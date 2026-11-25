import { randomUUID } from "node:crypto";
import type { AiBuilderProposal } from "./ai-builder-contract.ts";
import { readAiBuilderProposal } from "./ai-builder-input.ts";
import { resolveAiBuilderWorkflowReferences } from "./ai-builder-reference-resolution.ts";
import type { ComponentDefinition } from "./component-registry/contracts.ts";
import {
  FORM_CHILD_COMPONENT_TYPES,
  LAYOUT_CHILD_COMPONENT_TYPES,
  MODAL_CHILD_COMPONENT_TYPES,
  type ProjectComponent,
  type ProjectComponentType,
  type ProjectJsonObject,
} from "./db/project-components-contract.ts";
import type {
  ProjectWorkflow,
  ProjectWorkflowEdge,
  ProjectWorkflowNode,
  ProjectWorkflowRoute,
} from "./db/project-workflow-contract.ts";

const CODE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;
const NODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/;

type SessionWorkflow = {
  codeName: string;
  triggerCodeName: string;
  eventKey: string;
  nodes: ProjectWorkflowNode[];
  edges: ProjectWorkflowEdge[];
};

/** Stateful SaaS-style canvas session that mutates a draft project via typed tools. */
export class AiBuilderCanvasSession {
  private readonly definitionsByType: Map<string, ComponentDefinition>;
  private components: ProjectComponent[];
  private workflows: SessionWorkflow[];
  private customModulesSource: string;
  private changed = false;

  constructor(
    snapshot: AiBuilderProposal,
    componentDefinitions: ComponentDefinition[],
  ) {
    this.definitionsByType = new Map(
      componentDefinitions.map((definition) => [definition.type, definition]),
    );
    this.components = structuredClone(snapshot.components);
    this.customModulesSource = snapshot.customModulesSource;
    this.workflows = snapshot.workflow.workflows.map((workflow) => ({
      codeName: workflow.codeName,
      triggerCodeName: this.codeNameForKey(workflow.trigger.componentKey) ?? workflow.trigger.componentKey,
      eventKey: workflow.trigger.eventKey,
      nodes: structuredClone(workflow.nodes),
      edges: structuredClone(workflow.edges),
    }));
  }

  /** True when at least one mutating tool succeeded. */
  hasChanges(): boolean {
    return this.changed;
  }

  /** Executes one typed tool and returns a short success or error string. */
  executeTool(name: string, args: Record<string, unknown>): string {
    try {
      const result = this.dispatch(name, args);
      this.changed = true;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool failed.";
      return `ERROR: ${message}`;
    }
  }

  /** Builds and validates the portable proposal from the live session state. */
  buildProposal(
    version: number,
    componentDefinitions: ComponentDefinition[],
  ): AiBuilderProposal {
    const workflows = this.workflows.map((workflow) => ({
      codeName: workflow.codeName,
      trigger: {
        componentKey: workflow.triggerCodeName,
        eventKey: workflow.eventKey,
      },
      nodes: workflow.nodes.map((node) => this.toPortableNode(node)),
      edges: workflow.edges,
    }));
    const resolved = resolveAiBuilderWorkflowReferences(workflows, this.components);
    return readAiBuilderProposal({
      components: this.components,
      workflow: { version: 1, workflows: resolved },
      customModulesSource: this.customModulesSource,
    }, version, componentDefinitions);
  }

