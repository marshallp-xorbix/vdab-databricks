# AI Builder Tenant Models

This guide explains how tenant administrators register Databricks Model Serving endpoints for **AI Builder** (the in-app chat that scaffolds VDAB apps on the canvas), how builders select and use those models, where to obtain access tokens, and how to track usage in Databricks.

For usage-query details and sample SQL, see [AI Builder Databricks Usage Tracking](ai-builder-databricks-usage-tracking.md).

---

## Overview

| Concept | Description |
| --- | --- |
| **VDAB Default** | Platform-hosted model configured by Xorbix. No tenant setup required. Usage appears in VDAB's Databricks workspace. |
| **Tenant AI model** | A Model Serving endpoint in **your** Databricks workspace, registered by a tenant admin. Usage and compute cost appear in **your** workspace. |
| **Workspace connection** | OAuth link between VDAB and a Databricks workspace (used to list endpoints and run SQL). Configured on **Databricks Connections**. |
| **Access token (PAT)** | A separate Databricks personal access token stored encrypted on the tenant AI model record. Used only to call the serving endpoint through the AI Gateway. |

AI Builder calls endpoints via the Databricks **AI Gateway** OpenAI-compatible API (`/ai-gateway/mlflow/v1`). The endpoint must support **tool calling** (function calling) because the builder agent invokes canvas tools while generating your app.

> **Not the same as Model Chat.** Deployed-app **Model Chat** components use a different Responses API path and are not covered here. See [Model Chat VDAB Component Walkthrough](model_chat_steps.md).

---

## Prerequisites

Before adding a tenant AI model:

1. **Tenant admin** role in VDAB (required to create, edit, or delete models).
2. At least one **Databricks workspace connection** on the **Databricks Connections** page. See [Databricks OAuth Admin Setup Guide](databricks-oauth-admin-setup-guide.md) if you have not connected a workspace yet.
3. A **Model Serving endpoint** in that workspace that:
   - Is reachable through the Unity AI Gateway / pay-per-token Foundation Model APIs path VDAB uses, and
   - Supports **tool calling** (the admin save flow validates this automatically).
4. A **Databricks PAT** (personal access token) with permission to query that endpoint in the **same workspace** as the connection.

---

## Step 1: Prepare the serving endpoint in Databricks

1. In your Databricks workspace, open **Serving** and create or identify an endpoint you want AI Builder to use.
2. Confirm the endpoint is **Ready** and accepts chat-completions-style requests through the AI Gateway.
3. Note the exact **endpoint name** (this is the Semantic Kernel `model` id VDAB sends on each request).
4. Grant the identity that will own the PAT **Can Query** on the endpoint (or equivalent AI Gateway invoke permission).

Official Databricks references:

