import type { ITenantInvite } from "./TenantInvite";
import type { ITenantMemberRoleResponse } from "./TenantMemberRoleResponse";

export enum InviteOutcome {
  Created = "created",
  AlreadyPending = "alreadyPending",
  AlreadyMember = "alreadyMember",
  Invalid = "invalid",
  PriorMemberChoiceRequired = "priorMemberChoiceRequired",
}

export enum PriorMemberChoice {
  ReAdd = "reAdd",
  DifferentPerson = "differentPerson",
}

export interface IPriorMemberPrompt {
  displayName: string;
  email: string;
  removedOn: string | Date;
  priorRole: string;
  allowDifferentPerson: boolean;
  otherTenantsHaveEndedMemberships: boolean;
}

export interface IInviteResultDto {
  email: string;
  outcome: InviteOutcome;
  invite?: ITenantInvite;
  message?: string;
  priorMember?: IPriorMemberPrompt;
}

export interface ICreateInvitesResponse {
  results: IInviteResultDto[];
  seatOverageCount: number;
  availableSeats: number;
}

export interface IPriorMemberChoiceRequest {
  email: string;
  choice: PriorMemberChoice;
}

export interface IPriorMemberChoiceResponse {
  choice: PriorMemberChoice;
  restoredMembership?: ITenantMemberRoleResponse;
  inviteResponse?: ICreateInvitesResponse;
}
