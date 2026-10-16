import type { FC } from "react";
import type { Binding, BindingSchema } from "../../types/components/bindings";
import { UnityCatalogTableSelectorEditor } from "./UnityCatalogTableSelectorEditor";
import { DatabricksVolumeSelectorEditor } from "./DatabricksVolumeSelectorEditor";
import { LakebaseProvisionedDatabaseSelectorEditor } from "./LakebaseProvisionedDatabaseSelectorEditor";
import { LakebaseAutoscalingTableSelectorEditor } from "./LakebaseAutoscalingTableSelectorEditor";

interface BindingEditorFactoryProps {
  binding: Binding;
  schema: BindingSchema;
  onChange: (binding: Binding) => void;
  workspaceConnectionId?: number;
}

/**
 * Factory component that renders the appropriate editor for a binding based on its schema
 */
export const BindingEditorFactory: FC<BindingEditorFactoryProps> = ({
  binding,
  schema,
  onChange,
  workspaceConnectionId,
}) => {
  switch (schema.editorType) {
    case "UnityCatalogTableSelector":
      return (
        <UnityCatalogTableSelectorEditor
          binding={binding}
          onChange={onChange}
          workspaceConnectionId={workspaceConnectionId}
        />
      );
    case "DatabricksVolumeSelector":
      return (
        <DatabricksVolumeSelectorEditor
          binding={binding}
          onChange={onChange}
          workspaceConnectionId={workspaceConnectionId}
        />
      );
    case "LakebaseProvisionedDatabaseSelector":
      return (
        <LakebaseProvisionedDatabaseSelectorEditor
          binding={binding}
          onChange={onChange}
          workspaceConnectionId={workspaceConnectionId}
        />
      );
    case "LakebaseAutoscalingTableSelector":
      return (
        <LakebaseAutoscalingTableSelectorEditor
          binding={binding}
          onChange={onChange}
          workspaceConnectionId={workspaceConnectionId}
        />
      );
    default:
      return (
        <div className="text-xs text-muted-foreground">
          Unknown editor type: {schema.editorType}
        </div>
      );
  }
};
