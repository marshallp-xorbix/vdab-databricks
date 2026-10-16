# Lakebase Autoscaling API Contract Note

## Goal
Define the read-only backend contract for Lakebase Autoscaling selector data in VDAB, aligned to Databricks Postgres APIs and current Databricks connector patterns.

## Databricks Endpoint Discovery (Selection Scope)
The autoscaling selector is built from Postgres resources:

- `GET /api/2.0/postgres/projects`
  - Lists Lakebase Autoscaling projects.
  - Request query: `page_size`, `page_token`.
  - Response collection: `projects[]`, pagination token: `next_page_token`.
- `GET /api/2.0/postgres/projects/{projectId}/branches`
  - Lists branches for a selected project.
  - Request query: `page_size`, `page_token`.
  - Response collection: `branches[]`, pagination token: `next_page_token`.
- `GET /api/2.0/postgres/projects/{projectId}/branches/{branchId}/endpoints`
  - Lists endpoints for a selected branch.
  - Request query: `page_size`, `page_token`.
  - Response collection: `endpoints[]`, pagination token: `next_page_token`.

Reference: [Databricks Workspace Postgres REST APIs](https://docs.databricks.com/api/workspace/postgres) and [Databricks postgres CLI command reference](https://docs.databricks.com/aws/en/dev-tools/cli/reference/postgres-commands).

## Auth and Permission Expectations
- VDAB backend path uses existing authenticated-user flow:
  - JWT user from API request.
  - Workspace URL resolved from `workspaceConnectionId`.
  - OAuth token resolved through existing Databricks connection token service.
- Expected Databricks entitlement:
  - User can access target Lakebase Autoscaling project (`Can Manage` is sufficient for selector discovery).
- Expected auth-related failures:
  - Invalid/expired Databricks refresh token -> upstream auth failure.
  - Missing workspace token mapping for user/workspace -> connector failure from token service.

## Paging Rules Used by VDAB
- Backend requests `page_size=100`.
- Backend follows `next_page_token` until null/empty.
- Backend hard-stops at `100` pages to prevent runaway paging loops.
- Backend fully paginates server-side and returns deterministic sorted output to the client.

## Proposed `lakebaseAutoscaling` Selector Contract
Endpoint:
- `GET /api/DatabricksDataConnector/lakebase-autoscaling?workspaceConnectionId={id}`

Response shape:

```json
{
  "projects": [
    {
      "projectName": "projects/vdab-autoscale-lakebase",
      "projectId": "vdab-autoscale-lakebase",
      "displayName": "VDAB Autoscale Lakebase",
      "branches": [
        {
          "branchName": "projects/vdab-autoscale-lakebase/branches/main",
          "branchId": "main",
          "isDefault": true,
          "endpoints": [
            {
              "endpointName": "projects/vdab-autoscale-lakebase/branches/main/endpoints/default-rw",
              "endpointId": "default-rw",
              "endpointType": "ENDPOINT_TYPE_READ_WRITE",
              "autoscalingLimitMinCu": 0.5,
              "autoscalingLimitMaxCu": 4.0,
              "suspendTimeoutDuration": "3600s",
              "effectiveStatus": "STATE_READY",
              "selectorDisplay": {
                "primaryLabel": "VDAB Autoscale Lakebase / main / default-rw",
                "secondaryLabel": "ENDPOINT_TYPE_READ_WRITE | 0.5-4 CU",
                "searchText": "VDAB Autoscale Lakebase vdab-autoscale-lakebase main default-rw ENDPOINT_TYPE_READ_WRITE"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

## Dev Validation Commands and Payload Capture
Run these commands with a valid Databricks profile before final PR approval:

```bash
databricks auth login --profile "<your-profile>"
databricks postgres list-projects --profile "<your-profile>" --output json
databricks postgres list-branches "projects/vdab-autoscale-lakebase" --profile "<your-profile>" --output json
databricks postgres list-endpoints "projects/vdab-autoscale-lakebase/branches/main" --profile "<your-profile>" --output json
```

Capture and attach three payloads for implementation verification:
- Success case: project + branch + endpoint objects with autoscaling min/max CU.
- Empty case: project/branch with no endpoints (or no accessible projects result).
- Error case: auth/permission failure from CLI or API.

Observed error sample from this implementation environment (invalid refresh token):

```text
Error: A new access token could not be retrieved because the refresh token is invalid.
To reauthenticate, run:
  databricks auth login --profile <profile>
```

## Open UX Decisions (Explicit)
- Selector shape
  - Recommendation: single searchable selector grouped by `project / branch / endpoint`.
  - Owner: Frontend owner.
- Display label standard
  - Recommendation: `<ProjectDisplayName> / <BranchId> / <EndpointId>` with secondary autoscaling info.
  - Owner: Frontend owner.
- Empty fallback behavior
  - Recommendation: disabled selector + explicit empty-state message; no fallback to provisioned Lakebase data.
  - Owner: Frontend + backend owners.
- Paging UX
  - Recommendation: backend-only paging; client receives final merged, sorted payload.
  - Owner: Backend owner.
