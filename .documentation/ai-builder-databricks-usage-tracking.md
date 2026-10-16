# AI Builder Databricks Usage Tracking

VDAB attributes AI Builder model calls in Databricks using the **Databricks AI Gateway request-tags header**. Each LLM request made during an AI Builder session (including multi-step tool-calling loops) carries tags that appear in your workspace's `system.ai_gateway.usage` table.

This is the same mechanism used for the platform default AI Builder model. Tenant-owned serving endpoints receive the same tag schema, so usage is visible in **your** Databricks workspace when you use your own compute.

## Where to view usage

In the Databricks workspace that hosts the serving endpoint:

1. Open the **AI Gateway usage dashboard** (if enabled in your workspace), or
2. Query the system table `system.ai_gateway.usage` from Databricks SQL or a notebook.

Official Databricks documentation:

- [Monitor usage for Unity AI Gateway endpoints](https://docs.databricks.com/aws/en/ai-gateway/usage-tracking-beta)
- [Tag requests for usage tracking](https://docs.databricks.com/aws/en/ai-gateway/query-endpoints-beta#tag-requests-for-usage-tracking)

## Platform default vs tenant models

| Model selection | Usage appears in |
| --- | --- |
| **VDAB Default** (platform model) | VDAB's configured Databricks workspace |
| **Tenant AI model** (your workspace connection + serving endpoint) | Your tenant's Databricks workspace |

Token and compute costs for tenant models are billed to the workspace where the endpoint runs, not to VDAB's platform workspace.

## Request tags stamped by VDAB

VDAB sends the HTTP header `Databricks-Ai-Gateway-Request-Tags` with a JSON object of string key-value pairs. AI Builder sessions include:

| Tag key | Example | Description |
| --- | --- | --- |
| `source` | `vdab` | Identifies VDAB as the caller |
| `end_user` | `jane@acme.com` | VDAB user email (when available) |
| `feature` | `ai-builder` | Scopes usage to AI Builder (not endpoint validation pings) |
| `tenant_id` | `3fa85f64-5717-4562-b3fc-2c963f66afa6` | VDAB tenant GUID |
| `tenant_name` | `acme-corp` | VDAB tenant name |
| `user_id` | `7c9e6679-7425-40de-944b-e07fc1f90ae7` | VDAB user GUID |
| `app_id` | `42` | VDAB app (project) ID |
| `app_name` | `Sales Dashboard` | VDAB app name |
| `model_source` | `tenant` or `platform` | Whether the platform default or a tenant model was used |
| `tenant_ai_model_id` | `7` | Tenant AI model record ID (tenant models only) |
| `endpoint_name` | `my-serving-endpoint` | Databricks serving endpoint name |

Endpoint validation pings (when an admin saves a tenant AI model) only include `source` and `end_user`, not the AI Builder session tags.

Tags are stored in the `request_tags` column of `system.ai_gateway.usage`.

## Sample SQL queries

Filter to VDAB AI Builder traffic in the last 30 days:

```sql
SELECT
  usage_date,
  request_tags['end_user'] AS vdab_user,
  request_tags['app_id'] AS vdab_app_id,
  request_tags['app_name'] AS vdab_app_name,
  request_tags['tenant_name'] AS vdab_tenant_name,
  request_tags['model_source'] AS model_source,
  request_tags['tenant_ai_model_id'] AS tenant_ai_model_id,
  request_tags['endpoint_name'] AS endpoint_name,
  input_token_count,
  output_token_count,
  total_token_count
FROM system.ai_gateway.usage
WHERE request_tags['source'] = 'vdab'
  AND request_tags['feature'] = 'ai-builder'
  AND usage_date >= current_date() - INTERVAL 30 DAYS
ORDER BY usage_date DESC;
```

Aggregate tokens by VDAB app:

```sql
SELECT
  request_tags['app_id'] AS vdab_app_id,
  request_tags['app_name'] AS vdab_app_name,
  SUM(total_token_count) AS total_tokens,
  COUNT(*) AS request_count
FROM system.ai_gateway.usage
WHERE request_tags['source'] = 'vdab'
  AND request_tags['feature'] = 'ai-builder'
  AND usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY request_tags['app_id'], request_tags['app_name']
ORDER BY total_tokens DESC;
```

Aggregate by tenant AI model:

```sql
SELECT
  request_tags['tenant_ai_model_id'] AS tenant_ai_model_id,
  request_tags['endpoint_name'] AS endpoint_name,
  SUM(total_token_count) AS total_tokens
FROM system.ai_gateway.usage
WHERE request_tags['source'] = 'vdab'
  AND request_tags['model_source'] = 'tenant'
  AND usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY request_tags['tenant_ai_model_id'], request_tags['endpoint_name'];
```

Column names in `system.ai_gateway.usage` may vary slightly by Databricks platform version; adjust token column names if your workspace schema differs.

## Notes

- A single AI Builder user prompt may produce **multiple** usage rows because the agent can call the model several times while invoking canvas tools.
- Usage for **VDAB Default** is tracked in VDAB (PostgreSQL) from LLM API response metadata and shown in the app. Databricks `system.ai_gateway.usage` remains available for ops reconciliation and tenant-model analytics.
- Deployed-app **Model Chat** components use a separate Responses API path and are not tagged by this mechanism.
- **No special Databricks permissions** are required to send custom request tags. Any caller that can invoke the gateway may attach the `Databricks-Ai-Gateway-Request-Tags` header; Databricks stores whatever string key-value pairs you send in `request_tags`.
- If you only see `source` and `end_user`, the request was **not** an active AI Builder session (e.g. endpoint validation ping), or the server build predates the HttpContext-based tag context fix.
