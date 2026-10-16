export interface IInvoiceLineItem {
  description: string;
  amount: number;
  currency: string;
  quantity: number;
}

export class InvoiceLineItem implements IInvoiceLineItem {
  description: string = "";
  amount: number = 0;
  currency: string = "";
  quantity: number = 0;

  constructor(init?: Partial<IInvoiceLineItem>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
