# Unity Catalog — Well-Architected Review

> **Review date**: 2026-04-23  
> **Framework reference**: Databricks Well-Architected Framework — Data & AI Governance pillar; Unity Catalog Best Practices; Databricks Apps documentation.

---

## 1. Data Touchpoint Inventory & UC Object Naming

Every path in VDAB that reads or writes data through Databricks is catalogued below with its UC naming pattern.

| # | Touchpoint | Direction | UC Naming Pattern | Interface | Status |
|---|-----------|-----------|-------------------|-----------|--------|
| 1 | **DataWindow** (read table) | Read | `catalog.schema.table` (3-level) | Databricks SQL via app SP + SQL Warehouse | Compliant |
| 2 | **EditableDataWindow** (read/write table) | Read/Write | `catalog.schema.table` (3-level) | Databricks SQL via app SP + SQL Warehouse | Compliant |
| 3 | **SaveToTable action** (workflow) | Write | `catalog.schema.table` (3-level) | Generated Streamlit → `sql_execute()` | Compliant |
| 4 | **BuildSql / RunSql actions** (workflow) | Read/Write | User-authored SQL — no name enforcement | Generated Streamlit → `sql_query_df()` | By design (see §2 note 1) |
| 5 | **FileUpload → Volume** | Write (files) | `/Volumes/{catalog}/{schema}/{volume}[/path]` (3-level) | `WorkspaceClient().files.upload()` | Compliant |
| 6 | **Chart components** (Donut, Bar, Line, Pie) | Read | `catalog.schema.table` (3-level) | Same as DataWindow | Compliant |
| 7 | **Dropdown / Autocomplete** (data-driven) | Read | Static options (no UC binding today) | Streamlit selectbox / multiselect | N/A (not UC-backed yet) |
| 8 | **Lakebase Provisioned DB** | Read/Write | `schema.table` (2-level; database from env) | PostgreSQL connection via `lakebase_query_df()` | N/A (Lakebase is not UC) |
| 9 | **Lakebase Autoscaling** | Read/Write | `schema.table` (2-level; endpoint pre-selected) | PostgreSQL connection via `lakebase_query_df()` | N/A (Lakebase is not UC) |
| 10 | **UC metadata discovery** (catalogs, schemas, tables, columns) | Read (metadata) | REST: `/api/2.1/unity-catalog/*` | Databricks REST API via OAuth user token | Compliant (see §2 note 2) |
| 11 | **Volume discovery** | Read (metadata) | REST: `/api/2.1/unity-catalog/volumes` | Databricks REST API via OAuth user token | Compliant |
| 12 | **SQL Warehouse listing** | Read (metadata) | REST: `/api/2.0/sql/warehouses` | Databricks REST API via OAuth user token | Compliant |
| 13 | **App deployment** | Write (workspace files) | Workspace path (not UC object) | `/api/2.0/workspace/import`, Apps API | N/A |
| 14 | **Serving endpoints** | Read (metadata) | REST: `/api/2.0/serving-endpoints` | Databricks REST API | N/A |

All UC data paths use **three-level `catalog.schema.object` names**. Lakebase paths use two-level names because the database context is injected via environment variables at runtime — this is correct PostgreSQL behavior and does not violate UC conventions.

---

## 2. Design Notes

1. **BuildSql / RunSql** — Users write arbitrary SQL. For Unity Catalog sources, RunSql executes as the **app service principal** (`sql_query_df`), so every signed-in app user shares the app SP's privileges (no per-user UC row filters/column masks). Prefer `sqlStringLiteral` / `sqlIdentifier` placeholder formatting; `formatHint: "raw"` embeds values unescaped and expands injection blast radius under the shared SP identity. Lakebase sources use the Lakebase helpers instead. No three-level name enforcement is applied because this matches how Databricks SQL Warehouse and Lakebase natively work.

2. **Metadata discovery uses REST API only** — VDAB uses the Unity Catalog REST API (`/api/2.1/unity-catalog/*`) for all metadata discovery instead of querying `information_schema` via a serverless SQL warehouse. The REST approach avoids warehouse DBU cost on every catalog browse in the builder UI and keeps the implementation simple. The tradeoff is that REST-based metadata browsing does not generate UC lineage entries, whereas `information_schema` queries through a warehouse would. This is acceptable because metadata browsing is an interactive design-time activity, not a data access operation.

---

## 3. File Staging — Volume Flow

The `FileUpload` component uses UC Volumes for file staging:

1. User selects a UC Volume via `DatabricksVolumeSelectorEditor` (catalog → schema → volume → optional subpath)
2. Binding stored as `catalog.schema.volume/filePath`
3. Generated code: `WorkspaceClient().files.upload("/Volumes/{catalog}/{schema}/{volume}/{filename}")`

The binding requires all three levels (catalog, schema, volume) and the selector validates this before allowing save.

Volume upload provides **file persistence only**. VDAB does not include automatic Volume-to-Delta-table ingestion. Users who need to materialize uploaded files into tables do so outside VDAB (e.g., via a Databricks notebook or workflow).

---

## 4. Metadata & Lineage

VDAB does not create UC objects (tables, schemas, volumes, or catalogs). It reads from and writes to **pre-existing** objects. The write operations are:

| Write operation | Assets affected |
|----------------|----------------|
| SaveToTable (INSERT) | Rows in an existing table |
| FileUpload | Files in an existing Volume |
| App deployment | Workspace files (app.py, etc.) — not UC objects |

