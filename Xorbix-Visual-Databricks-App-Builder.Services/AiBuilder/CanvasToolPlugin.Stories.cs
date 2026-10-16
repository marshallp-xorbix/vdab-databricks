using System.ComponentModel;
using Microsoft.SemanticKernel;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal sealed partial class CanvasToolPlugin
{
    [KernelFunction]
    [Description("Add an Amoeba Story visualization (portfolio blobs / entity health-risk scatter).")]
    public string AddAmoebaStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "amoebaStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"entityId\":\"customer_id\",\"sizeMetric\":\"revenue\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildAmoebaStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.AmoebaStory, "amoebaStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Network Web Story visualization (relationship / supply-chain graph).")]
    public string AddNetworkWebStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "networkWebStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"sourceEntityId\":\"from_id\",\"targetEntityId\":\"to_id\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildNetworkWebStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.NetworkWebStory, "networkWebStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Terrain Story visualization (performance landscape / topography).")]
    public string AddTerrainStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "terrainStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"xDimension\":\"plant\",\"yDimension\":\"product\",\"heightMetric\":\"output\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildTerrainStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.TerrainStory, "terrainStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Heat Map Story visualization (geographic choropleth / US state intensity).")]
    public string AddHeatMapStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "heatMapStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"geographicArea\":\"state_code\",\"metricValue\":\"revenue\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.HeatMapStory, "heatMapStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Pulse Wave Story visualization (time-series metric pulse with event spikes).")]
    public string AddPulseWaveStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "pulseWaveStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"timeField\":\"period\",\"metricValue\":\"revenue\",\"baselineValue\":\"target\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildPulseWaveStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.PulseWaveStory, "pulseWaveStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Flow Field Story visualization (stage-to-stage funnel / conversion flow).")]
    public string AddFlowFieldStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "flowFieldStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"sourceStage\":\"from_stage\",\"destinationStage\":\"to_stage\",\"flowVolume\":\"count\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildFlowFieldStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.FlowFieldStory, "flowFieldStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Honeycomb Story visualization (initiative / priority impact grid).")]
    public string AddHoneycombStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "honeycombStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"itemName\":\"initiative\",\"impactScore\":\"impact\",\"priorityLevel\":\"priority\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildHoneycombStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.HoneycombStory, "honeycombStory", codeName, parentId, tabIndex, propsJson);
    }

    [KernelFunction]
    [Description("Add a Spiral Story visualization (journey / milestone transformation spiral).")]
    public string AddSpiralStory(
        [Description("Story title")] string? title = null,
        [Description("Code name in camelCase")] string codeName = "spiralStory",
        [Description("Optional parent id")] string? parentId = null,
        [Description("Optional tab index")] int tabIndex = 0,
        [Description("Optional JSON object of role key to column name, e.g. {\"journeyName\":\"program\",\"stage\":\"milestone\",\"timelineField\":\"quarter\"}")] string? fieldMappingsJson = null)
    {
        string propsJson = StoryAiFieldMappingHelper.BuildSpiralStoryPropsJson(title, fieldMappingsJson);
        return AddComponent(ComponentType.SpiralStory, "spiralStory", codeName, parentId, tabIndex, propsJson);
    }
}
