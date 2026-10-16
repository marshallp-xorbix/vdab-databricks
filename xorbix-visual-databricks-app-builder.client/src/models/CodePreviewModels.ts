import type { WorkflowDefinition } from "../types/workflow";

export interface ICodePreviewFile {
  path: string;
  content: string;
}

export interface ICodePreviewRequest {
  appName: string;
  appId: number;
  themeConfig?: {
    primaryColor?: string;
    backgroundColor?: string;
    secondaryBackgroundColor?: string;
    textColor?: string;
    pageWidth?: number;
  };
  formComponents: Record<string, unknown>[];
  workflowDefinition?: WorkflowDefinition;
  /** When set (including empty string), preview uses this body for `custom_modules.py`. */
  customModulesCode?: string;
}

export interface ICodePreviewResponse {
  files: ICodePreviewFile[];
  previewErrors?: string[];
  /** Embedded platform prebuilt library source (read-only in Code tab). */
  prebuiltModulesLibrarySource?: string;
}
