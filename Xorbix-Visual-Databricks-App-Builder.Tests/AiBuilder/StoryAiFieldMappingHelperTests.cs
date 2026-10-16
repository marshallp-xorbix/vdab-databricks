using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class StoryAiFieldMappingHelperTests
{
    [Fact]
    public void BuildHeatMapStoryPropsJson_EmptyMappings_UsesDefaultsWithoutFields()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson("Revenue by State", null);

        HeatMapStoryProps? props = JsonSerializer.Deserialize<HeatMapStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("Revenue by State", props.Title);
        Assert.Null(props.GeographicArea.Field);
        Assert.Equal("categorical", props.GeographicArea.ScaleType);
        Assert.Equal("none", props.GeographicArea.Transform);
        Assert.Null(props.MetricValue.Field);
        Assert.Equal("continuous", props.MetricValue.ScaleType);
        Assert.Equal("sum", props.MetricValue.Transform);
        Assert.Equal("usa", props.MapScope);
    }

    [Fact]
    public void BuildHeatMapStoryPropsJson_PartialRoles_SetsFieldsAndPreservesTransforms()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson(
            "Revenue by State",
            """{"geographicArea":"state_code","metricValue":"revenue","unknownRole":"ignored"}""");

        HeatMapStoryProps? props = JsonSerializer.Deserialize<HeatMapStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("state_code", props.GeographicArea.Field);
        Assert.Null(props.GeographicArea.DisplayName);
        Assert.Equal("categorical", props.GeographicArea.ScaleType);
        Assert.Equal("revenue", props.MetricValue.Field);
        Assert.Equal("sum", props.MetricValue.Transform);
        Assert.Null(props.TimeField.Field);
    }

    [Fact]
    public void BuildAmoebaStoryPropsJson_PartialRoles_SetsOnlyProvidedFields()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildAmoebaStoryPropsJson(
            null,
            """{"entityId":"customer_id","sizeMetric":"revenue"}""");

        AmoebaStoryProps? props = JsonSerializer.Deserialize<AmoebaStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("Amoeba Story", props.Title);
        Assert.Equal("customer_id", props.EntityId.Field);
        Assert.Equal("revenue", props.SizeMetric.Field);
        Assert.Equal("sum", props.SizeMetric.Transform);
        Assert.Null(props.EntityLabel.Field);
        Assert.Equal("avg", props.XMetric.Transform);
    }

    [Fact]
    public void BuildTerrainStoryPropsJson_RequiredRoles_AppliesColumns()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildTerrainStoryPropsJson(
            "Plant Output",
            """{"xDimension":"plant_name","yDimension":"product_family","heightMetric":"output_units"}""");

        TerrainStoryProps? props = JsonSerializer.Deserialize<TerrainStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("plant_name", props.XDimension.Field);
        Assert.Equal("product_family", props.YDimension.Field);
        Assert.Equal("output_units", props.HeightMetric.Field);
        Assert.Equal("sum", props.HeightMetric.Transform);
    }

    [Fact]
    public void BuildNetworkWebStoryPropsJson_UnknownKeysIgnored_DefaultsPreserved()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildNetworkWebStoryPropsJson(
            "Supply Chain",
            """{"sourceEntityId":"from_id","notARole":"x"}""");

        NetworkWebStoryProps? props = JsonSerializer.Deserialize<NetworkWebStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("from_id", props.SourceEntityId.Field);
        Assert.Null(props.TargetEntityId.Field);
        Assert.Equal("continuous", props.RelationshipWeight.ScaleType);
        Assert.Equal("none", props.RelationshipWeight.Transform);
    }

    [Fact]
    public void BuildHeatMapStoryPropsJson_InvalidJson_ThrowsInvalidOperationException()
    {
        InvalidOperationException ex = Assert.Throws<InvalidOperationException>(
            () => StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson("Title", "{not-json"));

        Assert.Contains("fieldMappingsJson", ex.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void BuildPulseWaveStoryPropsJson_PartialRoles_SetsFieldsAndPreservesTransforms()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildPulseWaveStoryPropsJson(
            "Metric Pulse",
            """{"timeField":"period","metricValue":"revenue","unknownRole":"x"}""");

        PulseWaveStoryProps? props = JsonSerializer.Deserialize<PulseWaveStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("period", props.TimeField.Field);
        Assert.Equal("revenue", props.MetricValue.Field);
        Assert.Equal("sum", props.MetricValue.Transform);
        Assert.Null(props.BaselineValue.Field);
        Assert.Equal("avg", props.BaselineValue.Transform);
    }

    [Fact]
    public void BuildFlowFieldStoryPropsJson_RequiredRoles_AppliesColumns()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildFlowFieldStoryPropsJson(
            "Funnel",
            """{"sourceStage":"from_stage","destinationStage":"to_stage","flowVolume":"volume","stageOrder":"ord"}""");

        FlowFieldStoryProps? props = JsonSerializer.Deserialize<FlowFieldStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("from_stage", props.SourceStage.Field);
        Assert.Equal("to_stage", props.DestinationStage.Field);
        Assert.Equal("volume", props.FlowVolume.Field);
        Assert.Equal("sum", props.FlowVolume.Transform);
        Assert.Equal("ord", props.StageOrder.Field);
        Assert.Equal("max", props.StageOrder.Transform);
    }

    [Fact]
    public void BuildHoneycombStoryPropsJson_EmptyMappings_UsesDefaultsWithoutFields()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildHoneycombStoryPropsJson(null, null);

        HoneycombStoryProps? props = JsonSerializer.Deserialize<HoneycombStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("Honeycomb Story", props.Title);
        Assert.Null(props.ItemName.Field);
        Assert.Equal("avg", props.ImpactScore.Transform);
        Assert.Equal("avg", props.ProgressPct.Transform);
    }

    [Fact]
    public void BuildSpiralStoryPropsJson_PartialRoles_SetsOnlyProvidedFields()
    {
        string propsJson = StoryAiFieldMappingHelper.BuildSpiralStoryPropsJson(
            "Journey",
            """{"journeyName":"program","stage":"milestone","metricValue":"value"}""");

        SpiralStoryProps? props = JsonSerializer.Deserialize<SpiralStoryProps>(propsJson, AiBuilderJsonOptions.CamelCase);

        Assert.NotNull(props);
        Assert.Equal("program", props.JourneyName.Field);
        Assert.Equal("milestone", props.Stage.Field);
        Assert.Equal("value", props.MetricValue.Field);
        Assert.Equal("sum", props.MetricValue.Transform);
        Assert.Null(props.TimelineField.Field);
        Assert.Equal("avg", props.ProgressPct.Transform);
    }

    [Fact]
    public void GetUnmappedRequiredRoles_HeatMapWithPartialMappings_ReturnsMissingRoles()
    {
        HeatMapStoryComponentDto component = new()
        {
            Id = "c1",
            CodeName = "heatMapStory",
            Type = ComponentType.HeatMapStory,
            Category = ComponentCategory.Visualization,
            SchemaVersion = 1,
            Props = JsonSerializer.Deserialize<HeatMapStoryProps>(
                StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson(
                    "Map",
                    """{"geographicArea":"state_code"}"""),
                AiBuilderJsonOptions.CamelCase)!,
        };

        IReadOnlyList<string> unmapped = StoryAiFieldMappingHelper.GetUnmappedRequiredRoles(component);

        Assert.Equal(["metricValue"], unmapped);
    }

    [Fact]
    public void ApplyIncompleteRequiredFieldMappings_UnmappedRoles_ForcesPartialNotEnoughInformation()
    {
        HeatMapStoryComponentDto component = new()
        {
            Id = "c1",
            CodeName = "heatMapStory",
            Type = ComponentType.HeatMapStory,
            Category = ComponentCategory.Visualization,
            SchemaVersion = 1,
            Props = JsonSerializer.Deserialize<HeatMapStoryProps>(
                StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson("Map", null),
                AiBuilderJsonOptions.CamelCase)!,
        };

        AiBuilderResponse result = new()
        {
            Status = AiBuilderCompletionStatus.Completed,
            Explanation = "Done",
            Operations = [],
        };

        List<CanvasOperationDto> operations =
        [
            new CanvasOperationDto { Op = "add", Component = component },
        ];

        AiBuilderResponse updated = StoryAiFieldMappingHelper.ApplyIncompleteRequiredFieldMappings(result, operations);

        Assert.Equal(AiBuilderCompletionStatus.Partial, updated.Status);
        Assert.NotNull(updated.Reason);
        Assert.Equal(AiBuilderReasonCode.NotEnoughInformation, updated.Reason.Code);
        Assert.Contains("heatMapStory.geographicArea", updated.Reason.MissingInputs);
        Assert.Contains("heatMapStory.metricValue", updated.Reason.MissingInputs);
    }

    [Fact]
    public void ApplyIncompleteRequiredFieldMappings_FullyMapped_LeavesCompleted()
    {
        HeatMapStoryComponentDto component = new()
        {
            Id = "c1",
            CodeName = "heatMapStory",
            Type = ComponentType.HeatMapStory,
            Category = ComponentCategory.Visualization,
            SchemaVersion = 1,
            Props = JsonSerializer.Deserialize<HeatMapStoryProps>(
                StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson(
                    "Map",
                    """{"geographicArea":"state_code","metricValue":"revenue"}"""),
                AiBuilderJsonOptions.CamelCase)!,
        };

        AiBuilderResponse result = new()
        {
            Status = AiBuilderCompletionStatus.Completed,
            Explanation = "Done",
            Operations = [new CanvasOperationDto { Op = "add", Component = component }],
        };

        AiBuilderResponse updated = StoryAiFieldMappingHelper.ApplyIncompleteRequiredFieldMappings(
            result,
            result.Operations);

        Assert.Equal(AiBuilderCompletionStatus.Completed, updated.Status);
        Assert.Null(updated.Reason);
    }

    [Fact]
    public void ApplyIncompleteRequiredFieldMappings_ExistingUnsupportedWorkflow_PreservesReasonAndExplanation()
    {
        HeatMapStoryComponentDto component = new()
        {
            Id = "c1",
            CodeName = "heatMapStory",
            Type = ComponentType.HeatMapStory,
            Category = ComponentCategory.Visualization,
            SchemaVersion = 1,
            Props = JsonSerializer.Deserialize<HeatMapStoryProps>(
                StoryAiFieldMappingHelper.BuildHeatMapStoryPropsJson("Map", null),
                AiBuilderJsonOptions.CamelCase)!,
        };

        const string originalExplanation = "Stories only support static binding.";
        const string originalTitle = "Unsupported workflow";

        AiBuilderResponse result = new()
        {
            Status = AiBuilderCompletionStatus.Partial,
            Explanation = originalExplanation,
            Operations = [new CanvasOperationDto { Op = "add", Component = component }],
            Reason = new AiBuilderOutcomeReason
            {
                Code = AiBuilderReasonCode.UnsupportedWorkflow,
                Title = originalTitle,
                Message = originalExplanation,
                Details = [],
                MissingInputs = [],
            },
        };

        AiBuilderResponse updated = StoryAiFieldMappingHelper.ApplyIncompleteRequiredFieldMappings(
            result,
            result.Operations);

        Assert.Equal(AiBuilderCompletionStatus.Partial, updated.Status);
        Assert.NotNull(updated.Reason);
        Assert.Equal(AiBuilderReasonCode.UnsupportedWorkflow, updated.Reason.Code);
        Assert.Equal(originalTitle, updated.Reason.Title);
        Assert.Equal(originalExplanation, updated.Explanation);
        Assert.Contains("heatMapStory.geographicArea", updated.Reason.MissingInputs);
        Assert.Contains("heatMapStory.metricValue", updated.Reason.MissingInputs);
        Assert.Contains(updated.Reason.Details, d => d.Contains("missing", StringComparison.Ordinal));
    }
}
