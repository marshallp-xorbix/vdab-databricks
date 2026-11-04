import type {
  CallerIdentity,
  ProjectCollaborator,
  ProjectSummary,
} from "../contracts.ts";
import { PROJECT_COLLABORATOR_DIRECTORY_UNAVAILABLE_CODE } from "../contracts.ts";
import { ApplicationError } from "../application-error.ts";
import { readProjectDeploymentSettings } from "../project-deployment-settings.ts";
import type { ProjectActor, ProjectRepository } from "./project-repository.ts";
import type { ProjectMetadata } from "./project-repository.ts";

const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_PROJECT_DESCRIPTION_LENGTH = 2000;
const PROJECT_THEME_COLOR_KEYS = [
  "primaryColor",
  "backgroundColor",
  "secondaryBackgroundColor",
  "textColor",
] as const;
const PROJECT_THEME_PAGE_WIDTH_KEY = "pageWidth";
const MIN_PROJECT_PAGE_WIDTH = 730;
const MAX_PROJECT_PAGE_WIDTH = 1800;
const MIN_USER_ID_LENGTH = 3;
const MAX_USER_ID_LENGTH = 255;

/** Coordinates project validation and creator/collaborator ACL operations. */
export class ProjectService {
  private readonly repository: ProjectRepository;
  private readonly workspaceId: string;

  constructor(repository: ProjectRepository, workspaceId: string) {
    this.repository = repository;
    this.workspaceId = workspaceId;
  }

  async createProject(
    caller: CallerIdentity,
    requestId: string,
    body: unknown,
  ): Promise<ProjectSummary> {
    const projectInput = readProjectInput(body);

    return this.repository.createProject({
      workspaceId: this.workspaceId,
      actorId: caller.userId,
      name: projectInput.name,
      description: projectInput.description,
      deploymentSettings: readProjectDeploymentSettings((body as Record<string, unknown>).deploymentSettings),
      requestId,
    });
  }

  async listProjects(
    caller: CallerIdentity,
    requestId: string,
  ): Promise<ProjectSummary[]> {
    return this.repository.listProjects(
      toProjectActor(caller, this.workspaceId, requestId),
    );
  }

