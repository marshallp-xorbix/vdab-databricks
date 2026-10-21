import ProjectComponentButton from "./ProjectComponentButton";
import type { IProjectComponent } from "../models/ProjectComponents";

interface IProjectComponentBranchProps {
  component: IProjectComponent;
  componentsByKey: ReadonlyMap<string, IProjectComponent>;
  position: string;
  selectedKey: string | null;
  disabled: boolean;
  onSelect: (componentKey: string) => void;
}

function ProjectComponentBranch({
  component,
  componentsByKey,
  position,
  selectedKey,
  disabled,
  onSelect,
}: Readonly<IProjectComponentBranchProps>) {
  return (
    <li>
      <ProjectComponentButton
        component={component}
        position={position}
        selectedKey={selectedKey}
        disabled={disabled}
        onSelect={onSelect}
      />
      {component.children.length > 0 && (
        <ol
          aria-label={`Children of ${component.type} ${component.key}`}
          className="ml-4 grid gap-1 border-l border-border pl-2"
        >
          {component.children.map((childKey, childIndex) => {
            const child = componentsByKey.get(childKey);
            if (!child) {
              return null;
            }

            return (
              <ProjectComponentBranch
                key={child.key}
                component={child}
                componentsByKey={componentsByKey}
                position={readChildPosition(component, child, childIndex, componentsByKey, position)}
                selectedKey={selectedKey}
                disabled={disabled}
                onSelect={onSelect}
              />
            );
          })}
        </ol>
      )}
    </li>
  );
}

function readChildPosition(
  parent: IProjectComponent,
  child: IProjectComponent,
  childIndex: number,
  componentsByKey: ReadonlyMap<string, IProjectComponent>,
  parentPosition: string,
): string {
  if (parent.type !== "Tabs") {
    return `${parentPosition}.${childIndex + 1}`;
  }

  const tabIndex = child.layout?.tabIndex;
  if (typeof tabIndex !== "number" || !Number.isSafeInteger(tabIndex) || tabIndex < 0) {
    return `${parentPosition}.${childIndex + 1}`;
  }

  const panePosition = parent.children
    .slice(0, childIndex + 1)
    .filter((key) => componentsByKey.get(key)?.layout?.tabIndex === tabIndex)
    .length;
  return `${parentPosition}.${tabIndex + 1}.${panePosition}`;
}

export default ProjectComponentBranch;
