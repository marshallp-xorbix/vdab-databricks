import { useMemo, useState } from "react";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { toast } from "../ui/use-toast";
import type { DatabricksConnectionStatusDto } from "../../models";
import {
  CreateTenantAiModelRequest,
  type ITenantAiModel,
  UpdateTenantAiModelRequest,
} from "../../models/TenantAiModel";
import {
  useTenantAiModelMutations,
  useTenantAiModels,
} from "../../hooks/useTenantAiModels";
import { usePlatformAiUsage } from "../../hooks/usePlatformAiUsage";
import PlatformAiUsageMeter from "../aiBuilder/PlatformAiUsageMeter";
import { DatabricksServingEndpointSelectorEditor } from "../properties/DatabricksServingEndpointSelectorEditor";

interface ITenantAiModelsSectionProps {
  workspaces: DatabricksConnectionStatusDto[];
  workspacesLoading?: boolean;
  canManage: boolean;
}

type FormState = {
  displayName: string;
  databricksConnectionId: string;
  endpointName: string;
  accessToken: string;
};

const emptyForm: FormState = {
  displayName: "",
  databricksConnectionId: "",
  endpointName: "",
  accessToken: "",
};

function TenantAiModelsSection({
  workspaces,
  workspacesLoading = false,
  canManage,
}: Readonly<ITenantAiModelsSectionProps>) {
  const { data: models = [], isLoading, error } = useTenantAiModels();
  const {
    usage: platformUsage,
    isLoading: isPlatformUsageLoading,
    isRefreshing: isPlatformUsageRefreshing,
    refetch: refetchPlatformUsage,
  } = usePlatformAiUsage();
  const { createMutation, updateMutation, deleteMutation } =
    useTenantAiModelMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ITenantAiModel | null>(null);
  const [editingModel, setEditingModel] = useState<ITenantAiModel | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const connectionOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        id: workspace.pkId,
        label: workspace.workspaceDisplayName,
      })),
    [workspaces],
  );

  const selectedConnectionId = Number(form.databricksConnectionId);

  const openCreateDialog = () => {
    setEditingModel(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (model: ITenantAiModel) => {
    setEditingModel(model);
    setForm({
      displayName: model.displayName,
      databricksConnectionId: String(model.databricksConnectionId),
      endpointName: model.endpointName,
      accessToken: "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const connectionId = Number(form.databricksConnectionId);
    if (
      !form.displayName.trim() ||
      !form.endpointName.trim() ||
      connectionId <= 0
    ) {
      toast({
        title: "Missing required fields",
        description: "Display name, workspace, and endpoint name are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingModel) {
        await updateMutation.mutateAsync({
          id: editingModel.tenantAiModelId,
          request: new UpdateTenantAiModelRequest({
            displayName: form.displayName.trim(),
            databricksConnectionId: connectionId,
            endpointName: form.endpointName.trim(),
            accessToken: form.accessToken.trim() || undefined,
          }),
        });
        toast({ title: "AI model updated" });
      } else {
        if (!form.accessToken.trim()) {
          toast({
            title: "Access token required",
            description:
              "Enter a PAT with Model Serving access for the new model.",
            variant: "destructive",
          });
          return;
        }

        await createMutation.mutateAsync(
          new CreateTenantAiModelRequest({
            displayName: form.displayName.trim(),
            databricksConnectionId: connectionId,
            endpointName: form.endpointName.trim(),
            accessToken: form.accessToken.trim(),
          }),
        );
        toast({ title: "AI model created" });
      }

      setDialogOpen(false);
    } catch (err) {
      toast({
        title: editingModel ? "Update failed" : "Create failed",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.tenantAiModelId);
      toast({ title: "AI model deleted" });
      setDeleteTarget(null);
    } catch (err) {
      toast({
        title: "Delete failed",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI Models</h2>
          <p className="text-sm text-muted-foreground">
            Register Databricks Model Serving endpoints for AI Builder. All
            tenant members can select these models in the app builder chat.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreateDialog}
            disabled={workspacesLoading || connectionOptions.length === 0}
          >
            + Add AI Model
          </Button>
        )}
      </div>

      {!workspacesLoading && connectionOptions.length === 0 && (
        <p className="text-sm text-warning-foreground">
          Add a Databricks workspace connection before registering AI models.
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load AI models."}
        </p>
      )}

      <PlatformAiUsageMeter
        usage={platformUsage}
        isLoading={isPlatformUsageLoading}
        isRefreshing={isPlatformUsageRefreshing}
        onRefresh={() => void refetchPlatformUsage()}
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading AI models...
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display name</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Created</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 5 : 4}
                    className="text-muted-foreground"
                  >
                    No tenant AI models configured yet.
                  </TableCell>
                </TableRow>
              ) : (
                models.map((model) => (
                  <TableRow key={model.tenantAiModelId}>
                    <TableCell className="font-medium">
                      {model.displayName}
                    </TableCell>
                    <TableCell>
                      {model.databricksConnectionDisplayName}
                    </TableCell>
                    <TableCell>{model.endpointName}</TableCell>
                    <TableCell>
                      {new Date(model.createdOn).toLocaleDateString()}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="AI model actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => openEditDialog(model)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(model)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingModel ? "Edit AI Model" : "Add AI Model"}
            </DialogTitle>
            <DialogDescription>
              The endpoint is validated on save and must support function
              calling for AI Builder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ai-model-display-name">Display name</Label>
              <Input
                id="ai-model-display-name"
                value={form.displayName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model-connection">Databricks workspace</Label>
              <Select
                value={form.databricksConnectionId}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    databricksConnectionId: value,
                    endpointName: "",
                  }))
                }
              >
                <SelectTrigger id="ai-model-connection">
                  <SelectValue placeholder="Select a workspace" />
                </SelectTrigger>
                <SelectContent>
                  {connectionOptions.map((option) => (
                    <SelectItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model-endpoint">Serving endpoint name</Label>
              <DatabricksServingEndpointSelectorEditor
                id="ai-model-endpoint"
                value={form.endpointName}
                onChange={(endpointName) =>
                  setForm((prev) => ({ ...prev, endpointName }))
                }
                workspaceConnectionId={
                  selectedConnectionId > 0 ? selectedConnectionId : undefined
                }
                showFieldLabel={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model-token">
                Access token (PAT)
                {editingModel ? " — leave blank to keep existing" : ""}
              </Label>
              <Input
                id="ai-model-token"
                type="password"
                autoComplete="off"
                value={form.accessToken}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, accessToken: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving
                ? "Saving..."
                : editingModel
                  ? "Save changes"
                  : "Create model"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete AI model</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.displayName}? Users who selected this model
              will fall back to the VDAB default.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isSaving}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TenantAiModelsSection;
