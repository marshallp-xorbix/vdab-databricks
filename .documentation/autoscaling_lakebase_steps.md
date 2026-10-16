# Autoscaling Lakebase App Steps and Permissions

## Autoscaling Lakebase QA Steps

To ensure that this feature is working, we will test by adding an Autoscaling Lakebase binding to a Data component, and then we will also add that same Autoscaling Lakebase as an app resource.

The following should be done in order to test all functionality:

### Add Data Component Binding (before resource) to check Error Handling

1. Start a fresh Databricks app or edit an existing one, and select a modal
2. Drag & Drop a `Data Window` component onto the scene
3. Open component settings (click on the Data Window on scene), and add a new Binding
4. Select Autoscaling Lakebase and add the following:
- Lakebase Project Name: `vdab-autoscale-lakebase`  
- Branch UID: `br-sweet-dew-d2sqihlr` (corresponds to this project's `production` branch)  
- Database: `databricks_postgres`  
- Schema: `dbdemos`  
- Table: `test`  
5. Save and Deploy the App
6. Loading up the Deployed app, you should see an error telling you to add the same Autoscaling Lakebase as an App Resource

### Add the Lakebase as a Resource:

1. Open the App Settings and navigate to the resource tab
2. Select `Edit`, choose `Autoscaling Lakebase` as resource type, then click `+ Add resource`
3. Fill in all of the same fields as before:
- Lakebase Project Name: `vdab-autoscale-lakebase`  
- Branch UID: `br-sweet-dew-d2sqihlr`  
- Database: `databricks_postgres`  
4. Select `Save resources`, then save the App and re-deploy
5. Load the deployed app, and now you are either met with your displayed data table, or an error saying that the current sessions has improper permissions 


If you see an error, then follow the below steps to finish granting your app user the permissions to use the Lakebase and re-deploy:


## Add Permissions

The rest of this document explains how to grant Lakebase permissions for a Databricks App that uses an Autoscaling Lakebase database resource or bindings.

### Key Concept

When a Databricks App connects to Lakebase, the database grants must be applied to the Postgres role used by the running app.

Use the app runtime `PGUSER` value as the role name in your SQL grants.

Example placeholder used below:

```sql
<PGUSER>
```

Replace that with the actual Postgres role for the app, for example:

```sql
"00000000-0000-0000-0000-000000000000"
```

or whatever `PGUSER` resolves to in the deployed app runtime enironement variables.

## Database Used In Examples

These examples assume:

- Database: `databricks_postgres`
- Schema: `dbdemos`
- Table: `test`

Adjust the database, schema, and table names to match your environment.

### 1. Minimum Read Access For One Table

Use this when the app only needs to read a single table.

```sql
GRANT CONNECT ON DATABASE databricks_postgres TO <PGUSER>;

GRANT USAGE ON SCHEMA dbdemos TO <PGUSER>;
GRANT SELECT ON TABLE dbdemos.test TO <PGUSER>;
```

What this does:

- `CONNECT` allows the app to connect to the database
- `USAGE ON SCHEMA` allows the app to access objects inside the schema
- `SELECT ON TABLE` allows reading the specific table

### 2. Read Access For All Current Tables In A Schema

Use this when the app should be able to read all existing tables in one schema.

```sql
GRANT CONNECT ON DATABASE databricks_postgres TO <PGUSER>;

GRANT USAGE ON SCHEMA dbdemos TO <PGUSER>;
GRANT SELECT ON ALL TABLES IN SCHEMA dbdemos TO <PGUSER>;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dbdemos TO <PGUSER>;
```

What this does:

- grants read access to all current tables in `dbdemos`
- grants sequence access needed when tables use identity/serial-backed columns

### 3. Read Access For Future Tables In A Schema

Use this together with section 2 if new tables will be created later and the app should keep working without manual re-grants.

```sql
ALTER DEFAULT PRIVILEGES IN SCHEMA dbdemos
GRANT SELECT ON TABLES TO <PGUSER>;

ALTER DEFAULT PRIVILEGES IN SCHEMA dbdemos
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO <PGUSER>;
```

What this does:

- automatically grants read access to future tables created in the schema
- automatically grants sequence access for future tables

### 4. Broad Read/Write Access For A Schema

Use this when the app needs to read and modify data in the schema.

```sql
GRANT CONNECT ON DATABASE databricks_postgres TO <PGUSER>;
GRANT USAGE, CREATE ON SCHEMA dbdemos TO <PGUSER>;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dbdemos TO <PGUSER>;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA dbdemos TO <PGUSER>;

ALTER DEFAULT PRIVILEGES IN SCHEMA dbdemos
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <PGUSER>;

ALTER DEFAULT PRIVILEGES IN SCHEMA dbdemos
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO <PGUSER>;
```

What this does:

- allows reading and modifying all current tables in the schema
- allows future tables and sequences in that schema to inherit the same permissions
- includes `CREATE ON SCHEMA` so the app can create objects in that schema if needed

### Which Section Should I Use?

Use the smallest permission set that matches the app behavior.

- Read one table only: section 1
- Read all current tables in one schema: section 2
- Read all current and future tables in one schema: sections 2 and 3
- Read/write data in one schema: section 4

### Important Notes

- Run these grants in the target database, for example `databricks_postgres`
- Grants given to your personal Databricks user do not automatically apply to the deployed app
- The deployed Databricks App uses the role identified by `PGUSER`
- If the app still fails after correct grants, verify the runtime `PGUSER` value matches the granted role exactly

### Common Error

If the app shows an error like:

```text
permission denied for schema dbdemos
```

that usually means one of these is missing:

- `GRANT USAGE ON SCHEMA dbdemos TO <PGUSER>;`
- `GRANT SELECT ON TABLE ... TO <PGUSER>;`
- `GRANT SELECT ON ALL TABLES IN SCHEMA ... TO <PGUSER>;`

## Overall Steps

For other users creating apps with Lakebase Autoscaling, follow these steps:

1. Add the Autoscaling Lakebase resource to the Databricks App.
2. Determine the app runtime Postgres role from `PGUSER`.
3. Grant database, schema, table, and sequence permissions to that role.
4. Redeploy the app after the grants are in place.
5. Test the app against the target schema and table.