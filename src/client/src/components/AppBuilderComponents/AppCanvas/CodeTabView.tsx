import type { FC } from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tree } from "react-arborist";
import { ChevronDown, ChevronRight, FileCode2, Folder } from "lucide-react";
import type { ICodePreviewFile } from "../../../models";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../ui/resizable";
import {
  buildCodeTree,
  countVisibleCodeTreeRows,
  inferMonacoLanguage,
  isCustomModulesPreviewPath,
  isPrebuiltLibraryVirtualPath,
  PREBUILT_LIBRARY_VIRTUAL_PATH,
  type CodeTreeNode,
} from "../../../utils/codePreviewUtils";
import { useTheme } from "../../../context/ThemeContext";

const Editor = lazy(() => import("@monaco-editor/react"));

const CODE_TREE_ROW_HEIGHT = 26;
/** Ignore flex pre-layout measurements that would collapse the tree to ~1px. */
const MIN_TRUSTED_SCROLL_VIEWPORT_PX = 48;

interface CodeTabViewProps {
  files: ICodePreviewFile[];
  selectedFilePath: string | null;
  loading: boolean;
  onSelectFile: (path: string) => void;
  openState: Record<string, boolean>;
  onToggleDirectory: (directoryPath: string, isOpen: boolean) => void;
  /** Live buffer for `custom_modules.py`; when this file is selected, Monaco edits update this via `onCustomModulesCodeChange`. */
  customModulesCode: string;
  onCustomModulesCodeChange: (next: string) => void;
  /** Embedded read-only `prebuilt_modules_library.py` from the platform (not in `files`). */
  prebuiltModulesLibrarySource: string;
  /** When true (app record still loading), show preview file body until `customModulesCode` is populated from the API. */
  appMetaLoading?: boolean;
  previewErrors?: string[];
  /** Disables custom module edits for standalone read-only project members. */
  readOnly?: boolean;
}

