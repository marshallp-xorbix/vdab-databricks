namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;

public enum AiBuilderCompletionStatus
{
    Completed,
    Partial,
    NeedsClarification,
    UnableToComplete,
}

public enum AiBuilderReasonCode
{
    NotEnoughInformation,
    TooComplex,
    TooManyFields,
    UnsupportedComponent,
    UnsupportedWorkflow,
    WorkspaceConnectionMissing,
    DatabricksMetadataUnavailable,
    ToolValidationFailed,
    OperationValidationFailed,
    ModelUnavailable,
    ConfigurationMissing,
    PlatformQuotaExceeded,
    ModelToolCallingUnsupported,
    ModelConfigurationUnsupported,
}

public class AiBuilderOutcomeReason
{
    public AiBuilderReasonCode Code { get; set; } = AiBuilderReasonCode.OperationValidationFailed;
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public List<string> Details { get; set; } = [];
    public List<string> SuggestedActions { get; set; } = [];
    public List<string> MissingInputs { get; set; } = [];
}

public class AiBuilderResponse
{
    public AiBuilderCompletionStatus Status { get; set; } = AiBuilderCompletionStatus.Completed;
    public List<CanvasOperationDto> Operations { get; set; } = [];
    public string Explanation { get; set; } = string.Empty;
    public AiBuilderOutcomeReason? Reason { get; set; }
}
