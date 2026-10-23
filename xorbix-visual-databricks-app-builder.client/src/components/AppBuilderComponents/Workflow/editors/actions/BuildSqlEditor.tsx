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
import {
  isWorkflowActionNode,
  type WorkflowSqlSourceKind,
} from "../../../../../types/workflow";
import BuildSqlInstalledResourceFields from "./BuildSqlInstalledResourceFields";
import {
  getInvalidBuildSqlTokens,
  parseBuildSqlTokens,
  synchronizeBuildSqlPlaceholders,
} from "../../../../../utils/workflow/buildSqlTemplateUtils";
import { lakebaseSourceFamily, SQL_SOURCE_OPTIONS } from "./buildSqlSourceOptions";
import type { WorkflowActionEditorProps } from "./types";

/** Edits a SQL action's source, component tokens, and parsed placeholder metadata. */
export const BuildSqlEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  components,
  normalizedAppResources = [],
  workspaceConnectionId,
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "BuildSql")) {
    return null;
  }

  const standaloneWorkspace = workspaceConnectionId === undefined;
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
              const previousFamily = lakebaseSourceFamily(
                current.params.sqlSourceKind,
              );
              const nextFamily = lakebaseSourceFamily(nextKind);
              const clearLakebase =
                nextKind === "unityCatalogTable" ||
                previousFamily !== nextFamily;

              return {
                ...current,
                params: {
                  ...current.params,
                  sqlSourceKind: nextKind,
                  ...(nextKind !== "unityCatalogTable"
                    ? { sqlWarehouseId: undefined, sqlWarehouseName: undefined }
                    : {}),
                  ...(clearLakebase
                    ? {
                        lakebaseAppResourceName: undefined,
                        lakebaseDatabaseName: undefined,
                        lakebaseInstanceName: undefined,
                        lakebaseProjectId: undefined,
                        lakebaseBranchId: undefined,
                        lakebaseEndpointId: undefined,
                        lakebaseDatabaseId: undefined,
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

      <BuildSqlInstalledResourceFields
        workflowId={workflowId}
        node={node}
        normalizedAppResources={normalizedAppResources}
        isStandaloneWorkspace={standaloneWorkspace}
        onUpdateNode={onUpdateNode}
      />

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
