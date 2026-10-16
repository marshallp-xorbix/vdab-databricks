# Unity Catalog Privileges For VDAB Apps

This document lists the minimum Unity Catalog privileges a workspace admin must grant for each VDAB feature to work correctly.

## Key Concept

VDAB deployed apps access Unity Catalog table data using the **app service principal** (M2M via `Config().authenticate` / `credentials_provider`), the same identity model used for Lakebase charts and Volume uploads.

This means data-level privileges for charts, DataWindow, EditableDataWindow, SaveToTable, and RunSql must be granted to the **app service principal**, not to end-user groups.

The SQL warehouse is still bound as an **app resource** in VDAB App Settings (so the app SP receives warehouse `CAN_USE`). End users only need permission to open the Databricks App; they do not need a SQL user-authorization consent prompt for chart queries.

## Placeholders Used In Examples

- `<catalog>`: The Unity Catalog catalog name
- `<schema>`: The schema name
- `<table>`: The table name
- `<volume>`: The volume name
- `<app_sp>`: The Databricks App service principal name or application ID
- `<group>`: The Databricks group that contains end users of the app (builder discovery / app open access)

Replace these with your actual values.

## 1. Read Table Data (DataWindow, Charts)

Use this when a VDAB component reads from a Unity Catalog table in the deployed app.

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO <app_sp>;
GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO <app_sp>;
GRANT SELECT ON TABLE <catalog>.<schema>.<table> TO <app_sp>;
```

What this does:

- `USE CATALOG` allows the app SP to navigate the catalog
- `USE SCHEMA` allows the app SP to access objects in the schema
- `SELECT` allows reading the table data as the app

## 2. Write Table Data (SaveToTable Action)

Use this when a VDAB workflow inserts rows into a Unity Catalog table.

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO <app_sp>;
GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO <app_sp>;
GRANT MODIFY ON TABLE <catalog>.<schema>.<table> TO <app_sp>;
```

What this does:

- `MODIFY` allows inserting, updating, and deleting rows in the table as the app

## 3. Read And Write Table Data (EditableDataWindow)

Use this when a VDAB component both reads from and writes to a table.

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO <app_sp>;
GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO <app_sp>;
GRANT SELECT ON TABLE <catalog>.<schema>.<table> TO <app_sp>;
GRANT MODIFY ON TABLE <catalog>.<schema>.<table> TO <app_sp>;
```

## 4. Upload Files To A Volume (FileUpload)

Use this when a VDAB component uploads files to a Unity Catalog Volume.

File uploads use the **app service principal's** credentials (via `WorkspaceClient()`), not the end user's token. Grants must be applied to the app service principal, not end user groups.

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO <app_sp>;
GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO <app_sp>;
GRANT WRITE VOLUME ON VOLUME <catalog>.<schema>.<volume> TO <app_sp>;
```

What this does:

- `WRITE VOLUME` allows the app service principal to upload files to the volume
- End users do not need volume grants — the app handles the upload on their behalf

## 5. Browse Catalogs, Schemas, And Tables (VDAB Builder UI)

Use this so users can discover and select data objects when designing apps in the VDAB builder.

```sql
GRANT BROWSE ON CATALOG <catalog> TO <group>;
```

What this does:

- `BROWSE` allows users to see catalog, schema, and table metadata in the VDAB builder without granting access to the data itself
- Users can discover tables and request access, but cannot read or write data until the app SP has `SELECT` or `MODIFY` for runtime queries

If you prefer to restrict visibility to specific schemas:

```sql
GRANT USE CATALOG ON CATALOG <catalog> TO <group>;
GRANT USE SCHEMA ON SCHEMA <catalog>.<schema> TO <group>;
```

## 6. SQL Warehouse Access

Every VDAB feature that reads or writes Unity Catalog data requires a SQL Warehouse. The warehouse must be:

1. **Added as an App Resource** in VDAB App Settings (binds `CAN_USE` to the app service principal)
2. Running when the app queries it

End users do not need separate warehouse grants for deployed-app SQL when using app SP auth.

## Which Section Should I Use?

Use the smallest permission set that matches the app behavior.

| VDAB Feature | Sections Needed |
|---|---|
| Read-only dashboard (charts, tables) | 1 + 5 + 6 |
| Dashboard with SaveToTable workflow | 1 + 2 + 5 + 6 |
| Editable data grid | 3 + 5 + 6 |
| File upload to Volume | 4 + 5 + 6 |
| All features combined | 1 + 2 + 3 + 4 + 5 + 6 |

## Important Notes

- SQL data grants (sections 1–3) must be applied to the **app service principal** — generated apps query as the app, like Lakebase
- Volume grants (section 4) must also be applied to the **app service principal**
- App resource bindings (SQL Warehouse, Lakebase) are separate from UC data grants — configure those in VDAB App Settings
- For Lakebase permissions, see `autoscaling_lakebase_perms.md`
- Prefer least privilege: grant the app SP only the catalogs/schemas/tables the app binds
- Trade-off: chart/SQL queries do not enforce per-user UC row filters or column masks; all signed-in app users see data the app SP can read
- Prefer `sqlStringLiteral` / `sqlIdentifier` for BuildSql placeholders; `formatHint: "raw"` embeds unescaped values and widens SQL injection impact under the shared app SP
- Use `BROWSE` for builder discovery (end users/groups) separately from runtime data grants (app SP)

## Common Errors

If the deployed app shows an error like:

```text
User does not have USE CATALOG on catalog '<catalog>'
```

that means the **app service principal** is missing `USE CATALOG` or related privileges on the catalog.

If the app shows:

```text
User does not have SELECT on table '<catalog>.<schema>.<table>'
```

that means the app SP has catalog/schema access but is missing `SELECT` on the specific table.
