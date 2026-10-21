ALTER TABLE vdab_project_workflows
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

WITH ordered_workflows AS (
  SELECT project_id,
         workflow_key,
         row_number() OVER (PARTITION BY project_id ORDER BY workflow_key) - 1 AS sort_order
  FROM vdab_project_workflows
)
UPDATE vdab_project_workflows AS workflows
SET sort_order = ordered_workflows.sort_order
FROM ordered_workflows
WHERE workflows.project_id = ordered_workflows.project_id
  AND workflows.workflow_key = ordered_workflows.workflow_key;

CREATE INDEX ix_vdab_project_workflows_order
  ON vdab_project_workflows (project_id, sort_order, workflow_key);
