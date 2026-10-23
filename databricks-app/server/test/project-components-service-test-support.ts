import type { CallerIdentity } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import type { ProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";

export const caller: CallerIdentity = {
  userId: "editor-1",
  preferredUsername: "Editor",
  email: "editor@example.com",
  workspaceId: "untrusted-workspace-value",
  authenticationMode: "local-test",
  isInstallationAdmin: false,
  databricksAccessToken: null,
};

export class RecordingComponentsRepository implements ProjectComponentsRepository {
  lastActor: ProjectActor | null = null;
  lastComponents: ProjectComponent[] = [];
  replaceCalls = 0;

  async getComponents(
    projectId: string,
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument> {
    this.lastActor = actor;
    return { projectId, version: 3, components: [] };
  }

  async replaceComponents(
    projectId: string,
    expectedVersion: number,
    components: ProjectComponent[],
    actor: ProjectActor,
  ): Promise<ProjectComponentsDocument> {
    this.replaceCalls += 1;
    this.lastActor = actor;
    this.lastComponents = components;
    return {
      projectId,
      version: expectedVersion + 1,
      components,
    };
  }
}

export function validTextInput(key: string): ProjectComponent {
  return {
    key,
    type: "TextInput",
    schemaVersion: 1,
    componentVersion: 1,
    codeName: key.replaceAll("-", "_"),
    description: null,
    properties: { label: key },
    bindings: null,
    children: [],
    layout: null,
  };
}
