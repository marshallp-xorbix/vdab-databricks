import { DatabricksGenieSpaceResourceSelectorEditor } from "../../properties/DatabricksGenieSpaceResourceSelectorEditor";
import { DatabricksJobSelectorEditor } from "../../properties/DatabricksJobSelectorEditor";
import { DatabricksMlflowExperimentSelectorEditor } from "../../properties/DatabricksMlflowExperimentSelectorEditor";
import { DatabricksSecretScopeKeySelectorEditor } from "../../properties/DatabricksSecretScopeKeySelectorEditor";
import { DatabricksServingEndpointSelectorEditor } from "../../properties/DatabricksServingEndpointSelectorEditor";
import { DatabricksSqlWarehouseSelectorEditor } from "../../properties/DatabricksSqlWarehouseSelectorEditor";
import { LakebaseAutoscalingDatabaseResourceSelector } from "../../properties/LakebaseAutoscalingDatabaseResourceSelector";
import { LakebaseDatabaseCatalogResourceSelector } from "../../properties/LakebaseDatabaseCatalogResourceSelector";
import {
  UnityCatalogTableSelectorFields,
  type UnityCatalogTableSelectorValue,
} from "../../properties/UnityCatalogTableSelectorFields";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import {
  AppResourceKindSlug,
  UcSecurableTypeWire,
} from "../../../types/appResourceKinds";

interface AppResourceTargetFieldsProps {
  resource: NormalizedAppResource;
  workspaceConnectionId: number | null;
  onChange: (next: NormalizedAppResource) => void;
  /**
   * When false, workspace picker labels are hidden (Details / Type columns supply context).
   */
  showResourceTypeFieldLabel?: boolean;
  /**
   * Workspace-backed pickers report load/API issues here so the parent can show one row-level error line.
   */
  onWorkspacePickerIssue?: (message: string | null) => void;
}

function parseUnityTableParts(fullName: string): UnityCatalogTableSelectorValue {
  const t = fullName.trim();
  if (!t) {
    return { catalog: "", schema: "", table: "" };
  }
  const parts = t.split(".");
  if (parts.length < 3) {
    return { catalog: "", schema: "", table: "" };
  }
  return {
    catalog: parts[0],
    schema: parts[1],
    table: parts.slice(2).join("."),
  };
}

