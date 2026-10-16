import { ComponentType, ComponentCategory } from "./componentTypes";
import type { Binding } from "./bindings";

/**
 * Base VDAB component structure
 * Props are dynamically typed based on component registry metadata from backend
 *
 * IMPORTANT: Keep this schema synchronized with backend class at:
 * Xorbix-Visual-Databricks-App-Builder.Models/DTOs/Vdab/VdabComponentDto.cs
 *
 */
export interface VdabComponent {
  id: string;
  codeName: string;
  type: ComponentType;
  category: ComponentCategory;
  icon?: string;
  layout?: string;
  /** Props bag from the registry / designer; narrowed per-renderer when read. */
  props: Record<string, unknown>;
  bindings?: Record<string, Binding>;
  supportedBindings?: string[]; // e.g., ["unityCatalogTable"]
  supportedEvents?: string[]; // e.g., ["onClick", "onChange"]
  children?: string[];
  schemaVersion: number; // integer, start at 1
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    secondaryBackgroundColor?: string;
    textColor?: string;
  };
}
