export interface IPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export class PaymentMethod implements IPaymentMethod {
  id: string = "";
  brand: string = "";
  last4: string = "";
  expMonth: number = 0;
  expYear: number = 0;
  isDefault: boolean = false;

  constructor(init?: Partial<IPaymentMethod>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
