import { Info } from "lucide-react";
import type { FC } from "react";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import type { VdabComponent } from "../../types/components";
import {
  HEIGHT_PIXELS_DEFAULT,
  HEIGHT_PIXELS_MAX,
  HEIGHT_PIXELS_MIN,
} from "../../utils/componentProps/heightPixelsUtils";
import {
  findServingEndpointResourceByName,
  getServingEndpointResources,
  hasServingEndpointQueryPermission,
} from "../../utils/servingEndpointResourceUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import { HeightPixelsPropertyEditor } from "./HeightPixelsPropertyEditor";
import { StringPropertyEditor } from "./StringPropertyEditor";

interface ModelChatPropsShape {
  servingEndpointAppResourceName?: string;
  title?: string;
  showBorder?: boolean;
  chatTotalHeightPixels?: number;
}

interface IModelChatPropertyEditorProps {
  component: VdabComponent;
  normalizedResources: NormalizedAppResource[];
  onPropertyChange: (key: string, value: unknown) => void;
}

export const ModelChatPropertyEditor: FC<
  Readonly<IModelChatPropertyEditorProps>
> = ({
  component,
  normalizedResources,
  onPropertyChange,
}) => {
  const props = component.props as ModelChatPropsShape;
  const title = typeof props.title === "string" ? props.title : "";
  const showBorder = props.showBorder === true;
  const chatTotalHeightPixels = props.chatTotalHeightPixels;
  const servingEndpoints = getServingEndpointResources(normalizedResources);
  const selected =
    typeof props.servingEndpointAppResourceName === "string"
      ? props.servingEndpointAppResourceName.trim()
      : "";
  const selectedResource = findServingEndpointResourceByName(
    normalizedResources,
    selected,
  );
  const selectedInvalid = selected.length > 0 && selectedResource == null;
  const selectedPermissionInvalid =
    selectedResource != null && !hasServingEndpointQueryPermission(selectedResource);
  const selectId = `serving-endpoint-select-${component.id}`;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title (designer label)"
        value={title}
        placeholder="Model Chat"
        onChange={(next) => onPropertyChange("title", next)}
      />

      <BooleanPropertyEditor
        label="Border (theme outline)"
        value={showBorder}
        onChange={(next) => onPropertyChange("showBorder", next)}
      />
      <p className="text-xs text-muted-foreground -mt-2">
        When enabled, the deployed app wraps this chat in a Streamlit bordered
        container that follows your app theme.
      </p>

      <HeightPixelsPropertyEditor
        label="Chat height (px)"
        value={chatTotalHeightPixels}
        step={10}
        onChange={(next) =>
          onPropertyChange("chatTotalHeightPixels", next)
        }
      />
      <p className="text-xs text-muted-foreground -mt-2">
        Target total height for the chat area (scrollable thread plus reserved
        space for the input bar). Saves between {HEIGHT_PIXELS_MIN}px and{" "}
        {HEIGHT_PIXELS_MAX}px; blank defaults to {HEIGHT_PIXELS_DEFAULT}px.
      </p>

      <div>
        <div className="flex items-center gap-1 mb-0.5">
          <label
            htmlFor={selectId}
            className="block text-xs font-medium text-muted-foreground"
          >
            Serving endpoint app resource
          </label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Serving endpoint resource help"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs" side="top">
                Add a Serving endpoint under App Settings {"->"} App resources
                (kind <span className="font-mono">serving_endpoint</span>) with{" "}
                <span className="font-mono">CAN_QUERY</span> or{" "}
                <span className="font-mono">CAN_MANAGE</span> permission before
                binding.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <select
          id={selectId}
          className={`flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            selectedInvalid || selectedPermissionInvalid ? "border-warning" : ""
          }`}
          value={selected}
          onChange={(event) =>
            onPropertyChange("servingEndpointAppResourceName", event.target.value)
          }
        >
          <option value="">Select a Serving endpoint resource...</option>
          {servingEndpoints.map((resource) => (
            <option key={resource.name} value={resource.name.trim()}>
              {resource.name.trim()}
              {resource.servingEndpoint?.permission
                ? ` (${resource.servingEndpoint.permission})`
                : ""}
            </option>
          ))}
        </select>
        {servingEndpoints.length === 0 ? (
          <p className="text-xs text-warning-foreground mt-1">
            No Serving endpoint resources loaded. Open App Settings, add a{" "}
            <span className="font-mono">serving_endpoint</span> resource with{" "}
            <span className="font-mono">CAN_QUERY</span> permission, save, then
            return here.
          </p>
        ) : null}
        {selectedInvalid ? (
          <p className="text-xs text-warning-foreground mt-1">
            The selected resource is not in the current app resource list. Pick a
            valid Serving endpoint or refresh after saving App Settings.
          </p>
        ) : null}
        {selectedPermissionInvalid ? (
          <p className="text-xs text-warning-foreground mt-1">
            The selected resource must use CAN_QUERY or CAN_MANAGE permission for
            chat inference.
          </p>
        ) : null}
      </div>
    </div>
  );
};
