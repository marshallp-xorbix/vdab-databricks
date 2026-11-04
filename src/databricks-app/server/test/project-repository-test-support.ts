import type { SqlClient, SqlPool, SqlResult } from "../src/db/sql.ts";

interface ProjectRow extends Record<string, unknown> {
  id: string;
  name: string;
  description: string | null;
  version: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  caller_role: "owner" | "editor" | "viewer" | "installationAdmin";
}

export class FakeSqlPool implements SqlPool {
  readonly statements: Array<{ text: string; values: unknown[] | undefined }> =
    [];
  projectRows: ProjectRow[] = [];
  ownerRows: Array<Record<string, unknown> & { created_by: string }> = [];
  collaboratorRows: Array<Record<string, unknown>> = [];
  failProjectInsert = false;
  failAuditInsert = false;
  deletedRows: Array<Record<string, unknown> & { created_by: string }> = [];
  removedCollaboratorRows: Array<
    Record<string, unknown> & { user_id: string }
  > = [];
  updateRows: ProjectRow[] = [];
  accessibleRows: Array<Record<string, unknown> & { id: string }> = [];

  async query<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>> {
    return this.execute<Row>(text, values);
  }

  async connect(): Promise<SqlClient> {
    return {
      query: <Row extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        values?: unknown[],
      ) => this.execute<Row>(text, values),
      release: () => undefined,
    };
  }

  private async execute<Row extends Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>> {
    this.statements.push({ text, values });

    if (this.failProjectInsert && text.includes("INSERT INTO vdab_projects")) {
      throw Object.assign(new Error("duplicate project name"), {
        code: "23505",
        constraint: "ux_vdab_projects_workspace_name",
      });
    }

    if (
      this.failAuditInsert &&
      text.includes("INSERT INTO vdab_audit_events")
    ) {
      throw new Error("audit database unavailable");
    }

    if (text.includes("INSERT INTO vdab_projects")) {
      const project = createProjectRow(
        String(values?.[4]),
        "owner",
        String(values?.[0]),
      );
      project.name = String(values?.[2]);
      project.description = values?.[3] as string | null;
      return { rows: [project as unknown as Row], rowCount: 1 };
    }

    if (text.includes("SELECT p.id, p.name")) {
      return {
        rows: this.projectRows as unknown as Row[],
        rowCount: this.projectRows.length,
      };
    }

    if (
      text.includes("UPDATE vdab_projects") &&
      text.includes("SET deleted_at")
    ) {
      return {
        rows: this.deletedRows as unknown as Row[],
        rowCount: this.deletedRows.length,
      };
    }

    if (text.includes("UPDATE vdab_projects")) {
      return {
        rows: this.updateRows as unknown as Row[],
        rowCount: this.updateRows.length,
      };
    }

    if (text.includes("SELECT p.id FROM vdab_projects")) {
      return {
        rows: this.accessibleRows as unknown as Row[],
        rowCount: this.accessibleRows.length,
      };
    }

    if (text.includes("SELECT created_by")) {
      return {
        rows: this.ownerRows as unknown as Row[],
        rowCount: this.ownerRows.length,
      };
    }

    if (text.includes("SELECT user_id, role")) {
      return {
        rows: this.collaboratorRows as unknown as Row[],
        rowCount: this.collaboratorRows.length,
      };
    }

    if (text.includes("DELETE FROM vdab_project_collaborators")) {
      return {
        rows: this.removedCollaboratorRows as unknown as Row[],
        rowCount: this.removedCollaboratorRows.length,
      };
    }

    return { rows: [], rowCount: null };
  }
}

export function createProjectRow(
  createdBy: string,
  callerRole: ProjectRow["caller_role"],
  id = "project-1",
): ProjectRow {
  const timestamp = new Date("2026-10-16T00:00:00.000Z");
  return {
    id,
    name: "Revenue",
    description: null,
    version: 1,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
    caller_role: callerRole,
  };
}
