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

test("ProjectComponentsService_RejectsInvalidSliderPropertiesBeforePersistence", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const invalidSliders = [
    { label: "", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: false },
    { label: "Slider", minValue: 100, maxValue: 0, defaultValue: 50, step: 1, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 101, step: 1, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 0, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 101, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: true },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 75, upperValue: 50, step: 1, ranged: true },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, format: "bad-format", ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: "false" },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: Number.NaN, step: 1, ranged: false },
    { label: "Slider", minValue: 0, maxValue: 100, defaultValue: 50, step: 1, ranged: false, unknown: true },
  ];

  for (const [index, properties] of invalidSliders.entries()) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-slider-invalid", "project-1", {
        version: 1,
        components: [{
          key: "slider-invalid",
          type: "Slider",
          schemaVersion: 1,
          properties,
        }],
      }),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
      `invalid slider case ${index} should be rejected`,
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsValidRangedSliderProperties", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const component = {
    key: "slider-range",
    type: "Slider",
    schemaVersion: 1,
    properties: {
      label: "Budget",
      minValue: 0,
      maxValue: 100,
      defaultValue: 25,
      upperValue: 75,
      step: 5,
      ranged: true,
    },
  };

  const result = await service.replaceComponents(caller, "request-slider-range", "project-1", {
    version: 1,
    components: [component],
  });

  assert.equal(result.components[0]?.type, "Slider");
  assert.equal(result.components[0]?.properties.ranged, true);
  assert.equal(result.components[0]?.properties.upperValue, 75);
});

test("ProjectComponentsService_RejectsInvalidLabelPropertiesBeforePersistence", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const invalidLabels = [
    { text: 12, fontSize: "medium", bold: false },
    { text: "Revenue", fontSize: "huge", bold: false },
    { text: "Revenue", fontSize: "small", bold: "false" },
    { text: "Revenue", fontSize: "small", bold: false, extra: true },
  ];

  for (const [index, properties] of invalidLabels.entries()) {
    await assert.rejects(
      () => service.replaceComponents(caller, `request-label-invalid-${index}`, "project-1", {
        version: 1,
        components: [{
          key: `label-invalid-${index}`,
          type: "Label",
          schemaVersion: 1,
          properties,
        }],
      }),
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

test("ProjectComponentsService_AcceptsLabelProperties", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-label", "project-1", {
    version: 1,
    components: [{
      key: "revenue-label",
      type: "Label",
      schemaVersion: 1,
      properties: { text: "Revenue", fontSize: "large", bold: true },
    }],
  });

  assert.equal(result.components[0]?.type, "Label");
  assert.deepEqual(result.components[0]?.properties, {
    text: "Revenue",
    fontSize: "large",
    bold: true,
  });
});

test("ProjectComponentsService_AcceptsOrderedExpanderChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-expander", "project-1", {
    version: 1,
    components: [
      {
        key: "section",
        type: "Expander",
        schemaVersion: 1,
        properties: { sectionTitle: "Details", defaultExpanded: true },
        children: ["second-input", "first-input"],
      },
      { ...validTextInput("first-input"), properties: { label: "First" } },
      { ...validTextInput("second-input"), properties: { label: "Second" } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["second-input", "first-input"]);
  assert.equal(result.components[0]?.properties.defaultExpanded, true);
});

test("ProjectComponentsService_AcceptsOrderedColumnsChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-columns", "project-1", {
    version: 1,
    components: [
      {
        key: "columns",
        type: "Columns",
        schemaVersion: 1,
        properties: { columnCount: 3 },
        children: ["second-input", "first-input"],
      },
      { ...validTextInput("first-input"), properties: { label: "First" } },
      { ...validTextInput("second-input"), properties: { label: "Second" } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["second-input", "first-input"]);
  assert.equal(result.components[0]?.properties.columnCount, 3);
});

test("ProjectComponentsService_AcceptsOrderedRowsChildren", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-rows", "project-1", {
    version: 1,
    components: [
      {
        key: "rows",
        type: "Rows",
        schemaVersion: 1,
        properties: { rowCount: 3 },
        children: ["second-input", "first-input"],
      },
      { ...validTextInput("first-input"), properties: { label: "First" } },
      { ...validTextInput("second-input"), properties: { label: "Second" } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, ["second-input", "first-input"]);
  assert.equal(result.components[0]?.properties.rowCount, 3);
});

test("ProjectComponentsService_AcceptsTabsChildrenByPaneAndPosition", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const result = await service.replaceComponents(caller, "request-tabs", "project-1", {
    version: 1,
    components: [
      {
        key: "tabs",
        type: "Tabs",
        schemaVersion: 1,
        properties: { tabs: ["Overview", "Details"], defaultTabIndex: 1 },
        children: ["later-child", "first-child", "second-pane"],
      },
      { ...validTextInput("first-child"), layout: { tabIndex: 0, y: 0 } },
      { ...validTextInput("later-child"), layout: { tabIndex: 0, y: 1 } },
      { ...validTextInput("second-pane"), layout: { tabIndex: 1, y: 0 } },
    ],
  });

  assert.deepEqual(result.components[0]?.children, [
    "later-child",
    "first-child",
    "second-pane",
  ]);
  assert.deepEqual(result.components[0]?.properties, {
    tabs: ["Overview", "Details"],
    defaultTabIndex: 1,
  });
  assert.deepEqual(result.components[1]?.layout, { tabIndex: 0, y: 0 });
});

test("ProjectComponentsService_RejectsInvalidTabsAndChildLayouts", async () => {
  const repository = new RecordingComponentsRepository();
  const service = new ProjectComponentsService(repository, "workspace-a");
  const tabs = {
    key: "tabs",
    type: "Tabs",
    schemaVersion: 1,
    properties: { tabs: ["Overview", "Details"], defaultTabIndex: 0 },
    children: ["child"],
  };
  const child = { ...validTextInput("child"), layout: { tabIndex: 0, y: 0 } };
  const invalidRequests: unknown[] = [
    { version: 1, components: [{ ...tabs, properties: {} }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: [] } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: [" "] } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["x".repeat(101)] } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["Overview"], defaultTabIndex: 1 } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["Same", "Same"], defaultTabIndex: 1 } }] },
    { version: 1, components: [{ ...tabs, properties: { tabs: ["Overview"], extra: true } }] },
    { version: 1, components: [{ ...tabs, schemaVersion: 2 }] },
    { version: 1, components: [{ ...tabs, layout: { y: 0 } }] },
    { version: 1, components: [{ ...tabs, bindings: { table: "resource" } }] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, validTextInput("child")] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, { ...child, layout: { tabIndex: -1, y: 0 } }] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, { ...child, layout: { tabIndex: 2, y: 0 } }] },
    { version: 1, components: [{ ...tabs, children: ["child"] }, { ...child, layout: { tabIndex: 0, y: "first" } }] },
    {
      version: 1,
      components: [
        { ...tabs, children: ["nested-tabs"] },
        { ...validTextInput("nested-tabs"), type: "Tabs", properties: { tabs: ["Nested"] }, layout: { tabIndex: 0, y: 0 } },
      ],
    },
    {
      version: 1,
      components: [
        { ...tabs, children: ["nested-child"] },
        { ...child, children: ["grandchild"] },
        validTextInput("grandchild"),
      ],
    },
  ];

  for (const invalidRequest of invalidRequests) {
    await assert.rejects(
      () => service.replaceComponents(caller, "request-invalid-tabs", "project-1", invalidRequest),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "invalid_component_aggregate",
    );
  }

  assert.equal(repository.replaceCalls, 0);
});

