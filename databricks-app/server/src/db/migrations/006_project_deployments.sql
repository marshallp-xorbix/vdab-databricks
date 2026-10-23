ALTER TABLE vdab_project_child_apps
  ALTER COLUMN workspace_app_id DROP NOT NULL;

ALTER TABLE vdab_project_child_apps
  ADD COLUMN IF NOT EXISTS create_marker text NULL;

ALTER TABLE vdab_project_child_apps
  ADD COLUMN IF NOT EXISTS source_code_path text NULL;

ALTER TABLE vdab_project_deployments
  ADD COLUMN IF NOT EXISTS app_name text NULL;

ALTER TABLE vdab_project_deployments
  ADD COLUMN IF NOT EXISTS source_code_path text NULL;

ALTER TABLE vdab_project_deployments
  ADD COLUMN IF NOT EXISTS attempt_of uuid NULL
    REFERENCES vdab_project_deployments(id);

ALTER TABLE vdab_project_deployments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE vdab_project_deployments
  ADD COLUMN IF NOT EXISTS required_user_api_scopes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vdab_project_child_apps_workspace_app_name
  ON vdab_project_child_apps (app_name);

CREATE UNIQUE INDEX IF NOT EXISTS ux_vdab_project_child_apps_workspace_app_id
  ON vdab_project_child_apps (workspace_app_id)
  WHERE workspace_app_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vdab_project_deployments_active
  ON vdab_project_deployments (project_id)
  WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS ix_vdab_project_deployments_successful
  ON vdab_project_deployments (project_id, completed_at DESC)
  WHERE status = 'succeeded';
