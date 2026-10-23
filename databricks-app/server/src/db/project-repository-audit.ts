import { randomUUID } from "node:crypto";
import type { ProjectAuditEvent } from "./project-repository.ts";
import type { SqlPool } from "./sql.ts";

/** Appends a parameterized install-local audit event on the supplied connection. */
export async function insertAuditEvent(
  client: Pick<SqlPool, "query">,
  event: ProjectAuditEvent,
): Promise<void> {
  const values: unknown[] = [
    randomUUID(),
    event.workspaceId,
    event.projectId,
    event.actorId,
    event.action,
  ];
  if (event.parameterizeOutcome) {
    values.push("success");
  }

  values.push(event.requestId);

  if (event.metadata) {
    values.push(JSON.stringify(event.metadata));
  }

  const placeholders = values.map((_, index) => `$${index + 1}`);
  const query = event.parameterizeOutcome
    ? `INSERT INTO vdab_audit_events
        (id, workspace_id, project_id, actor_id, action, outcome, source_request_id${event.metadata ? ", metadata" : ""})
       VALUES (${placeholders.join(", ")})`
    : `INSERT INTO vdab_audit_events
        (id, workspace_id, project_id, actor_id, action, source_request_id, outcome${event.metadata ? ", metadata" : ""})
       VALUES (${placeholders.slice(0, 5).join(", ")}, ${placeholders[5]}, 'success'${event.metadata ? `, ${placeholders[6]}` : ""})`;

  await client.query(query, values);
}
