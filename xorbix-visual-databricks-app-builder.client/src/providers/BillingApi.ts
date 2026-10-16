import { BaseApi } from "./BaseApi";
import {
  ApiError,
  BetaCodeValidation,
  BillingStatus,
  CustomerDetails,
  InvoicePreview,
  PaginatedInvoicesResponse,
  PaymentMethod,
  Plan,
  PurchaseSeatsResponse,
  Seat,
  SeatPreview,
  SeatSummary,
  SetupIntent,
  Subscription,
  SubscriptionHistory,
  PromoCodeValidation,
  type IAssignSeatRequest,
  type IBetaCodeValidation,
  type IBillingStatus,
  type ICustomerDetails,
  type ISubscriptionRequest,
  type IFluentError,
  type IInvoicePreview,
  type IPaginatedInvoicesResponse,
  type IPaymentMethod,
  type IPlan,
  type IProblemDetails,
  type IPurchaseSeatsRequest,
  type IRedeemBetaCodeRequest,
  type IPurchaseSeatsResponse,
  type IRemoveSeatsRequest,
  type ISeat,
  type ISeatPreview,
  type ISeatSummary,
  type ISetupIntent,
  type ISubscription,
  type ISubscriptionHistory,
  type IValidatePromoCodeRequest,
  type IPromoCodeValidation,
  type ITransferSeatRequest,
} from "../models";

export type BillingApiErrorPayload =
  | string
  | IProblemDetails
  | IFluentError[]
  | Record<string, unknown>
  | null
  | undefined;

export interface IBillingApiError {
  message: string;
  status: number;
  data: BillingApiErrorPayload;
}

export function toBillingApiError(error: unknown): IBillingApiError | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  return {
    message: error.message,
    status: error.status,
    data: error.data as BillingApiErrorPayload,
  };
}

/**
 * API client for billing, subscription, and seat management endpoints.
 */
export class BillingApi extends BaseApi {
  async getPlans(): Promise<Plan[]> {
    const data = await this.get<IPlan[]>("/api/Billing/plans");
    return data.map((plan) => new Plan(plan));
  }

  async getStatus(): Promise<BillingStatus> {
    const data = await this.get<IBillingStatus>("/api/Billing/status");
    return new BillingStatus(data);
  }

  async getCustomerDetails(): Promise<CustomerDetails> {
    const data = await this.get<ICustomerDetails>(
      "/api/Billing/customer-details",
    );
    return new CustomerDetails(data);
  }

  async updateCustomerDetails(
    request: ICustomerDetails,
  ): Promise<CustomerDetails> {
    const data = await this.put<ICustomerDetails>(
      "/api/Billing/customer-details",
      request,
    );
    return new CustomerDetails(data);
  }

  async getPublishableKey(): Promise<string> {
    return this.get<string>("/api/Billing/publishable-key");
  }