  private dispatch(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case "addLabel":
        return this.addComponent("Label", readString(args.codeName, "label"), {
          text: readString(args.text, "Label Text"),
          fontSize: readString(args.fontSize, "medium"),
          bold: readBoolean(args.bold, false),
        }, args);
      case "addTextInput":
        return this.addComponent("TextInput", readString(args.codeName, "textInput"), {
          label: readString(args.label, "Text Input"),
          placeholder: readString(args.placeholder, ""),
        }, args);
      case "addButton":
        return this.addComponent("Button", readString(args.codeName, "button"), {
          label: readString(args.label, "Button"),
          variant: readString(args.variant, "primary"),
          disabled: false,
          help: "",
        }, args);
      case "addCheckbox":
        return this.addComponent("Checkbox", readString(args.codeName, "checkbox"), {
          label: readString(args.label, "Checkbox"),
          defaultChecked: readBoolean(args.defaultChecked, false),
          help: "",
          disabled: false,
        }, args);
      case "addToggle":
        return this.addComponent("Toggle", readString(args.codeName, "toggle"), {
          label: readString(args.label, "Toggle"),
          defaultValue: readBoolean(args.defaultValue, false),
          help: "",
          disabled: false,
        }, args);
      case "addDropdown":
        return this.addComponent("Dropdown", readString(args.codeName, "dropdown"), {
          label: readString(args.label, "Dropdown"),
          options: splitCsv(readString(args.options, "Option 1,Option 2")).map((value) => ({ value })),
          placeholder: readString(args.placeholder, ""),
          multiselect: readBoolean(args.multiselect, false),
          defaultValue: "",
          help: "",
          disabled: false,
        }, args);
      case "addDatePicker":
        return this.addComponent("DatePicker", readString(args.codeName, "datePicker"), {
          label: readString(args.label, "Date"),
        }, args);
      case "addTimePicker":
        return this.addComponent("TimePicker", readString(args.codeName, "timePicker"), {
          label: readString(args.label, "Time"),
        }, args);
      case "addSlider":
        return this.addComponent("Slider", readString(args.codeName, "slider"), {
          label: readString(args.label, "Slider"),
          minValue: readNumber(args.minValue, 0),
          maxValue: readNumber(args.maxValue, 100),
          defaultValue: readNumber(args.defaultValue, 50),
          step: readNumber(args.step, 1),
          ranged: false,
        }, args);
      case "addForm":
        return this.addComponent("Form", readString(args.codeName, "form"), {
          submitButtonText: readString(args.submitButtonText, "Submit"),
          clearOnSubmit: false,
          enterToSubmit: true,
          border: true,
          width: "stretch",
          height: "content",
        }, args);
      case "addModal":
        return this.addComponent("Modal", readString(args.codeName, "modal"), {
          title: readString(args.title, "My Modal"),
          width: null,
          height: null,
          position: "center",
          dismissible: true,
        }, { ...args, parentId: null });
      case "addColumns":
        return this.addComponent("Columns", readString(args.codeName, "columns"), {
          columnCount: readNumber(args.columnCount, 2),
        }, args);
      case "addRows":
        return this.addComponent("Rows", readString(args.codeName, "rows"), {
          rowCount: readNumber(args.rowCount, 2),
        }, args);
      case "addTabs":
        return this.addComponent("Tabs", readString(args.codeName, "tabs"), {
          tabs: splitCsv(readString(args.tabNames, "Tab 1,Tab 2")),
          defaultTabIndex: 0,
        }, args);
      case "addExpander":
        return this.addComponent("Expander", readString(args.codeName, "expander"), {
          sectionTitle: readString(args.sectionTitle, "Section"),
          defaultExpanded: readBoolean(args.defaultExpanded, false),
        }, args);
      case "addDataWindow":
        return this.addComponent("DataWindow", readString(args.codeName, "dataWindow"), {
          label: readString(args.label, "Data Table"),
          maxRows: readNumber(args.maxRows, 0),
          scrollable: readBoolean(args.scrollable, true),
          placeholder: readString(args.placeholder, ""),
        }, args);
      case "addEditableDataWindow":
        return this.addComponent("EditableDataWindow", readString(args.codeName, "editableDataWindow"), {
          label: readString(args.label, "Editable Data Table"),
          maxRows: readNumber(args.maxRows, 0),
          scrollable: readBoolean(args.scrollable, true),
          disabled: readBoolean(args.disabled, false),
        }, args);
      case "addFileUpload":
        return this.addComponent("FileUpload", readString(args.codeName, "fileUpload"), {
          label: readString(args.label, "Upload File"),
        }, args);
      case "addBarChart":
        return this.addChart("BarChart", args);
      case "addLineChart":
        return this.addChart("LineChart", args);
      case "addPieChart":
        return this.addChart("PieChart", args);
      case "addDonutChart":
        return this.addChart("DonutChart", args);
      case "addDashboardEmbed":
        return this.addComponent("DashboardEmbed", readString(args.codeName, "dashboardEmbed"), {
          src: readString(args.src, ""),
          height: readNumber(args.height, 600),
        }, args);
      case "addGenieChat":
        return this.addComponent("GenieChat", readString(args.codeName, "genieChat"), {
          genieSpaceAppResourceName: readString(args.genieSpaceAppResourceName, ""),
          title: readString(args.title, "Genie Chat"),
          chatTotalHeightPixels: readNumber(args.chatTotalHeightPixels, 600),
          showBorder: readBoolean(args.showBorder, false),
        }, args);
      case "addModelChat":
        return this.addComponent("ModelChat", readString(args.codeName, "modelChat"), {
          servingEndpointAppResourceName: readString(args.servingEndpointAppResourceName, ""),
          title: readString(args.title, "Model Chat"),
          chatTotalHeightPixels: readNumber(args.chatTotalHeightPixels, 600),
          showBorder: readBoolean(args.showBorder, false),
        }, args);
      case "addAmoebaStory":
      case "addNetworkWebStory":
      case "addTerrainStory":
      case "addHeatMapStory":
      case "addPulseWaveStory":
      case "addFlowFieldStory":
      case "addHoneycombStory":
      case "addSpiralStory":
        return this.addStory(name, args);
      case "modifyComponent":
        return this.modifyComponent(args);
      case "deleteComponent":
        return this.deleteComponent(args);
      case "createWorkflow":
        return this.createWorkflow(args);
      case "addTriggerToastAction":
        return this.addToastAction(args);
      case "addShowModalAction":
        return this.addShowModalAction(args);
      case "addBuildSqlAction":
        return this.addBuildSqlAction(args);
      case "addRunSqlAction":
        return this.addRunSqlAction(args);
      case "addSetBindingAction":
        return this.addSetBindingAction(args);
      case "addSaveToTableAction":
        return this.addSaveToTableAction(args, "unityCatalogTable");
      case "addSaveToLakebaseProvisionedAction":
        return this.addSaveToTableAction(args, "lakebaseProvisionedDatabase");
      case "addSaveToLakebaseAutoscalingAction":
        return this.addSaveToTableAction(args, "lakebaseAutoscaling");
      case "addStartDatabricksJobAction":
        return this.addStartJobAction(args);
      case "addCallCustomModuleAction":
        return this.addCallCustomModuleAction(args);
      case "addCallPrebuiltModuleAction":
        return this.addCallPrebuiltModuleAction(args);
      case "connectWorkflowNodes":
        return this.connectWorkflowNodes(args);
      case "deleteWorkflow":
        return this.deleteWorkflow(args);
      case "updateCustomModulesCode":
        return this.updateCustomModules(args);
      case "setStaticVolumeBinding":
        return this.setVolumeBinding(args);
      case "setStaticUnityCatalogBinding":
        return this.setTableBinding(args, "unityCatalogTable");
      case "setStaticLakebaseProvisionedBinding":
        return this.setTableBinding(args, "lakebaseProvisionedDatabase");
      case "setStaticLakebaseAutoscalingBinding":
        return this.setTableBinding(args, "lakebaseAutoscaling");
      default:
        throw new Error(`Unsupported tool "${name}".`);
    }
  }

  private addChart(type: "BarChart" | "LineChart" | "PieChart" | "DonutChart", args: Record<string, unknown>): string {
    const defaults = this.definitionsByType.get(type)?.props ?? {};
    return this.addComponent(type, readString(args.codeName, type.charAt(0).toLowerCase() + type.slice(1)), {
      ...defaults,
      title: readString(args.title, type),
      seriesColor: readString(args.seriesColor, String(defaults.seriesColor ?? "#1f77b4")),
    }, args);
  }

  private addStory(toolName: string, args: Record<string, unknown>): string {
    const type = toolName.replace(/^add/, "") as ProjectComponentType;
    const definition = this.definitionsByType.get(type);
    if (!definition) throw new Error(`Unsupported story type ${type}.`);
    const properties = { ...definition.props, title: readString(args.title, String(definition.props.title ?? type)) };
    const mappings = parseJsonObject(args.fieldMappingsJson);
    if (mappings) Object.assign(properties, { fieldMappings: mappings });
    return this.addComponent(type, readString(args.codeName, type.charAt(0).toLowerCase() + type.slice(1)), properties, args);
  }

  private addComponent(
    type: ProjectComponentType,
    codeName: string,
    propertyOverrides: ProjectJsonObject,
    args: Record<string, unknown>,
  ): string {
    const normalizedCodeName = requireCodeName(codeName);
    if (this.findByCodeName(normalizedCodeName)) {
      throw new Error(`Component codeName '${normalizedCodeName}' already exists. Choose a unique codeName.`);
    }
    const definition = this.definitionsByType.get(type);
    if (!definition) throw new Error(`Unsupported component type: ${type}.`);
    if (type === "Modal" && args.parentId !== undefined && args.parentId !== null && args.parentId !== "") {
      throw new Error("Modals must be root-level. Omit parentId when calling addModal.");
    }
    const key = this.allocateKey(normalizedCodeName);
    const parentKey = type === "Modal" ? null : this.resolveOptionalParent(args.parentId);
    if (parentKey) this.assertNestingAllowed(parentKey, type);
    const component: ProjectComponent = {
      key,
      type,
      schemaVersion: 1,
      componentVersion: 1,
      codeName: normalizedCodeName,
      description: null,
      properties: { ...definition.props, ...propertyOverrides },
      bindings: null,
      children: [],
      layout: parentKey ? this.childLayout(parentKey, args) : null,
    };
    this.components.push(component);
    if (parentKey) this.appendChild(parentKey, key);
    return key;
  }

  private modifyComponent(args: Record<string, unknown>): string {
    const key = this.resolveComponentRef(args.componentId, args.codeName);
    const index = this.components.findIndex((component) => component.key === key);
    const current = this.components[index];
    if (!current || index < 0) throw new Error(`Component '${key}' was not found.`);
    const propsJson = typeof args.propsJson === "string" ? args.propsJson : "{}";
    const props = parseJsonObject(propsJson) ?? {};
    const nextCodeName = typeof args.newCodeName === "string" && args.newCodeName.trim()
      ? requireCodeName(args.newCodeName)
      : current.codeName;
    if (nextCodeName && nextCodeName !== current.codeName && this.findByCodeName(nextCodeName)) {
      throw new Error(`Component codeName '${nextCodeName}' already exists.`);
    }
    const updated: ProjectComponent = {
      ...current,
      codeName: nextCodeName,
      properties: { ...current.properties, ...props },
    };
    this.components[index] = updated;
    return key;
  }

  private deleteComponent(args: Record<string, unknown>): string {
    const key = this.resolveComponentRef(args.componentId, args.codeName);
    this.components = this.components
      .filter((component) => component.key !== key)
      .map((component) => ({
        ...component,
        children: component.children.filter((childKey) => childKey !== key),
      }));
    this.workflows = this.workflows.filter((workflow) => {
      const triggerKey = this.keyForCodeName(workflow.triggerCodeName);
      return triggerKey !== key;
    });
    return key;
  }

  private createWorkflow(args: Record<string, unknown>): string {
    const codeName = requireCodeName(readString(args.workflowCodeName, ""));
    const triggerCodeName = requireCodeName(readString(args.triggerComponentCodeName, ""));
    const eventKey = readString(args.triggerEventKey, "onClick");
    if (this.workflows.some((workflow) => workflow.codeName.toLocaleLowerCase("en-US") === codeName.toLocaleLowerCase("en-US"))) {
      throw new Error(`Workflow '${codeName}' already exists. Call deleteWorkflow first before recreating it.`);
    }
    const triggerComponent = this.findByCodeName(triggerCodeName);
    if (!triggerComponent) {
      throw new Error(`Trigger component '${triggerCodeName}' was not found. Use an existing component codeName.`);
    }
    const triggerKey = `${triggerCodeName.toLocaleLowerCase("en-US")}::${eventKey.toLocaleLowerCase("en-US")}`;
    if (this.workflows.some((workflow) =>
      `${workflow.triggerCodeName.toLocaleLowerCase("en-US")}::${workflow.eventKey.toLocaleLowerCase("en-US")}` === triggerKey)) {
      throw new Error(`A workflow already exists for ${triggerCodeName}.${eventKey}. Delete it before creating a replacement.`);
    }
    this.workflows.push({ codeName, triggerCodeName, eventKey, nodes: [], edges: [] });
    return codeName;
  }

  private addToastAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "toast1"));
    this.assertUniqueNode(workflow, nodeId);
    const duration = readString(args.toastDuration, "short");
    if (!["short", "long", "infinite"].includes(duration)) {
      throw new Error("toastDuration must be short, long, or infinite.");
    }
    workflow.nodes.push({
      id: nodeId,
      actionType: "triggerToast",
      schemaVersion: 1,
      params: {
        body: readString(args.body, "Done"),
        duration: { kind: "preset", value: duration },
      },
    });
    return nodeId;
  }

  private addShowModalAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "showModal1"));
    this.assertUniqueNode(workflow, nodeId);
    const modalCodeName = requireCodeName(readString(args.modalCodeName, ""));
    const modal = this.findByCodeName(modalCodeName);
    if (!modal || modal.type !== "Modal") {
      throw new Error(`Modal '${modalCodeName}' must already exist on the canvas before addShowModalAction.`);
    }
    workflow.nodes.push({
      id: nodeId,
      actionType: "showModal",
      schemaVersion: 1,
      params: { modalComponentKey: modal.key },
    });
    return nodeId;
  }

  private addBuildSqlAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "buildSql1"));
    this.assertUniqueNode(workflow, nodeId);
    const placeholders = parseJsonArray(args.placeholdersJson).map((item) => {
      if (!isRecord(item)) throw new Error("placeholdersJson entries must be objects.");
      return {
        token: readString(item.token, ""),
        componentKey: readString(item.componentCodeName ?? item.componentKey, ""),
        valueType: readString(item.valueType, "string"),
        ...(item.formatHint === undefined ? {} : { formatHint: item.formatHint }),
      };
    });
    workflow.nodes.push({
      id: nodeId,
      actionType: "buildSql",
      schemaVersion: 1,
      params: {
        sqlSourceKind: readString(args.sqlSourceKind, "unityCatalogTable"),
        sqlTemplate: readString(args.sqlTemplate, "SELECT 1"),
        placeholders,
      },
    });
    return nodeId;
  }

  private addRunSqlAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "runSql1"));
    this.assertUniqueNode(workflow, nodeId);
    workflow.nodes.push({
      id: nodeId,
      actionType: "runSql",
      schemaVersion: 1,
      params: {
        statement: {
          sourceActionType: "buildSql",
          nodeId: requireNodeId(readString(args.buildSqlNodeId, "")),
        },
      },
    });
    return nodeId;
  }

  private addSetBindingAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "setBinding1"));
    this.assertUniqueNode(workflow, nodeId);
    const targetCodeName = requireCodeName(readString(args.targetComponentCodeName, ""));
    const target = this.findByCodeName(targetCodeName);
    if (!target) throw new Error(`Target component '${targetCodeName}' was not found.`);
    workflow.nodes.push({
      id: nodeId,
      actionType: "setBinding",
      schemaVersion: 1,
      params: {
        source: {
          sourceActionType: "runSql",
          nodeId: requireNodeId(readString(args.runSqlNodeId, "")),
          outputKey: "rows",
        },
        target: {
          componentKey: target.key,
          bindingType: readString(args.bindingType, "unityCatalogTable"),
        },
      },
    });
    return nodeId;
  }

  private addSaveToTableAction(
    args: Record<string, unknown>,
    tableType: "unityCatalogTable" | "lakebaseProvisionedDatabase" | "lakebaseAutoscaling",
  ): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "saveTable1"));
    this.assertUniqueNode(workflow, nodeId);
    const formCodeName = requireCodeName(readString(args.sourceFormComponentCodeName, ""));
    const form = this.findByCodeName(formCodeName);
    if (!form || form.type !== "Form") {
      throw new Error(`SaveToTable source '${formCodeName}' must be an existing Form codeName.`);
    }
    const catalog = readString(args.catalog, "");
    const schema = readString(args.schema, "");
    const table = readString(args.table, "");
    const targetTable: Record<string, unknown> = {
      tableType,
      resourceKey: `table_${hashText(`${tableType}|${catalog}|${schema}|${table}|${String(args.instanceName ?? "")}|${String(args.projectId ?? "")}`)}`,
      catalog,
      schema,
      table,
    };
    if (tableType === "lakebaseProvisionedDatabase") {
      targetTable.instanceName = readString(args.instanceName, "");
      targetTable.database = readString(args.database, "");
    }
    if (tableType === "lakebaseAutoscaling") {
      targetTable.projectId = readString(args.projectId, "");
      targetTable.branchId = readString(args.branchId, "");
      targetTable.endpointId = readString(args.endpointId, "");
      targetTable.database = readString(args.database, "");
    }
    workflow.nodes.push({
      id: nodeId,
      actionType: "saveToTable",
      schemaVersion: 1,
      params: {
        sourceFormComponentKey: form.key,
        targetTable,
        excludedColumns: [],
        columnMappings: [],
      },
    });
    return nodeId;
  }

  private addStartJobAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "startJob1"));
    this.assertUniqueNode(workflow, nodeId);
    workflow.nodes.push({
      id: nodeId,
      actionType: "startDatabricksJob",
      schemaVersion: 1,
      params: {
        job: {
          resourceType: "databricksJob",
          resourceKey: readString(args.jobId, ""),
          jobName: readString(args.jobName, ""),
        },
      },
    });
    return nodeId;
  }

  private addCallCustomModuleAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "customModule1"));
    this.assertUniqueNode(workflow, nodeId);
    workflow.nodes.push({
      id: nodeId,
      actionType: "callCustomModule",
      schemaVersion: 1,
      params: { functionName: requireCodeName(readString(args.functionName, "")) },
    });
    return nodeId;
  }

  private addCallPrebuiltModuleAction(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const nodeId = requireNodeId(readString(args.nodeId, "prebuiltModule1"));
    this.assertUniqueNode(workflow, nodeId);
    workflow.nodes.push({
      id: nodeId,
      actionType: "callPrebuiltModule",
      schemaVersion: 1,
      params: {
        functionName: requireCodeName(readString(args.functionName, "")),
        namedArguments: parseStringMap(args.namedArgumentsJson),
      },
    });
    return nodeId;
  }

  private connectWorkflowNodes(args: Record<string, unknown>): string {
    const workflow = this.requireWorkflow(readString(args.workflowCodeName, ""));
    const fromNodeId = requireNodeId(readString(args.fromNodeId, ""));
    const toNodeId = requireNodeId(readString(args.toNodeId, ""));
    const route = readString(args.route, "onSuccess") as ProjectWorkflowRoute;
    if (!["onSuccess", "onError", "always"].includes(route)) {
      throw new Error("Workflow route must be onSuccess, onError, or always.");
    }
    if (!workflow.nodes.some((node) => node.id === fromNodeId) ||
        !workflow.nodes.some((node) => node.id === toNodeId)) {
      throw new Error("connectWorkflowNodes must reference action nodes in the same workflow.");
    }
    workflow.edges.push({ fromNodeId, toNodeId, route });
    return `${fromNodeId}->${toNodeId}`;
  }

  private deleteWorkflow(args: Record<string, unknown>): string {
    const codeName = requireCodeName(readString(args.workflowCodeName, ""));
    const before = this.workflows.length;
    this.workflows = this.workflows.filter(
      (workflow) => workflow.codeName.toLocaleLowerCase("en-US") !== codeName.toLocaleLowerCase("en-US"),
    );
    if (this.workflows.length === before) {
      throw new Error(`Workflow '${codeName}' was not found.`);
    }
    return codeName;
  }

  private updateCustomModules(args: Record<string, unknown>): string {
    const source = readString(args.pythonSource, "");
    if (source.length > 256_000) throw new Error("custom_modules.py source is too large.");
    this.customModulesSource = source;
    return "custom_modules.py";
  }

  private setVolumeBinding(args: Record<string, unknown>): string {
    const key = this.resolveComponentRef(undefined, args.componentCodeName);
    const component = this.components.find((item) => item.key === key);
    if (!component || component.type !== "FileUpload") {
      throw new Error("setStaticVolumeBinding requires an existing FileUpload codeName.");
    }
    const catalog = readString(args.catalog, "");
    const schema = readString(args.schema, "");
    const volume = readString(args.volume, "");
    const filePath = typeof args.filePath === "string" ? args.filePath : "";
    component.bindings = {
      databricksVolume: {
        bindingType: "databricksVolume",
        source: {
          kind: "resource",
          valueType: "file",
          resource: {
            type: "databricksVolume",
            catalog,
            schema,
            volume,
            filePath,
          },
        },
      },
    };
    return key;
  }

  private setTableBinding(
    args: Record<string, unknown>,
    bindingType: "unityCatalogTable" | "lakebaseProvisionedDatabase" | "lakebaseAutoscaling",
  ): string {
    const key = this.resolveComponentRef(undefined, args.componentCodeName);
    const component = this.components.find((item) => item.key === key);
    if (!component) throw new Error(`Component '${String(args.componentCodeName)}' was not found.`);
    const catalog = readString(args.catalog, "");
    const schema = readString(args.schema, "");
    const table = readString(args.table, "");
    const resource: ProjectJsonObject = {
      type: bindingType,
      catalog,
      schema,
      table,
    };
    if (bindingType === "lakebaseProvisionedDatabase") {
      resource.instanceName = readString(args.instanceName, "");
      resource.database = readString(args.database, "");
    }
    if (bindingType === "lakebaseAutoscaling") {
      resource.projectId = readString(args.projectId, "");
      resource.branchId = readString(args.branchId, "");
      resource.endpointId = readString(args.endpointId, "");
      resource.database = readString(args.database, "");
    }
    component.bindings = {
      [bindingType]: {
        bindingType,
        source: { kind: "resource", valueType: "table", resource },
      },
    };
    return key;
  }

  private toPortableNode(node: ProjectWorkflowNode): ProjectWorkflowNode {
    if (node.actionType !== "buildSql") return node;
    const placeholders = Array.isArray(node.params.placeholders) ? node.params.placeholders : [];
    return {
      ...node,
      params: {
        ...node.params,
        placeholders: placeholders.map((placeholder) => {
          if (!isRecord(placeholder)) return placeholder;
          const codeName = typeof placeholder.componentKey === "string"
            ? placeholder.componentKey
            : "";
          const resolved = this.keyForCodeName(codeName) ?? codeName;
          return { ...placeholder, componentKey: resolved };
        }),
      },
    };
  }

  private requireWorkflow(codeName: string): SessionWorkflow {
    const normalized = requireCodeName(codeName);
    const workflow = this.workflows.find(
      (item) => item.codeName.toLocaleLowerCase("en-US") === normalized.toLocaleLowerCase("en-US"),
    );
    if (!workflow) throw new Error(`Workflow '${normalized}' not found. Call createWorkflow first.`);
    return workflow;
  }

  private assertUniqueNode(workflow: SessionWorkflow, nodeId: string): void {
    if (workflow.nodes.some((node) => node.id === nodeId)) {
      throw new Error(`Workflow action id '${nodeId}' already exists in '${workflow.codeName}'.`);
    }
  }

  private allocateKey(codeName: string): string {
    if (!this.components.some((component) => component.key === codeName)) return codeName;
    return randomUUID();
  }

  private resolveOptionalParent(value: unknown): string | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new Error("parentId must be a string id or codeName.");
    const byKey = this.components.find((component) => component.key === value);
    if (byKey) return byKey.key;
    const byCodeName = this.findByCodeName(value);
    if (byCodeName) return byCodeName.key;
    throw new Error(`Unknown parent reference '${value}'. Use an existing parent id or codeName.`);
  }

  private resolveComponentRef(componentId: unknown, codeName: unknown): string {
    if (typeof componentId === "string" && componentId.trim()) {
      if (this.components.some((component) => component.key === componentId)) return componentId;
    }
    if (typeof codeName === "string" && codeName.trim()) {
      const component = this.findByCodeName(codeName);
      if (component) return component.key;
    }
    throw new Error("Provide a valid componentId or known codeName.");
  }

  private appendChild(parentKey: string, childKey: string): void {
    const parent = this.components.find((component) => component.key === parentKey);
    if (!parent) throw new Error(`Parent '${parentKey}' was not found.`);
    parent.children = [...parent.children, childKey];
  }

  /** Rejects illegal nesting with actionable guidance before mutating the draft. */
  private assertNestingAllowed(parentKey: string, childType: ProjectComponentType): void {
    const parent = this.components.find((component) => component.key === parentKey);
    if (!parent) throw new Error(`Parent '${parentKey}' was not found.`);

    if (isContainerComponent(childType) && childType !== "Modal") {
      if (parent.type !== "Modal") {
        throw new Error(
          `${childType} may only be root-level or a direct Modal child. Place it at root or under a Modal, not under ${parent.type}.`,
        );
      }
      return;
    }

    if (parent.type === "Form") {
      if (!FORM_CHILD_COMPONENT_TYPES.some((type) => type === childType)) {
        throw new Error(
          `${childType} cannot be nested inside Form. Form children must be input fields only (${FORM_CHILD_COMPONENT_TYPES.join(", ")}). Place FileUpload, Button, and DataWindow as Form siblings (root or under Modal).`,
        );
      }
      return;
    }

    if (parent.type === "Modal") {
      if (!MODAL_CHILD_COMPONENT_TYPES.some((type) => type === childType)) {
        throw new Error(`${childType} cannot be nested inside Modal.`);
      }
      return;
    }

    if (
      parent.type === "Expander" ||
      parent.type === "Columns" ||
      parent.type === "Rows" ||
      parent.type === "Tabs"
    ) {
      if (!LAYOUT_CHILD_COMPONENT_TYPES.some((type) => type === childType)) {
        throw new Error(
          `${childType} cannot be nested inside ${parent.type}. Layout slots accept only: ${LAYOUT_CHILD_COMPONENT_TYPES.join(", ")}.`,
        );
      }
      return;
    }

    throw new Error(
      `${parent.type} cannot contain children. Nest under Form, Modal, Columns, Rows, Tabs, or Expander instead.`,
    );
  }

  private childLayout(parentKey: string, args: Record<string, unknown>): ProjectJsonObject | null {
    const parent = this.components.find((component) => component.key === parentKey);
    if (!parent) return null;
    if (parent.type === "Tabs") {
      return { tabIndex: readNumber(args.tabIndex, 0), y: parent.children.length };
    }
    if (parent.type === "Modal") {
      return { y: parent.children.length };
    }
    return null;
  }

  private findByCodeName(codeName: string): ProjectComponent | undefined {
    const normalized = codeName.toLocaleLowerCase("en-US");
    return this.components.find((component) =>
      typeof component.codeName === "string" &&
      component.codeName.toLocaleLowerCase("en-US") === normalized);
  }

  private keyForCodeName(codeName: string): string | undefined {
    return this.findByCodeName(codeName)?.key;
  }

  private codeNameForKey(key: string): string | undefined {
    const component = this.components.find((item) => item.key === key);
    return component?.codeName ?? undefined;
  }
}

function requireCodeName(value: string): string {
  const text = value.trim();
  if (!CODE_NAME_PATTERN.test(text)) {
    throw new Error(`'${value}' must be a camelCase code name matching ^[A-Za-z][A-Za-z0-9_]*$.`);
  }
  return text;
}

function requireNodeId(value: string): string {
  const text = value.trim();
  if (!NODE_ID_PATTERN.test(text)) {
    throw new Error(`'${value}' is not a valid workflow action id.`);
  }
  return text;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function splitCsv(value: string): string[] {
  return value.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseJsonObject(value: unknown): ProjectJsonObject | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed as ProjectJsonObject : null;
  } catch {
    return null;
  }
}

function parseStringMap(value: unknown): Record<string, string> {
  const object = parseJsonObject(value);
  if (!object) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(object)) {
    if (typeof entry === "string") result[key] = entry;
  }
  return result;
}

function parseJsonArray(value: unknown): unknown[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isContainerComponent(type: ProjectComponentType): boolean {
  return type === "Form" ||
    type === "Modal" ||
    type === "Expander" ||
    type === "Columns" ||
    type === "Rows" ||
    type === "Tabs";
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
