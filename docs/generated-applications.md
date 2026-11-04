# Generated Streamlit applications

VDAB generates Python/Streamlit source for child Databricks Apps. Generation is deterministic and separate from the builder's HTTP, database, and workspace layers.

## Inputs and output

The generator consumes a validated project snapshot: project metadata, ordered/nested component configuration, workflows, modules, theme, and resource references. It produces an inspectable app package such as `app.py`, runtime helpers, `requirements.txt`, `app.yaml`, and optional modules, styles, or story assets. The preview generator uses the same project contract while producing browser preview output.

The component registry defines allowed types, versions, properties, binding schemas, and generation dispatch. Nested layout components preserve their child order. Resource keys are resolved to current-workspace App resources during deploy; display labels alone are not authority.

## Identity and resource use

Generated applications have their own Databricks App identity and explicitly attached resources. Viewer-initiated operations use the generated App's supported user authorization flow where Databricks supports it. VDAB never embeds the builder's forwarded token, service-principal grants, Lakebase credentials, workspace secrets, or user credentials into output. Generated source must validate resource bindings and fail clearly when a required resource is absent or mismatched.

## Deployment lifecycle

The deployment service validates the selected target, captures a versioned source snapshot, uploads source using the caller-authorized workspace API, invokes the child-App deployment API, and records the result. Retry and rollback use retained snapshots and explicit target confirmation. Linking an existing App verifies its workspace/space and resource configuration before replacing source.

Generated runtime behavior and actual viewer permissions must be verified in a real workspace. Local fakes and golden-source tests are not evidence of successful child-App runtime execution.