**Lineage**: UC automatically captures lineage for all SQL queries executed through a SQL warehouse. Since deployed VDAB apps execute reads and writes via `sql_query_df()` / `sql_execute()` through the bound SQL warehouse as the app service principal, lineage is captured natively by the platform without any additional implementation in VDAB.

**Tags and comments**: VDAB does not set table comments, column descriptions, or UC tags. Since it does not create UC objects, there is no object creation point at which to apply them.

**External lineage (BYOL)**: Out of scope. VDAB runs entirely within Databricks, so native UC lineage is sufficient.

---

## 5. Least-Privilege UC Grants

### 5.1 Unity Catalog (deployed Databricks App)

Deployed apps access Unity Catalog table data using the **app service principal** (`credentials_provider=lambda: cfg.authenticate`). Data privileges for runtime SQL apply to the **app SP**, not the end user. Builder metadata discovery still uses the designer's OAuth token.

#### Minimum UC privileges per feature

| VDAB Feature | UC Object | Required Privilege | Granted To |
|-------------|-----------|-------------------|------------|
| **Browse catalogs** (builder) | `catalog` | `USE CATALOG` or `BROWSE` | End user |
| **Browse schemas** (builder) | `catalog.schema` | `USE SCHEMA` or `BROWSE` | End user |
| **Browse tables** (builder) | `catalog.schema.table` | `BROWSE` (metadata only) | End user |
| **Read table data** (DataWindow, Charts) | `catalog.schema.table` | `USE CATALOG` + `USE SCHEMA` + `SELECT` | App service principal |
| **Write table data** (SaveToTable) | `catalog.schema.table` | `USE CATALOG` + `USE SCHEMA` + `MODIFY` | App service principal |
| **Edit table data** (EditableDataWindow) | `catalog.schema.table` | `USE CATALOG` + `USE SCHEMA` + `SELECT` + `MODIFY` | App service principal |
| **SQL Warehouse access** | SQL Warehouse | `CAN USE` | App service principal (App Resource binding) |

#### App service principal requirements

UC SQL, file uploads, and Lakebase connections all use the app service principal's credentials.

| Resource | Required Permission | Configuration |
|----------|-------------------|---------------|
| SQL Warehouse | `CAN USE` | Added as App Resource in VDAB App Settings |
| UC tables (charts / DataWindow / workflows) | `USE CATALOG` + `USE SCHEMA` + `SELECT`/`MODIFY` | Granted to the app service principal on bound tables |
| UC Volume (if FileUpload used) | `USE CATALOG` + `USE SCHEMA` + `WRITE VOLUME` | Granted to the app service principal on the target volume |
| Lakebase Database (if used) | Database resource binding | Added as App Resource in VDAB App Settings |
| Workspace folder | Read access to app source code path | Automatic via Apps framework |

### 5.2 Lakebase (deployed Databricks App)

Lakebase permissions apply to the **app's Postgres role** (`PGUSER` environment variable), not the end user.

| VDAB Feature | Lakebase Object | Required Grant | Granted To |
|-------------|----------------|----------------|------------|
| **Read table** (DataWindow, Charts) | `schema.table` | `CONNECT` on database + `USAGE` on schema + `SELECT` on table | `PGUSER` role |
| **Write table** (SaveToTable) | `schema.table` | `CONNECT` + `USAGE` + `INSERT` (+ `UPDATE`, `DELETE` if needed) | `PGUSER` role |
| **Read all tables in schema** | `schema.*` | `CONNECT` + `USAGE` + `SELECT ON ALL TABLES IN SCHEMA` | `PGUSER` role |
| **Read future tables** | `schema.*` (future) | `ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES` | `PGUSER` role |

> Full Lakebase grant examples are documented in `.documentation/autoscaling_lakebase_perms.md`.

### 5.3 VDAB Builder UI (design-time)

During app design, VDAB's backend calls Databricks REST APIs using the **user's OAuth token**.

| VDAB Builder Action | Databricks API | Required Privilege |
|--------------------|---------------|-------------------|
| List catalogs | `GET /api/2.1/unity-catalog/catalogs` | `USE CATALOG` or `BROWSE` on catalogs |
| List schemas | `GET /api/2.1/unity-catalog/schemas` | `USE SCHEMA` or `BROWSE` on schemas |
| List tables | `GET /api/2.1/unity-catalog/tables` | `BROWSE` on catalog (metadata only) |
| Get table details (columns) | `GET /api/2.1/unity-catalog/tables/{fullName}` | `BROWSE` or `SELECT` on table |
| List volumes | `GET /api/2.1/unity-catalog/volumes` | `BROWSE` or `READ VOLUME` on schema |
| List SQL warehouses | `GET /api/2.0/sql/warehouses` | Workspace user access |
| List Lakebase instances | `GET /api/2.0/database/instances` | Workspace user access |
| Deploy app | `POST /api/2.0/workspace/import` + Apps API | Workspace contributor |

---

## 6. Compliance Checklist (Acceptance Criteria)

- [x] **Architecture note lists every data touchpoint and its UC object naming pattern** — See §1.
- [x] **Customer doc specifies minimum UC privileges per feature** — See §5 above and `.documentation/unity-catalog-privileges.md`.
- [x] **File-based flows use UC Volumes as documented** — FileUpload uses `/Volumes/{catalog}/{schema}/{volume}` with three-level binding validation. Volume-to-table ingestion is out of scope (file staging only).
- [x] **Defined approach to metadata/lineage** — UC auto-captures lineage for SQL warehouse queries in deployed apps. VDAB does not create UC objects, so tags/comments are not applicable.
