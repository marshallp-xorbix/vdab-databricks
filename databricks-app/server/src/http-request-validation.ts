import { ApplicationError } from "./application-error.ts";

/** Parses one JSON request body after validating its declared media type. */
export function parseJsonRequestBody(
  requestBody: string,
  contentType: string | string[] | undefined,
): unknown {
  const normalizedContentType = Array.isArray(contentType) ? contentType[0] : contentType;
  if (
    !normalizedContentType ||
    !/^application\/(?:[\w.+-]+\+)?json(?:\s*;|$)/i.test(normalizedContentType)
  ) {
    throw new ApplicationError(
      415,
      "json_content_type_required",
      "JSON content type required",
      "Send this request with an application/json content type.",
    );
  }

  try {
    const parsedBody: unknown = JSON.parse(requestBody);
    return parsedBody;
  } catch {
    throw new ApplicationError(400, "invalid_json", "Invalid JSON", "The request body must contain valid JSON.");
  }
}

/** Rejects a body on an endpoint whose contract has no request payload. */
export function requireEmptyRequestBody(requestBody: string, code: string, detail: string): void {
  if (requestBody.trim() !== "") {
    throw new ApplicationError(400, code, "Request body not supported", detail);
  }
}

/** Decodes and validates a project UUID path segment. */
export function decodePathSegment(value: string | undefined): string {
  if (!value) throw invalidProjectId();

  try {
    const decodedValue = decodeURIComponent(value);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decodedValue)) {
      throw invalidProjectId();
    }
    return decodedValue;
  } catch {
    throw invalidProjectId();
  }
}

/** Decodes a collaborator identifier without permitting a path separator. */
export function decodeCollaboratorPathSegment(value: string | undefined): string {
  if (!value) throw invalidCollaborator();

  try {
    const decodedValue = decodeURIComponent(value);
    if (!decodedValue || decodedValue.includes("/") || decodedValue.includes("\\")) {
      throw invalidCollaborator();
    }
    return decodedValue;
  } catch {
    throw invalidCollaborator();
  }
}

/** Decodes a component type path segment. */
export function decodeComponentTypeSegment(value: string | undefined): string {
  if (!value) throw invalidComponentType();

  try {
    const decodedValue = decodeURIComponent(value);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(decodedValue)) throw invalidComponentType();
    return decodedValue;
  } catch {
    throw invalidComponentType();
  }
}

/** Validates the requested page size against the configured maximum. */
export function readPageSize(rawPageSize: string | null): number {
  if (rawPageSize === null) return DEFAULT_PAGE_SIZE;
  const pageSize = Number(rawPageSize);
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ApplicationError(
      400,
      "invalid_page_size",
      "Invalid page size",
      `Page size must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }
  return pageSize;
}

/** Validates an opaque workspace page token before forwarding it. */
export function readPageToken(rawPageToken: string | null): string | null {
  if (rawPageToken && rawPageToken.length > MAX_PAGE_TOKEN_LENGTH) {
    throw new ApplicationError(400, "invalid_page_token", "Invalid page token", "The page token is too long.");
  }
  return rawPageToken || null;
}

function invalidProjectId(): ApplicationError {
  return new ApplicationError(400, "invalid_project_id", "Invalid project ID", "The project ID is invalid.");
}

function invalidCollaborator(): ApplicationError {
  return new ApplicationError(400, "invalid_collaborator", "Invalid collaborator", "The collaborator ID is invalid.");
}

function invalidComponentType(): ApplicationError {
  return new ApplicationError(400, "invalid_component_type", "Invalid component type", "The component type is invalid.");
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE_TOKEN_LENGTH = 2048;
