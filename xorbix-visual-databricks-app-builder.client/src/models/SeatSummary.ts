export interface ISeatSummary {
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  bundledSeats: number;
  extraSeats: number;
  pendingCancellationSeats: number;
}

export class SeatSummary implements ISeatSummary {
  totalSeats: number = 0;
  occupiedSeats: number = 0;
  availableSeats: number = 0;
  bundledSeats: number = 0;
  extraSeats: number = 0;
  pendingCancellationSeats: number = 0;

  constructor(init?: Partial<ISeatSummary>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
