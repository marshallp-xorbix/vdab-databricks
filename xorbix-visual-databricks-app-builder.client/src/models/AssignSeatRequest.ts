export interface IAssignSeatRequest {
  userId: string;
}

export class AssignSeatRequest implements IAssignSeatRequest {
  userId: string = "";

  constructor(init?: Partial<IAssignSeatRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
