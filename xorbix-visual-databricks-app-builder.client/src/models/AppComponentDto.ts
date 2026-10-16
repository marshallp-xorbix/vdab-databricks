import { ComponentType } from "../types/components/componentTypes";
import { parseApiDate } from "../lib/utils";

export interface IAppComponentDto {
  id: number;
  appId: number;
  frontendId?: string;
  codeName?: string;
  description?: string;
  componentType: ComponentType;
  componentVersion: number;
  properties: string; // JSON string
  bindings?: string; // JSON string
  children?: string; // JSON string
  layout?: string; // JSON string
  createdOn: string | Date;
  createdBy?: number;
  modifiedOn?: string | Date;
  modifiedBy?: number;
  deletedOn?: string | Date;
  deletedBy?: number;
}

export class AppComponentDto implements IAppComponentDto {
  id: number = 0;
  appId: number = 0;
  frontendId?: string;
  codeName?: string;
  description?: string;
  componentType: ComponentType = ComponentType.TextInput;
  componentVersion: number = 0;
  properties: string = ""; // JSON string
  bindings?: string; // JSON string
  children?: string; // JSON string
  layout?: string; // JSON string
  createdOn: Date = new Date();
  createdBy?: number;
  modifiedOn?: Date;
  modifiedBy?: number;
  deletedOn?: Date;
  deletedBy?: number;

  constructor(init?: Partial<IAppComponentDto>) {
    if (init) {
      Object.assign(this, init);
      if (init.createdOn) this.createdOn = parseApiDate(init.createdOn);
      if (init.modifiedOn) this.modifiedOn = parseApiDate(init.modifiedOn);
      if (init.deletedOn) this.deletedOn = parseApiDate(init.deletedOn);
    }
  }
}
