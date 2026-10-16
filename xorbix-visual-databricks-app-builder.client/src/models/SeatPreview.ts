import { parseApiDate } from "../lib/utils";

export interface ISeatPreview {
  currentSeats: number;
  newSeats: number;
  proratedAmount: number;
  currency: string;
  effectiveDate: string | Date;
}

export class SeatPreview implements ISeatPreview {
  currentSeats: number = 0;
  newSeats: number = 0;
  proratedAmount: number = 0;
  currency: string = "";
  effectiveDate: Date = new Date();

  constructor(init?: Partial<ISeatPreview>) {
    if (init) {
      Object.assign(this, init);

      if (init.effectiveDate) {
        this.effectiveDate = parseApiDate(init.effectiveDate);
      }
    }
  }
}
