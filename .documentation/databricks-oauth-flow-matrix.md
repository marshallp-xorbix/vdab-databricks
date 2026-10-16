# Databricks OAuth Flow Matrix

This document describes the OAuth flows supported by VDAB, their implementation status, scope justification, and token security posture.

---

## OAuth Flow Summary

| Flow | Status | Use Case |
|:-----|:-------|:---------|
| U2M PKCE (Authorization Code + PKCE) | **Implemented** | Interactive user login; delegates identity to Databricks |
| Token Refresh via `offline_access` | **Implemented** | Silent access token renewal without user interaction |
| M2M OAuth (Client Credentials) | Not Implemented | Backend service-to-service calls with no user context |
| Token Federation / OIDC | Not Implemented | Exchanging external IdP tokens for Databricks tokens |
| Workload Identity Federation (WIF) | Not Implemented | Azure-managed identity for zero-secret service auth |

---

## Implemented Flows

### U2M PKCE (Authorization Code + PKCE)

**Databricks docs:** [Authenticate access to Databricks with a user account using OAuth (U2M)](https://docs.databricks.com/en/dev-tools/auth/oauth-u2m.html)

**What it does:** Allows an end-user to authenticate against their Databricks workspace through a browser-based OAuth 2.0 Authorization Code flow with PKCE (Proof Key for Code Exchange). VDAB never sees or handles the user's Databricks password.

**Step-by-step flow:**

1. User clicks **Authorize** on a workspace card in VDAB.
2. Frontend generates a cryptographic `code_verifier` and derives the `code_challenge` (SHA-256).
3. Frontend redirects the browser to `{workspaceUrl}/oidc/v1/authorize` with `response_type=code`, `client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method=S256`, and `scope=all-apis offline_access`.
4. User authenticates in the Databricks consent screen and approves access.
5. Databricks redirects back to `{browser_origin}/callback` with an authorization `code` (same value used in step 3 as `redirect_uri`, unless `VITE_REDIRECT_URL` overrides at build time).
6. Frontend sends `code`, `code_verifier`, `redirect_uri` to backend via `POST /api/databricks/exchange-token`.
7. Backend (`DatabricksConnectionService.ExchangeTokenAsync`) exchanges the code for tokens by POSTing to `{workspaceUrl}/oidc/v1/token` with `grant_type=authorization_code`, client credentials, and the PKCE verifier.
8. Backend returns the token response to the frontend.
9. Frontend sends the refresh token to `POST /api/DatabricksConnection/UpdateWorkspaceRefreshToken` for encrypted storage.
10. The access token is cached server-side for subsequent API calls.

**Where it's implemented:**

- Frontend: `src/utils/databricksAuth.ts` (PKCE generation, redirect), `src/pages/DatabricksConnections.tsx` (exchange flow)
- Frontend API: `src/providers/DatabricksApi.ts` (`exchangeToken`, `updateRefreshToken`)
- Backend Controller: `DatabricksConnectionController.cs` (exchange-token endpoint)
- Backend Service: `DatabricksConnectionService.ExchangeTokenAsync`

### Token Refresh via `offline_access`

**Databricks docs:** [Authenticate access to Databricks with a user account using OAuth (U2M)](https://docs.databricks.com/en/dev-tools/auth/oauth-u2m.html) (refresh token section)

**What it does:** When the short-lived access token expires, the backend uses the stored refresh token to obtain a new access token without requiring user interaction.

**Step-by-step flow:**

1. Any API call that needs a Databricks access token calls `GetValidAccessTokenAsync`.
2. The service checks the in-memory/hybrid cache for a valid token.
3. On cache miss, `RefreshAccessTokenCoreAsync` loads the encrypted refresh token from the database.
4. Backend POSTs to `{workspaceUrl}/oidc/v1/token` with `grant_type=refresh_token`, client credentials, and the refresh token.
5. Databricks returns a new access token (and optionally a rotated refresh token).
6. If a new refresh token is returned, it is encrypted and saved; `LastRotatedAt` is updated.
7. The new access token is cached with the configured TTL.
8. If the refresh token itself is expired or revoked, the user is prompted to re-authorize.

**Where it's implemented:**

- Backend Service: `DatabricksConnectionService.RefreshAccessTokenCoreAsync`, `GetValidAccessTokenAsync`
- Cache: `IDatabricksAccessTokenCache` (hybrid cache with encryption)
- Repository: `IDatabricksUserTokenRepository.RotateAsync`

---

## Not Implemented Flows

### M2M OAuth (Client Credentials)

**What it is:** A machine-to-machine flow where the backend authenticates directly with Databricks using a service principal's `client_id` and `client_secret`, without any user context.

**When it would be needed:**

- Background jobs (scheduled data syncs, batch deployments)
- Admin operations that don't map to a specific user
- System health checks against Databricks APIs

**Databricks docs:** [Authenticate access to Databricks with a service principal using OAuth (M2M)](https://docs.databricks.com/en/dev-tools/auth/oauth-m2m.html)

### Token Federation / OIDC

**What it is:** Exchanging an OIDC token from an external Identity Provider (e.g., Entra ID / Azure AD) for a Databricks access token, enabling SSO-style flows where users authenticate once through the corporate IdP.

**When it would be needed:**

- SSO integration where VDAB's own JWT should be trusted by Databricks
- Eliminating the separate Databricks consent screen for users already authenticated via Entra ID

**Databricks docs:** [Token federation](https://docs.databricks.com/en/dev-tools/auth/oauth-federation.html)

### Workload Identity Federation (WIF)

**What it is:** Allows Azure-hosted workloads (e.g., Azure App Service, Azure Functions) to authenticate to Databricks using a managed identity, removing the need to store client secrets entirely.

**When it would be needed:**

- Production deployments on Azure where eliminating stored secrets is a security priority
- Compliance requirements that mandate managed identity over stored credentials

**Databricks docs:** [Workload identity federation on Azure](https://docs.databricks.com/en/dev-tools/auth/azure-wif.html)

---

## Scope Justification

| Scope | Purpose | Justification |
|:------|:--------|:-------------|
| `all-apis` | Grants access to all Databricks REST APIs | VDAB needs access to SQL Statement Execution, Unity Catalog, Workspace, and Apps APIs to support query execution, data governance, app deployment, and workspace browsing. A single broad scope avoids requiring users to re-authorize when new API features are added. |
| `offline_access` | Enables refresh token issuance | Required for silent token renewal so users don't have to re-authenticate every time the short-lived access token expires (typically 1 hour). Without this scope, every session would require a full browser-based re-authorization. |

---

## Token Security Summary

| Aspect | Implementation |
|:-------|:--------------|
| **Encryption at rest** | Refresh tokens are encrypted using AES-256 via `IEncryptionHelper` before database storage. Access tokens in cache are encrypted via the hybrid cache encryption layer. |
| **Storage** | Refresh tokens: SQL Server `DatabricksUserTokens` table (encrypted column). Access tokens: server-side hybrid cache only (never persisted to DB). |
| **Rotation handling** | When Databricks returns a new refresh token during a refresh grant, the service detects the change, encrypts and stores the new token, and updates `LastRotatedAt`. Stale tokens are automatically superseded. |
| **Revocation** | Users can disconnect a workspace via `POST /{workspaceConnectionId}/disconnect`, which sets `RevokedAt` on the token record and evicts the cached access token. Revoked tokens are excluded from authorization status checks. |
| **Masking in logs** | Access tokens are logged only as masked previews (first 6 + last 4 characters). Refresh tokens are never logged. OAuth error responses are sanitized to extract only `error` and `error_description` fields; raw response bodies containing tokens are never written to logs. |
| **TTL** | Access tokens are cached with a configurable TTL (`AccessTokenTtlMinutes` per workspace connection). Refresh token expiration is tracked via `RefreshTokenExpiresAt` and checked before use. |
| **Transport** | All Databricks OAuth endpoints are called over HTTPS. Backend-to-frontend communication is over HTTPS in production. |
