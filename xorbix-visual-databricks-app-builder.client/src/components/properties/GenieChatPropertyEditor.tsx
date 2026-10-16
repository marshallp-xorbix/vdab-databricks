import { Info } from "lucide-react";
import type { FC } from "react";
import type { NormalizedAppResource } from "../../models/DatabricksAppModels";
import type { VdabComponent } from "../../types/components";
import { AppResourceKindSlug } from "../../types/appResourceKinds";
import {
  HEIGHT_PIXELS_DEFAULT,
  HEIGHT_PIXELS_MAX,
  HEIGHT_PIXELS_MIN,
} from "../../utils/componentProps/heightPixelsUtils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { BooleanPropertyEditor } from "./BooleanPropertyEditor";
import { HeightPixelsPropertyEditor } from "./HeightPixelsPropertyEditor";
import { StringPropertyEditor } from "./StringPropertyEditor";

interface GenieChatPropsShape {
  genieSpaceAppResourceName?: string;
  title?: string;
  showBorder?: boolean;
  chatTotalHeightPixels?: number;
}

interface GenieChatPropertyEditorProps {
  component: VdabComponent;
  normalizedResources: NormalizedAppResource[];
  onPropertyChange: (key: string, value: unknown) => void;
}

export const GenieChatPropertyEditor: FC<GenieChatPropertyEditorProps> = ({
  component,
  normalizedResources,
  onPropertyChange,
}) => {
  const props = component.props as GenieChatPropsShape;
  const title = typeof props.title === "string" ? props.title : "";
  const showBorder = props.showBorder === true;
  const chatTotalHeightPixels = props.chatTotalHeightPixels;
  const genieSpaces = normalizedResources.filter(
    (r) => r.kind === AppResourceKindSlug.GenieSpace,
  );
  const selected =
    typeof props.genieSpaceAppResourceName === "string"
      ? props.genieSpaceAppResourceName.trim()
      : "";

  const selectedInvalid =
    selected.length > 0 &&
    !genieSpaces.some(
      (r) => r.name.trim().toLowerCase() === selected.toLowerCase(),
    );

  const selectId = `genie-space-select-${component.id}`;

  return (
    <div className="space-y-4">
      <StringPropertyEditor
        label="Title (designer label)"
        value={title}
        placeholder="Genie Chat"
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
            Genie space app resource
          </label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Genie space resource help"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs" side="top">
                Add a Genie space under App Settings → App resources (kind{" "}
                <span className="font-mono">genie_space</span>) before binding.
                The resource <strong>name</strong> must match what Databricks
                uses for <span className="font-mono">valueFrom</span> in{" "}
                <span className="font-mono">app.yaml</span>.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <select
          id={selectId}
          className={`flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            selectedInvalid ? "border-warning" : ""
          }`}
          value={selected}
          onChange={(e) =>
            onPropertyChange("genieSpaceAppResourceName", e.target.value)
          }
        >
          <option value="">Select a Genie space resource…</option>
          {genieSpaces.map((r) => (
            <option key={r.name} value={r.name.trim()}>
              {r.name.trim()}
            </option>
          ))}
        </select>
        {genieSpaces.length === 0 ? (
          <p className="text-xs text-warning-foreground mt-1">
            No Genie space resources loaded. Open App Settings, add a{" "}
            <span className="font-mono">genie_space</span> resource, save, then
            return here.
          </p>
        ) : null}
        {selectedInvalid ? (
          <p className="text-xs text-warning-foreground mt-1">
            The selected resource is not in the current app resource list. Pick a
            valid Genie space or refresh after saving App Settings.
          </p>
        ) : null}
      </div>
    </div>
  );
};
