import { ApplicationError } from "../application-error.ts";
import type { ProjectSummary } from "../contracts.ts";
import type { ProjectComponentsDocument } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import { generateProjectSource } from "./preview-component-source.ts";
import { resolveWorkflowModuleFiles } from "./preview-workflow-modules.ts";
import { projectUsesLakebase } from "./preview-lakebase-helpers.ts";

const SUPPORTED_COMPONENT_TYPES = new Set([
  "DashboardEmbed",
  "GenieChat",
  "ModelChat",
  "TextInput",
  "Button",
  "Checkbox",
  "Toggle",
  "Dropdown",
  "DatePicker",
  "TimePicker",
  "Slider",
  "Label",
  "Expander",
  "Columns",
  "Rows",
  "Tabs",
  "Form",
  "Modal",
  "FileUpload",
  "DataWindow",
  "EditableDataWindow",
  "BarChart",
  "LineChart",
  "PieChart",
  "DonutChart",
  "AmoebaStory",
  "FlowFieldStory",
  "HeatMapStory",
  "HoneycombStory",
  "NetworkWebStory",
  "PulseWaveStory",
  "SpiralStory",
  "TerrainStory",
]);

export interface PreviewFile {
  path: string;
  content: string;
}

/** Deterministic source preview for the currently implemented generated runtime. */
export interface ProjectPreview {
  projectId: string;
  version: number;
  previewOnly: true;
  files: PreviewFile[];
}

export class ProjectPreviewGenerator {
  generate(
    project: ProjectSummary,
    document: ProjectComponentsDocument,
    workflow: ProjectWorkflowDefinition = { version: 1, workflows: [] },
    customModulesSource?: string,
  ): ProjectPreview {
    const unsupportedTypes = [...new Set(
      document.components
        .filter((component) => !SUPPORTED_COMPONENT_TYPES.has(component.type))
        .map((component) => component.type),
    )];

    if (unsupportedTypes.length > 0) {
      throw new ApplicationError(
        422,
        "preview_component_not_supported",
        "Component preview not supported",
        `Preview currently supports DashboardEmbed, GenieChat, ModelChat, TextInput, Button, Checkbox, Toggle, Dropdown, DatePicker, TimePicker, Slider, Label, Expander, Columns, Rows, Tabs, Form, Modal, FileUpload, Unity Catalog DataWindow components, Delta-backed EditableDataWindow, Unity Catalog BarChart, LineChart, PieChart, DonutChart, AmoebaStory, FlowFieldStory, HeatMapStory, HoneycombStory, NetworkWebStory, PulseWaveStory, SpiralStory, and TerrainStory components. Unsupported component types: ${unsupportedTypes.join(", ")}.`,
      );
    }

    const moduleFiles = resolveWorkflowModuleFiles(workflow, customModulesSource);
    const content = generateProjectSource(project.name, document.components, workflow);
    const files: PreviewFile[] = [{ path: "app.py", content }];
    if (projectUsesLakebase(document.components, workflow)) {
      files.push({ path: "requirements.txt", content: "asyncpg==0.32.0\n" });
    }
    if (moduleFiles.customModulesSource !== null) {
      files.push({ path: "custom_modules.py", content: moduleFiles.customModulesSource });
    }
    if (moduleFiles.prebuiltModulesLibrarySource !== null) {
      files.push({ path: "prebuilt_modules_library.py", content: moduleFiles.prebuiltModulesLibrarySource });
    }

    return {
      projectId: document.projectId,
      version: document.version,
      previewOnly: true,
      files,
    };
  }
}
