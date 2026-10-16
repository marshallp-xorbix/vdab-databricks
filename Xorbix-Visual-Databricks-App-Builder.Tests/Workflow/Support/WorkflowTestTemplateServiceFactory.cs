using FluentResults;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

internal static class WorkflowTestTemplateServiceFactory
{
    public static WorkflowActionDefinitionRegistry CreateActionDefinitionRegistry()
    {
        return new WorkflowActionDefinitionRegistry(CreateActionDefinitions());
    }

    public static WorkflowActionValidator CreateWorkflowActionValidator()
    {
        WorkflowActionDefinitionRegistry definitionRegistry = CreateActionDefinitionRegistry();
        return new WorkflowActionValidator(definitionRegistry);
    }

    public static WorkflowTemplateValidator CreateWorkflowTemplateValidator()
    {
        WorkflowActionValidator actionValidator = CreateWorkflowActionValidator();
        return new WorkflowTemplateValidator(actionValidator);
    }

    public static WorkflowTemplateHelper CreateWorkflowTemplateHelper()
    {
        WorkflowTemplateValidator validator = CreateWorkflowTemplateValidator();
        List<IWorkflowActionGenerator> generators = CreateGenerators();
        return new WorkflowTemplateHelper(generators, validator);
    }

    public static StreamlitTemplateService CreateTemplateService(IReadOnlyDictionary<ComponentType, IComponentService> componentServices)
    {
        Mock<IComponentRegistryService> registryService = new();
        registryService
            .Setup(service => service.GetComponentServices())
            .Returns(componentServices);

        StreamlitGenerationService generationService = new(registryService.Object);
        WorkflowTemplateHelper workflowTemplateHelper = CreateWorkflowTemplateHelper();
        return new StreamlitTemplateService(generationService, workflowTemplateHelper);
    }

    public static WorkflowActionGenerationContext CreateGenerationContext(
        IEnumerable<WorkflowActionNodeModel> nodes,
        IEnumerable<WorkflowEdgeModel>? edges = null,
        string workflowCodeName = "wf_test",
        string triggerComponentCodeName = "status_filter",
        string eventKey = "onChange")
    {
        List<WorkflowActionNodeModel> nodeList = nodes.ToList();
        WorkflowModel workflow = new()
        {
            CodeName = workflowCodeName,
            Trigger = new WorkflowTriggerModel
            {
                ComponentCodeName = triggerComponentCodeName,
                EventKey = eventKey,
            },
            Nodes = nodeList,
            Edges = edges?.ToList() ?? new List<WorkflowEdgeModel>(),
        };

        Dictionary<string, WorkflowActionNodeModel> nodesById = nodeList
            .Where(node => !string.IsNullOrWhiteSpace(node.Id))
            .ToDictionary(node => node.Id, StringComparer.Ordinal);

        return new WorkflowActionGenerationContext
        {
            Workflow = workflow,
            NodesById = nodesById,
        };
    }

    public static List<IWorkflowActionDefinition> CreateActionDefinitions()
    {
        return new List<IWorkflowActionDefinition>
        {
            new TriggerToastActionDefinition(),
            new ShowModalActionDefinition(),
            new SaveToTableActionDefinition(),
            new BuildSqlActionDefinition(),
            new RunSqlActionDefinition(),
            new SetBindingActionDefinition(),
            new StartDatabricksJobActionDefinition(),
            new CallCustomModuleActionDefinition(),
            new CallPrebuiltModuleActionDefinition(),
        };
    }

    public static List<IWorkflowActionGenerator> CreateGenerators()
    {
        return new List<IWorkflowActionGenerator>
        {
            new BuildSqlActionGenerator(),
            new RunSqlActionGenerator(),
            new SaveToTableActionGenerator(),
            new SetBindingActionGenerator(),
            new ShowModalActionGenerator(),
            new StartDatabricksJobActionGenerator(),
            new TriggerToastActionGenerator(),
            new CallCustomModuleActionGenerator(),
            new CallPrebuiltModuleActionGenerator(),
        };
    }
}