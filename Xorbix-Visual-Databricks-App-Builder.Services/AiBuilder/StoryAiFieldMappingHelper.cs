using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories.Helpers;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Builds story visualization props for AI Builder add tools, applying optional role→column mappings.
/// </summary>
internal static class StoryAiFieldMappingHelper
{
    /// <summary>
    /// Builds Amoeba Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildAmoebaStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        AmoebaStoryProps props = StoryComponentDefaults.CreateAmoebaProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.EntityId, mappings, "entityId");
        Apply(props.EntityLabel, mappings, "entityLabel");
        Apply(props.Category, mappings, "category");
        Apply(props.SizeMetric, mappings, "sizeMetric");
        Apply(props.XMetric, mappings, "xMetric");
        Apply(props.YMetric, mappings, "yMetric");
        Apply(props.ChangeMetric, mappings, "changeMetric");
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.HealthScore, mappings, "healthScore");
        Apply(props.RiskScore, mappings, "riskScore");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Network Web Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildNetworkWebStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        NetworkWebStoryProps props = StoryComponentDefaults.CreateNetworkWebProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.SourceEntityId, mappings, "sourceEntityId");
        Apply(props.SourceEntityLabel, mappings, "sourceEntityLabel");
        Apply(props.TargetEntityId, mappings, "targetEntityId");
        Apply(props.TargetEntityLabel, mappings, "targetEntityLabel");
        Apply(props.RelationshipType, mappings, "relationshipType");
        Apply(props.RelationshipWeight, mappings, "relationshipWeight");
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.Direction, mappings, "direction");
        Apply(props.EdgeValue, mappings, "edgeValue");
        Apply(props.Frequency, mappings, "frequency");
        Apply(props.EdgeRiskScore, mappings, "edgeRiskScore");
        Apply(props.EdgeStatus, mappings, "edgeStatus");
        Apply(props.SourceCategory, mappings, "sourceCategory");
        Apply(props.TargetCategory, mappings, "targetCategory");
        Apply(props.SourceValue, mappings, "sourceValue");
        Apply(props.TargetValue, mappings, "targetValue");
        Apply(props.SourceHealthScore, mappings, "sourceHealthScore");
        Apply(props.TargetHealthScore, mappings, "targetHealthScore");
        Apply(props.SourceRiskScore, mappings, "sourceRiskScore");
        Apply(props.TargetRiskScore, mappings, "targetRiskScore");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Terrain Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildTerrainStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        TerrainStoryProps props = StoryComponentDefaults.CreateTerrainProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.XDimension, mappings, "xDimension");
        Apply(props.YDimension, mappings, "yDimension");
        Apply(props.HeightMetric, mappings, "heightMetric");
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.TerrainCategory, mappings, "terrainCategory");
        Apply(props.RiskScore, mappings, "riskScore");
        Apply(props.TargetValue, mappings, "targetValue");
        Apply(props.BaselineValue, mappings, "baselineValue");
        Apply(props.ForecastValue, mappings, "forecastValue");
        Apply(props.VolumeMetric, mappings, "volumeMetric");
        Apply(props.Status, mappings, "status");
        Apply(props.EventName, mappings, "eventName");
        Apply(props.EventDate, mappings, "eventDate");
        Apply(props.CalloutText, mappings, "calloutText");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Heat Map Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildHeatMapStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        HeatMapStoryProps props = StoryComponentDefaults.CreateHeatMapProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.GeographicArea, mappings, "geographicArea");
        Apply(props.MetricValue, mappings, "metricValue");
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.SecondaryMetric, mappings, "secondaryMetric");
        Apply(props.ChangePct, mappings, "changePct");
        Apply(props.TargetValue, mappings, "targetValue");
        Apply(props.RiskScore, mappings, "riskScore");
        Apply(props.Category, mappings, "category");
        Apply(props.ForecastValue, mappings, "forecastValue");
        Apply(props.Notes, mappings, "notes");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Pulse Wave Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildPulseWaveStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        PulseWaveStoryProps props = StoryComponentDefaults.CreatePulseWaveProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.MetricValue, mappings, "metricValue");
        Apply(props.BaselineValue, mappings, "baselineValue");
        Apply(props.EventName, mappings, "eventName");
        Apply(props.EventType, mappings, "eventType");
        Apply(props.ImpactScore, mappings, "impactScore");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Flow Field Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildFlowFieldStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        FlowFieldStoryProps props = StoryComponentDefaults.CreateFlowFieldProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.SourceStage, mappings, "sourceStage");
        Apply(props.DestinationStage, mappings, "destinationStage");
        Apply(props.FlowVolume, mappings, "flowVolume");
        Apply(props.StageOrder, mappings, "stageOrder");
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.ConversionPct, mappings, "conversionPct");
        Apply(props.DropOffCount, mappings, "dropOffCount");
        Apply(props.AvgTimeInStage, mappings, "avgTimeInStage");
        Apply(props.Status, mappings, "status");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Honeycomb Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildHoneycombStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        HoneycombStoryProps props = StoryComponentDefaults.CreateHoneycombProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.ItemName, mappings, "itemName");
        Apply(props.ImpactScore, mappings, "impactScore");
        Apply(props.PriorityLevel, mappings, "priorityLevel");
        Apply(props.ProgressPct, mappings, "progressPct");
        Apply(props.Category, mappings, "category");
        Apply(props.TimeField, mappings, "timeField");
        Apply(props.Trend, mappings, "trend");
        Apply(props.RiskScore, mappings, "riskScore");
        Apply(props.Owner, mappings, "owner");
        Apply(props.DueDate, mappings, "dueDate");
        Apply(props.Investment, mappings, "investment");
        Apply(props.BenefitValue, mappings, "benefitValue");
        Apply(props.Notes, mappings, "notes");
        Apply(props.Status, mappings, "status");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    /// <summary>
    /// Builds Spiral Story props JSON from an optional title and role→column map.
    /// </summary>
    public static string BuildSpiralStoryPropsJson(string? title, string? fieldMappingsJson)
    {
        SpiralStoryProps props = StoryComponentDefaults.CreateSpiralProps(title);
        Dictionary<string, string> mappings = ParseMappings(fieldMappingsJson);
        Apply(props.JourneyName, mappings, "journeyName");
        Apply(props.Stage, mappings, "stage");
        Apply(props.TimelineField, mappings, "timelineField");
        Apply(props.ProgressPct, mappings, "progressPct");
        Apply(props.MetricValue, mappings, "metricValue");
        Apply(props.TargetDate, mappings, "targetDate");
        Apply(props.ActualDate, mappings, "actualDate");
        Apply(props.Status, mappings, "status");
        Apply(props.RiskScore, mappings, "riskScore");
        Apply(props.Owner, mappings, "owner");
        Apply(props.KeyAchievement, mappings, "keyAchievement");
        Apply(props.Cost, mappings, "cost");
        return JsonSerializer.Serialize(props, AiBuilderJsonOptions.CamelCase);
    }

    private static Dictionary<string, string> ParseMappings(string? fieldMappingsJson)
    {
        if (string.IsNullOrWhiteSpace(fieldMappingsJson))
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        try
        {
            Dictionary<string, string>? mappings = JsonSerializer.Deserialize<Dictionary<string, string>>(
                fieldMappingsJson,
                AiBuilderJsonOptions.CamelCase);
            return mappings is null
                ? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(mappings, StringComparer.OrdinalIgnoreCase);
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException(
                "fieldMappingsJson must be a JSON object of role keys to column name strings, e.g. {\"geographicArea\":\"state_code\",\"metricValue\":\"revenue\"}.",
                ex);
        }
    }

    private static void Apply(ChartAxisConfigDto axis, Dictionary<string, string> mappings, string roleKey)
    {
        if (!mappings.TryGetValue(roleKey, out string? column) || string.IsNullOrWhiteSpace(column))
            return;

        string trimmed = column.Trim();
        axis.Field = trimmed;
    }

    /// <summary>
    /// Marks the response Partial when added/modified stories still have unmapped required Field roles.
    /// </summary>
    public static AiBuilderResponse ApplyIncompleteRequiredFieldMappings(
        AiBuilderResponse result,
        IReadOnlyList<CanvasOperationDto> operations)
    {
        List<string> details = [];
        List<string> missingInputs = [];

        foreach (CanvasOperationDto operation in operations)
        {
            if (!IsAddOrModify(operation.Op) || operation.Component is null)
                continue;

            IReadOnlyList<string> unmappedRoles = GetUnmappedRequiredRoles(operation.Component);
            if (unmappedRoles.Count == 0)
                continue;

            string codeName = string.IsNullOrWhiteSpace(operation.Component.CodeName)
                ? operation.Component.Type.ToString()
                : operation.Component.CodeName;
            details.Add($"{codeName}: missing {string.Join(", ", unmappedRoles)}");
            foreach (string role in unmappedRoles)
                missingInputs.Add($"{codeName}.{role}");
        }

        if (details.Count == 0)
            return result;

        result.Status = AiBuilderCompletionStatus.Partial;
        if (result.Operations.Count == 0)
            result.Operations = operations.ToList();

        if (result.Reason is not null)
        {
            // Enrich — never replace — a terminal reason the model already produced
            // (e.g. UNABLE_TO_COMPLETE[UnsupportedWorkflow] for event-driven story requests).
            if (result.Reason.Code == AiBuilderReasonCode.TooComplex)
                result.Reason.Code = AiBuilderReasonCode.NotEnoughInformation;
            if (result.Reason.Details.Count == 0)
                result.Reason.Details = details;
            if (result.Reason.MissingInputs.Count == 0)
                result.Reason.MissingInputs = missingInputs;
            return result;
        }

        const string defaultMessage =
            "Story visualization(s) were added and bound, but required Field Mappings are incomplete. Finish mapping in Properties → Field Mappings.";

        result.Reason = AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.NotEnoughInformation,
            "Story field mappings incomplete",
            defaultMessage,
            details: details,
            suggestedActions: ["Open Properties → Field Mappings and map the required roles listed in the details."],
            missingInputs: missingInputs);
        result.Explanation = defaultMessage;
        return result;
    }

    /// <summary>
    /// Returns required Field Mapping role keys that still have an empty Field on the component.
    /// </summary>
    public static IReadOnlyList<string> GetUnmappedRequiredRoles(VdabComponentDto component) =>
        component switch
        {
            AmoebaStoryComponentDto amoeba => Unmapped(
                ("entityId", amoeba.Props.EntityId),
                ("entityLabel", amoeba.Props.EntityLabel),
                ("category", amoeba.Props.Category),
                ("sizeMetric", amoeba.Props.SizeMetric),
                ("xMetric", amoeba.Props.XMetric),
                ("yMetric", amoeba.Props.YMetric),
                ("changeMetric", amoeba.Props.ChangeMetric)),
            NetworkWebStoryComponentDto network => Unmapped(
                ("sourceEntityId", network.Props.SourceEntityId),
                ("sourceEntityLabel", network.Props.SourceEntityLabel),
                ("targetEntityId", network.Props.TargetEntityId),
                ("targetEntityLabel", network.Props.TargetEntityLabel),
                ("relationshipType", network.Props.RelationshipType),
                ("relationshipWeight", network.Props.RelationshipWeight)),
            TerrainStoryComponentDto terrain => Unmapped(
                ("xDimension", terrain.Props.XDimension),
                ("yDimension", terrain.Props.YDimension),
                ("heightMetric", terrain.Props.HeightMetric)),
            HeatMapStoryComponentDto heatMap => Unmapped(
                ("geographicArea", heatMap.Props.GeographicArea),
                ("metricValue", heatMap.Props.MetricValue)),
            PulseWaveStoryComponentDto pulseWave => Unmapped(
                ("timeField", pulseWave.Props.TimeField),
                ("metricValue", pulseWave.Props.MetricValue),
                ("baselineValue", pulseWave.Props.BaselineValue)),
            FlowFieldStoryComponentDto flowField => Unmapped(
                ("sourceStage", flowField.Props.SourceStage),
                ("destinationStage", flowField.Props.DestinationStage),
                ("flowVolume", flowField.Props.FlowVolume),
                ("stageOrder", flowField.Props.StageOrder)),
            HoneycombStoryComponentDto honeycomb => Unmapped(
                ("itemName", honeycomb.Props.ItemName),
                ("impactScore", honeycomb.Props.ImpactScore),
                ("priorityLevel", honeycomb.Props.PriorityLevel),
                ("progressPct", honeycomb.Props.ProgressPct),
                ("category", honeycomb.Props.Category)),
            SpiralStoryComponentDto spiral => Unmapped(
                ("journeyName", spiral.Props.JourneyName),
                ("stage", spiral.Props.Stage),
                ("timelineField", spiral.Props.TimelineField),
                ("progressPct", spiral.Props.ProgressPct),
                ("metricValue", spiral.Props.MetricValue)),
            _ => [],
        };

    private static bool IsAddOrModify(string? op) =>
        string.Equals(op, "add", StringComparison.OrdinalIgnoreCase)
        || string.Equals(op, "modify", StringComparison.OrdinalIgnoreCase);

    private static List<string> Unmapped(params (string Role, ChartAxisConfigDto Axis)[] roles)
    {
        List<string> missing = [];
        foreach ((string role, ChartAxisConfigDto axis) in roles)
        {
            if (string.IsNullOrWhiteSpace(axis.Field))
                missing.Add(role);
        }

        return missing;
    }
}
