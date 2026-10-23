# Node backend dependency approval proposal

**Status:** Approved by the user on 2026-10-16 for exactly `pg@8.23.1` and `@types/pg@8.23.1`.  
**Evaluation date:** 2026-10-16.

## Proposed minimum packages

| Package                                                | Proposed version | Purpose                                                                                                                                                                                            | Runtime impact                                                                                         |
| ------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`pg`](https://www.npmjs.com/package/pg)               | `8.23.1`         | Pure-JavaScript PostgreSQL wire-protocol client and connection pool for the customer-bound Lakebase Autoscaling database. It supports a dynamic password callback for refreshed OAuth credentials. | Server runtime dependency only; npm reports 102,632 bytes unpacked. Does not enter the browser bundle. |
| [`@types/pg`](https://www.npmjs.com/package/@types/pg) | `8.23.1`         | TypeScript declarations; the `pg` package metadata does not ship declarations.                                                                                                                     | Development-only types; npm reports 19,802 bytes unpacked.                                             |

The Node runtime has no built-in PostgreSQL wire-protocol client. Lakebase is the approved durable store, so a maintained PostgreSQL client is necessary for a direct Node implementation. A REST workspace API or browser-side storage cannot replace transactional Lakebase persistence. No Express, ORM, Databricks SDK, or validation package is included in this proposal; the architecture will use Node built-ins and typed `fetch` unless later evidence demonstrates a necessary, separately reviewed package.

## Required approval evaluation

- **Security:** A disposable npm lockfile containing these exact direct versions and transitive dependencies was audited on 2026-10-16 with `npm audit --json`: **0 vulnerabilities** (0 critical, 0 high, 0 moderate, 0 low). This is a point-in-time result, not a permanent security guarantee. Repeat `npm audit` on the actual committed lockfile and in CI.
- **License:** `pg` and `@types/pg` both declare MIT. A resolution of the proposed exact package graph found MIT licenses for the other packages except `pg-int8`, `split2`, and `xtend`, which declare permissive ISC licenses. No copyleft license appeared. Recheck the actual committed lockfile before release.
- **Maintenance:** `pg@8.23.1` was the npm latest tag when checked, published 16 days earlier; the upstream repository showed recent 8.x release activity and an active `pg@9.0` work stream. `@types/pg@8.23.1` was the npm latest declaration set. Upstream: [node-postgres repository](https://github.com/brianc/node-postgres), [pg release history](https://www.npmjs.com/package/pg?activeTab=versions), [TypeScript declarations](https://www.npmjs.com/package/@types/pg).
- **Scope appropriateness:** `pg` is the narrow client needed to persist and retrieve builder state in PostgreSQL. The type package is needed to maintain strict TypeScript without handwritten ambient declarations.
- **Bundle/deployment impact:** Both are server-only; `pg` is pure JavaScript with no native build requirement. The exact candidate graph resolves to 17 packages, adds about 102.6 KB unpacked for `pg` plus 19.8 KB for declarations, and adds no client-side bundle bytes.
- **Unpatched CVEs:** The reviewed exact-version dependency graph had no npm audit advisory. No known unpatched CVE was returned by the audit at review time.

## Approval requested

Approve or reject adding `pg@8.23.1` as a production dependency and `@types/pg@8.23.1` as a development dependency. Approval covers only these exact packages/versions; any additional third-party package requires its own recorded evaluation and approval.

## Generated Python Lakebase driver — approved

**Status:** The user approved exactly `asyncpg==0.32.0` on 2026-10-21 for generated Python child-app requirements and the local verification environment. No other Python package is approved.
**Evaluation date:** 2026-10-21.

| Package                                               | Proposed version | Purpose                                                                                                                                                                     | Runtime impact                                                                                                                                                                                               |
| ----------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`asyncpg`](https://pypi.org/project/asyncpg/0.32.0/) | `0.32.0`         | PostgreSQL wire-protocol client for generated child apps that read/write selected Lakebase Autoscaling or existing Provisioned resources, including workflow `SaveToTable`. | Added to generated child apps' pinned `requirements.txt` only when a project uses Lakebase; not installed by the Node builder itself. CPython 3.11 manylinux wheels are about 3.2–3.3 MB for x86-64/aarch64. |

### Required approval evaluation

- **Security:** An OSV version query for PyPI `asyncpg@0.32.0` returned no advisories on 2026-10-20. The local test environment does not contain `pip-audit`; it was not installed as an unapproved third-party audit tool. Run `pip-audit` and dependency/license scans before release; the OSV result is point-in-time evidence only.
- **License:** PyPI declares Apache-2.0. The exact versioned upstream text is retained at [asyncpg v0.32.0 LICENSE](https://github.com/MagicStack/asyncpg/blob/v0.32.0/LICENSE) with SHA-256 `D9222D73FDAC50992174076EFA04F44F6FBCD9D56155A7C7092E98757042A6F6`. Lakebase-generated source bundles and the VDAB third-party notice report include this text; product redistribution approval remains with the owner/legal reviewer.
- **Maintenance:** PyPI lists four maintainers and published 0.32.0 on 2026-10-06, with CPython 3.11 Linux wheels. The prior release was 0.31.0 on 2025-11-24, and a September 2026 upstream issue asked about maintenance/release cadence. The new release is positive evidence of activity, but the longer gap is a maintenance risk to retain in release review.
- **Scope appropriateness:** The approved customer Lakebase target speaks PostgreSQL's wire protocol. The installed Apps Python library list does not include a PostgreSQL driver. A pure-standard-library client would require implementing authentication, TLS, and the PostgreSQL protocol in VDAB. `asyncpg` supplies the missing protocol client; the generated implementation quotes validated identifiers and passes write values as query parameters.
- **Bundle/deployment impact:** The dependency is emitted as exactly `asyncpg==0.32.0` in a generated app's `requirements.txt` only when its source uses Lakebase. It does not enlarge the Node builder package or browser bundle. A generated app gains one native wheel of about 3.2–3.3 MB plus install/startup work. Databricks' current pip-based App runtime uses Python 3.11; this machine has Python 3.14.3 only, so a Python 3.11/Databricks install was not verified.
- **Unpatched CVEs:** No OSV advisory was returned for 0.32.0 at evaluation time. This does not replace the required release-time `pip-audit` check.

### Approved scope and local evidence

The approved package is emitted only in generated projects that use Lakebase and is used by the disposable local verification environment. Local PostgreSQL 17 integration exercised Autoscaling readers/workflows; the compatibility harness also covers existing Provisioned resource readers, `EditableDataWindow`, and BuildSql → RunSql → SaveToTable without adding a package. This remains local PostgreSQL and mock HTTP evidence only; it does not prove Databricks OAuth roles, scopes, child-App resource binding, Python 3.11 package installation, or Streamlit behavior in a deployed child App. Run the release-time `pip-audit` and license review; no additional package approval is implied.
