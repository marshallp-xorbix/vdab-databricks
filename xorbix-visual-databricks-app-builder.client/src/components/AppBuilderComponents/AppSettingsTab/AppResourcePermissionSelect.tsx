import { useMemo } from "react";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import type { NormalizedAppResource } from "../../../models/DatabricksAppModels";
import {
  applyPermissionToResource,
  getResourcePermissionValue,
} from "../../../utils/appResourceEditor";
import {
  RESOURCE_FIELD_LABEL_CLASS,
  SELECT_VALUE_APP_RESOURCE_PERMISSION_EMPTY,
} from "../../../constants/databricksAppResourcesUi";
import {
  formatPermissionLabel,
  mergePermissionOptionsForKind,
  type AppResourceKind,
} from "../../../types/appResourceKinds";

interface AppResourcePermissionSelectProps {
  resource: NormalizedAppResource;
  onChange: (next: NormalizedAppResource) => void;
  /** When false, omit the field label (e.g. when a table column header supplies it). */
  showFieldLabel?: boolean;
}

export default function AppResourcePermissionSelect({
  resource,
  onChange,
  showFieldLabel = true,
}: AppResourcePermissionSelectProps) {
  const value = getResourcePermissionValue(resource);

  const permissionOptions = useMemo(() => {
    const kind = resource.kind as AppResourceKind;
    return mergePermissionOptionsForKind(kind, value);
  }, [resource.kind, value]);

  const selectValue = value.trim()
    ? value.trim()
    : SELECT_VALUE_APP_RESOURCE_PERMISSION_EMPTY;

  return (
    <div className="space-y-1">
      {showFieldLabel ? (
        <Label className={RESOURCE_FIELD_LABEL_CLASS}>Permission</Label>
      ) : null}
      <Select
        value={selectValue}
        onValueChange={(v) =>
          onChange(applyPermissionToResource(resource, v))
        }
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select permission" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value={SELECT_VALUE_APP_RESOURCE_PERMISSION_EMPTY}
            disabled
          >
            Select permission
          </SelectItem>
          {permissionOptions.map((p) => (
            <SelectItem key={p} value={p}>
              {formatPermissionLabel(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
