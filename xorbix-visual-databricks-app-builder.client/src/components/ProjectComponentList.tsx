import ProjectComponentBranch from "./ProjectComponentBranch";
import type { IProjectComponent } from "../models/ProjectComponents";

interface IProjectComponentListProps {
  components: IProjectComponent[];
  selectedKey: string | null;
  disabled: boolean;
  onSelect: (componentKey: string) => void;
}

function ProjectComponentList({
  components,
  selectedKey,
  disabled,
  onSelect,
}: Readonly<IProjectComponentListProps>) {
  const componentsByKey = new Map(
    components.map((component) => [component.key, component]),
  );
  const childKeys = new Set(components.flatMap((component) => component.children));
  const rootComponents = components.filter((component) => !childKeys.has(component.key));

  return (
    <nav aria-label="Project components">
      <ol className="grid gap-2">
        {rootComponents.map((component, index) => (
          <ProjectComponentBranch
            key={component.key}
            component={component}
            componentsByKey={componentsByKey}
            position={`${index + 1}`}
            selectedKey={selectedKey}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </nav>
  );
}

export default ProjectComponentList;
