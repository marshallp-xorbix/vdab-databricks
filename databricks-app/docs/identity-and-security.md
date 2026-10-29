# Identity and security

## Trust boundaries

- Production caller identity comes from Databricks App proxy context at trusted ingress. Arbitrary forwarded identity headers are not trusted in local development.
- Workspace authority is derived from trusted Databricks App runtime configuration. Browser input cannot select another host, tenant, connection, or credential.
- Project access is enforced by the builder's Lakebase ACL. App workspace access alone does not grant visibility into every project.
- User-triggered Databricks requests use the acting user's forwarded token and required consent/permissions. A denial must not fall back to the VDAB service principal.
- The service principal is reserved for explicitly approved shared/background operations.

## Sensitive data

Never log, persist in project JSON, export, or return caller tokens, App secrets, Lakebase OAuth credentials, passwords, or generated credentials. Workspace resource references may store resource identifiers and display metadata needed to reselect/rebind a resource; credentials are supplied by Databricks resource bindings at runtime.

## API and import safety

Validate every request at the Node boundary, including nested component trees, workflows, module source, and imported project bundles. Reject authority-bearing fields such as SaaS tenant IDs, external connection IDs, caller-supplied workspace hosts, and secrets. Use parameterized SQL and fixed/allowlisted identifiers.

## Authorization evidence

Databricks App scopes and resource grants are distinct. A scope permits an API operation; it does not grant access to every underlying resource. The [API reference](api-reference.md) documents each route's authorization requirements. Unsupported or missing consent fails closed, and denied user actions are never retried as the VDAB app identity.
