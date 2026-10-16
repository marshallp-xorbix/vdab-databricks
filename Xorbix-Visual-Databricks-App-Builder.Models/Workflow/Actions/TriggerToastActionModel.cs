using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Typed TriggerToast workflow node model.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actions/triggerToast.ts
/// </summary>
public sealed class TriggerToastActionModel : WorkflowActionNodeModel
{
    public required string Body { get; init; }

    public string? Icon { get; init; }

    public required ToastDurationModel Duration { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.TriggerToast;
}

/// <summary>
/// Typed duration union for workflow toast actions.
/// </summary>
public abstract class ToastDurationModel
{
    public abstract ToastDurationKind Kind { get; }
}

public sealed class ToastPresetDurationModel : ToastDurationModel
{
    public required ToastPresetDuration Value { get; init; }

    public override ToastDurationKind Kind => ToastDurationKind.Preset;
}

public sealed class ToastSecondsDurationModel : ToastDurationModel
{
    public required int Value { get; init; }

    public override ToastDurationKind Kind => ToastDurationKind.Seconds;
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ToastDurationKind
{
    [JsonStringEnumMemberName("preset")]
    Preset,

    [JsonStringEnumMemberName("seconds")]
    Seconds
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ToastPresetDuration
{
    [JsonStringEnumMemberName("short")]
    Short,

    [JsonStringEnumMemberName("long")]
    Long,

    [JsonStringEnumMemberName("infinite")]
    Infinite
}