export default function AppResourceTargetFields({
  resource,
  workspaceConnectionId,
  onChange,
  showResourceTypeFieldLabel = true,
  onWorkspacePickerIssue,
}: AppResourceTargetFieldsProps) {
  const lab = "text-xs text-muted-foreground";
  const detailLab = showResourceTypeFieldLabel ? lab : "sr-only";
  const inp = "h-9 text-sm";

  switch (resource.kind) {
    case AppResourceKindSlug.SqlWarehouse:
      return (
        <DatabricksSqlWarehouseSelectorEditor
          value={resource.sqlWarehouse?.id ?? ""}
          onChange={(warehouseId) =>
            onChange({
              ...resource,
              sqlWarehouse: {
                id: warehouseId,
                permission: resource.sqlWarehouse?.permission ?? "",
              },
            })
          }
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
        />
      );

    case AppResourceKindSlug.Job:
      return (
        <DatabricksJobSelectorEditor
          value={resource.job?.id ?? ""}
          onChange={(jobId) =>
            onChange({
              ...resource,
              job: {
                id: jobId,
                permission: resource.job?.permission ?? "",
              },
            })
          }
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
        />
      );

    case AppResourceKindSlug.Database:
      return (
        <LakebaseDatabaseCatalogResourceSelector
          databaseName={resource.database?.database_name ?? ""}
          instanceName={resource.database?.instance_name ?? ""}
          permission={resource.database?.permission ?? ""}
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showCatalogLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
          onChange={(next) =>
            onChange({
              ...resource,
              database: {
                database_name: next.database_name,
                instance_name: next.instance_name,
                permission: next.permission,
              },
            })
          }
        />
      );

    case AppResourceKindSlug.AutoscalingDatabase:
      return (
        <LakebaseAutoscalingDatabaseResourceSelector
          databaseName={resource.database?.database_name ?? ""}
          databaseDisplayName={resource.database?.database_display_name ?? ""}
          instanceName={resource.database?.instance_name ?? ""}
          permission={resource.database?.permission ?? ""}
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
          onChange={(next) =>
            onChange({
              ...resource,
              database: {
                database_name: next.database_name,
                database_display_name: next.database_display_name,
                instance_name: next.instance_name,
                permission: next.permission,
              },
            })
          }
        />
      );

    case AppResourceKindSlug.Secret:
      return (
        <DatabricksSecretScopeKeySelectorEditor
          scope={resource.secret?.scope ?? ""}
          keyName={resource.secret?.key ?? ""}
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabels={showResourceTypeFieldLabel}
          onChange={(next) =>
            onChange({
              ...resource,
              secret: {
                scope: next.scope,
                key: next.key,
                permission: resource.secret?.permission ?? "",
              },
            })
          }
        />
      );

    case AppResourceKindSlug.Experiment:
      return (
        <DatabricksMlflowExperimentSelectorEditor
          value={resource.experiment?.experiment_id ?? ""}
          onChange={(experimentId) =>
            onChange({
              ...resource,
              experiment: {
                experiment_id: experimentId,
                permission: resource.experiment?.permission ?? "",
              },
            })
          }
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
        />
      );

    case AppResourceKindSlug.GenieSpace:
      return (
        <DatabricksGenieSpaceResourceSelectorEditor
          spaceId={resource.genieSpace?.space_id ?? ""}
          fallbackName={resource.genieSpace?.name}
          onChange={(next) =>
            onChange({
              ...resource,
              genieSpace: {
                name: next.name,
                space_id: next.spaceId,
                permission: resource.genieSpace?.permission ?? "",
              },
            })
          }
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
        />
      );

    case AppResourceKindSlug.ServingEndpoint:
      return (
        <DatabricksServingEndpointSelectorEditor
          value={resource.servingEndpoint?.name ?? ""}
          onChange={(name) =>
            onChange({
              ...resource,
              servingEndpoint: {
                name,
                permission: resource.servingEndpoint?.permission ?? "",
              },
            })
          }
          workspaceConnectionId={workspaceConnectionId ?? undefined}
          showFieldLabel={showResourceTypeFieldLabel}
          onWorkspaceFetchIssue={onWorkspacePickerIssue}
        />
      );

    case AppResourceKindSlug.UcSecurable: {
      const stRaw = resource.ucSecurable?.securable_type?.trim() ?? "";
      const st = stRaw.toUpperCase();
      if (stRaw && st !== "TABLE") {
        return (
          <div className="flex min-w-0 flex-col gap-2">
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label className={detailLab}>Securable full name</Label>
                <Input
                  className={inp}
                  value={resource.ucSecurable?.securable_full_name ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...resource,
                      ucSecurable: {
                        securable_full_name: e.target.value,
                        securable_type: resource.ucSecurable?.securable_type ?? "",
                        permission: resource.ucSecurable?.permission ?? "",
                      },
                    })
                  }
                  placeholder="catalog.schema.entity"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className={detailLab}>Securable type</Label>
                <Input
                  className={inp}
                  value={resource.ucSecurable?.securable_type ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...resource,
                      ucSecurable: {
                        securable_full_name:
                          resource.ucSecurable?.securable_full_name ?? "",
                        securable_type: e.target.value,
                        permission: resource.ucSecurable?.permission ?? "",
                      },
                    })
                  }
                  placeholder="e.g. VOLUME"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="link"
              className="h-auto self-start p-0 text-xs text-primary"
              onClick={() =>
                onChange({
                  ...resource,
                  ucSecurable: {
                    securable_full_name: "",
                    securable_type: "",
                    permission: resource.ucSecurable?.permission ?? "",
                  },
                })
              }
            >
              Pick Unity Catalog table instead
            </Button>
          </div>
        );
      }

      const tableValue = parseUnityTableParts(
        resource.ucSecurable?.securable_full_name ?? "",
      );
      return (
        <div className="flex min-w-0 flex-col gap-2">
          <UnityCatalogTableSelectorFields
            value={tableValue}
            workspaceConnectionId={workspaceConnectionId ?? undefined}
            hideFieldLabels={!showResourceTypeFieldLabel}
            onWorkspaceFetchIssue={onWorkspacePickerIssue}
            onChange={(next) => {
              const full =
                next.catalog && next.schema && next.table
                  ? `${next.catalog}.${next.schema}.${next.table}`
                  : "";
              onChange({
                ...resource,
                ucSecurable: {
                  securable_full_name: full,
                  securable_type: full
                    ? UcSecurableTypeWire.Table
                    : (resource.ucSecurable?.securable_type ?? ""),
                  permission: resource.ucSecurable?.permission ?? "",
                },
              });
            }}
          />
          <Button
            type="button"
            variant="link"
            className="h-auto self-start p-0 text-xs text-primary"
            onClick={() =>
              onChange({
                ...resource,
                ucSecurable: {
                  securable_full_name: "",
                  securable_type: UcSecurableTypeWire.Volume,
                  permission: resource.ucSecurable?.permission ?? "",
                },
              })
            }
          >
            {"Use manual name & type (volume, function, …)"}
          </Button>
        </div>
      );
    }

    default:
      return (
        <p className="text-sm text-warning-foreground">
          Unsupported resource type: {resource.kind}
        </p>
      );
  }
}
