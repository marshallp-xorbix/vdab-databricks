import type { FC } from "react";
import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../ui/table";
import { Textarea } from "../../../../ui/textarea";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import type { WorkflowSqlSourceKind } from "../../../../../types/workflow";
import { AppResourceKindSlug } from "../../../../../types/appResourceKinds";
import type { NormalizedAppResource } from "../../../../../models/DatabricksAppModels";
import {
  getInvalidBuildSqlTokens,
  parseBuildSqlTokens,
  synchronizeBuildSqlPlaceholders,
} from "../../../../../utils/workflow/buildSqlTemplateUtils";
import type { WorkflowActionEditorProps } from "./types";

function lakebaseSourceFamily(
  kind: WorkflowSqlSourceKind,
): "unity" | "provisioned" | "autoscaling" {
  if (kind === "unityCatalogTable") {
    return "unity";
  }
  if (kind === "lakebaseProvisionedDatabase") {
    return "provisioned";
  }
  return "autoscaling";
}

const SQL_SOURCE_OPTIONS: Array<{
  value: WorkflowSqlSourceKind;
  label: string;
  helperText: string;
}> = [
  {
    value: "unityCatalogTable",
    label: "Unity Catalog",
    helperText:
      "RunSql runs as the Databricks app identity (shared by all users of this app). Prefer escaped placeholders over raw.",
  },
  {
    value: "lakebaseProvisionedDatabase",
    label: "Lakebase",
    helperText:
      "Pick a provisioned Lakebase app resource. RunSql uses that resource’s host and database from app.yaml.",
  },
  {
    value: "lakebaseAutoscaling",
    label: "Lakebase Autoscaling",
    helperText:
      "Pick an autoscaling Lakebase app resource. RunSql resolves the endpoint and connects to the selected database.",
  },
];

