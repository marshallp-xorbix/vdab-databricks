import type { FC } from "react";
import { useState } from "react";
import type { VdabComponent } from "../../types/components";
import type { Binding } from "../../types/components/bindings";
import { useComponentRegistry } from "../../context/ComponentRegistryContext";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import DataWindowTableBindingEditor from "../DataWindowTableBindingEditor";
import type { WorkflowBindingOverrideSummary } from "../../utils/workflow/workflowBindingOverrides";
import type { ProjectJsonObject } from "../../models/ProjectComponents";

interface BindingsPanelProps {
  component: VdabComponent;
  onUpdateBindings: (bindings: Record<string, Binding> | null) => void;
  workflowBindingOverrides?: WorkflowBindingOverrideSummary[];
  onJumpToWorkflowAction?: (workflowCodeName: string, nodeId?: string) => void;
}

/** SaaS-style Add/Remove bindings section for components with supportedBindings. */
export const BindingsPanel: FC<BindingsPanelProps> = ({
  component,
  onUpdateBindings,
  workflowBindingOverrides = [],
  onJumpToWorkflowAction,
}) => {
  const { registry } = useComponentRegistry();
  const [showAddBinding, setShowAddBinding] = useState(false);
  const supportedBindings = component.supportedBindings || [];
  const currentBindings = (component.bindings || {}) as Record<string, Binding>;
  const bindingSchemas = registry?.bindingSchemas || [];
  const availableBindings = supportedBindings.filter(
    (bindingType) => !currentBindings[bindingType],
  );
  const hasExistingBinding = Object.keys(currentBindings).length > 0;
  const canAddBinding = !hasExistingBinding && availableBindings.length > 0;
  const activeBindingType = Object.keys(currentBindings)[0];
  const activeSchema = bindingSchemas.find(
    (schema) => schema.type === activeBindingType,
  );

  if (supportedBindings.length === 0) {
    return null;
  }

  function handleAddBinding(bindingType: string): void {
    const schema = bindingSchemas.find((entry) => entry.type === bindingType);
    if (!schema) return;
    const defaultConfig = (schema.defaultConfig || {}) as Binding;
    onUpdateBindings({ [bindingType]: defaultConfig });
    setShowAddBinding(false);
  }

  function handleRemoveBinding(bindingType: string): void {
    const next = { ...currentBindings };
    delete next[bindingType];
    onUpdateBindings(Object.keys(next).length > 0 ? next : null);
  }

  const overrides = workflowBindingOverrides.filter(
    (override) => override.bindingType === activeBindingType,
  );

  return (
    <section className="space-y-3" aria-label="Bindings">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bindings
        </h3>
        {canAddBinding ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setShowAddBinding((open) => !open)}
          >
            {showAddBinding ? "Cancel" : "Add binding"}
          </Button>
        ) : null}
      </div>

      {showAddBinding ? (
        <div className="grid gap-2 rounded-md border border-border p-2">
          <Label className="text-xs">Binding type</Label>
          <ul className="grid gap-1">
            {availableBindings.map((bindingType) => {
              const schema = bindingSchemas.find(
                (entry) => entry.type === bindingType,
              );
              return (
                <li key={bindingType}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => handleAddBinding(bindingType)}
                  >
                    {schema?.label ?? bindingType}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {activeBindingType && activeSchema ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{activeSchema.label}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive"
              onClick={() => handleRemoveBinding(activeBindingType)}
            >
              Remove
            </Button>
          </div>
          <DataWindowTableBindingEditor
            componentKey={component.id}
            bindings={(component.bindings ?? null) as ProjectJsonObject | null}
            disabled={false}
            onChange={(bindings) =>
              onUpdateBindings(
                bindings as Record<string, Binding> | null,
              )
            }
          />
          {overrides.length > 0 ? (
            <div className="space-y-2 rounded-md bg-warning-subtle px-3 py-2">
              <p className="text-xs font-medium uppercase tracking-wide text-warning-foreground">
                Workflow override
              </p>
              {overrides.map((override) => (
                <div
                  key={`${override.workflowCodeName}:${override.nodeId}`}
                  className="flex items-center justify-between gap-2"
                >
                  <p className="text-xs text-warning-foreground">
                    {override.workflowCodeName}
                  </p>
                  {onJumpToWorkflowAction ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        onJumpToWorkflowAction(
                          override.workflowCodeName,
                          override.nodeId,
                        )
                      }
                    >
                      Open action
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No data binding is configured for this component.
        </p>
      )}
    </section>
  );
};

export default BindingsPanel;
