# Databricks OAuth Admin Setup Guide

This guide walks administrators through setting up a Databricks App Connection for use with VDAB (Visual Databricks App Builder).

---

## Prerequisites

- **Databricks Account Admin** access (account-level settings)
- Every **public URL** where users open the VDAB UI (each becomes `{origin}/callback` for OAuth)
- Access to the VDAB Databricks Connections page

---

## Step 1: Create a Databricks App Connection

1. Open your Databricks workspace and click your workspace name in the top-left corner.
2. Select **Manage Account** to open the account console.
3. In the left sidebar, click **Settings**.
4. Navigate to the **App Connections** tab.
5. Click **Add Connection**.
6. Enter a descriptive name for the connection (e.g., `VDAB Production`).

---

## Step 2: Configure Redirect URI

1. In the App Connection configuration, locate the **Redirect URIs** section.
2. Register **every** base URL users use to open VDAB, each with the `/callback` path. The SPA sends `redirect_uri` as `{browser_origin}/callback` (unless `VITE_REDIRECT_URL` is set at build time to override). Databricks requires an **exact** match.

   Examples (add all that apply):

   | Where users load VDAB | Redirect URI to register |
   |:------------------------|:--------------------------|
   | Production custom domain | `https://app.vdab.ai/callback` |
   | Production Azure hostname | `https://xorbix-vdab-prd.azurewebsites.net/callback` |
   | Staging custom domain | `https://xorbix-vdab-stg.azurewebsites.net/callback` |
   | Staging Azure hostname | `https://xorbix-vdab-dev.azurewebsites.net/callback` |
   | Local Vite / Aspire | `http://localhost:5173/callback` |

3. The redirect URI is case-sensitive and must include the full path with protocol.

> **Important:** A mismatch between any URI you register here and the `redirect_uri` the browser sends causes a **redirect_uri mismatch** error. If you add a new public hostname, add its `/callback` entry in Databricks **and** ensure that origin is listed in `ApplicationConfiguration:AllowedOrigins` on the API (so confirmation-email links can use the same host when applicable).

---

## Step 3: Configure API Access and Scopes

1. Under **API Access**, click **All APIs** and then **Add**.
2. This grants the `all-apis` scope, which VDAB requires for:
   - **SQL Statement Execution API** — running queries bound to UI components
   - **Unity Catalog API** — browsing catalogs, schemas, and tables
   - **Workspace API** — listing and managing workspace resources
   - **Apps API** — deploying generated applications to Databricks
3. The `offline_access` scope is requested automatically during authorization to enable refresh tokens.

---

## Step 4: Copy Client ID and Client Secret

1. After saving the App Connection, Databricks will display the **Client ID** and **Client Secret**.
2. **Copy both values immediately** — the Client Secret cannot be viewed again after closing the dialog.
3. Note the configured **Access Token TTL** and **Refresh Token Lifespan** values from the App Connection settings. You will enter these in VDAB.

---

## Step 5: Configure the Workspace in VDAB

1. Open VDAB and navigate to **Databricks Connections**.
2. Click **+ Add Workspace**.
3. Fill in the following fields:

| Field | Description | Example |
|:------|:-----------|:--------|
| **Workspace Display Name** | A friendly name shown in VDAB | `Production Workspace` |
| **Workspace URL** | The full URL of your Databricks workspace | `https://adb-1234567890.12.azuredatabricks.net` |
| **Client ID** | The OAuth App Connection Client ID | `00000000-0000-0000-0000-000000000000` |
| **Client Secret** | The OAuth App Connection Client Secret | (paste from Step 4) |
| **Access Token TTL (minutes)** | Must match the TTL configured in Databricks | `60` |
| **Refresh Token Lifespan (minutes)** | Must match the lifespan configured in Databricks | `10080` (7 days) |

4. Click **Save**.

> **Note:** The Client Secret is encrypted at rest using AES-256 before being stored in the database.

---

## Step 6: Authorize the Workspace