export const BuildSqlEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  components,
  normalizedAppResources = [],
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "BuildSql")) {
    return null;
  }

  const parsedTokens = parseBuildSqlTokens(node.params.sqlTemplate);
  const invalidTokens = getInvalidBuildSqlTokens(
    node.params.sqlTemplate,
    components,
  );
  const synchronizedPlaceholders = synchronizeBuildSqlPlaceholders(
    node.params.sqlTemplate,
    node.params.placeholders,
    components,
  );
  const selectedSourceOption = SQL_SOURCE_OPTIONS.find(
    (option) => option.value === node.params.sqlSourceKind,
  );

  const provisionedLakebaseResources: NormalizedAppResource[] =
    normalizedAppResources.filter(
      (r) => r.kind === AppResourceKindSlug.Database,
    );
  const autoscalingLakebaseResources: NormalizedAppResource[] =
    normalizedAppResources.filter(
      (r) => r.kind === AppResourceKindSlug.AutoscalingDatabase,
    );

  const lakebaseResourceOptions: NormalizedAppResource[] =
    node.params.sqlSourceKind === "lakebaseProvisionedDatabase"
      ? provisionedLakebaseResources
      : node.params.sqlSourceKind === "lakebaseAutoscaling"
        ? autoscalingLakebaseResources
        : [];

  return (
    <div className="mt-2 space-y-3">
      <div className="space-y-1">
        <Label className="text-sm">SQL Source</Label>
        <Select
          value={node.params.sqlSourceKind ?? ""}
          onValueChange={(value) =>
            onUpdateNode(workflowId, node.id, (current) => {
              if (!isWorkflowActionNode(current, "BuildSql")) {
                return current;
              }
              const nextKind = value as WorkflowSqlSourceKind;
              const prevFamily = lakebaseSourceFamily(current.params.sqlSourceKind);
              const nextFamily = lakebaseSourceFamily(nextKind);
              const clearLakebase =
                nextKind === "unityCatalogTable" || prevFamily !== nextFamily;
              return {
                ...current,
                params: {
                  ...current.params,
                  sqlSourceKind: nextKind,
                  ...(clearLakebase
                    ? {
                        lakebaseAppResourceName: undefined,
                        lakebaseDatabaseName: undefined,
                      }
                    : {}),
                },
              };
            })
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select SQL source..." />
          </SelectTrigger>
          <SelectContent>
            {SQL_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {selectedSourceOption?.helperText ??
            "Choose whether all tables in this SQL statement are Unity Catalog or Lakebase so runtime execution can call the correct method."}
        </p>
      </div>

      {(node.params.sqlSourceKind === "lakebaseProvisionedDatabase" ||
        node.params.sqlSourceKind === "lakebaseAutoscaling") && (
        <div className="space-y-1 rounded-md border border-border bg-muted/80 p-3">
          <Label className="text-sm">Lakebase app resource</Label>
          {lakebaseResourceOptions.length === 0 ? (
            <p className="text-xs text-warning-foreground">
              {node.params.sqlSourceKind === "lakebaseAutoscaling"
                ? "No Lakebase Autoscaling resources are attached to this app. Add one in App Settings > Resources."
                : "No provisioned Lakebase resources are attached to this app. Add one in App Settings > Resources."}
            </p>
          ) : (
            <Select
              value={node.params.lakebaseAppResourceName ?? ""}
              onValueChange={(resourceName) => {
                const picked = lakebaseResourceOptions.find(
                  (r) => r.name === resourceName,
                );
                const dbName = picked?.database?.database_name?.trim() ?? "";
                onUpdateNode(workflowId, node.id, (current) =>
                  isWorkflowActionNode(current, "BuildSql")
                    ? {
                        ...current,
                        params: {
                          ...current.params,
                          lakebaseAppResourceName: resourceName || undefined,
                          lakebaseDatabaseName: dbName || undefined,
                        },
                      }
                    : current,
                );
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-card">
                <SelectValue placeholder="Select attached resource..." />
              </SelectTrigger>
              <SelectContent>
                {lakebaseResourceOptions.map((r) => (
                  <SelectItem key={r.name} value={r.name}>
                    {r.name}
                    {r.database?.database_name
                      ? ` — ${r.database.database_name}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {node.params.lakebaseAppResourceName &&
          node.params.lakebaseDatabaseName ? (
            <p className="text-xs text-muted-foreground">
              Database{" "}
              <span className="font-mono">
                {node.params.lakebaseDatabaseName}
              </span>{" "}
              is taken from the resource metadata and emitted in generated{" "}
              <span className="font-mono">app.yaml</span>.
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-sm">SQL Template</Label>
        <Textarea
          value={node.params.sqlTemplate}
          placeholder="SELECT * FROM main.sales.orders WHERE customer_id = {customer_input}"
          className="min-h-32 font-mono text-sm"
          onChange={(event) => {
            const sqlTemplate = event.target.value;

            onUpdateNode(workflowId, node.id, (current) =>
              isWorkflowActionNode(current, "BuildSql")
                ? {
                    ...current,
                    params: {
                      ...current.params,
                      sqlTemplate,
                      placeholders: synchronizeBuildSqlPlaceholders(
                        sqlTemplate,
                        current.params.placeholders,
                        components,
                      ),
                    },
                  }
                : current,
            );
          }}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{"}componentCodeName{"}"} tokens to reference component values.
          All referenced tables in the statement should belong to the selected
          SQL source.
        </p>
      </div>

      {invalidTokens.length > 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-foreground">
          Unknown component tokens:{" "}
          {invalidTokens.map((token) => `{${token}}`).join(", ")}
        </div>
      )}

      <div className="space-y-2 rounded-md border border-border p-3">
        <div>
          <Label className="text-sm font-medium">Parsed Placeholders</Label>
          <p className="text-xs text-muted-foreground">
            Placeholder metadata stays synchronized to the template tokens.
          </p>
        </div>

        {parsedTokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No component tokens found in the SQL template.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Format Hint</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {synchronizedPlaceholders.map((placeholder) => (
                <TableRow key={placeholder.token}>
                  <TableCell className="font-mono text-xs">
                    {`{${placeholder.token}}`}
                  </TableCell>
                  <TableCell>{placeholder.componentCodeName}</TableCell>
                  <TableCell>{placeholder.valueType}</TableCell>
                  <TableCell>{placeholder.formatHint ?? "raw"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
