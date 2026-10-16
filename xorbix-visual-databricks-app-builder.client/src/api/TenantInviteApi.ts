import type {
  ICreateInvitesRequest,
  ICreateInvitesResponse,
  IInviteValidationResponse,
  IPriorMemberChoiceRequest,
  IPriorMemberChoiceResponse,
  IRegisterAndAcceptInviteRequest,
  IRegisterAndAcceptInviteResponse,
  ITenantInvite,
} from "../models";
import { BaseApi } from "../providers/BaseApi";

export class TenantInviteApi extends BaseApi {
  async listPending(): Promise<ITenantInvite[]> {
    return this.get<ITenantInvite[]>("/api/Tenant/invites");
  }

  async createInvites(
    request: ICreateInvitesRequest,
  ): Promise<ICreateInvitesResponse> {
    return this.post<ICreateInvitesResponse>("/api/Tenant/invites", request);
  }

  async confirmPriorMemberChoice(
    request: IPriorMemberChoiceRequest,
  ): Promise<IPriorMemberChoiceResponse> {
    return this.post<IPriorMemberChoiceResponse>(
      "/api/Tenant/invites/prior-member-choice",
      request,
    );
  }

  async cancelInvite(inviteId: string): Promise<void> {
    await this.delete<void>(`/api/Tenant/invites/${inviteId}`);
  }

  async resendInvite(inviteId: string): Promise<ITenantInvite> {
    return this.post<ITenantInvite>(`/api/Tenant/invites/${inviteId}/resend`);
  }

  async validateToken(token: string): Promise<IInviteValidationResponse> {
    return this.get<IInviteValidationResponse>(
      `/api/Tenant/invites/validate?token=${encodeURIComponent(token)}`,
    );
  }

  async acceptInvite(token: string): Promise<void> {
    await this.post<void>("/api/Tenant/invites/accept", { token });
  }

  async registerAndAcceptInvite(
    request: IRegisterAndAcceptInviteRequest,
  ): Promise<IRegisterAndAcceptInviteResponse> {
    return this.post<IRegisterAndAcceptInviteResponse>(
      "/api/Tenant/invites/register-and-accept",
      request,
    );
  }
}

export const tenantInviteApi = new TenantInviteApi();
