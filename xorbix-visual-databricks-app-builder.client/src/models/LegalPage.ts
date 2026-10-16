/**
 * Sanitized legal page content from the VDAB API (sourced from WordPress).
 */
export interface ILegalPage {
  slug: string;
  htmlContent: string;
}

export class LegalPage implements ILegalPage {
  slug: string = "";
  htmlContent: string = "";

  constructor(init?: Partial<ILegalPage>) {
    if (!init) return;
    Object.assign(this, init);
  }
}
