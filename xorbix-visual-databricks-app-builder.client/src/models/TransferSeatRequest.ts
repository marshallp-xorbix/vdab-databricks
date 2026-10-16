export interface ITransferSeatRequest {
  newUserId: string;
}

export class TransferSeatRequest implements ITransferSeatRequest {
  newUserId: string = "";

  constructor(init?: Partial<ITransferSeatRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