  async createSetupIntent(): Promise<SetupIntent> {
    const data = await this.post<ISetupIntent>("/api/Billing/setup-intent");
    return new SetupIntent(data);
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await this.get<IPaymentMethod[]>(
      "/api/Billing/payment-methods",
    );
    return data.map((paymentMethod) => new PaymentMethod(paymentMethod));
  }

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.post<void>(
      `/api/Billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`,
    );
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    await this.delete<void>(
      `/api/Billing/payment-methods/${encodeURIComponent(paymentMethodId)}`,
    );
  }

  async getSubscription(): Promise<Subscription> {
    const data = await this.get<ISubscription>("/api/Billing/subscription");
    return new Subscription(data);
  }

  async validatePromoCode(
    request: IValidatePromoCodeRequest,
  ): Promise<PromoCodeValidation> {
    const data = await this.post<IPromoCodeValidation>(
      "/api/Billing/promo-codes/validate",
      request,
    );
    return new PromoCodeValidation(data);
  }

  async validateBetaCode(code: string): Promise<BetaCodeValidation> {
    const data = await this.post<IBetaCodeValidation>(
      "/api/Billing/beta-codes/validate",
      { code },
    );
    return new BetaCodeValidation(data);
  }

  async createBetaSubscription(
    request: IRedeemBetaCodeRequest,
  ): Promise<Subscription> {
    const data = await this.post<ISubscription>(
      "/api/Billing/subscription/beta",
      request,
    );
    return new Subscription(data);
  }

  async createSubscription(
    request: ISubscriptionRequest,
  ): Promise<Subscription> {
    const data = await this.post<ISubscription>(
      "/api/Billing/subscription",
      request,
    );
    return new Subscription(data);
  }

  async updateSubscription(
    request: ISubscriptionRequest,
  ): Promise<Subscription> {
    const data = await this.put<ISubscription>(
      "/api/Billing/subscription",
      request,
    );
    return new Subscription(data);
  }

  async cancelSubscription(immediate: boolean = false): Promise<Subscription> {
    const params = new URLSearchParams({ immediate: immediate.toString() });
    const data = await this.delete<ISubscription>(
      `/api/Billing/subscription?${params.toString()}`,
    );
    return new Subscription(data);
  }

  async reactivateSubscription(): Promise<Subscription> {
    const data = await this.post<ISubscription>(
      "/api/Billing/subscription/reactivate",
    );
    return new Subscription(data);
  }

  async previewTierChange(newTier: string): Promise<InvoicePreview> {
    const params = new URLSearchParams({ newTier });
    const data = await this.get<IInvoicePreview>(
      `/api/Billing/subscription/preview?${params.toString()}`,
    );
    return new InvoicePreview(data);
  }

  async getSeats(): Promise<Seat[]> {
    const data = await this.get<ISeat[]>("/api/Billing/seats");
    return data.map((seat) => new Seat(seat));
  }

  async getSeatsForTenant(tenantId: string): Promise<Seat[]> {
    const data = await this.get<ISeat[]>(
      `/api/Billing/tenants/${encodeURIComponent(tenantId)}/seats`,
    );
    return data.map((seat) => new Seat(seat));
  }

  async getSeatSummary(): Promise<SeatSummary> {
    const data = await this.get<ISeatSummary>("/api/Billing/seats/summary");
    return new SeatSummary(data);
  }

  async purchaseSeats(
    request: IPurchaseSeatsRequest,
  ): Promise<PurchaseSeatsResponse> {
    const data = await this.post<IPurchaseSeatsResponse>(
      "/api/Billing/seats/purchase",
      request,
    );
    return new PurchaseSeatsResponse(data);
  }

  async removeSeats(request: IRemoveSeatsRequest): Promise<Seat[]> {
    const data = await this.post<ISeat[]>("/api/Billing/seats/remove", request);
    return data.map((seat) => new Seat(seat));
  }

  async previewSeatChange(change: number): Promise<SeatPreview> {
    const params = new URLSearchParams({ change: change.toString() });
    const data = await this.get<ISeatPreview>(
      `/api/Billing/seats/preview?${params.toString()}`,
    );
    return new SeatPreview(data);
  }

  async assignSeat(seatId: string, request: IAssignSeatRequest): Promise<Seat> {
    const data = await this.post<ISeat>(
      `/api/Billing/seats/${encodeURIComponent(seatId)}/assign`,
      request,
    );
    return new Seat(data);
  }

  async unassignSeat(
    seatId: string,
    cancelSeat: boolean = false,
  ): Promise<Seat> {
    const params = new URLSearchParams({ cancelSeat: cancelSeat.toString() });
    const data = await this.post<ISeat>(
      `/api/Billing/seats/${encodeURIComponent(seatId)}/unassign?${params.toString()}`,
    );
    return new Seat(data);
  }

  async transferSeat(
    seatId: string,
    request: ITransferSeatRequest,
  ): Promise<Seat> {
    const data = await this.post<ISeat>(
      `/api/Billing/seats/${encodeURIComponent(seatId)}/transfer`,
      request,
    );
    return new Seat(data);
  }

  async removeUserFromSeat(seatId: string): Promise<Seat> {
    const data = await this.post<ISeat>(
      `/api/Billing/seats/${encodeURIComponent(seatId)}/remove-user`,
    );
    return new Seat(data);
  }

  async removeSeat(seatId: string): Promise<Seat> {
    const data = await this.post<ISeat>(
      `/api/Billing/seats/${encodeURIComponent(seatId)}/remove-seat`,
    );
    return new Seat(data);
  }

  async getInvoices(
    skip: number = 0,
    take: number = 25,
  ): Promise<PaginatedInvoicesResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      take: take.toString(),
    });

    const data = await this.get<IPaginatedInvoicesResponse>(
      `/api/Billing/invoices?${params.toString()}`,
    );
    return new PaginatedInvoicesResponse(data);
  }

  async getInvoicesForTenant(
    tenantId: string,
    skip: number = 0,
    take: number = 25,
  ): Promise<PaginatedInvoicesResponse> {
    const params = new URLSearchParams({
      skip: skip.toString(),
      take: take.toString(),
    });

    const data = await this.get<IPaginatedInvoicesResponse>(
      `/api/Billing/tenants/${encodeURIComponent(tenantId)}/invoices?${params.toString()}`,
    );
    return new PaginatedInvoicesResponse(data);
  }

  async getSubscriptionHistoryForTenant(
    tenantId: string,
  ): Promise<SubscriptionHistory[]> {
    const records = await this.get<ISubscriptionHistory[]>(
      `/api/Billing/tenants/${encodeURIComponent(tenantId)}/subscription-history`,
    );
    return records.map((record) => new SubscriptionHistory(record));
  }

  async getUpcomingInvoice(): Promise<InvoicePreview> {
    const data = await this.get<IInvoicePreview>(
      "/api/Billing/invoices/upcoming",
    );
    return new InvoicePreview(data);
  }
}

export const billingApi = new BillingApi();
