import type { DatabricksJobResourceRef } from "../sharedReferences";

export interface StartDatabricksJobParams {
  job: DatabricksJobResourceRef;
}

export interface StartDatabricksJobResult {
  runId: string;
  status: string;
}
