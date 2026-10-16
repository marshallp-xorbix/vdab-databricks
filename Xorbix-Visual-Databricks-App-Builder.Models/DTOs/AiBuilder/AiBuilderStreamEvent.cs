namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

/// <summary>A single event emitted by the AI builder streaming endpoint.</summary>
public class AiBuilderStreamEvent
{
    /// <summary>The event type: "progress", "result", or "error".</summary>
    public string Type { get; init; } = string.Empty;

    /// <summary>Human-readable status message (set on "progress" and "error" events).</summary>
    public string? Message { get; init; }

    /// <summary>Structured reason for expected errors or incomplete generation.</summary>
    public AiBuilderOutcomeReason? Reason { get; init; }

    /// <summary>Final result payload (set on "result" events only).</summary>
    public AiBuilderResponse? Result { get; init; }
}
