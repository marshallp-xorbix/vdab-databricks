import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AppSettingsWarning,
  NormalizedAppResource,
} from "../../../models/DatabricksAppModels";
import { useAppResourcesEditor } from "../../../hooks/useAppResourcesEditor";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_VALUE_ADD_APP_RESOURCE_KIND_PLACEHOLDER,
} from "../../../constants/databricksAppResourcesUi";
import {
  APP_RESOURCE_KINDS,
  AppResourceKindSlug,
  KIND_LABELS,
  type AppResourceKind,
} from "../../../types/appResourceKinds";
import { buildAppSettingsResourceTableRow } from "../../../utils/appSettingsResourceRow";
import AppResourcePermissionSelect from "./AppResourcePermissionSelect";
import AppResourceTargetFields from "./AppResourceTargetFields";
import AppSettingsResourceWarnings from "./AppSettingsResourceWarnings";
import AppSettingsResourcesTable from "./AppSettingsResourcesTable";
import SettingsCard from "./SettingsCard";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";

const APP_RESOURCES_DOCS_HREF =
  "https://docs.databricks.com/aws/en/dev-tools/databricks-apps/resources";

interface AppResourcesTabProps {
  normalizedResources: NormalizedAppResource[];
  appSettingsWarnings: AppSettingsWarning[];
  resourcesLoading: boolean;
  resourcesError: string | null;
  appSettingsComputeSize: string;
  appId: number | null;
  databricksAppName: string;
  workspaceConnectionId: number | null;
  serverUpdateTime: string;
  reloadDatabricksResources: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function AppResourcesTab({
  normalizedResources,
  appSettingsWarnings,
  resourcesLoading,
  resourcesError,
  appSettingsComputeSize,
  appId,
  databricksAppName,
  workspaceConnectionId,
  serverUpdateTime,
  reloadDatabricksResources,
  onDirtyChange,
}: AppResourcesTabProps) {
  const [addKind, setAddKind] = useState<AppResourceKind | "">("");
  const [isEditing, setIsEditing] = useState(false);
  const [workspacePickerIssueByClientId, setWorkspacePickerIssueByClientId] =
    useState<Record<string, string>>({});

  const editor = useAppResourcesEditor({
    appId,
    databricksAppName,
    normalizedResources,
    serverUpdateTime,
    resourcesLoading,
    onDirtyChange,
    reloadDatabricksResources,
  });

  const showEditor =
    !resourcesLoading &&
    !resourcesError &&
    Boolean(databricksAppName) &&
    Boolean(appId);

  useEffect(() => {
    if (!showEditor) {
      setIsEditing(false);
    }
  }, [showEditor]);

  useEffect(() => {
    if (!isEditing) {
      setWorkspacePickerIssueByClientId({});
    }
  }, [isEditing]);

  return (
    <SettingsCard>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground">App resources</h2>
        <p className="mt-1 max-w-none text-sm leading-relaxed text-muted-foreground">
          Specify what resources the app&apos;s service principal will access on
          behalf of the app. Click Edit to change resources; Save resources
          writes updates to Databricks.
          <a
            href={APP_RESOURCES_DOCS_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            Learn more
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </p>
      </div>

      {showEditor && (
        <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
          {!isEditing ? (
            <Button
              type="button"
              variant="secondary"
              disabled={editor.saving}
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edit
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="default"
                disabled={!editor.canSave || editor.saving}
                className="bg-primary text-primary-foreground hover:opacity-90"
                onClick={() =>
                  void editor.save().then((ok) => {
                    if (ok) {
                      setIsEditing(false);
                      setAddKind("");
                    }
                  })
                }
              >
                {editor.saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save resources"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={editor.saving}
                onClick={() => {
                  editor.cancel();
                  setIsEditing(false);
                  setAddKind("");
                }}
              >
                Cancel
              </Button>
              {!serverUpdateTime.trim() && (
                <p className="text-sm text-warning-foreground">
                  Load app details (update time missing) before saving.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {editor.conflictMessage && (
        <div
          className="mb-4 rounded-md border border-warning/40 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground"
          role="alert"
        >
          <p className="font-medium">Conflict</p>
          <p className="mt-1">{editor.conflictMessage}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void editor.reloadAfterConflict()}
          >
            Reload from Databricks
          </Button>
        </div>
      )}

      {editor.saveError && (
        <div
          className="mb-4 rounded-md border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-foreground"
          role="alert"
        >
          <p className="font-medium">Could not save</p>
          <p className="mt-1">{editor.saveError}</p>
        </div>
      )}

      {showEditor && isEditing && editor.duplicateKeys.size > 0 && (
        <div
          className="mb-4 rounded-md border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-foreground"
          role="status"
        >
          Duplicate resource keys: {[...editor.duplicateKeys].join(", ")}. Keys
          must be unique.
        </div>
      )}

      {(!showEditor || !isEditing) && (
        <AppSettingsResourcesTable
          resources={normalizedResources}
          warnings={appSettingsWarnings}
          loading={resourcesLoading}
          error={resourcesError}
          computeSize={appSettingsComputeSize}
        />
      )}

      {showEditor && isEditing && (
        <div className="space-y-6">
          <AppSettingsResourceWarnings warnings={appSettingsWarnings} />

          <div>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={!addKind}
                onClick={() => {
                  if (addKind) {
                    editor.addResource(addKind);
                    setAddKind("");
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add resource
              </Button>
              <div className="flex min-w-[220px] flex-col gap-1">
                <Label className={RESOURCE_FIELD_LABEL_CLASS}>
                  Resource type
                </Label>
                <Select
                  value={
                    addKind || SELECT_VALUE_ADD_APP_RESOURCE_KIND_PLACEHOLDER
                  }
                  onValueChange={(v) =>
                    setAddKind(
                      v === SELECT_VALUE_ADD_APP_RESOURCE_KIND_PLACEHOLDER
                        ? ""
                        : (v as AppResourceKind),
                    )
                  }
                >
                  <SelectTrigger className="h-9 w-[220px] text-sm">
                    <SelectValue placeholder="Choose type to add" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value={SELECT_VALUE_ADD_APP_RESOURCE_KIND_PLACEHOLDER}
                      disabled
                    >
                      Choose type
                    </SelectItem>
                    {APP_RESOURCE_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editor.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resources yet. Choose a resource type, then click Add
                resource.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="hidden gap-3 md:grid md:grid-cols-[minmax(7rem,0.75fr)_minmax(8rem,0.85fr)_minmax(200px,1.6fr)_minmax(10rem,1fr)_auto] md:items-start md:px-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Key
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Type
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Details
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Permissions
                  </span>
                  <span className="sr-only">Remove</span>
                </div>

                {editor.rows.map((row) => {
                  const rowErr = editor.rowErrorByClientId.get(row.clientId);
                  const workspacePickerErr =
                    workspacePickerIssueByClientId[row.clientId];
                  const nameDup =
                    row.resource.name.trim() &&
                    editor.duplicateKeys.has(row.resource.name.trim());
                  const rowIssueText = nameDup
                    ? "Duplicate key in this list."
                    : (workspacePickerErr ?? rowErr ?? null);
                  const summary = buildAppSettingsResourceTableRow(
                    row.resource,
                  );
                  const kindLabel =
                    KIND_LABELS[row.resource.kind as AppResourceKind] ??
                    row.resource.kind;

                  return (
                    <div
                      key={row.clientId}
                      className="rounded-lg border border-border bg-muted p-4 md:border-0 md:bg-transparent md:p-0"
                    >
                      <div className="grid gap-4 md:grid-cols-[minmax(7rem,0.75fr)_minmax(8rem,0.85fr)_minmax(200px,1.6fr)_minmax(10rem,1fr)_auto] md:items-start">
                        <div className="space-y-1">
                          <Label
                            className={`${RESOURCE_FIELD_LABEL_CLASS} md:sr-only`}
                          >
                            Key
                          </Label>
                          <Input
                            className="h-9 text-sm"
                            value={row.resource.name}
                            onChange={(e) =>
                              editor.updateRowResource(
                                row.clientId,
                                (prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }),
                              )
                            }
                            placeholder="e.g. sql-warehouse"
                            aria-invalid={Boolean(rowIssueText)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            className={`${RESOURCE_FIELD_LABEL_CLASS} md:sr-only`}
                          >
                            Type
                          </Label>
                          <div className="flex min-h-9 items-center text-sm text-foreground">
                            {kindLabel}
                          </div>
                        </div>
                        <div className="min-w-0 space-y-1">
                          <Label
                            className={`${RESOURCE_FIELD_LABEL_CLASS} md:sr-only`}
                          >
                            Details
                          </Label>
                          <AppResourceTargetFields
                            resource={row.resource}
                            workspaceConnectionId={workspaceConnectionId}
                            showResourceTypeFieldLabel={false}
                            onWorkspacePickerIssue={(message) => {
                              setWorkspacePickerIssueByClientId((prev) => {
                                const next = { ...prev };
                                if (!message?.trim()) {
                                  delete next[row.clientId];
                                } else {
                                  next[row.clientId] = message.trim();
                                }
                                return next;
                              });
                            }}
                            onChange={(next) =>
                              editor.updateRowResource(row.clientId, () => next)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            className={`${RESOURCE_FIELD_LABEL_CLASS} md:sr-only`}
                          >
                            Permissions
                          </Label>
                          <AppResourcePermissionSelect
                            resource={row.resource}
                            showFieldLabel={false}
                            onChange={(next) =>
                              editor.updateRowResource(row.clientId, () => next)
                            }
                          />
                        </div>
                        <div className="flex justify-end md:justify-center md:pt-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-destructive-foreground hover:bg-destructive-subtle"
                            onClick={() => {
                              setWorkspacePickerIssueByClientId((prev) => {
                                const next = { ...prev };
                                delete next[row.clientId];
                                return next;
                              });
                              editor.removeRow(row.clientId);
                            }}
                            aria-label="Remove resource"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {rowIssueText && (
                        <p className="mt-2 text-xs text-destructive">
                          {rowIssueText}
                        </p>
                      )}
                      {row.resource.kind ===
                        AppResourceKindSlug.SqlWarehouse && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          &apos;Can manage&apos; is only accepted if your
                          account can grant that level on the warehouse in
                          Databricks; otherwise use &apos;Can use&apos;.
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Preview: {summary.details} · {summary.permissions}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {Boolean(appSettingsComputeSize?.trim()) && (
            <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground">
              <span className="font-medium text-foreground">Compute size: </span>
              {appSettingsComputeSize}
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
