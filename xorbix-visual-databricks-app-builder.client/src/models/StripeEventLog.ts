import { parseApiDate } from "../lib/utils";

/**
 * Wire shape of a Stripe event log row as returned by
 * `GET /api/Management/stripe/event-logs`. Mirrors `StripeEventLogDto`.
 */
export interface IStripeEventLogDto {
  id: number;
  stripeEventId: string;
  eventType: string;
  processedAt: string | Date;
  success: boolean;
  errorMessage?: string | null;
  customerId?: string | null;
  detailSummary?: string | null;
}

/**
 * Class wrapper that parses `processedAt` into a Date on construction.
 */
export class StripeEventLogDto implements IStripeEventLogDto {
  id: number = 0;
  stripeEventId: string = "";
  eventType: string = "";
  processedAt: Date = new Date();
  success: boolean = false;
  errorMessage?: string | null;
  customerId?: string | null;
  detailSummary?: string | null;

  constructor(init?: Partial<IStripeEventLogDto>) {
    if (init) {
      Object.assign(this, init);
      if (init.processedAt) {
        this.processedAt = parseApiDate(init.processedAt);
      }
    }
  }
}

/**
 * Paginated envelope returned by `GET /api/Management/stripe/event-logs`.
 * Mirrors `PaginatedStripeEventLogsResponse`.
 */
export interface IPaginatedStripeEventLogsResponse {
  logs: IStripeEventLogDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}
