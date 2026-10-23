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

test("ProjectComponentsService_AcceptsOrderedFormControlsAndDocumentedDimensions", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-form", "project-1", {
    version: 1,
    components: [
      {
        key: "form",
        type: "Form",
        schemaVersion: 1,
        properties: {
          submitButtonText: "Save record",
          clearOnSubmit: true,
          enterToSubmit: false,
          border: false,
          width: 720,
          height: "content",
        },
        children: ["name", "approved"],
      },
      validTextInput("name"),
      {
        key: "approved",
        type: "Checkbox",
        schemaVersion: 1,
        properties: { label: "Approved", defaultChecked: false },
        children: [],
      },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["name", "approved"]);
  assert.equal(result.components[0]?.properties.width, 720);
});

test("ProjectComponentsService_RejectsInvalidFormPropertiesAndChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const form = {
    key: "form",
    type: "Form",
    schemaVersion: 1,
    properties: { submitButtonText: "Save" },
    children: ["child"],
  };
  const invalidRequests: unknown[] = [
    { version: 1, components: [{ ...form, properties: { ...form.properties, extra: true } }] },
    { version: 1, components: [{ ...form, properties: { ...form.properties, clearOnSubmit: "yes" } }] },
    { version: 1, components: [{ ...form, properties: { ...form.properties, width: "wide" } }] },
    { version: 1, components: [{ ...form, properties: { ...form.properties, width: 10_001 } }] },
    { version: 1, components: [{ ...form, schemaVersion: 2 }] },
    { version: 1, components: [{ ...form, layout: { y: 1 } }] },
    { version: 1, components: [{ ...form, bindings: { table: "resource" } }] },
    { version: 1, components: [{ ...form, children: ["child"] }, { ...validTextInput("child"), type: "Button" }] },
    {
      version: 1,
      components: [
        { ...form, children: ["child"] },
        { ...validTextInput("child"), children: ["grandchild"] },
        validTextInput("grandchild"),
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid-form", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsModalChildrenAndPreservesLegacyDimensions", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-modal", "project-1", {
    version: 1,
    components: [
      {
        key: "modal",
        type: "Modal",
        schemaVersion: 1,
        codeName: "reviewModal",
        properties: {
          title: "Review details",
          width: "medium",
          height: 640,
          position: "right",
          dismissible: false,
        },
        children: ["section", "confirm"],
      },
      {
        key: "section",
        type: "Expander",
        schemaVersion: 1,
        properties: { sectionTitle: "Details", defaultExpanded: true },
        children: ["note"],
      },
      validTextInput("note"),
      {
        ...validTextInput("confirm"),
        type: "Button",
        properties: { label: "Close" },
        layout: { y: 1 },
      },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["section", "confirm"]);
  assert.deepEqual(result.components[1]?.children, ["note"]);
  assert.equal(result.components[0]?.properties.height, 640);
  assert.equal(result.components[0]?.properties.position, "right");
  assert.equal(result.components[0]?.properties.dismissible, false);
});

test("ProjectComponentsService_RejectsInvalidModalPropertiesAndNesting", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const modal = {
    key: "modal",
    type: "Modal",
    schemaVersion: 1,
    properties: { title: "Review" },
    children: ["child"],
  };
  const invalidRequests: unknown[] = [
    { version: 1, components: [{ ...modal, properties: { title: "  " } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", width: "wide" } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", width: 2_147_483_648 } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", position: "top" } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", dismissible: "yes" } }] },
    { version: 1, components: [{ ...modal, properties: { title: "Review", height: "content" } }] },
    { version: 1, components: [{ ...modal, layout: { y: 1 } }] },
    { version: 1, components: [{ ...modal, bindings: { table: "resource" } }] },
    { version: 1, components: [{ ...modal, children: ["nested"] }, { ...modal, key: "nested" }] },
    { version: 1, components: [{ ...modal, children: ["child"] }, { ...validTextInput("child"), layout: { y: -1 } }] },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid-modal", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

