/** Result shape shared by the PostgreSQL adapter and deterministic test doubles. */
export interface SqlResult<Row extends Record<string, unknown>> {
  rows: Row[];
  rowCount: number | null;
}

/** Minimal PostgreSQL client contract used by repository transactions. */
export interface SqlClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
  release(): void;
}

/** Minimal PostgreSQL pool contract used by repositories and migrations. */
export interface SqlPool {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<SqlResult<Row>>;
  connect(): Promise<SqlClient>;
}
