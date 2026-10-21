import {
  ProjectCollaborator,
  type IProjectCollaborator,
} from "../models/ProjectCollaborator";

/** Lists editor grants for a project owner or installation recovery admin. */
export async function listProjectCollaborators(
  projectId: string,
  signal?: AbortSignal,
): Promise<IProjectCollaborator[]> {
  const response = await fetch(`${collaboratorsPath(projectId)}`, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return parseCollaborators(await response.json());
}

/** Revokes one VDAB project editor grant without changing Databricks permissions. */
export async function revokeProjectCollaborator(
  projectId: string,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${collaboratorsPath(projectId)}/${encodeURIComponent(userId)}`,
    { method: "DELETE", credentials: "same-origin" },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status !== 204) {
    throw new Error("The collaborator service returned an invalid response.");
  }
}

function collaboratorsPath(projectId: string): string {
  return `/api/v1/projects/${encodeURIComponent(projectId)}/collaborators`;
}

function parseCollaborators(value: unknown): IProjectCollaborator[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("The collaborator service returned an invalid response.");
  }

  return value.items.map((item: unknown) => {
    if (
      !isRecord(item) ||
      typeof item.userId !== "string" ||
      item.role !== "editor" ||
      typeof item.grantedBy !== "string" ||
      typeof item.createdAt !== "string"
    ) {
      throw new Error("The collaborator service returned an invalid grant.");
    }

    return new ProjectCollaborator({
      userId: item.userId,
      role: item.role,
      grantedBy: item.grantedBy,
      createdAt: item.createdAt,
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    // Fall through to a status-only message.
  }

  return `The collaborator service returned ${response.status}.`;
}
