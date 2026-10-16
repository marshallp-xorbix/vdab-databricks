using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

internal static class AiBuilderResultClassifier
{
    internal static AiBuilderOutcomeReason? GetConfigurationReason(DatabricksAiConfiguration config)
    {
        return GetConfigurationReason(config.WorkspaceUrl, config.AccessToken, config.EndpointName);
    }

    internal static AiBuilderOutcomeReason? GetConfigurationReason(ResolvedAiModelConfiguration config)
    {
        return GetConfigurationReason(config.WorkspaceUrl, config.AccessToken, config.EndpointName);
    }

    private static AiBuilderOutcomeReason? GetConfigurationReason(
        string workspaceUrl,
        string accessToken,
        string endpointName)
    {
        List<string> missingInputs = [];
        if (string.IsNullOrWhiteSpace(workspaceUrl))
            missingInputs.Add("Databricks AI WorkspaceUrl");
        if (string.IsNullOrWhiteSpace(accessToken))
            missingInputs.Add("Databricks AI AccessToken");
        if (string.IsNullOrWhiteSpace(endpointName))
            missingInputs.Add("Databricks AI EndpointName");
        if (missingInputs.Count == 0 && !Uri.TryCreate(DatabricksServingUrlHelper.BuildServingBaseUrl(workspaceUrl), UriKind.Absolute, out _))
            missingInputs.Add("Valid Databricks AI WorkspaceUrl");

        if (missingInputs.Count == 0)
            return null;

        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.ConfigurationMissing,
            "AI Builder is not configured",
            "AI Builder cannot generate app changes until the Databricks AI serving configuration is complete.",
            missingInputs.Select(input => $"Missing or invalid: {input}"),
            ["Configure the Databricks AI settings and try again."],
            missingInputs);
    }

    internal static AiBuilderStreamEvent CreateResultEvent(
        AiBuilderCompletionStatus status,
        string explanation,
        AiBuilderOutcomeReason reason)
    {
        return new AiBuilderStreamEvent
        {
            Type = "result",
            Message = explanation,
            Reason = reason,
            Result = AiBuilderOutcomeFactory.CreateResponse(status, explanation, reason),
        };
    }

    internal static AiBuilderOutcomeReason ClassifyModelResolutionFailure(IReadOnlyList<IError> errors)
    {
        IError? error = errors.FirstOrDefault();
        if (error is PlatformAiQuotaExceededError quotaExceeded)
        {
            return CreatePlatformQuotaExceededReason(quotaExceeded.Message);
        }

        if (error is ForbiddenError forbidden)
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.WorkspaceConnectionMissing,
                "Workspace connection is unavailable",
                forbidden.Message,
                [forbidden.Message],
                ["Check the model's Databricks workspace connection and try again."]);
        }

        if (error is BadRequestError badRequest)
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.ConfigurationMissing,
                "AI model is not configured",
                badRequest.Message,
                [badRequest.Message],
                ["Update the tenant AI model configuration in Databricks Connections."]);
        }

        if (error is NotFoundError notFoundError)
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.ModelUnavailable,
                "Selected AI model not found",
                notFoundError.Message,
                [notFoundError.Message],
                ["Choose a different model and try again."]);
        }

        string message = error?.Message ?? "AI model could not be resolved.";
        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.ModelUnavailable,
            "AI model could not be resolved",
            message,
            [message],
            ["Try again or choose a different model."]);
    }

    internal static AiBuilderOutcomeReason ClassifyContextFailure(string message)
    {
        if (message.Contains("second operation was started on this context", StringComparison.OrdinalIgnoreCase))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.DatabricksMetadataUnavailable,
                "AI Builder context could not be loaded",
                "Databricks metadata could not be loaded safely for this request. Please try again.",
                [message],
                ["Try again. If this continues, check the AI Builder service logs."]);
        }

        if (message.Contains("workspace", StringComparison.OrdinalIgnoreCase)
            || message.Contains("connection", StringComparison.OrdinalIgnoreCase))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.WorkspaceConnectionMissing,
                "Workspace connection is unavailable",
                message,
                [message],
                ["Check the app's Databricks workspace connection and try again."]);
        }

        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.DatabricksMetadataUnavailable,
            "AI Builder context could not be loaded",
            message,
            [message],
            ["Try again after the Databricks metadata connection is available."]);
    }

    internal static AiBuilderOutcomeReason ClassifyAgentException(Exception exception)
    {
        if (exception is PlatformAiQuotaExceededException quotaException)
        {
            return CreatePlatformQuotaExceededReason(quotaException.Message);
        }

        string message = FlattenExceptionMessage(exception);
        if (message.Contains("second operation was started on this context", StringComparison.OrdinalIgnoreCase))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.ModelUnavailable,
                "AI Builder stream failed",
                "AI Builder could not complete the generation stream. Please try again.",
                [message],
                ["Try again. If this continues, check the AI Builder service logs."]);
        }

        string? unsupportedEndpoint = AiGatewayEndpointErrorClassifier.TryClassifyUnsupportedEndpoint(message);
        if (unsupportedEndpoint is not null)
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.ModelConfigurationUnsupported,
                "AI model configuration is unsupported",
                unsupportedEndpoint,
                [message],
                ["Register a chat endpoint that supports mlflow/v1/chat/completions."]);
        }

        if (IsAiGatewayUnauthorized(message))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.ConfigurationMissing,
                "AI model authentication failed",
                "Databricks AI Gateway rejected the access token. Update the PAT for the selected AI model and try again.",
                [message],
                [
                    "Verify the PAT was generated in the same workspace, has not expired, and can query the serving endpoint via AI Gateway.",
                    "Update the token on the tenant AI model in Databricks Connections, or DatabricksAi:AccessToken for the platform default model.",
                ]);
        }

        if (message.Contains("required", StringComparison.OrdinalIgnoreCase)
            || message.Contains("missing", StringComparison.OrdinalIgnoreCase)
            || message.Contains("provide", StringComparison.OrdinalIgnoreCase))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.NotEnoughInformation,
                "More information is needed",
                "AI Builder needs a few more details before it can safely complete this request.",
                [message],
                ["Reply with the missing table, workflow, field, or Databricks resource details."]);
        }

        if (IsRequestTooComplex(message))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.TooComplex,
                "Request is too complex for one pass",
                "AI Builder could not complete the whole request in a single generation pass.",
                [message],
                ["Break the request into smaller app sections or workflows."]);
        }

        if (message.Contains("unsupported", StringComparison.OrdinalIgnoreCase))
        {
            return AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.UnsupportedComponent,
                "Unsupported builder request",
                "AI Builder tried to use a component or workflow pattern that is not supported yet.",
                [message],
                ["Try using existing VDAB components and workflow actions."]);
        }

        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.ToolValidationFailed,
            "AI Builder could not apply the requested change",
            "The generated tool call failed validation before changes could be returned.",
            [message],
            ["Try a smaller prompt with explicit component names and workflow steps."]);
    }

    internal static AiBuilderResponse? ParseTaggedFinalOutcome(string finalText, List<CanvasOperationDto> operations)
    {
        if (string.IsNullOrWhiteSpace(finalText))
            return null;

        string trimmed = finalText.Trim();
        if (trimmed.StartsWith("NEEDS_CLARIFICATION:", StringComparison.OrdinalIgnoreCase))
        {
            string message = trimmed["NEEDS_CLARIFICATION:".Length..].Trim();
            AiBuilderOutcomeReason reason = AiBuilderOutcomeFactory.CreateReason(
                AiBuilderReasonCode.NotEnoughInformation,
                "More information is needed",
                string.IsNullOrWhiteSpace(message) ? "AI Builder needs more detail before it can complete this request." : message,
                suggestedActions: ["Reply with the missing details so AI Builder can continue."]);

            return AiBuilderOutcomeFactory.CreateResponse(AiBuilderCompletionStatus.NeedsClarification, reason.Message, reason);
        }

        if (TryParseUnableTag(trimmed, "UNABLE_TO_COMPLETE", out AiBuilderResponse? unableResponse))
        {
            if (operations.Count > 0)
            {
                unableResponse!.Operations = operations;
                unableResponse.Status = AiBuilderCompletionStatus.Partial;
            }

            return unableResponse;
        }

        if (TryParseUnableTag(trimmed, "PARTIAL", out AiBuilderResponse? partialResponse))
        {
            AiBuilderResponse response = partialResponse!;
            response.Operations = operations;
            response.Status = AiBuilderCompletionStatus.Partial;
            return response;
        }

        return null;
    }

    private static bool TryParseUnableTag(string text, string tag, out AiBuilderResponse? response)
    {
        response = null;
        if (!text.StartsWith(tag, StringComparison.OrdinalIgnoreCase))
            return false;

        AiBuilderReasonCode code = AiBuilderReasonCode.UnsupportedWorkflow;
        int messageStart = tag.Length;
        if (text.Length > tag.Length && text[tag.Length] == '[')
        {
            int closingIndex = text.IndexOf(']', tag.Length + 1);
            if (closingIndex > tag.Length && Enum.TryParse(text[(tag.Length + 1)..closingIndex], ignoreCase: true, out AiBuilderReasonCode parsedCode))
            {
                code = parsedCode;
                messageStart = closingIndex + 1;
            }
        }

        if (text.Length > messageStart && text[messageStart] == ':')
            messageStart++;

        string message = text[messageStart..].Trim();
        if (string.IsNullOrWhiteSpace(message))
            message = "AI Builder could not complete this request with the information available.";

        AiBuilderOutcomeReason reason = AiBuilderOutcomeFactory.CreateReason(
            code,
            tag.Equals("PARTIAL", StringComparison.OrdinalIgnoreCase) ? "AI Builder partially completed the request" : "AI Builder could not complete the request",
            message,
            suggestedActions: ["Adjust the request or provide more detail, then try again."]);

        response = AiBuilderOutcomeFactory.CreateResponse(AiBuilderCompletionStatus.UnableToComplete, message, reason);
        return true;
    }

    private static string FlattenExceptionMessage(Exception exception)
    {
        List<string> messages = [];
        Exception? current = exception;
        while (current is not null)
        {
            if (!string.IsNullOrWhiteSpace(current.Message))
                messages.Add(current.Message);

            current = current.InnerException;
        }

        return messages.Count > 0 ? string.Join(" ", messages.Distinct()) : "AI generation failed.";
    }

    /// <summary>
    /// Detects Databricks AI Gateway auth failures. Must run before complexity heuristics —
    /// messages like "Invalid access token" contain "token" but are not context-length errors.
    /// </summary>
    private static bool IsAiGatewayUnauthorized(string message)
    {
        if (message.Contains("Invalid access token", StringComparison.OrdinalIgnoreCase))
            return true;

        // The tagging handler stamps "AI Gateway" onto every error, and response bodies can
        // embed "401" in token counts / ReqId GUIDs — match the real 401 status token,
        // not a bare "401" substring.
        if (message.Contains("401 (Unauthorized)", StringComparison.OrdinalIgnoreCase)
            || message.Contains("returned 401", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return message.Contains("Unauthorized", StringComparison.OrdinalIgnoreCase)
            && message.Contains("access token", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsRequestTooComplex(string message)
    {
        return message.Contains("context length", StringComparison.OrdinalIgnoreCase)
            || message.Contains("context_length_exceeded", StringComparison.OrdinalIgnoreCase)
            || message.Contains("too complex", StringComparison.OrdinalIgnoreCase)
            || message.Contains("token limit", StringComparison.OrdinalIgnoreCase)
            || message.Contains("max tokens", StringComparison.OrdinalIgnoreCase)
            || message.Contains("maximum context", StringComparison.OrdinalIgnoreCase)
            || message.Contains("prompt is too long", StringComparison.OrdinalIgnoreCase);
    }

    private static AiBuilderOutcomeReason CreatePlatformQuotaExceededReason(string message)
    {
        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.PlatformQuotaExceeded,
            PlatformAiQuotaMessages.QuotaExceededTitle,
            message,
            [message],
            [PlatformAiQuotaMessages.SwitchToTenantModelSuggestedAction]);
    }

    internal static AiBuilderOutcomeReason CreateModelToolCallingUnsupportedReason(
        string? message = null,
        IEnumerable<string>? details = null,
        IEnumerable<string>? suggestedActions = null)
    {
        return AiBuilderOutcomeFactory.CreateReason(
            AiBuilderReasonCode.ModelToolCallingUnsupported,
            "AI model does not support builder tool calling",
            message
            ?? "The model responded but did not invoke AI Builder tools. AI Builder requires a model that supports tool calling via the Databricks AI Gateway.",
            details ?? [],
            suggestedActions
            ?? [
                "Try a proprietary chat model with tool calling enabled.",
                "Verify the endpoint supports function calling through mlflow/v1/chat/completions.",
            ]);
    }
}
