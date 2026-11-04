import type { ICodePreviewFile } from "../models";

/** Path of the user-editable Python helper module in the generated app bundle. */
export const CUSTOM_MODULES_FILE_PATH = "custom_modules.py";

/** Virtual path for the read-only platform library entry in the Code tab (not part of generated `files`). */
export const PREBUILT_LIBRARY_VIRTUAL_PATH =
  "__vdab_platform__/prebuilt_modules_library.py";

export function isPrebuiltLibraryVirtualPath(
  path: string | null | undefined,
): boolean {
  return path === PREBUILT_LIBRARY_VIRTUAL_PATH;
}

export function isCustomModulesPreviewPath(path: string | null | undefined): boolean {
  return path === CUSTOM_MODULES_FILE_PATH;
}

export interface CodeTreeNode {
  id: string;
  name: string;
  fullPath: string;
  isDirectory: boolean;
  children?: CodeTreeNode[];
}

interface MutableTreeNode {
  id: string;
  name: string;
  fullPath: string;
  isDirectory: boolean;
  children: Map<string, MutableTreeNode>;
}

const createDirectoryNode = (
  id: string,
  name: string,
  fullPath: string,
): MutableTreeNode => ({
  id,
  name,
  fullPath,
  isDirectory: true,
  children: new Map<string, MutableTreeNode>(),
});

const toCodeTreeNode = (node: MutableTreeNode): CodeTreeNode => {
  const sortedChildren = Array.from(node.children.values()).sort(
    (left, right) => {
      if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    },
  );

  return {
    id: node.id,
    name: node.name,
    fullPath: node.fullPath,
    isDirectory: node.isDirectory,
    children: sortedChildren.length
      ? sortedChildren.map((child) => toCodeTreeNode(child))
      : undefined,
  };
};

/** Counts rows shown in the code file tree for the current expand/collapse state (matches `openByDefault={false}` + `openState`). */
export function countVisibleCodeTreeRows(
  nodes: CodeTreeNode[],
  openState: Record<string, boolean>,
): number {
  let count = 0;

  for (const node of nodes) {
    count += 1;

    if (
      node.isDirectory &&
      node.children &&
      node.children.length > 0 &&
      openState[node.fullPath] === true
    ) {
      count += countVisibleCodeTreeRows(node.children, openState);
    }
  }

  return count;
}

export const buildCodeTree = (files: ICodePreviewFile[]): CodeTreeNode[] => {
  const root = createDirectoryNode("root", "root", "");

  files.forEach((file) => {
    const segments = file.path
      .split("/")
      .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
      return;
    }

    let cursor = root;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const nextPath = cursor.fullPath
        ? `${cursor.fullPath}/${segment}`
        : segment;
      const nodeId = nextPath;

      if (!cursor.children.has(nodeId)) {
        cursor.children.set(
          nodeId,
          isLeaf
            ? {
                id: nodeId,
                name: segment,
                fullPath: nextPath,
                isDirectory: false,
                children: new Map<string, MutableTreeNode>(),
              }
            : createDirectoryNode(nodeId, segment, nextPath),
        );
      }

      const nextNode = cursor.children.get(nodeId);
      if (nextNode) {
        cursor = nextNode;
      }
    });
  });

  return Array.from(root.children.values())
    .sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
    .map((child) => toCodeTreeNode(child));
};

export const chooseDefaultCodeFilePath = (
  files: ICodePreviewFile[],
  previousPath?: string | null,
): string | null => {
  if (files.length === 0) {
    return null;
  }

  if (previousPath && files.some((file) => file.path === previousPath)) {
    return previousPath;
  }

  const appPy = files.find((file) => file.path === "app.py");
  if (appPy) {
    return appPy.path;
  }

  const sortedPaths = files
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  return sortedPaths[0] ?? null;
};

export const inferMonacoLanguage = (path: string | null): string => {
  if (!path) {
    return "plaintext";
  }

  if (path.endsWith(".py")) {
    return "python";
  }

  if (path.endsWith(".yaml") || path.endsWith(".yml")) {
    return "yaml";
  }

  if (path.endsWith(".toml")) {
    return "ini";
  }

  if (path.endsWith(".json")) {
    return "json";
  }

  return "plaintext";
};