1. After saving, the workspace card will show **Not Authorized** with a red indicator.
2. Click the **Authorize** button on the workspace card.
3. You will be redirected to the Databricks consent screen.
4. Log in with your Databricks credentials and approve the requested permissions.
5. After approval, you will be redirected back to VDAB. The workspace card should now show **Authorized** with a green indicator.

---

## Step 7: Re-authorization

Re-authorization is needed when:

- The refresh token has expired (based on the configured lifespan)
- The token has been manually revoked or disconnected
- The App Connection credentials have been rotated in Databricks

To re-authorize:

1. Click the **Re-authorize** button on an authorized workspace card.
2. Complete the Databricks consent flow again.
3. The new tokens replace the previous ones automatically.

---

## Step 8: Disconnect a Workspace

To revoke your token and disconnect from a workspace:

1. Click the **Disconnect** button (red outline) on an authorized workspace card.
2. Confirm the action in the dialog.
3. This revokes the stored refresh token and clears the cached access token.
4. The workspace card will return to **Not Authorized** status.
5. You can re-authorize at any time by clicking **Authorize**.

> **Note:** Disconnecting only affects your user tokens. The workspace connection configuration (Client ID, URL, etc.) remains intact for other users.

---

## Security Notes for Admins

### Scopes

| Scope | Purpose |
|:------|:--------|
| `all-apis` | Required for SQL, Unity Catalog, Workspace, and Apps API access |
| `offline_access` | Enables refresh token issuance for silent token renewal |

These are the minimum scopes required for VDAB to function. No additional scopes are requested.

### Token Storage

- **Refresh tokens** are encrypted using AES-256 (`IEncryptionHelper`) before database storage.
- **Access tokens** are held only in server-side memory cache and are never persisted to the database.
- **Client secrets** are encrypted at rest in the database.

### Audit Fields

Each user token record tracks:

| Field | Description |
|:------|:-----------|
| `CreatedAt` | When the token was first stored |
| `LastRotatedAt` | When the refresh token was last rotated by Databricks |
| `RefreshTokenExpiresAt` | When the refresh token expires |
| `RevokedAt` | When the user disconnected (null if active) |

### Log Safety

- Access tokens are never logged in full; only a masked preview (first 6 + last 4 characters) appears in debug logs.
- Refresh tokens are never logged.
- OAuth error responses are sanitized — only `error` and `error_description` fields are extracted from error responses; raw response bodies are never logged.

---

## Troubleshooting

| Problem | Possible Cause | Solution |
|:--------|:--------------|:---------|
| **"redirect_uri mismatch" error** during authorization | The redirect URI in the Databricks App Connection does not include the exact `{origin}/callback` the browser sent | Add that full URI in Databricks (e.g. `https://app.vdab.ai/callback` and your App Service URL if both are used). Optional: set `VITE_REDIRECT_URL` at build time only if you must force a fixed redirect instead of the current origin |
| **"Client ID or Client Secret is missing" error** | The workspace was saved without credentials | Edit the workspace and enter the Client ID and Client Secret from the Databricks App Connection |
| **"invalid_client" error during token exchange** | Wrong Client ID or Client Secret | Verify credentials match the Databricks App Connection. If the secret was rotated, update it in VDAB |
| **"invalid_grant" or token refresh fails** | Refresh token has expired or been revoked | Click **Re-authorize** to obtain fresh tokens |
| **Workspace shows "Not Authorized" after it was previously authorized** | Refresh token expired based on the configured lifespan | Re-authorize the workspace. Consider increasing the Refresh Token Lifespan in the Databricks App Connection settings |
| **"Databricks authentication expired" error during API calls** | Both the access token and refresh token are expired | Re-authorize the workspace |
| **Authorization flow redirects but never completes** | Browser popup blocker or cookie restrictions | Allow popups and third-party cookies for the Databricks workspace domain |
| **"Connection configuration not found" error** | Workspace URL doesn't match any saved connection | Ensure the Workspace URL was saved correctly in VDAB before authorizing |
