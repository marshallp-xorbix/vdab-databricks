import type { VdabComponent } from "./components";

/**
 * Type definitions for the AppBuilder editor interface
 */

/**
 * Types of editor tabs
 */
export const TabType = {
  MainFlow: "mainFlow",
  MainPage: "mainPage",
  Modal: "modal",
} as const;

export type TabType = (typeof TabType)[keyof typeof TabType];

export const CanvasContextType = {
  Page: "page",
  Modal: "modal",
} as const;

export type CanvasContextType =
  (typeof CanvasContextType)[keyof typeof CanvasContextType];

export const DEFAULT_PAGE_CONTEXT_ID = "1";
export const PAGE_CONTEXT_PREFIX = "page_";
export const MODAL_CONTEXT_PREFIX = "modal_";

export const getPageContextKey = (
  pageId: string = DEFAULT_PAGE_CONTEXT_ID,
): string => `${PAGE_CONTEXT_PREFIX}${pageId}`;

export const getCurrentPageContextKey = (): string =>
  getPageContextKey(DEFAULT_PAGE_CONTEXT_ID);

export const getModalContextKey = (modalId: string): string =>
  `${MODAL_CONTEXT_PREFIX}${modalId}`;

export const isModalContextKey = (contextKey: string): boolean =>
  contextKey.startsWith(MODAL_CONTEXT_PREFIX);

export const getModalIdFromContextKey = (
  contextKey: string,
): string | undefined =>
  isModalContextKey(contextKey)
    ? contextKey.slice(MODAL_CONTEXT_PREFIX.length)
    : undefined;

/**
 * Represents a tab in the editor tab bar
 */
export interface EditorTab {
  /** Unique identifier for the tab */
  id: string;

  /** Type of tab */
  type: TabType;

  /** Display label for the tab */
  label: string;

  /** For modal tabs, the component ID of the modal */
  modalId?: string;

  /** Whether the tab can be closed */
  canClose: boolean;
}

/**
 * Component contexts grouped by context key (page_{id}, modal_{id}, etc.)
 */
export type ComponentContexts = Record<string, VdabComponent[]>;

export type OwnerContextByComponentId = Record<string, string>;

export type ParentByChildId = Record<string, string>;

export interface ComponentOwnershipIndexes {
  ownerContextByComponentId: OwnerContextByComponentId;
  parentByChildId: ParentByChildId;
}
