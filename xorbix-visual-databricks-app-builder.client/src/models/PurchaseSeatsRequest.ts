export interface IPurchaseSeatsRequest {
  count: number;
}

export class PurchaseSeatsRequest implements IPurchaseSeatsRequest {
  count: number = 1;

  constructor(init?: Partial<IPurchaseSeatsRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