  async getProject(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectSummary> {
    const project = await this.repository.getProject(
      projectId,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!project) {
      throw projectNotFound();
    }

    return project;
  }

  async updateProject(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<ProjectSummary> {
    const metadata = readProjectMetadata(body);
    const project = await this.repository.updateProject(
      projectId,
      metadata,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!project) {
      throw projectNotFound();
    }

    return project;
  }

  /** Removes a project from active access for its owner or installation admin. */
  async deleteProject(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<void> {
    const wasDeleted = await this.repository.deleteProject(
      projectId,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!wasDeleted) {
      throw projectNotFound();
    }
  }

  async listCollaborators(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
  ): Promise<ProjectCollaborator[]> {
    const collaborators = await this.repository.listCollaborators(
      projectId,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!collaborators) {
      throw projectNotFound();
    }

    return collaborators;
  }

  async grantEditor(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    body: unknown,
  ): Promise<void> {
    if (caller.authenticationMode === "databricks") {
      throw new ApplicationError(
        501,
        PROJECT_COLLABORATOR_DIRECTORY_UNAVAILABLE_CODE,
        "Collaborator selection unavailable",
        "Project access cannot be granted until a supported Databricks identity selection flow is available.",
      );
    }

    const collaboratorId = readCollaboratorId(body);

    if (collaboratorId === caller.userId) {
      throw new ApplicationError(
        400,
        "invalid_collaborator",
        "Invalid collaborator",
        "A project creator cannot add themselves as a collaborator.",
      );
    }

    const wasGranted = await this.repository.grantEditor(
      projectId,
      collaboratorId,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!wasGranted) {
      throw projectNotFound();
    }
  }

  async removeEditor(
    caller: CallerIdentity,
    requestId: string,
    projectId: string,
    collaboratorId: string,
  ): Promise<void> {
    const normalizedCollaboratorId = readCollaboratorPathId(collaboratorId);

    const wasAuthorized = await this.repository.removeEditor(
      projectId,
      normalizedCollaboratorId,
      toProjectActor(caller, this.workspaceId, requestId),
    );

    if (!wasAuthorized) {
      throw projectNotFound();
    }

    if (normalizedCollaboratorId === caller.userId) {
      throw new ApplicationError(
        400,
        "invalid_collaborator",
        "Invalid collaborator",
        "A project owner cannot remove their own project access.",
      );
    }
  }
}

function toProjectActor(
  caller: CallerIdentity,
  workspaceId: string,
  requestId: string,
): ProjectActor {
  return {
    workspaceId,
    userId: caller.userId,
    isInstallationAdmin: caller.isInstallationAdmin,
    requestId,
  };
}

function readProjectInput(value: unknown): {
  name: string;
  description: string | null;
} {
  if (
    !isRecord(value) ||
    hasUnexpectedProperties(value, ["name", "description", "deploymentSettings"])
  ) {
    throw invalidProjectInput();
  }

  const name = readRequiredText(value.name, MAX_PROJECT_NAME_LENGTH);
  const description =
    value.description === undefined || value.description === null
      ? null
      : readOptionalText(value.description, MAX_PROJECT_DESCRIPTION_LENGTH);

  return { name, description };
}

function readProjectMetadata(value: unknown): ProjectMetadata {
  if (
    !isRecord(value) ||
    hasUnexpectedProperties(value, ["name", "description", "version", "theme", "deploymentSettings"]) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1
  ) {
    throw invalidProjectInput();
  }

  const projectInput = readProjectInput({
    name: value.name,
    description: value.description,
  });

  return {
    ...projectInput,
    expectedVersion: value.version as number,
    ...(Object.hasOwn(value, "theme") ? { theme: readProjectTheme(value.theme) } : {}),
    ...(Object.hasOwn(value, "deploymentSettings") ? { deploymentSettings: readProjectDeploymentSettings(value.deploymentSettings) } : {}),
  };
}

function readProjectTheme(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  if (!isRecord(value)) throw invalidProjectInput();
  const allowedKeys = new Set<string>([
    ...PROJECT_THEME_COLOR_KEYS,
    PROJECT_THEME_PAGE_WIDTH_KEY,
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    throw invalidProjectInput();
  }
  for (const key of PROJECT_THEME_COLOR_KEYS) {
    const color = value[key];
    if (color !== undefined && (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) {
      throw invalidProjectInput();
    }
  }
  const pageWidth = value[PROJECT_THEME_PAGE_WIDTH_KEY];
  if (pageWidth !== undefined) {
    const parsedWidth = typeof pageWidth === "number" ? pageWidth : Number(pageWidth);
    if (
      !Number.isInteger(parsedWidth) ||
      parsedWidth < MIN_PROJECT_PAGE_WIDTH ||
      parsedWidth > MAX_PROJECT_PAGE_WIDTH
    ) {
      throw invalidProjectInput();
    }
  }
  return value;
}

function readCollaboratorId(value: unknown): string {
  if (!isRecord(value) || hasUnexpectedProperties(value, ["userId"])) {
    throw new ApplicationError(
      400,
      "invalid_collaborator",
      "Invalid collaborator",
      "Provide a valid Databricks user ID.",
    );
  }

  const userId = readRequiredText(value.userId, MAX_USER_ID_LENGTH);

  if (userId.length < MIN_USER_ID_LENGTH) {
    throw new ApplicationError(
      400,
      "invalid_collaborator",
      "Invalid collaborator",
      "Provide a valid Databricks user ID.",
    );
  }

  return userId;
}

function readCollaboratorPathId(value: string): string {
  const userId = readRequiredText(value, MAX_USER_ID_LENGTH);

  if (userId.length < MIN_USER_ID_LENGTH) {
    throw new ApplicationError(
      400,
      "invalid_collaborator",
      "Invalid collaborator",
      "Provide a valid Databricks user ID.",
    );
  }

  return userId;
}

function readRequiredText(value: unknown, maximumLength: number): string {
  if (typeof value !== "string") {
    throw invalidProjectInput();
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0 || normalizedValue.length > maximumLength) {
    throw invalidProjectInput();
  }

  return normalizedValue;
}

function readOptionalText(
  value: unknown,
  maximumLength: number,
): string | null {
  if (typeof value !== "string") {
    throw invalidProjectInput();
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maximumLength) {
    throw invalidProjectInput();
  }

  return normalizedValue.length > 0 ? normalizedValue : null;
}

function hasUnexpectedProperties(
  value: Record<string, unknown>,
  allowedProperties: string[],
): boolean {
  return Object.keys(value).some(
    (propertyName) => !allowedProperties.includes(propertyName),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidProjectInput(): ApplicationError {
  return new ApplicationError(
    400,
    "invalid_project",
    "Invalid project",
    `Provide a project name up to ${MAX_PROJECT_NAME_LENGTH} characters and an optional description up to ${MAX_PROJECT_DESCRIPTION_LENGTH} characters.`,
  );
}

function projectNotFound(): ApplicationError {
  return new ApplicationError(
    404,
    "project_not_found",
    "Project not found",
    "The requested project does not exist or is not available to you.",
  );
}
