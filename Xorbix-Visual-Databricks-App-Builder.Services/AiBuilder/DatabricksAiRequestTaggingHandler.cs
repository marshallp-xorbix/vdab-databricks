using System.Text;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Adds <c>Databricks-Ai-Gateway-Request-Tags</c> to outbound AI serving requests so calls
/// can be attributed to the end user in <c>system.ai_gateway.usage</c>.
/// </summary>
public sealed class DatabricksAiRequestTaggingHandler : DelegatingHandler
{
    private readonly ICurrentUserService _currentUserService;
    private readonly IAiBuilderGatewayTagContext _gatewayTagContext;
    private readonly IPlatformAiQuotaService _platformAiQuotaService;
    private readonly ILogger<DatabricksAiRequestTaggingHandler> _logger;

    public DatabricksAiRequestTaggingHandler(
        ICurrentUserService currentUserService,
        IAiBuilderGatewayTagContext gatewayTagContext,
        IPlatformAiQuotaService platformAiQuotaService,
        ILogger<DatabricksAiRequestTaggingHandler> logger)
    {
        _currentUserService = currentUserService;
        _gatewayTagContext = gatewayTagContext;
        _platformAiQuotaService = platformAiQuotaService;
        _logger = logger;
    }

    /// <inheritdoc/>
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        string? email = _currentUserService.GetUserEmail();
        _gatewayTagContext.TryGet(out AiBuilderGatewayTags? aiBuilderTags);
        Dictionary<string, string> tags = DatabricksAiGatewayTagBuilder.Build(email, aiBuilderTags);

        if (tags.Count > 0)
        {
            string tagJson = JsonSerializer.Serialize(tags);
            request.Headers.TryAddWithoutValidation(AiBuilderGatewayTagKeys.HeaderName, tagJson);
        }

        Guid? userId = _currentUserService.GetUserId();
        bool isPlatformAiBuilderSession = IsPlatformAiBuilderSession(aiBuilderTags);
        if (isPlatformAiBuilderSession && userId.HasValue)
        {
            Result quotaResult = await _platformAiQuotaService.EnsureCanUsePlatformModelAsync(
                userId.Value,
                cancellationToken);
            if (quotaResult.IsFailed)
            {
                string message = quotaResult.Errors.FirstOrDefault()?.Message
                    ?? PlatformAiQuotaMessages.QuotaExceededFallbackMessage;
                throw new PlatformAiQuotaExceededException(message);
            }
        }

        HttpResponseMessage response = await base.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            string responseDetail = response.Content is not null
                ? TruncateForLog(await response.Content.ReadAsStringAsync(cancellationToken))
                : string.Empty;

            _logger.LogWarning(
                "AI Gateway returned {StatusCode} for {Url}. Response: {ResponseBody}",
                (int)response.StatusCode,
                request.RequestUri,
                responseDetail);

            if (aiBuilderTags is not null)
            {
                string message = string.IsNullOrWhiteSpace(responseDetail)
                    ? $"Databricks AI Gateway returned {(int)response.StatusCode} ({response.StatusCode})."
                    : $"Databricks AI Gateway returned {(int)response.StatusCode} ({response.StatusCode}): {responseDetail}";

                throw new HttpRequestException(message);
            }
        }

        if (isPlatformAiBuilderSession
            && userId.HasValue
            && aiBuilderTags?.TenantId is Guid recordTenantId
            && response.Content is not null)
        {
            string responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            if (OpenAiUsageParser.TryParseTotalTokens(
                    responseBody,
                    out int totalTokens,
                    out int? inputTokens,
                    out int? outputTokens))
            {
                PlatformAiUsageRecordContext recordContext = new()
                {
                    TotalTokens = totalTokens,
                    InputTokens = inputTokens,
                    OutputTokens = outputTokens,
                    TenantId = recordTenantId,
                    AppId = aiBuilderTags.AppId,
                };
                try
                {
                    await _platformAiQuotaService.RecordUsageAsync(
                        userId.Value,
                        recordContext,
                        cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(
                        ex,
                        "Failed to record platform AI usage for user {UserId} in tenant {TenantId}",
                        userId.Value,
                        recordTenantId);
                }
            }

            response.Content = new StringContent(responseBody, Encoding.UTF8, "application/json");
        }

        return response;
    }

    private static bool IsPlatformAiBuilderSession(AiBuilderGatewayTags? tags)
    {
        return tags is not null && tags.ModelSource == AiModelSource.Platform;
    }

    private static string TruncateForLog(string content, int maxLength = 2000)
    {
        if (content.Length <= maxLength)
            return content;

        return content[..maxLength] + "...";
    }
}
