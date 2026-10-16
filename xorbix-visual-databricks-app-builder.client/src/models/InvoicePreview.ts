import { parseApiDate } from "../lib/utils";
import type { IInvoiceLineItem } from "./InvoiceLineItem";
import { InvoiceLineItem } from "./InvoiceLineItem";

export interface IInvoicePreview {
  amount: number;
  currency: string;
  lineItems: IInvoiceLineItem[];
  prorationDate: string | Date;
}

export class InvoicePreview implements IInvoicePreview {
  amount: number = 0;
  currency: string = "";
  lineItems: InvoiceLineItem[] = [];
  prorationDate: Date = new Date();

  constructor(init?: Partial<IInvoicePreview>) {
    if (init) {
      Object.assign(this, init);

      if (init.lineItems) {
        this.lineItems = init.lineItems.map(
          (lineItem) => new InvoiceLineItem(lineItem),
        );
      }

      if (init.prorationDate) {
        this.prorationDate = parseApiDate(init.prorationDate);
      }
    }
  }
}
