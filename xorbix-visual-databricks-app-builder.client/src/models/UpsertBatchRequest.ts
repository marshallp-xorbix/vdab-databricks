import type { IUpsertAppComponentRequest } from "./UpsertAppComponentRequest";

export interface IUpsertBatchRequest {
  appId: number;
  components: IUpsertAppComponentRequest[];
}

export class UpsertBatchRequest implements IUpsertBatchRequest {
  appId: number = 0;
  components: IUpsertAppComponentRequest[] = [];

  constructor(init?: Partial<IUpsertBatchRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
