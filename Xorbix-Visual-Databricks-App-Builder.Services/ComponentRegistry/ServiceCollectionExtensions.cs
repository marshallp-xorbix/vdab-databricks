using Microsoft.Extensions.DependencyInjection;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Data;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Embedding;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Genie;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Model;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry;

/// <summary>
/// Extension methods for registering component registry services
/// </summary>
public static class ComponentRegistryServiceCollectionExtensions
{
    /// <summary>
    /// Registers all component registry services and individual component services.
    /// Each component service is registered as <see cref="IComponentService"/> so that
    /// <see cref="ComponentRegistryService"/> can resolve them all via
    /// <see cref="IEnumerable{IComponentService}"/> — no changes here when adding new components.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddComponentRegistry(this IServiceCollection services)
    {
        // Register each component service as IComponentService (stateless singletons).
        // ComponentRegistryService resolves these via IEnumerable<IComponentService>.
        services.AddSingleton<IComponentService, TextInputComponentService>();
        services.AddSingleton<IComponentService, ButtonComponentService>();
        services.AddSingleton<IComponentService, CheckboxComponentService>();
        services.AddSingleton<IComponentService, ToggleComponentService>();
        services.AddSingleton<IComponentService, DropdownComponentService>();
        services.AddSingleton<IComponentService, DatePickerComponentService>();
        services.AddSingleton<IComponentService, TimePickerComponentService>();
        services.AddSingleton<IComponentService, SliderComponentService>();
        services.AddSingleton<IComponentService, ColumnsComponentService>();
        services.AddSingleton<IComponentService, RowsComponentService>();
        services.AddSingleton<IComponentService, DataWindowComponentService>();
        services.AddSingleton<IComponentService, EditableDataWindowComponentService>();
        services.AddSingleton<IComponentService, ModalComponentService>();
        services.AddSingleton<IComponentService, FormComponentService>();
        services.AddSingleton<IComponentService, ExpanderComponentService>();
        services.AddSingleton<IComponentService, FileUploadComponentService>();
        services.AddSingleton<IComponentService, LabelComponentService>();
        services.AddSingleton<IComponentService, BarChartComponentService>();
        services.AddSingleton<IComponentService, LineChartComponentService>();
        services.AddSingleton<IComponentService, PieChartComponentService>();
        services.AddSingleton<IComponentService, DonutChartComponentService>();
        services.AddSingleton<IComponentService, AmoebaStoryComponentService>();
        services.AddSingleton<IComponentService, NetworkWebStoryComponentService>();
        services.AddSingleton<IComponentService, TerrainStoryComponentService>();
        services.AddSingleton<IComponentService, HeatMapStoryComponentService>();
        services.AddSingleton<IComponentService, PulseWaveStoryComponentService>();
        services.AddSingleton<IComponentService, FlowFieldStoryComponentService>();
        services.AddSingleton<IComponentService, HoneycombStoryComponentService>();
        services.AddSingleton<IComponentService, SpiralStoryComponentService>();
        services.AddSingleton<IComponentService, TabsComponentService>();
        services.AddSingleton<IComponentService, DashboardEmbedComponentService>();
        services.AddSingleton<IComponentService, GenieChatComponentService>();
        services.AddSingleton<IComponentService, ModelChatComponentService>();

        // Register generation service as Singleton (stateless orchestrator)
        services.AddSingleton<IStreamlitGenerationService, StreamlitGenerationService>();

        // Register registry service as Singleton (stateless registry)
        services.AddSingleton<IComponentRegistryService, ComponentRegistryService>();

        return services;
    }
}