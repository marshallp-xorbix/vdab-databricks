import type { FC } from "react";
import { useState } from "react";
import type { VdabComponent } from "../../types/components";
import type { Binding } from "../../types/components/bindings";
import { BindingEditorFactory } from "./BindingEditorFactory";
import { useComponentRegistry } from "../../context/ComponentRegistryContext";
import { Label } from "../ui/label";
import type { WorkflowBindingOverrideSummary } from "../../utils/workflow/workflowBindingOverrides";

interface BindingsPanelProps {
  component: VdabComponent;
  onUpdateBindings: (bindings: Record<string, Binding>) => void;
  workflowBindingOverrides?: WorkflowBindingOverrideSummary[];
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
  workspaceConnectionId?: number;
}

export const BindingsPanel: FC<BindingsPanelProps> = ({
  component,
  onUpdateBindings,
  workflowBindingOverrides = [],
  onJumpToWorkflowAction,
  workspaceConnectionId,
}) => {
  const { registry } = useComponentRegistry();
  const [showAddBinding, setShowAddBinding] = useState(false);

  const supportedBindings = component.supportedBindings || [];
  const currentBindings = component.bindings || {};
  const bindingSchemas = registry?.bindingSchemas || [];
  const workflowOverridesByBindingType = workflowBindingOverrides.reduce<
    Record<string, WorkflowBindingOverrideSummary[]>
  >((accumulator, override) => {
    const currentOverrides = accumulator[override.bindingType] ?? [];
    accumulator[override.bindingType] = [...currentOverrides, override];
    return accumulator;
  }, {});

  // Get available binding types that can be added (not already added)
  const availableBindings = supportedBindings.filter(
    (bindingType) => !currentBindings[bindingType],
  );
  const hasExistingBinding = Object.keys(currentBindings).length > 0;
  const canAddBinding = !hasExistingBinding && availableBindings.length > 0;

  const handleAddBinding = (bindingType: string) => {
    const schema = bindingSchemas.find((s) => s.type === bindingType);
    if (!schema) return;

    const defaultConfig = schema.defaultConfig || {};
    const newBinding: Binding = {
      ...(defaultConfig as Binding),
    };

    const updatedBindings = {
      ...currentBindings,
      [bindingType]: newBinding,
    };

    onUpdateBindings(updatedBindings);
    setShowAddBinding(false);
  };

  const handleUpdateBinding = (
    bindingType: string,
    updatedBinding: Binding,
  ) => {
    const updatedBindings = {
      ...currentBindings,
      [bindingType]: updatedBinding,
    };
    onUpdateBindings(updatedBindings);
  };

  const handleRemoveBinding = (bindingType: string) => {
    const updatedBindings = { ...currentBindings };
    delete updatedBindings[bindingType];
    onUpdateBindings(updatedBindings);
  };

  const renderWorkflowOverrides = (bindingType: string) => {
    const overrides = workflowOverridesByBindingType[bindingType] ?? [];
    if (overrides.length === 0) {
      return null;
    }

    return (
      <div className="space-y-2 rounded-md bg-warning-subtle px-3 py-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground">
            Workflow override
          </p>
          <p className="text-xs text-warning-foreground">
            A workflow can replace this binding at runtime.
          </p>
        </div>
        <div className="space-y-2">
          {overrides.map((override) => (
            <div
              key={`${override.workflowCodeName}:${override.nodeId}`}
              className="rounded-md bg-card px-3 py-2 shadow-sm"
            >
              <p className="text-sm font-medium text-foreground">
                {override.workflowCodeName}
              </p>
              <p className="text-xs text-muted-foreground">{override.nodeLabel}</p>
              <p className="text-xs text-muted-foreground">
                Source: {override.sourceNodeId}.{override.outputKey}
              </p>
              {onJumpToWorkflowAction ? (
                <button
                  type="button"
                  onClick={() =>
                    onJumpToWorkflowAction(
                      override.workflowCodeName,
                      override.nodeId,
                    )
                  }
                  className="mt-2 text-xs font-medium text-primary hover:text-primary-hover"
                >
                  Open action
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const overrideOnlyBindingTypes = Object.keys(workflowOverridesByBindingType)
    .filter((bindingType) => !currentBindings[bindingType])
    .sort((left, right) => left.localeCompare(right));

  if (supportedBindings.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        This component does not support any bindings.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Existing bindings */}
      {Object.entries(currentBindings).map(([bindingType, binding]) => {
        const schema = bindingSchemas.find((s) => s.type === bindingType);
        if (!schema) return null;

        return (
          <div
            key={bindingType}
            className="space-y-2 rounded-lg bg-muted/90 p-3"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">{schema.label}</Label>
              <button
                onClick={() => handleRemoveBinding(bindingType)}
                className="text-xs text-destructive hover:text-destructive-foreground"
              >
                Remove
              </button>
            </div>
            <BindingEditorFactory
              binding={binding}
              schema={schema}
              onChange={(updatedBinding) =>
                handleUpdateBinding(bindingType, updatedBinding)
              }
              workspaceConnectionId={workspaceConnectionId}
            />
            {renderWorkflowOverrides(bindingType)}
          </div>
        );
      })}

      {overrideOnlyBindingTypes.map((bindingType) => {
        const schema = bindingSchemas.find(
          (candidate) => candidate.type === bindingType,
        );

        return (
          <div
            key={`workflow-override-${bindingType}`}
            className="space-y-2 rounded-lg bg-warning-subtle/70 p-3"
          >
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                {schema?.label || bindingType}
              </Label>
              <span className="text-xs text-warning-foreground">Workflow only</span>
            </div>
            {renderWorkflowOverrides(bindingType)}
          </div>
        );
      })}

      {/* Add Binding button */}
      {canAddBinding && (
        <div>
          {!showAddBinding ? (
            <button
              onClick={() => setShowAddBinding(true)}
              className="w-full rounded-md bg-muted px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              + Add Binding
            </button>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm">Select binding type:</Label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddBinding(e.target.value);
                  }
                }}
                className="h-9 w-full rounded-md border-0 bg-muted px-3 py-1 text-sm"
                defaultValue=""
              >
                <option value="">Select...</option>
                {availableBindings.map((bindingType) => {
                  const schema = bindingSchemas.find(
                    (s) => s.type === bindingType,
                  );
                  return (
                    <option key={bindingType} value={bindingType}>
                      {schema?.label || bindingType}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={() => setShowAddBinding(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {!canAddBinding &&
        Object.keys(currentBindings).length === 0 && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No bindings available for this component.
          </div>
        )}
    </div>
  );
};
