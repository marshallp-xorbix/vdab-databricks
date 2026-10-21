CREATE TABLE IF NOT EXISTS vdab_projects (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description text NULL CHECK (description IS NULL OR char_length(description) <= 2000),
  created_by text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ix_vdab_projects_workspace_owner
  ON vdab_projects (workspace_id, created_by) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vdab_projects_workspace_name
  ON vdab_projects (workspace_id, name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS vdab_project_collaborators (
  project_id uuid NOT NULL REFERENCES vdab_projects(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  granted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS vdab_project_components (
  project_id uuid NOT NULL REFERENCES vdab_projects(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  component_type text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  sort_order integer NOT NULL,
  parent_key text NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  bindings jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (project_id, component_key),
  FOREIGN KEY (project_id, parent_key)
    REFERENCES vdab_project_components(project_id, component_key)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS vdab_project_workflows (
  project_id uuid NOT NULL REFERENCES vdab_projects(id) ON DELETE CASCADE,
  workflow_key text NOT NULL,
  definition jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, workflow_key)
);

CREATE TABLE IF NOT EXISTS vdab_project_custom_modules (
  project_id uuid NOT NULL REFERENCES vdab_projects(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  display_name text NOT NULL,
  source_text text NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, module_key)
);

CREATE TABLE IF NOT EXISTS vdab_project_resource_references (
  project_id uuid NOT NULL REFERENCES vdab_projects(id) ON DELETE CASCADE,
  resource_key text NOT NULL,
  resource_type text NOT NULL,
  display_name text NOT NULL,
  workspace_resource_id text NULL,
  resolved boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (project_id, resource_key),
  CHECK (resolved = false OR workspace_resource_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS vdab_project_child_apps (
  project_id uuid PRIMARY KEY REFERENCES vdab_projects(id) ON DELETE CASCADE,
  workspace_app_id text NOT NULL,
  app_name text NOT NULL,
  link_mode text NOT NULL CHECK (link_mode IN ('createNew', 'linkExisting')),
  linked_by text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vdab_project_deployments (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES vdab_projects(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  source_version integer NOT NULL CHECK (source_version > 0),
  source_snapshot jsonb NOT NULL,
  databricks_deployment_id text NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  failure_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ix_vdab_project_deployments_project_created
  ON vdab_project_deployments (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vdab_audit_events (
  id uuid PRIMARY KEY,
  workspace_id text NOT NULL,
  project_id uuid NULL REFERENCES vdab_projects(id) ON DELETE SET NULL,
  actor_id text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  source_request_id text NULL,
  databricks_request_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_vdab_audit_events_project_time
  ON vdab_audit_events (project_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS vdab_instance_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
