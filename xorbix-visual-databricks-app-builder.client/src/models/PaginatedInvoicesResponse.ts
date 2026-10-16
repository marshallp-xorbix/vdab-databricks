import type { IInvoice } from "./Invoice";
import { Invoice } from "./Invoice";

export interface IPaginatedInvoicesResponse {
  invoices: IInvoice[];
  skip: number;
  take: number;
  hasMore: boolean;
}

export class PaginatedInvoicesResponse implements IPaginatedInvoicesResponse {
  invoices: Invoice[] = [];
  skip: number = 0;
  take: number = 25;
  hasMore: boolean = false;

  constructor(init?: Partial<IPaginatedInvoicesResponse>) {
    if (init) {
      Object.assign(this, init);

      if (init.invoices) {
        this.invoices = init.invoices.map((invoice) => new Invoice(invoice));
      }
    }
  }
}
