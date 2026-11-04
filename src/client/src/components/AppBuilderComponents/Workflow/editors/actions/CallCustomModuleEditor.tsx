import type { FC } from "react";
import { Label } from "../../../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../ui/select";
import { isWorkflowActionNode } from "../../../../../types/workflow";
import { parseCustomModuleFunctionOptions } from "../../../../../utils/workflow/customModuleFunctionParser";
import type { WorkflowActionEditorProps } from "./types";

export const CallCustomModuleEditor: FC<WorkflowActionEditorProps> = ({
  workflowId,
  node,
  customModulesCode = "",
  onUpdateNode,
}) => {
  if (!isWorkflowActionNode(node, "CallCustomModule")) {
    return null;
  }

  const functionOptions = parseCustomModuleFunctionOptions(customModulesCode);
  const selectedValue = node.params.functionName || undefined;
  const selectedExists = functionOptions.some(
    (option) => option.functionName === selectedValue,
  );

  return (
    <div className="mt-2 grid gap-3">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm">Target function</Label>
        <Select
          value={selectedValue}
          onValueChange={(value) =>
            onUpdateNode(workflowId, node.id, (current) =>
              isWorkflowActionNode(current, "CallCustomModule")
                ? {
                    ...current,
                    params: {
                      ...current.params,
                      functionName: value,
                    },
                  }
                : current,
            )
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Select Function" />
          </SelectTrigger>
          <SelectContent>
            {functionOptions.map((option) => (
              <SelectItem key={option.functionName} value={option.functionName}>
                {option.signature}
              </SelectItem>
            ))}
            {selectedValue && !selectedExists ? (
              <SelectItem value={selectedValue}>
                {selectedValue}(ctx) (current, not found in file)
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
        {functionOptions.length === 0 ? (
          <p className="text-xs text-warning-foreground">
            No top-level functions were found in `custom_modules.py`.
          </p>
        ) : null}
      </div>
    </div>
  );
};
