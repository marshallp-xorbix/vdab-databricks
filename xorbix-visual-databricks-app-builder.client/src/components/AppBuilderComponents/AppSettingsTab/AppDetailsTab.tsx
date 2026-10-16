import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import type { AppDetails } from "../../../hooks/useAppPersistence";
import type { DatabricksConnection } from "../../../models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import type { DatabricksAppNamesLoadState } from "../../../hooks/useDatabricksAppNames";
import DatabricksAppNameCombobox from "./DatabricksAppNameCombobox";
import SettingsCard from "./SettingsCard";

interface AppDetailsTabProps {
  appId: number | null;
  appDetails: AppDetails;
  workspaceConnections: DatabricksConnection[];
  onDetailChange: <K extends keyof AppDetails>(
    field: K,
    value: AppDetails[K],
  ) => void;
  databricksAppNames: string[];
  databricksAppNamesLoadState: DatabricksAppNamesLoadState;
  databricksAppNamesError: string | null;
}

export default function AppDetailsTab({
  appId,
  appDetails,
  workspaceConnections,
  onDetailChange,
  databricksAppNames,
  databricksAppNamesLoadState,
  databricksAppNamesError,
}: AppDetailsTabProps) {
  return (
    <div className="space-y-6">
      <SettingsCard title="Application Identity">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label className="text-sm text-foreground" htmlFor="projectName">
              App name
            </Label>
            <Input
              id="projectName"
              type="text"
              value={appDetails.appName}
              onChange={(e) => onDetailChange("appName", e.target.value)}
              placeholder="MyVDABApp"
              className="mt-1 bg-card"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This name will appear on your apps dashboard.
            </p>
          </div>
          <div>
            <DatabricksAppNameCombobox
              appId={appId}
              workspaceConnectionId={appDetails.workspaceConnectionId}
              value={appDetails.databricksAppName}
              onChange={(name) => onDetailChange("databricksAppName", name)}
              appNames={databricksAppNames}
              loadState={databricksAppNamesLoadState}
              errorMessage={databricksAppNamesError}
            />
          </div>
        </div>

        <div className="mt-5">
          <Label className="text-sm text-foreground" htmlFor="description">
            Description
          </Label>
          <textarea
            id="description"
            value={appDetails.description}
            onChange={(e) => onDetailChange("description", e.target.value)}
            rows={4}
            placeholder="Add a short description for this app (who uses it, what it collects, etc.)."
            className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />
        </div>
      </SettingsCard>

      <SettingsCard title="Workspace & Infrastructure">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label className="text-sm text-foreground" htmlFor="workspacePath">
              Workspace path
            </Label>
            <Input
              id="workspacePath"
              type="text"
              value={appDetails.workspacePath}
              onChange={(e) => onDetailChange("workspacePath", e.target.value)}
              placeholder="/Workspace/Users/username/my-apps"
              className="mt-1 bg-card"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The Databricks workspace path where this app will be deployed.
            </p>
          </div>

          <div>
            <Label className="text-sm text-foreground" htmlFor="workspaceConnectionId">
              Workspace connection
            </Label>
            <Select
              value={appDetails.workspaceConnectionId}
              onValueChange={(value) => onDetailChange("workspaceConnectionId", value)}
            >
              <SelectTrigger
                id="workspaceConnectionId"
                className="mt-1 w-full rounded-md border-border"
              >
                <SelectValue placeholder="Select workspace connection..." />
              </SelectTrigger>
              <SelectContent>
                {workspaceConnections.map((connection) => (
                  <SelectItem
                    key={connection.pkId}
                    value={connection.pkId.toString()}
                  >
                    {connection.workspaceDisplayName ||
                      connection.workspaceUrl ||
                      `Connection ${connection.pkId}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Select the Databricks connection used for deployment.
            </p>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}

