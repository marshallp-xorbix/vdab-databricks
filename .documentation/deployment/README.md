# VDAB Deployment Guide

Everything needed to deploy **Xorbix Visual Databricks App Builder (VDAB)** to Azure across its
three environments — **dev**, **stg**, and **prd** — using the Bicep templates in
[`.infrastructure/`](../../.infrastructure/) and the Azure DevOps pipeline in
[`.pipelines/`](../../.pipelines/).

## Read in order

| # | Document | Read it when |
|---|----------|--------------|
| 0 | [Shared variables & naming](./0-variables.md) | Always first — the single source of truth for prefixes, resource names, service-connection and variable-group names. |
| 1 | [Environment & promotion model](./1-overview.md) | To understand the three environments, what auto-deploys, and how stg/prd are gated. |
| 2 | [Azure setup](./2-azure-setup.md) | First-time-only: resource group + subscription prerequisites. |
| 3 | [Service connections & access](./3-service-connections-and-access.md) | Creating the Azure DevOps service connection, variable groups, and approval-gated Environments. |
| 4 | [Manual Bicep deployment](./4-deploy-bicep.md) | The first deploy of any environment (seeds secrets), or to debug infrastructure locally. |
| 5 | [Pipeline setup & operation](./5-pipeline-setup.md) | Wiring up and running the CI/CD pipeline; stage-by-stage troubleshooting. |
| 6 | [Lakebase environment databases](./6-lakebase-databases.md) | Pointing each environment at its own Databricks Lakebase Postgres branch. |
| 7 | [Add a brand-new environment](./7-add-new-environment.md) | The end-to-end checklist for standing up another environment from scratch. |
| 8 | [Production go-live & domain cutover](./8-production-go-live.md) | Blue-green slot releases, the first prod deploy, moving `app.vdab.ai`/`app.vdab.io` off dev, and retiring the old `prod` app. |

## Release process (the *why* and *when*, not the *how*)

This guide covers deployment **mechanics**. The process, approvals, and QA scope around a release live
in [`.documentation/release/`](../release/):

| Document | Read it when |
|----------|--------------|
| [Release & deployment workflow](../release/release-workflow.md) | Deciding who approves what, how rollback and migrations interact, feature-flag and changelog/docs strategy, release versioning, and the now-vs-later roadmap. |
| [QA strategy — what we test, and where](../release/qa-strategy.md) | Deciding what to test in each environment, and especially what the **production verification pass** does and does not cover. |
| [Release readiness backlog](../release/release-backlog.md) | Picking up the work the two documents above identified — board-ready items grouped by epic and ordered against the launch date. |

## Related setup runbooks

- [GeoLite2 IP geolocation setup](../geolite2_setup_readme.md) — required after first environment deployment to upload `GeoLite2-City.mmdb`, configure `GeoLiteConfiguration`, and verify managed-identity blob access.

## At a glance

| Environment | App Service | Public URL | Key Vault | Lakebase branch | How it deploys |
|-------------|-------------|------------|-----------|-----------------|----------------|
| **Local** | — | `http://localhost:5173` | `xorbixvdabdevkv` (read-only) | local PostgreSQL | Aspire AppHost (see [root readme](../../readme.md)) |
| **dev** | `xorbix-vdab-dev` | `https://xorbix-vdab-dev.azurewebsites.net` | `xorbixvdabdevkv` | `dev` | **auto** on merge to `develop` |
| **stg** | `xorbix-vdab-stg` | `https://xorbix-vdab-stg.azurewebsites.net` | `xorbixvdabstgkv` | `stg` | **promote** same artifact (approval-gated) |
| **prd** | `xorbix-vdab-prd` | `https://app.vdab.ai` + `https://app.vdab.io` | `xorbixvdabprdkv` | `prd` | **promote** same artifact → blue-green **slot swap** (higher-bar approval) |

All three Azure environments live in the single shared resource group **`vdab`** in subscription
`1691b7b4-5945-408f-a9e7-3eaab576becd`, disambiguated by the `xorbix-vdab-{env}` name prefix.

> **Related, but different:** [autoscaling_lakebase_steps.md](../autoscaling_lakebase_steps.md) covers granting
> Lakebase permissions to the Databricks apps that VDAB *builds and deploys*. This guide is about VDAB's **own**
> backend infrastructure and database.
