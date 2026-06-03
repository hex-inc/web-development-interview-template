import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import { SERVER, type CellData, type ServerApi } from "./api";

const SAVE_DEBOUNCE_MS = 250;

interface NotebookProps {
  server?: ServerApi;
}

export function Notebook({ server = SERVER }: NotebookProps) {
  const [cells, setCells] = useState<CellData[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingCellId, setSavingCellId] = useState<string | null>(null);
  const [failedCellId, setFailedCellId] = useState<string | null>(null);
  const cellsRef = useRef<CellData[]>([]);
  const hasUnsavedLocalChanges = useRef(false);
  const localChangeVersion = useRef(0);
  const saveTimeout = useRef<number>();

  const applyServerCells = useCallback((newCells: CellData[]) => {
    cellsRef.current = newCells;
    setCells(newCells);
  }, []);

  useEffect(() => {
    let isActive = true;

    const handleServerUpdate = (newCells: CellData[]) => {
      if (!hasUnsavedLocalChanges.current) {
        applyServerCells(newCells);
      }
    };

    server.getCells().then(
      (newCells) => {
        if (isActive && !hasUnsavedLocalChanges.current) {
          applyServerCells(newCells);
        }
      },
      () => {
        if (isActive) {
          setLoadError("Unable to load cells.");
        }
      },
    );

    server.subscribe(handleServerUpdate);

    return () => {
      isActive = false;
      server.unsubscribe(handleServerUpdate);
    };
  }, [applyServerCells, server]);

  useEffect(() => {
    return () => {
      window.clearTimeout(saveTimeout.current);
    };
  }, []);

  const syncCells = useCallback(
    (newCells: CellData[], changedCellId: string) => {
      cellsRef.current = newCells;
      setCells(newCells);
      setFailedCellId(null);
      setSavingCellId(changedCellId);
      hasUnsavedLocalChanges.current = true;

      localChangeVersion.current += 1;
      const changeVersion = localChangeVersion.current;

      window.clearTimeout(saveTimeout.current);
      saveTimeout.current = window.setTimeout(() => {
        server.updateCells(newCells).then(
          () => {
            if (changeVersion === localChangeVersion.current) {
              hasUnsavedLocalChanges.current = false;
              setSavingCellId(null);
            }
          },
          () => {
            if (changeVersion === localChangeVersion.current) {
              hasUnsavedLocalChanges.current = false;
              setSavingCellId(null);
              setFailedCellId(changedCellId);
            }
          },
        );
      }, SAVE_DEBOUNCE_MS);
    },
    [server],
  );

  const addEmptyCell = useCallback(() => {
    const newCell = {
      id: uuid(),
      text: "",
    };
    const newCells = [
      ...cellsRef.current,
      newCell,
    ];

    syncCells(newCells, newCell.id);
  }, [syncCells]);

  const updateCellText = useCallback(
    (id: string, text: string) => {
      const newCells = cellsRef.current.map((cell) =>
        cell.id === id
          ? {
              ...cell,
              text,
            }
          : cell,
      );

      syncCells(newCells, id);
    },
    [syncCells],
  );

  return (
    <div className="notebook">
      <h2>Notebook</h2>
      {loadError && <p role="alert">{loadError}</p>}
      <button type="button" onClick={addEmptyCell}>
        Add empty cell
      </button>
      <div className="cell-list">
        {cells.map((cell) => (
          <div className="cell" key={cell.id}>
            <textarea
              value={cell.text}
              onChange={(event) => updateCellText(cell.id, event.target.value)}
            />
            {savingCellId === cell.id && (
              <span className="cell-status" aria-label="Saving cell">
                ...
              </span>
            )}
            {failedCellId === cell.id && (
              <span
                className="cell-status cell-status-error"
                role="img"
                aria-label="Unable to save cell"
                title="Unable to save cell"
              >
                !
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
