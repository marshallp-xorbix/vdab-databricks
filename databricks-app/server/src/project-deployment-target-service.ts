import type { CallerIdentity, WorkspaceAppResource } from "./contracts.ts";
import { MAX_APPS_PER_WORKSPACE } from "./contracts.ts";
import type {
  ProjectChildAppRecord,
  ProjectDeploymentRecord,
} from "./db/project-deployment-repository.ts";
import {
  containsWorkspaceAppResources,
  hasExactWorkspaceAppResources,
} from "./workspace-app-resource-validation.ts";
import type {
  WorkspaceAppDeploymentClient,
  WorkspaceAppDetails,
} from "./workspace-app-deployment-client.ts";
import {
  childAppIdentityChanged,
  childAppIdentityUnavailable,
  childAppMarkerMissing,
  childAppMissing,
  childAppNameConflict,
  childAppScopePolicyUnavailable,
  childAppSpaceMismatch,
  gitSourceNotSupported,
  missingChildAppResources,
  missingChildAppScopes,
  overwriteConfirmationRequired,
  workspaceAppLimitReached,
} from "./project-deployment-service-errors.ts";

interface EnsuredTargetApp {
  app: WorkspaceAppDetails;
  auditAction:
    | "deployment.app.created"
    | "deployment.app.recovered"
    | "deployment.app.linked"
    | null;
}

/** Handles the target-App preflight and recovery rules for deployment. */
export class ProjectDeploymentTargetService {
  private readonly workspaceClient: WorkspaceAppDeploymentClient;

  constructor(workspaceClient: WorkspaceAppDeploymentClient) {
    this.workspaceClient = workspaceClient;
  }

  /** Validates a new or explicitly linked target before persisting a deploy. */
  async validateInitialTarget(
    caller: CallerIdentity,
    mode: "createNew" | "linkExisting",
    appName: string,
    confirmOverwrite: boolean,
    requiredScopes: string[],
    requiredResources: WorkspaceAppResource[],
    expectedAppSpaceName: string | null,
    existingApp?: WorkspaceAppDetails | null,
  ): Promise<void> {
    const existing =
      mode === "linkExisting" && existingApp !== undefined
        ? existingApp
        : await this.workspaceClient.getApp(caller, appName);
    if (mode === "createNew") {
      if (existing) throw childAppNameConflict();
      if (
        (await this.workspaceClient.countApps(caller)) >= MAX_APPS_PER_WORKSPACE
      ) {
        throw workspaceAppLimitReached();
      }
      return;
    }
    if (!confirmOverwrite) throw overwriteConfirmationRequired();
    if (!existing) throw childAppMissing();
    this.validateExistingApp(
      existing,
      requiredScopes,
      requiredResources,
      existing.appId,
      expectedAppSpaceName,
    );
    if (!hasExactWorkspaceAppResources(existing.resources, requiredResources)) {
      throw missingChildAppResources();
    }
  }

  /** Reads and validates an existing linked target as the acting caller. */
  async requireExistingApp(
    caller: CallerIdentity,
    appName: string,
  ): Promise<WorkspaceAppDetails> {
    const app = await this.workspaceClient.getApp(caller, appName);
    if (!app) throw childAppMissing();
    return app;
  }

  /** Reads the current target for a project create, link, or redeploy request. */
  async getCurrentTargetApp(
    caller: CallerIdentity,
    appName: string,
    mode: "createNew" | "linkExisting",
    childApp: ProjectChildAppRecord | null,
  ): Promise<WorkspaceAppDetails | null> {
    if (!childApp && mode === "createNew") return null;
    if (childApp?.mode === "createNew" && !childApp.appId) {
      return this.workspaceClient.getApp(caller, appName);
    }
    return this.requireExistingApp(caller, appName);
  }

  /** Verifies the target identity, scopes, source mode, and resource set. */
  validateExistingApp(
    app: WorkspaceAppDetails,
    requiredScopes: string[],
    requiredResources: WorkspaceAppResource[],
    expectedAppId: string | null,
    expectedAppSpaceName: string | null,
  ): void {
    if (!app.appId) throw childAppIdentityUnavailable();
    if (app.usesGitSource) throw gitSourceNotSupported();
    if (expectedAppId && app.appId !== expectedAppId)
      throw childAppIdentityChanged();
    if (app.spaceName !== expectedAppSpaceName)
      throw childAppSpaceMismatch(expectedAppSpaceName);
    if (app.spaceName && app.effectiveUserApiScopes === null)
      throw childAppScopePolicyUnavailable();
    const missingScopes = requiredScopes.filter(
      (scope) =>
        !(app.effectiveUserApiScopes ?? app.userApiScopes).includes(scope),
    );
    if (missingScopes.length > 0) throw missingChildAppScopes(missingScopes);
    if (!containsWorkspaceAppResources(app.resources, requiredResources)) {
      throw missingChildAppResources();
    }
  }

  /** Creates or recovers a child App from the immutable deployment marker. */
  async ensureTargetApp(
    caller: CallerIdentity,
    record: ProjectDeploymentRecord,
    createMarker: string | null,
    appSpaceName: string | null,
  ): Promise<EnsuredTargetApp> {
    const existing = await this.workspaceClient.getApp(caller, record.appName);
    if (record.mode === "linkExisting") {
      if (!existing) throw childAppMissing();
      return {
        app: existing,
        auditAction: record.appId ? null : "deployment.app.linked",
      };
    }

    if (!createMarker) throw childAppMarkerMissing();
    if (existing) {
      if (existing.description !== createMarker) throw childAppNameConflict();
      return {
        app: existing,
        auditAction: record.appId ? null : "deployment.app.recovered",
      };
    }

    const created = await this.workspaceClient.createApp(
      caller,
      record.appName,
      createMarker,
      record.requiredUserApiScopes,
      record.requiredAppResources,
      appSpaceName,
    );
    if (!created.appId) {
      const recovered = await this.workspaceClient.getApp(
        caller,
        record.appName,
      );
      if (
        !recovered ||
        recovered.description !== createMarker ||
        !recovered.appId
      ) {
        throw childAppIdentityUnavailable();
      }
      return { app: recovered, auditAction: "deployment.app.recovered" };
    }
    return { app: created, auditAction: "deployment.app.created" };
  }
}
