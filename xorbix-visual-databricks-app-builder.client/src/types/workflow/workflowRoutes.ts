export const WORKFLOW_ROUTES = ["onSuccess", "onError", "always"] as const;
export const DEFAULT_SUCCESS_ROUTE = "onSuccess" as const;
export const DEFAULT_ERROR_ROUTE = "onError" as const;
export const DEFAULT_ALWAYS_ROUTE = "always" as const;

export type WorkflowRoute = (typeof WORKFLOW_ROUTES)[number];
