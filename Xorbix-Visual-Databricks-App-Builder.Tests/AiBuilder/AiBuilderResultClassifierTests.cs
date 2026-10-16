using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class AiBuilderResultClassifierTests
{
    [Fact]
    public void ClassifyModelResolutionFailure_TenantAiModelNotFound_UsesModelUnavailable()
    {
        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyModelResolutionFailure(
            [new NotFoundError("Tenant AI model not found.")]);

        Assert.Equal(AiBuilderReasonCode.ModelUnavailable, reason.Code);
        Assert.Equal("Selected AI model not found", reason.Title);
    }

    [Fact]
    public void ClassifyModelResolutionFailure_MissingAccessToken_UsesConfigurationMissing()
    {
        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyModelResolutionFailure(
            [new BadRequestError("Tenant AI model is missing an access token.")]);

        Assert.Equal(AiBuilderReasonCode.ConfigurationMissing, reason.Code);
        Assert.Equal("AI model is not configured", reason.Title);
    }

    [Fact]
    public void ClassifyModelResolutionFailure_PlatformQuotaExceeded_UsesPlatformQuotaReason()
    {
        DateTime resetsAtUtc = new(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc);
        PlatformAiQuotaExceededError error = new(
            "Monthly VDAB Default limit reached (100k tokens). Resets August 1, 2026 UTC, or switch to a tenant AI model.",
            tokensUsed: 100_000,
            tokenLimit: 100_000,
            resetsAtUtc);

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyModelResolutionFailure([error]);

        Assert.Equal(AiBuilderReasonCode.PlatformQuotaExceeded, reason.Code);
        Assert.Equal(PlatformAiQuotaMessages.QuotaExceededTitle, reason.Title);
        Assert.Contains(error.Message, reason.Details);
    }

    [Fact]
    public void ClassifyAgentException_PlatformQuotaExceeded_UsesPlatformQuotaReason()
    {
        PlatformAiQuotaExceededException exception = new("Monthly VDAB Default token limit reached.");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.PlatformQuotaExceeded, reason.Code);
        Assert.Equal(PlatformAiQuotaMessages.QuotaExceededTitle, reason.Title);
    }

    [Fact]
    public void ClassifyAgentException_InvalidAccessToken_UsesConfigurationMissingNotTooComplex()
    {
        Exception exception = new HttpRequestException(
            """Databricks AI Gateway returned 401 (Unauthorized): {"error_code":401,"message":"Invalid access token. [ReqId: fdd6ef69-f726-4e94-b510-14df3ffcdc67]"}""");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.ConfigurationMissing, reason.Code);
        Assert.Equal("AI model authentication failed", reason.Title);
        Assert.Contains("access token", reason.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("too complex", reason.Title, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ClassifyAgentException_Gateway400WithTokenCountContaining401_UsesTooComplexNotAuth()
    {
        Exception exception = new HttpRequestException(
            """Databricks AI Gateway returned 400 (BadRequest): This model's maximum context length was exceeded; you requested 15401 tokens.""");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.TooComplex, reason.Code);
        Assert.Equal("Request is too complex for one pass", reason.Title);
        Assert.NotEqual(AiBuilderReasonCode.ConfigurationMissing, reason.Code);
    }

    [Fact]
    public void ClassifyAgentException_ContextLengthExceeded_UsesTooComplex()
    {
        Exception exception = new InvalidOperationException(
            "This model's maximum context length was exceeded for the prompt.");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.TooComplex, reason.Code);
        Assert.Equal("Request is too complex for one pass", reason.Title);
    }

    [Fact]
    public void ClassifyAgentException_UnsupportedApiType_UsesModelConfigurationUnsupported()
    {
        Exception exception = new InvalidOperationException(
            "API type 'mlflow/v1/chat/completions' is not supported. Supported API types: [openai/v1/responses].");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.ModelConfigurationUnsupported, reason.Code);
    }

    [Fact]
    public void ClassifyAgentException_ReasoningEffortWithTools_UsesModelConfigurationUnsupported()
    {
        Exception exception = new HttpRequestException(
            "Function tools with reasoning_effort are not supported for gpt-5.5 in /v1/chat/completions.");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.ModelConfigurationUnsupported, reason.Code);
        Assert.Contains("reasoning_effort", reason.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ClassifyAgentException_TemperatureRejected_UsesModelConfigurationUnsupported()
    {
        Exception exception = new HttpRequestException("temperature is not supported for this model");

        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(exception);

        Assert.Equal(AiBuilderReasonCode.ModelConfigurationUnsupported, reason.Code);
        Assert.Contains("temperature", reason.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void CreateModelToolCallingUnsupportedReason_UsesExpectedCode()
    {
        AiBuilderOutcomeReason reason = AiBuilderResultClassifier.CreateModelToolCallingUnsupportedReason();

        Assert.Equal(AiBuilderReasonCode.ModelToolCallingUnsupported, reason.Code);
        Assert.Contains("tool calling", reason.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseTaggedFinalOutcome_UnableWithOperations_BecomesPartial()
    {
        List<CanvasOperationDto> operations =
        [
            new CanvasOperationDto
            {
                Op = "add",
                Component = new ButtonComponentDto
                {
                    Id = "1",
                    CodeName = "button",
                    Type = ComponentType.Button,
                    Category = ComponentCategory.Controls,
                    Props = new ButtonProps { Label = "Button" },
                },
            },
        ];

        AiBuilderResponse? response = AiBuilderResultClassifier.ParseTaggedFinalOutcome(
            "UNABLE_TO_COMPLETE[TooComplex]: Could not finish everything.",
            operations);

        Assert.NotNull(response);
        Assert.Equal(AiBuilderCompletionStatus.Partial, response.Status);
        Assert.Single(response.Operations);
    }

    [Fact]
    public void ParseTaggedFinalOutcome_UnableWithoutOperations_StaysUnable()
    {
        AiBuilderResponse? response = AiBuilderResultClassifier.ParseTaggedFinalOutcome(
            "UNABLE_TO_COMPLETE[TooComplex]: Could not finish.",
            []);

        Assert.NotNull(response);
        Assert.Equal(AiBuilderCompletionStatus.UnableToComplete, response.Status);
        Assert.Empty(response.Operations);
    }

    [Fact]
    public void ParseTaggedFinalOutcome_Partial_AttachesOperations()
    {
        List<CanvasOperationDto> operations =
        [
            new CanvasOperationDto { Op = "addWorkflow" },
        ];

        AiBuilderResponse? response = AiBuilderResultClassifier.ParseTaggedFinalOutcome(
            "PARTIAL[TooComplex]: Added the form only.",
            operations);

        Assert.NotNull(response);
        Assert.Equal(AiBuilderCompletionStatus.Partial, response.Status);
        Assert.Single(response.Operations);
    }
}
