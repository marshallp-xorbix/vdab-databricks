export interface IRemoveSeatsRequest {
  count: number;
}

export class RemoveSeatsRequest implements IRemoveSeatsRequest {
  count: number = 1;

  constructor(init?: Partial<IRemoveSeatsRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
