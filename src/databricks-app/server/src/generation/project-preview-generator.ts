import { ApplicationError } from "../application-error.ts";
import type { ProjectSummary } from "../contracts.ts";
import type { ProjectComponentsDocument } from "../db/project-components-contract.ts";
import type { ProjectWorkflowDefinition } from "../db/project-workflow-contract.ts";
import { generateProjectSource } from "./preview-component-source.ts";
import {
  ASYNC_PG_LICENSE_FILE_PATH,
  ASYNC_PG_LICENSE_TEXT,
  ASYNC_PG_REQUIREMENTS_CONTENT,
} from "./asyncpg-package-notice.ts";
import { resolveWorkflowModuleFiles } from "./preview-workflow-modules.ts";
import { projectUsesLakebase } from "./preview-lakebase-helpers.ts";
import { DEFAULT_CUSTOM_MODULES_SOURCE } from "./custom-modules-template.ts";
import { PREVIEW_APP_MANIFEST_CONTENT } from "../generated-app-manifest.ts";

const DEFAULT_PAGE_WIDTH = 730;
const MINIMUM_PAGE_WIDTH = 730;
const MAXIMUM_PAGE_WIDTH = 1800;
const REQUIREMENTS_FILE_PATH = "requirements.txt";
const DEFAULT_THEME = {
  primaryColor: "#0078D4",
  backgroundColor: "#252526",
  secondaryBackgroundColor: "#2D2D30",
  textColor: "#CCCCCC",
} as const;

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
    const unsupportedTypes = [
      ...new Set(
        document.components
          .filter((component) => !SUPPORTED_COMPONENT_TYPES.has(component.type))
          .map((component) => component.type),
      ),
    ];

    if (unsupportedTypes.length > 0) {
      throw new ApplicationError(
        422,
        "preview_component_not_supported",
        "Component preview not supported",
        `Preview currently supports DashboardEmbed, GenieChat, ModelChat, TextInput, Button, Checkbox, Toggle, Dropdown, DatePicker, TimePicker, Slider, Label, Expander, Columns, Rows, Tabs, Form, Modal, FileUpload, Unity Catalog DataWindow components, Delta-backed EditableDataWindow, Unity Catalog BarChart, LineChart, PieChart, DonutChart, AmoebaStory, FlowFieldStory, HeatMapStory, HoneycombStory, NetworkWebStory, PulseWaveStory, SpiralStory, and TerrainStory components. Unsupported component types: ${unsupportedTypes.join(", ")}.`,
      );
    }

    const moduleFiles = resolveWorkflowModuleFiles(
      workflow,
      customModulesSource,
    );
    const pageWidth = readPageWidth(project.theme);
    const content = generateProjectSource(
      project.name,
      document.components,
      workflow,
      pageWidth,
    );
    const files: PreviewFile[] = [
      { path: "app.py", content },
      { path: "app.yaml", content: PREVIEW_APP_MANIFEST_CONTENT },
      { path: "custom_modules.py", content: moduleFiles.customModulesSource ?? DEFAULT_CUSTOM_MODULES_SOURCE },
      { path: REQUIREMENTS_FILE_PATH, content: "" },
      { path: ".streamlit/config.toml", content: getThemeConfig(project.theme) },
    ];
    if (projectUsesLakebase(document.components, workflow)) {
      const requirementsFile = files.find(
        (file) => file.path === REQUIREMENTS_FILE_PATH,
      );
      if (requirementsFile) {
        requirementsFile.content = ASYNC_PG_REQUIREMENTS_CONTENT;
      }
      files.push({
        path: ASYNC_PG_LICENSE_FILE_PATH,
        content: ASYNC_PG_LICENSE_TEXT,
      });
    }
    if (moduleFiles.prebuiltModulesLibrarySource !== null) {
      files.push({
        path: "prebuilt_modules_library.py",
        content: moduleFiles.prebuiltModulesLibrarySource,
      });
    }

    return {
      projectId: document.projectId,
      version: document.version,
      previewOnly: true,
      files,
    };
  }
}

function getThemeConfig(theme: Record<string, unknown> | null | undefined): string {
  const keys = ["primaryColor", "backgroundColor", "secondaryBackgroundColor", "textColor"] as const;
  const entries = keys.map((key) => {
    const value = theme?.[key];
    const fallback = DEFAULT_THEME[key];
    const color = typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
      ? value
      : fallback;
    return `${key} = "${color}"`;
  });
  return `[theme]\n${entries.join("\n")}\n`;
}

function readPageWidth(theme: Record<string, unknown> | null | undefined): number {
  const value = theme?.pageWidth;
  const parsedValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsedValue)) return DEFAULT_PAGE_WIDTH;
  return Math.min(MAXIMUM_PAGE_WIDTH, Math.max(MINIMUM_PAGE_WIDTH, Math.round(parsedValue)));
}
