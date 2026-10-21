import type { ProjectJsonObject } from "../models/ProjectComponents";
import DataWindowPropertiesEditor from "./DataWindowPropertiesEditor";

interface IEditableDataWindowPropertiesEditorProps {
  componentKey: string;
  properties: ProjectJsonObject;
  bindings: ProjectJsonObject | null;
  disabled: boolean;
  onPropertiesChange: (properties: ProjectJsonObject) => void;
  onBindingsChange: (bindings: ProjectJsonObject | null) => void;
}

function EditableDataWindowPropertiesEditor({
  componentKey,
  properties,
  bindings,
  disabled,
  onPropertiesChange,
  onBindingsChange,
}: Readonly<IEditableDataWindowPropertiesEditorProps>) {
  return (
    <DataWindowPropertiesEditor
      componentKey={componentKey}
      editable
      properties={properties}
      bindings={bindings}
      disabled={disabled}
      onPropertiesChange={onPropertiesChange}
      onBindingsChange={onBindingsChange}
    />
  );
}

export default EditableDataWindowPropertiesEditor;
