ALTER TABLE vdab_project_deployments
  ADD COLUMN IF NOT EXISTS required_app_resources jsonb NOT NULL DEFAULT '[]'::jsonb;
