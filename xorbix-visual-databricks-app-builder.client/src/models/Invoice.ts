import { parseApiDate } from "../lib/utils";

export interface IInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: string | Date;
  pdfUrl?: string;
  hostedInvoiceUrl?: string;
}

export class Invoice implements IInvoice {
  id: string = "";
  amount: number = 0;
  currency: string = "";
  status: string = "";
  created: Date = new Date();
  pdfUrl?: string;
  hostedInvoiceUrl?: string;

  constructor(init?: Partial<IInvoice>) {
    if (init) {
      Object.assign(this, init);

      if (init.created) {
        this.created = parseApiDate(init.created);
      }
    }
  }
}
