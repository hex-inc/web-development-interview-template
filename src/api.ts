import { cloneDeep } from "lodash";
import { v4 as uuid } from "uuid";

export interface CellData {
  id: string;
  text: string;
}

export type Subscription = (newCells: CellData[]) => void;

export interface ServerApi {
  getCells: () => Promise<CellData[]>;

  updateCells: (newCells: CellData[]) => Promise<void>;

  subscribe: (callback: Subscription) => void;

  unsubscribe: (callback: Subscription) => void;
}

class DefaultServer implements ServerApi {
  private static FAILURE_PERCENT = 100;
  private static SERVER_DELAY_MS = 200;

  private cellData: CellData[] = [
    {
      id: uuid(),
      text: "hello world",
    },
  ];

  private subscriptions: Subscription[] = [];

  getCells(): Promise<CellData[]> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > DefaultServer.FAILURE_PERCENT / 100) {
          resolve(cloneDeep(this.cellData));
        } else {
          reject("Server error");
        }
      }, DefaultServer.SERVER_DELAY_MS);
    });
  }

  updateCells(newCells: CellData[]): Promise<void> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > DefaultServer.FAILURE_PERCENT / 100) {
          this.cellData = cloneDeep(newCells);
          this.subscriptions.forEach((subscription) =>
            subscription(this.cellData),
          );
          resolve();
        } else {
          reject("Server error");
        }
      }, DefaultServer.SERVER_DELAY_MS);
    });
  }

  subscribe(subscription: Subscription): void {
    this.subscriptions.push(subscription);
  }

  unsubscribe(subscription: Subscription): void {
    this.subscriptions = this.subscriptions.filter((s) => s !== subscription);
  }
}

export const SERVER = new DefaultServer();