const CodeTabView: FC<CodeTabViewProps> = ({
  files,
  selectedFilePath,
  loading,
  onSelectFile,
  openState,
  onToggleDirectory,
  customModulesCode,
  onCustomModulesCodeChange,
  prebuiltModulesLibrarySource,
  appMetaLoading = false,
  previewErrors = [],
  readOnly = false,
}) => {
  const { theme } = useTheme();
  const codeListScrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(400);

  const treeData = useMemo(() => buildCodeTree(files), [files]);

  const visibleRowCount = useMemo(
    () => countVisibleCodeTreeRows(treeData, openState),
    [treeData, openState],
  );

  const contentTreeHeight = useMemo(
    () =>
      Math.max(CODE_TREE_ROW_HEIGHT, visibleRowCount * CODE_TREE_ROW_HEIGHT),
    [visibleRowCount],
  );

  const treeHeight = useMemo(() => {
    const viewportLooksUnmeasured =
      scrollViewportHeight < MIN_TRUSTED_SCROLL_VIEWPORT_PX;
    const effectiveViewport = viewportLooksUnmeasured
      ? Number.POSITIVE_INFINITY
      : scrollViewportHeight;
    return Math.min(effectiveViewport, contentTreeHeight);
  }, [scrollViewportHeight, contentTreeHeight]);

  const treeRemountKey = useMemo(() => {
    const pathsKey = files
      .map((file) => file.path)
      .sort()
      .join("\n");
    const openKey = JSON.stringify(openState);
    return `${pathsKey}::${openKey}`;
  }, [files, openState]);

  const measureScrollViewport = useCallback(() => {
    const element = codeListScrollRef.current;
    if (!element) {
      return;
    }

    const raw = Math.floor(element.clientHeight);
    if (raw < MIN_TRUSTED_SCROLL_VIEWPORT_PX) {
      return;
    }

    setScrollViewportHeight(raw);
  }, []);

  useEffect(() => {
    const element = codeListScrollRef.current;
    if (!element) {
      return undefined;
    }

    measureScrollViewport();

    const observer = new ResizeObserver(() => {
      measureScrollViewport();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [loading, files.length, measureScrollViewport]);

  useLayoutEffect(() => {
    measureScrollViewport();
  }, [
    measureScrollViewport,
    openState,
    visibleRowCount,
    treeData,
    loading,
    files.length,
  ]);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedFilePath) ?? null,
    [files, selectedFilePath],
  );

  const isPrebuiltLibrarySelected = isPrebuiltLibraryVirtualPath(
    selectedFilePath,
  );

  const editorLanguage = inferMonacoLanguage(
    isPrebuiltLibrarySelected ? "prebuilt_modules_library.py" : selectedFile?.path ?? null,
  );
  const isCustomModulesEditable = isCustomModulesPreviewPath(selectedFile?.path);
  const customModulesDisplayValue =
    appMetaLoading && customModulesCode.length === 0
      ? (selectedFile?.content ?? "")
      : customModulesCode;
  const editorValue = isCustomModulesEditable
    ? customModulesDisplayValue
    : isPrebuiltLibrarySelected
      ? prebuiltModulesLibrarySource
      : (selectedFile?.content ?? "");

  const editorReadOnly =
    readOnly || !isCustomModulesEditable || appMetaLoading || isPrebuiltLibrarySelected;

  const showEditor =
    Boolean(selectedFile) || isPrebuiltLibrarySelected;

  return (
    <div className="h-full min-h-0 flex flex-col overscroll-none">
      {previewErrors.length > 0 ? (
        <div className="shrink-0 border-b border-warning/40 bg-warning-subtle px-4 py-3 text-sm text-warning-foreground">
          <p className="font-semibold">
            Code preview generated with workflow errors.
          </p>
          <p className="mt-1 text-xs text-warning-foreground/80">
            Invalid workflows were disabled for this preview so component code
            can still render. Fix these issues and reload the Code tab to
            include workflow code.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-warning-foreground/80">
            {previewErrors.map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="code-tab-split-layout"
        className="flex-1 min-h-0 overflow-hidden overscroll-none bg-[var(--builder-panel-bg)]"
      >
        <ResizablePanel defaultSize={24} minSize={16} className="min-h-0">
          <div className="h-full border-r border-[var(--builder-chrome-border)] overflow-hidden min-h-0 flex flex-col">
            <div className="h-8 px-3 flex items-center border-b border-[var(--builder-chrome-border)] text-[11px] tracking-wide font-semibold text-muted-foreground">
              FILES
            </div>

            <div className="flex flex-1 min-h-0 flex-col">
              <div
                ref={codeListScrollRef}
                className="flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-contain"
              >
                {loading ? (
                  <div className="shrink-0 px-4 py-10 text-center text-sm text-muted-foreground">
                    Loading code preview...
                  </div>
                ) : files.length === 0 ? (
                  <div className="shrink-0 px-4 py-10 text-center text-sm text-muted-foreground">
                    No generated files are available for preview.
                  </div>
                ) : (
                  <div
                    className="shrink-0 w-full overflow-hidden"
                    style={{ height: treeHeight }}
                  >
                    <Tree<CodeTreeNode>
                      key={treeRemountKey}
                      data={treeData}
                      width="100%"
                      height={treeHeight}
                      disableDrag
                      disableDrop
                      disableEdit
                      openByDefault={false}
                      initialOpenState={openState}
                      paddingTop={0}
                      paddingBottom={0}
                      rowHeight={CODE_TREE_ROW_HEIGHT}
                      indent={16}
                    >
                      {(nodeProps) => {
                        const node = nodeProps.node.data;
                        const isSelected =
                          !node.isDirectory &&
                          selectedFilePath === node.fullPath;
                        const isOpen = nodeProps.node.isOpen;
                        const depthPadding = 8 + nodeProps.node.level * 12;

                        return (
                          <div
                            style={{
                              ...nodeProps.style,
                              paddingLeft: `${depthPadding}px`,
                            }}
                            className={`h-full leading-5 flex items-center pr-2 text-[13px] ${
                              node.isDirectory
                                ? "text-foreground"
                                : "text-muted-foreground"
                            } ${isSelected ? "bg-muted text-foreground" : "hover:bg-muted"}`}
                            onClick={() => {
                              if (node.isDirectory) {
                                onToggleDirectory(
                                  node.fullPath,
                                  !nodeProps.node.isOpen,
                                );
                                nodeProps.node.toggle();
                                return;
                              }

                              if (!node.isDirectory) {
                                onSelectFile(node.fullPath);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") {
                                return;
                              }

                              event.preventDefault();

                              if (node.isDirectory) {
                                onToggleDirectory(
                                  node.fullPath,
                                  !nodeProps.node.isOpen,
                                );
                                nodeProps.node.toggle();
                                return;
                              }

                              onSelectFile(node.fullPath);
                            }}
                            aria-label={node.fullPath}
                            title={node.fullPath}
                          >
                            <span className="w-4 shrink-0 flex items-center justify-center">
                              {node.isDirectory ? (
                                isOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                )
                              ) : null}
                            </span>
                            <span className="w-4 mr-2 shrink-0 flex items-center justify-center">
                              {node.isDirectory ? (
                                <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </span>
                            <span className="truncate">{node.name}</span>
                          </div>
                        );
                      }}
                    </Tree>
                  </div>
                )}

                <div className="shrink-0 border-t border-[var(--builder-chrome-border)] bg-muted/80">
                  <div className="h-8 px-3 flex items-center border-b border-[var(--builder-chrome-border)] text-[11px] tracking-wide font-semibold text-muted-foreground">
                    Library
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectFile(PREBUILT_LIBRARY_VIRTUAL_PATH)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] leading-5 text-muted-foreground hover:bg-muted ${
                      isPrebuiltLibrarySelected
                        ? "bg-muted text-foreground"
                        : ""
                    }`}
                  >
                    <span className="w-4 shrink-0" />
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">prebuilt_modules_library.py</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={76} minSize={40} className="min-h-0">
          <div className="h-full min-w-0 min-h-0 overflow-hidden">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Loading file content...
              </div>
            ) : !showEditor ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Select a file to view generated code.
              </div>
            ) : (
              <Suspense
                fallback={
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    Loading editor...
                  </div>
                }
              >
                <Editor
                  key={
                    isPrebuiltLibrarySelected
                      ? PREBUILT_LIBRARY_VIRTUAL_PATH
                      : (selectedFile?.path ?? "none")
                  }
                  height="100%"
                  theme={theme === "light" ? "vs" : "vs-dark"}
                  language={editorLanguage}
                  value={editorValue}
                  onChange={(next) => {
                    if (editorReadOnly) {
                      return;
                    }
                    onCustomModulesCodeChange(next ?? "");
                  }}
                  options={{
                    ariaLabel: isCustomModulesEditable
                      ? "Custom Python module source"
                      : "Generated app code",
                    readOnly: editorReadOnly,
                    automaticLayout: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    lineNumbers: "on",
                    fontSize: 13,
                    lineHeight: 20,
                    tabSize: 2,
                    padding: { top: 8 },
                  }}
                />
              </Suspense>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default CodeTabView;
