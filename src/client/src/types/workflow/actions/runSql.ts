export interface RunSqlStatementRef {
  sourceActionType: "BuildSql";
  nodeId: string;
}

export interface RunSqlParams {
  statement: RunSqlStatementRef;
}

export interface RunSqlResult {
  rows: unknown[];
}
