using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal static class AiBuilderOutcomeFactory
{
    internal static AiBuilderResponse CreateResponse(
        AiBuilderCompletionStatus status,
        string explanation,
        AiBuilderOutcomeReason? reason = null,
        List<CanvasOperationDto>? operations = null)
    {
        return new AiBuilderResponse
        {
            Status = status,
            Explanation = explanation,
            Reason = reason,
            Operations = operations ?? [],
        };
    }

    internal static AiBuilderOutcomeReason CreateReason(
        AiBuilderReasonCode code,
        string title,
        string message,
        IEnumerable<string>? details = null,
        IEnumerable<string>? suggestedActions = null,
        IEnumerable<string>? missingInputs = null)
    {
        return new AiBuilderOutcomeReason
        {
            Code = code,
            Title = title,
            Message = message,
            Details = details?.Where(detail => !string.IsNullOrWhiteSpace(detail)).ToList() ?? [],
            SuggestedActions = suggestedActions?.Where(action => !string.IsNullOrWhiteSpace(action)).ToList() ?? [],
            MissingInputs = missingInputs?.Where(input => !string.IsNullOrWhiteSpace(input)).ToList() ?? [],
        };
    }
}
