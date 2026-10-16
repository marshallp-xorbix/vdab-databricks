using Microsoft.Extensions.DependencyInjection;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Definitions;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Validation;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

/// <summary>
/// Extension methods for registering workflow services
/// </summary>
public static class WorkflowServiceCollectionExtensions
{
    /// <summary>
    /// Registers workflow template helpers and action generators.
    /// </summary>
    public static IServiceCollection AddWorkflowServices(this IServiceCollection services)
    {
        services.AddSingleton<IWorkflowActionDefinition, TriggerToastActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, ShowModalActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, SaveToTableActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, BuildSqlActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, RunSqlActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, SetBindingActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, StartDatabricksJobActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, CallCustomModuleActionDefinition>();
        services.AddSingleton<IWorkflowActionDefinition, CallPrebuiltModuleActionDefinition>();
        services.AddSingleton<WorkflowActionDefinitionRegistry>();
        services.AddSingleton<WorkflowActionValidator>();
        services.AddSingleton<WorkflowTemplateValidator>();

        services.AddScoped<IWorkflowTemplateHelper, WorkflowTemplateHelper>();
        services.AddScoped<IWorkflowActionGenerator, BuildSqlActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, RunSqlActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, SaveToTableActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, SetBindingActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, ShowModalActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, StartDatabricksJobActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, TriggerToastActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, CallCustomModuleActionGenerator>();
        services.AddScoped<IWorkflowActionGenerator, CallPrebuiltModuleActionGenerator>();

        return services;
    }
}
