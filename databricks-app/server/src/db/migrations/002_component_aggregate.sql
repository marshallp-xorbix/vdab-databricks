ALTER TABLE vdab_project_components
  ADD COLUMN code_name text NULL,
  ADD COLUMN description text NULL,
  ADD COLUMN component_version integer NOT NULL DEFAULT 1
    CHECK (component_version > 0),
  ADD COLUMN children jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN layout jsonb NOT NULL DEFAULT '{}'::jsonb;
