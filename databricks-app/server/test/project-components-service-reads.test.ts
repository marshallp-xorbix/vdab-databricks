import assert from "node:assert/strict";
import test from "node:test";
import type { CallerIdentity } from "../src/contracts.ts";
import type {
  ProjectComponent,
  ProjectComponentsDocument,
} from "../src/db/project-components-contract.ts";
import { PROJECT_COMPONENT_TYPES } from "../src/db/project-components-contract.ts";
import { ProjectComponentsService } from "../src/db/project-components-service.ts";
import type { ProjectComponentsRepository } from "../src/db/project-components-repository.ts";
import type { ProjectActor } from "../src/db/project-repository.ts";
import {
  caller,
  RecordingComponentsRepository,
  validTextInput,
} from "./project-components-service-test-support.ts";

test("ProjectComponentsService_PassesReadsThroughWithTrustedWorkspaceActor", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");

  const document = await service.getComponents(caller, "request-read", "project-1");

  assert.equal(document.projectId, "project-1");
  assert.equal(repository.lastActor?.workspaceId, "workspace-a");
  assert.equal(repository.lastActor?.requestId, "request-read");
});
