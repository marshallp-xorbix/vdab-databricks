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

test("ProjectComponentsService_RejectsInvalidAuthorityVersionsAndNestedReferences", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const validComponent = {
    key: "component-1",
    type: "TextInput",
    schemaVersion: 1,
    properties: { label: "Customer" },
    children: [],
  };
  const invalidRequests: unknown[] = [
    { version: 0, components: [] },
    { version: 1, workspaceHost: "https://outside.invalid", components: [] },
    { version: 1, components: [{ ...validComponent, key: "bad key" }] },
    { version: 1, components: [{ ...validComponent, type: "Unknown" }] },
    { version: 1, components: [{ ...validComponent, schemaVersion: 0 }] },
    {
      version: 1,
      components: [
        validComponent,
        { ...validComponent, codeName: "customer" },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "DatePicker",
          properties: { label: "Pick a date", defaultValue: "2025-02-30" },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "DatePicker",
          properties: {
            label: "Pick a date",
            minDate: "2025-02-01",
            maxDate: "2025-01-01",
          },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "DatePicker",
          properties: { label: "Pick a date", format: "DD/MM/YY" },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "TimePicker",
          properties: { label: "Pick a time", defaultValue: "25:30" },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "TimePicker",
          properties: { label: "Pick a time", step: 0 },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "TimePicker",
          properties: { label: "Pick a time", step: 82_801 },
        },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, children: ["missing-child"] },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, children: ["component-2"] },
        { ...validComponent, key: "component-2", children: ["component-1"] },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, properties: { workspaceHost: "https://outside.invalid" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, bindings: { source: { workspaceConnectionId: "external" } } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, properties: { number: Number.POSITIVE_INFINITY } },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "Dropdown",
          properties: { label: "Pick one", options: [{ value: "one", externalUrl: "https://outside.invalid" }] },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "Dropdown",
          properties: { label: "Pick one", options: [{ value: 1 }] },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          ...validComponent,
          type: "Dropdown",
          properties: {
            label: "Pick one",
            options: [{ value: "one" }],
            defaultValue: "missing",
            multiselect: true,
          },
        },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section", defaultExpanded: "true" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section", unknown: true } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", schemaVersion: 2, properties: { sectionTitle: "Section" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, layout: { y: 0 } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, bindings: { source: "table" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, children: ["nested-expander"] },
        { ...validComponent, key: "nested-expander", type: "Expander", properties: { sectionTitle: "Nested" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, children: ["unsupported-child"] },
        { ...validComponent, key: "unsupported-child", type: "Form", properties: {} },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Expander", properties: { sectionTitle: "Section" }, children: ["nested-input"] },
        { ...validComponent, key: "nested-input", children: ["other-input"] },
        { ...validComponent, key: "other-input" },
      ],
    },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 0 } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 1.5 } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 13 } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: "two" } }] },
    { version: 1, components: [{ ...validComponent, type: "Columns", properties: { columnCount: 2, extra: true } }] },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Columns", properties: { columnCount: 1 }, children: ["first-input", "second-input"] },
        validTextInput("first-input"),
        validTextInput("second-input"),
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Columns", properties: { columnCount: 2 }, children: ["nested-expander"] },
        { ...validComponent, key: "nested-expander", type: "Expander", properties: { sectionTitle: "Nested" } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Columns", properties: { columnCount: 2 }, bindings: { source: "volume" } },
      ],
    },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 0 } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 1.5 } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 13 } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: "two" } }] },
    { version: 1, components: [{ ...validComponent, type: "Rows", properties: { rowCount: 2, extra: true } }] },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Rows", properties: { rowCount: 1 }, children: ["first-input", "second-input"] },
        validTextInput("first-input"),
        validTextInput("second-input"),
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Rows", properties: { rowCount: 2 }, children: ["nested-columns"] },
        { ...validComponent, key: "nested-columns", type: "Columns", properties: { columnCount: 2 } },
      ],
    },
    {
      version: 1,
      components: [
        { ...validComponent, type: "Rows", properties: { rowCount: 2 }, bindings: { source: "volume" } },
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_RejectsOversizedAndOverdeepJson", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  let nestedValue: unknown = "value";

  for (let depth = 0; depth < 22; depth += 1) {
    nestedValue = { child: nestedValue };
  }

  const invalidRequests = [
    {
      version: 1,
      components: [
        {
          key: "deep-json",
          type: "TextInput",
          schemaVersion: 1,
          properties: { nested: nestedValue },
        },
      ],
    },
    {
      version: 1,
      components: [
        {
          key: "large-json",
          type: "TextInput",
          schemaVersion: 1,
          properties: { text: "x".repeat(950_000) },
        },
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

