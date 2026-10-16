import { ComponentType } from "../types/components/componentTypes";

export interface IUpsertAppComponentRequest {
  appId?: number;
  id?: number;
  frontendId?: string;
  codeName?: string;
  description?: string;
  componentType: ComponentType;
  componentVersion: number;
  properties: string; // JSON string
  bindings?: string; // JSON string
  children?: string; // JSON string
  layout?: string; // JSON string
}

export class UpsertAppComponentRequest implements IUpsertAppComponentRequest {
  appId?: number;
  id?: number;
  frontendId?: string;
  codeName?: string;
  description?: string;
  componentType: ComponentType = ComponentType.TextInput;
  componentVersion: number = 0;
  properties: string = ""; // JSON string
  bindings?: string; // JSON string
  children?: string; // JSON string
  layout?: string; // JSON string

  constructor(init?: Partial<IUpsertAppComponentRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