- [Query Unity AI Gateway endpoints](https://docs.databricks.com/aws/en/ai-gateway/query-endpoints-beta)
- [Monitor usage for Unity AI Gateway endpoints](https://docs.databricks.com/aws/en/ai-gateway/usage-tracking-beta)

---

## Step 2: Create a Databricks access token (PAT)

VDAB does **not** reuse the OAuth tokens from your workspace connection for AI Builder model calls. Each tenant AI model stores its own **encrypted PAT** used as the Bearer token when VDAB calls your endpoint.

### Where to get the token

In the **same Databricks workspace** linked to the model:

1. Click your **user icon** (or service principal settings) in the workspace header.
2. Go to **Settings** → **Developer** → **Access tokens** (or **User settings** → **Access tokens**).
3. Click **Generate new token**.
4. Set a label (e.g. `VDAB AI Builder – Sales Endpoint`) and an expiration appropriate for your security policy.
5. Copy the token immediately — Databricks will not show it again.

Alternatively, create a token for a **service principal** if your organization prefers a non-human identity for automation. The PAT must still belong to a principal that can query the serving endpoint.

### Required permissions

The PAT owner needs:

| Requirement | Why |
| --- | --- |
| Token created in the **same workspace** as the VDAB connection | Mismatched workspaces cause `401 Unauthorized` on save validation. |
| **Can Query** (or equivalent) on the target serving endpoint | Without this, validation returns `403 Forbidden`. |
| Ability to invoke the endpoint via **AI Gateway** chat completions | VDAB validates by posting a tool-calling ping to `/ai-gateway/mlflow/v1/chat/completions`. |

VDAB encrypts the PAT at rest and never returns it through the API after save. On edit, leave the token field **blank** to keep the existing token.

---

## Step 3: Register the model in VDAB

1. Open VDAB and go to **Databricks Connections**.
2. Select the **AI Models** tab.
3. Click **+ Add AI Model** (tenant admins only).
4. Fill in the form:

| Field | Description |
| --- | --- |
| **Display name** | Label shown in the AI Builder model picker (e.g. `GPT-4.1 – Engineering`). Unique per tenant. |
| **Databricks workspace** | The workspace connection whose URL is used to reach the endpoint. |
| **Serving endpoint name** | Exact endpoint name from Databricks. Use the endpoint picker to browse available endpoints when the workspace is connected. |
| **Access token (PAT)** | Required on create; optional on edit (blank keeps the current token). |

5. Click **Create model**.

### What happens on save

VDAB runs an automatic **validation ping** against your endpoint:

- Sends a minimal chat-completions request with a `ping` tool and `tool_choice: required`.
- Does **not** send `temperature` (providers use their default). This works for both standard chat models and reasoning Claude/GPT models that reject `temperature=0`.
- Expects the model to return a function/tool call response.
- If validation fails, the model is not saved and you receive an error (common causes: wrong PAT, wrong workspace, missing Can Query, unsupported API type, or a model that does not support tool calling).

Validation traffic is tagged in Databricks with only `source` and `end_user` (see [Telemetry](#step-5-track-usage-and-telemetry) below).

### Supported model families

| Family | Examples | Notes |
| --- | --- | --- |
| OpenAI GPT 5.x chat endpoints | `databricks-gpt-5-4`, `databricks-gpt-5-5`, `databricks-gpt-5-mini` | Must support `mlflow/v1/chat/completions` and tool calling. |
| Anthropic Claude 4.x / 5.x | `databricks-claude-sonnet-4-5`, `us.anthropic.claude-sonnet-5`, `databricks-claude-opus-4-8`, `databricks-claude-haiku-4-5` | Same gateway + tool-calling requirements. |

### Unsupported endpoint types

| Type | Example | Error you should see |
| --- | --- | --- |
| OpenAI Responses API only | `databricks-gpt-5-3-codex` | Requires Responses API; VDAB needs `mlflow/v1/chat/completions`. |
| Embedding model | `databricks-gte-large-en` | Not a chat model. |

---

## Step 4: Use the model in AI Builder

Any **tenant member** (not only admins) can use registered models in the app builder.

1. Open an app in the **App Builder**.
2. Open the **AI Builder** chat panel (fixed panel on the canvas).
3. Use the **model selector** in the chat header (defaults to **VDAB Default**).
4. Pick a tenant model from the list. Each option shows the display name, endpoint name, and workspace.
5. Chat as usual — describe the app you want and the agent will scaffold components on the canvas.

### How selection is stored

- Your model choice is saved **per user, per tenant** in VDAB's preferences store (`aiBuilder.selectedModelId`).
- Choosing **VDAB Default** clears the tenant selection (platform model is used).
- The selection persists across sessions until you change it or an admin deletes the model.
- If a stored model is deleted or no longer exists, the UI falls back to **VDAB Default** without modifying your saved preference on read.

### What gets sent on each chat message

When you submit a prompt, VDAB:

1. Resolves the selected model (platform config or tenant endpoint + PAT).
2. Stamps **gateway telemetry tags** for the session (tenant, user, app, endpoint, etc.).
3. Streams the agent response over `POST /api/aibuilder/generate-stream`, passing the optional `aiModelId` in the request body.
4. Persists your model selection after a successful resolve (skipped when the value is already unchanged).

One user prompt may trigger **multiple** LLM calls while the agent invokes canvas tools.

---

## Step 5: Track usage and telemetry

VDAB shows **in-app token usage** for the **VDAB Default** model only. Each user gets a monthly quota (100,000 total tokens by default, UTC calendar month). The AI Builder chat header and **Databricks Connections → AI Models** tab display a progress meter (`used / limit`) that refreshes when you open the panel, after each AI Builder session, or when you click the refresh button.

Tenant AI models are **not** limited by VDAB. Query your Databricks workspace for tenant-model usage (see below).

For detailed usage queries and sample SQL against `system.ai_gateway.usage`, see [AI Builder Databricks Usage Tracking](ai-builder-databricks-usage-tracking.md).

### Where usage appears

| Model | Usage table location |
| --- | --- |
| **VDAB Default** | Xorbix platform Databricks workspace |
| **Tenant AI model** | Your tenant's Databricks workspace |

Open the **AI Gateway usage dashboard** (if enabled) or query `system.ai_gateway.usage` from Databricks SQL or a notebook.

### Request tags VDAB sends

On each AI Builder LLM call, VDAB adds the HTTP header `Databricks-Ai-Gateway-Request-Tags` with a JSON object. During an active builder session, tags include:

| Tag key | Example | Meaning |
| --- | --- | --- |
| `source` | `vdab` | Caller is VDAB |
| `end_user` | `jane@acme.com` | VDAB user email (from login JWT) |
| `feature` | `ai-builder` | AI Builder session (not admin validation ping) |
| `tenant_id` | GUID | VDAB tenant |
| `tenant_name` | `acme-corp` | VDAB tenant name |
| `user_id` | GUID | VDAB user id |
| `app_id` | `42` | VDAB app being edited |
| `app_name` | `Sales Dashboard` | App display name |
| `model_source` | `tenant` or `platform` | Which model path was used |
| `tenant_ai_model_id` | `7` | Tenant model record id (tenant models only) |
| `endpoint_name` | `my-endpoint` | Databricks serving endpoint name |

Tags are stored in the `request_tags` column. Access them in SQL as `request_tags['end_user']`, etc.

### `requester` vs `end_user`

These are different fields in `system.ai_gateway.usage`:

| Field | Set by | Meaning |
| --- | --- | --- |
| **`requester`** (top-level column) | Databricks | Identity behind the **PAT** that called the gateway (platform service token or your stored tenant PAT owner). |
| **`request_tags['end_user']`** | VDAB | Email of the **VDAB user** actually using AI Builder. |

Use `requester` for credential/workspace billing attribution; use `request_tags['end_user']` for per-user chargeback inside your organization.

### Example: AI Builder traffic in the last 30 days

```sql
SELECT
  usage_date,
  requester,
  request_tags['end_user'] AS vdab_user,
  request_tags['app_name'] AS vdab_app,
  request_tags['tenant_name'] AS vdab_tenant,
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

### Example: Aggregate by tenant AI model

```sql
SELECT
  request_tags['tenant_ai_model_id'] AS tenant_ai_model_id,
  request_tags['endpoint_name'] AS endpoint_name,
  SUM(total_token_count) AS total_tokens,
  COUNT(*) AS request_count
FROM system.ai_gateway.usage
WHERE request_tags['source'] = 'vdab'
  AND request_tags['model_source'] = 'tenant'
  AND usage_date >= current_date() - INTERVAL 30 DAYS
GROUP BY 1, 2
ORDER BY total_tokens DESC;
```

More queries and notes: [AI Builder Databricks Usage Tracking](ai-builder-databricks-usage-tracking.md).

---

## Managing models

Tenant admins can **edit** or **delete** models from **Databricks Connections → AI Models**.

| Action | Effect |
| --- | --- |
| **Edit** | Update display name, workspace, or endpoint. Re-validates the endpoint. Optionally supply a new PAT. |
| **Delete** | Soft-deletes the model and clears `aiBuilder.selectedModelId` from affected users' preferences. Users fall back to VDAB Default. |

---

## Troubleshooting

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| **401 on save** | PAT wrong workspace, expired, or revoked | Regenerate PAT in the same workspace as the connection. |
| **403 on save** | PAT owner lacks endpoint access | Grant **Can Query** on the serving endpoint. |
| **Tool calling validation failed** | Model does not support functions/tools | Use a Foundation Model / gateway endpoint that supports tool calling. |
| **Model responded without tool calls** | Chat completed but no canvas tools were invoked | Use a Claude or GPT chat endpoint that supports tool calling via `mlflow/v1/chat/completions`. |
| **Responses API required** | Endpoint only supports `openai/v1/responses` | Choose a chat endpoint that supports `mlflow/v1/chat/completions`. |
| **Embedding endpoint** | Wrong model class | Register a chat model, not an embeddings endpoint. |
| **Model not in picker** | Not registered or wrong tenant | Confirm you're in the correct VDAB tenant; admin must add the model. |
| **Falls back to VDAB Default** | Model deleted or endpoint unavailable | Re-register or fix the endpoint; check builder error messages. |
| **Usage only shows `source` + `end_user`** | Validation ping, not a builder session | Normal for admin save validation. Filter with `request_tags['feature'] = 'ai-builder'` for chat traffic. |
| **No rows in usage table** | System table not enabled or wrong workspace | Confirm `system.ai_gateway.usage` is available; query the workspace where the endpoint runs. |

---

## API reference (for integrators)

| Endpoint | Method | Role | Purpose |
| --- | --- | --- | --- |
| `/api/tenantaimodel` | GET | Tenant member | List tenant models |
| `/api/tenantaimodel` | POST | Tenant admin | Create model |
| `/api/tenantaimodel/{id}` | PUT | Tenant admin | Update model |
| `/api/tenantaimodel/{id}` | DELETE | Tenant admin | Delete model |
| `/api/aibuilder/available-models` | GET | Tenant member | Models for picker (includes VDAB Default) |
| `/api/aibuilder/selected-model` | GET | Tenant member | Current user's selection |
| `/api/aibuilder/selected-model` | PUT | Tenant member | Set selection (`aiModelId` null = platform default) |
| `/api/aibuilder/platform-usage` | GET | Tenant member | Current user's VDAB Default monthly token usage |
| `/api/aibuilder/generate-stream` | POST | Tenant member | Run AI Builder (optional `aiModelId` in body) |
