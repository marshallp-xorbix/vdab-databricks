import {
  createContext,
  useContext,
  useState,
  type FC,
  type ReactNode,
} from "react";

export type BuilderMode = "canvas" | "workflow" | "code" | "settings";

interface BuilderLayoutContextValue {
  builderMode: BuilderMode;
  setBuilderMode: (mode: BuilderMode) => void;
  isLeftPanelOpen: boolean;
  setIsLeftPanelOpen: (open: boolean) => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (open: boolean) => void;
  /** Shown in BrandedTopBar next to the logo (URL + loaded app details). */
  headerAppTitle: string;
  setHeaderAppTitle: (title: string) => void;
}

const BuilderLayoutContext = createContext<BuilderLayoutContextValue | null>(
  null,
);

interface BuilderLayoutProviderProps {
  children: ReactNode;
}

export const BuilderLayoutProvider: FC<BuilderLayoutProviderProps> = ({
  children,
}) => {
  const [builderMode, setBuilderMode] = useState<BuilderMode>("canvas");
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [headerAppTitle, setHeaderAppTitle] = useState("");

  return (
    <BuilderLayoutContext.Provider
      value={{
        builderMode,
        setBuilderMode,
        isLeftPanelOpen,
        setIsLeftPanelOpen,
        isRightPanelOpen,
        setIsRightPanelOpen,
        headerAppTitle,
        setHeaderAppTitle,
      }}
    >
      {children}
    </BuilderLayoutContext.Provider>
  );
};

export function useBuilderLayout(): BuilderLayoutContextValue {
  const context = useContext(BuilderLayoutContext);
  if (!context) {
    throw new Error(
      "useBuilderLayout must be used within BuilderLayoutProvider",
    );
  }
  return context;
}
