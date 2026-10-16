import type { FC } from "react";
import { Label } from "../../../../ui/label";
import { Input } from "../../../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import { parsePrebuiltModuleFunctionOptions } from "../../../../../utils/workflow/parsePrebuiltModuleFunctionOptions";
import type { WorkflowActionEditorProps } from "./types";

export const CallPrebuiltModuleEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  prebuiltModulesLibrarySource = "",
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "CallPrebuiltModule")) {
    return null;
  }

  const functionOptions = parsePrebuiltModuleFunctionOptions(
    prebuiltModulesLibrarySource,
  );
  const selectedValue = node.params.functionName || undefined;
  const selected = functionOptions.find(
    (option) => option.functionName === selectedValue,
  );
  const selectedExists = Boolean(selected);

  return (
    <div className="mt-2 grid gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm">Prebuilt function</Label>
        <Select
          value={selectedValue}
          onValueChange={(value) =>
            onUpdateNode(workflowId, node.id, (current) => {
              if (!isWorkflowActionNode(current, "CallPrebuiltModule")) {
                return current;
              }

              const option = functionOptions.find(
                (o) => o.functionName === value,
              );
              const nextArgs: Record<string, string> = {};
              for (const name of option?.parameterNames ?? []) {
                nextArgs[name] =
                  current.params.namedArguments[name] ?? "";
              }

              return {
                ...current,
                params: {
                  functionName: value,
                  namedArguments: nextArgs,
                },
              };
            })
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select prebuilt function" />
          </SelectTrigger>
          <SelectContent>
            {functionOptions.map((option) => (
              <SelectItem
                key={option.functionName}
                value={option.functionName}
              >
                {option.signature}
              </SelectItem>
            ))}
            {selectedValue && !selectedExists ? (
              <SelectItem value={selectedValue}>
                {selectedValue} (current, not found in library)
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {!prebuiltModulesLibrarySource.trim() ? (
          <p className="text-xs text-warning-foreground">
            Prebuilt library text is not available yet. Reload the app or open
            the Code tab to refresh.
          </p>
        ) : null}
        {prebuiltModulesLibrarySource.trim() && functionOptions.length === 0 ? (
          <p className="text-xs text-warning-foreground">
            No eligible prebuilt functions were found (each must start with
            `ctx` as the first parameter).
          </p>
        ) : null}
      </div>

      {selected?.parameterNames.map((paramName) => (
        <div key={paramName} className="space-y-1 sm:col-span-2">
          <Label className="text-sm">{paramName}</Label>
          <Input
            className="h-8 text-sm"
            value={node.params.namedArguments[paramName] ?? ""}
            onChange={(event) =>
              onUpdateNode(workflowId, node.id, (current) => {
                if (!isWorkflowActionNode(current, "CallPrebuiltModule")) {
                  return current;
                }

                return {
                  ...current,
                  params: {
                    ...current.params,
                    namedArguments: {
                      ...current.params.namedArguments,
                      [paramName]: event.target.value,
                    },
                  },
                };
              })
            }
          />
        </div>
      ))}
    </div>
  );
};
