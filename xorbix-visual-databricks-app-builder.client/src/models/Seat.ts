import { parseApiDate } from "../lib/utils";

export interface ISeat {
  seatId: string;
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  status: string;
  isBundled: boolean;
  seatStartDate: string | Date;
  seatEndDate?: string | Date;
  assignedAt?: string | Date;
  canceledAt?: string | Date;
}

export class Seat implements ISeat {
  seatId: string = "";
  userId?: string;
  userEmail?: string;
  userDisplayName?: string;
  status: string = "";
  isBundled: boolean = false;
  seatStartDate: Date = new Date();
  seatEndDate?: Date;
  assignedAt?: Date;
  canceledAt?: Date;

  constructor(init?: Partial<ISeat>) {
    if (init) {
      Object.assign(this, init);

      if (init.seatStartDate) {
        this.seatStartDate = parseApiDate(init.seatStartDate);
      }
      if (init.seatEndDate) {
        this.seatEndDate = parseApiDate(init.seatEndDate);
      }
      if (init.assignedAt) {
        this.assignedAt = parseApiDate(init.assignedAt);
      }
      if (init.canceledAt) {
        this.canceledAt = parseApiDate(init.canceledAt);
      }
    }
  }
}
