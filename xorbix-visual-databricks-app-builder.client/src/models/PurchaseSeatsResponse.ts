import type { ISeat } from "./Seat";
import { Seat } from "./Seat";
import type { ISeatPreview } from "./SeatPreview";
import { SeatPreview } from "./SeatPreview";

export interface IPurchaseSeatsResponse {
  seats: ISeat[];
  prorationPreview: ISeatPreview;
}

export class PurchaseSeatsResponse implements IPurchaseSeatsResponse {
  seats: Seat[] = [];
  prorationPreview: SeatPreview = new SeatPreview();

  constructor(init?: Partial<IPurchaseSeatsResponse>) {
    if (init) {
      Object.assign(this, init);

      if (init.seats) {
        this.seats = init.seats.map((seat) => new Seat(seat));
      }

      if (init.prorationPreview) {
        this.prorationPreview = new SeatPreview(init.prorationPreview);
      }
    }
  }
}
