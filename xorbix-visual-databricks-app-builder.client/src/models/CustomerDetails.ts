export interface ICustomerDetails {
  invoiceName: string;
  invoiceEmail: string;
}

export class CustomerDetails implements ICustomerDetails {
  invoiceName: string = "";
  invoiceEmail: string = "";

  constructor(init?: Partial<ICustomerDetails>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
