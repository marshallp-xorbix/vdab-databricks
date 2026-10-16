using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Server;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>Controller for AI-assisted app scaffolding via Databricks Model Serving.</summary>
[ApiController]
[Authorize(Policy = AuthPolicies.RequireTenantMembership)]
[Route("api/[controller]")]
public class AiBuilderController : AuthenticatedControllerBase
{
    private const int MaxPromptLength = 8000;
    private const int MaxConversationMessages = 20;
    private const int MaxCurrentComponents = 500;
    private const int MaxCurrentWorkflows = 100;
    private const int MaxCustomModulesCodeLength = 20000;

    private static readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IAiBuilderService _aiBuilderService;
    private readonly IAiBuilderModelSelectionService _modelSelectionService;
    private readonly IPlatformAiQuotaService _platformAiQuotaService;
    private readonly ILogger<AiBuilderController> _logger;

    /// <summary>Initializes a new instance of the <see cref="AiBuilderController"/> class.</summary>
    public AiBuilderController(
        IAiBuilderService aiBuilderService,
        IAiBuilderModelSelectionService modelSelectionService,
        IPlatformAiQuotaService platformAiQuotaService,
        ILogger<AiBuilderController> logger)
    {
        _aiBuilderService = aiBuilderService;
        _modelSelectionService = modelSelectionService;
        _platformAiQuotaService = platformAiQuotaService;
        _logger = logger;
    }

    static AiBuilderController()
    {
        _jsonOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    }

    /// <summary>Lists platform default and tenant AI models available to the caller.</summary>
    [HttpGet("available-models")]
    [ProducesResponseType(typeof(IReadOnlyList<AiBuilderModelOptionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<AiBuilderModelOptionDto>>> GetAvailableModels(CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid _, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        FluentResults.Result<IReadOnlyList<AiBuilderModelOptionDto>> result =
            await _modelSelectionService.GetAvailableModelsAsync(tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Gets the caller's selected AI Builder model for the active tenant.</summary>
    [HttpGet("selected-model")]
    [ProducesResponseType(typeof(AiBuilderSelectedModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiBuilderSelectedModelDto>> GetSelectedModel(CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        FluentResults.Result<AiBuilderSelectedModelDto> result =
            await _modelSelectionService.GetSelectedModelAsync(userId, tenantId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Sets the caller's selected AI Builder model for the active tenant.</summary>
    [HttpPut("selected-model")]
    [ProducesResponseType(typeof(AiBuilderSelectedModelDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AiBuilderSelectedModelDto>> SetSelectedModel(
        [FromBody] SetAiBuilderSelectedModelRequest request,
        CancellationToken cancellationToken)
    {
        if (request is null)
        {
            return BadRequest("Request cannot be null.");
        }

        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            return authFailure;
        }

        FluentResults.Result<AiBuilderSelectedModelDto> result =
            await _modelSelectionService.SetSelectedModelAsync(userId, tenantId, request.AiModelId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>Gets the caller's current-month VDAB Default AI Builder token usage.</summary>
    [HttpGet("platform-usage")]
    [ProducesResponseType(typeof(PlatformAiUsageDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PlatformAiUsageDto>> GetPlatformUsage(CancellationToken cancellationToken)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid _);
        if (authFailure is not null)
        {
            return authFailure;
        }

        FluentResults.Result<PlatformAiUsageDto> result =
            await _platformAiQuotaService.GetUsageAsync(userId, cancellationToken);
        return this.HandleFluentResult(result);
    }

    /// <summary>
    /// Streams VDAB component generation progress as Server-Sent Events.
    /// Emits a "progress" event for each tool call and a "result" event when complete.
    /// </summary>
    /// <param name="request">The prompt and app context.</param>
    /// <param name="ct">Cancellation token.</param>
    [HttpPost("generate-stream")]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task GenerateStream([FromBody] AiBuilderRequest request, CancellationToken ct)
    {
        ActionResult? authFailure = RequireAuthenticatedContext(out Guid userId, out Guid tenantId);
        if (authFailure is not null)
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        string? validationError = ValidateRequest(request);
        if (validationError is not null)
        {
            Response.StatusCode = 400;
            await Response.WriteAsJsonAsync(new { error = validationError }, cancellationToken: ct);
            return;
        }

        Response.ContentType = "text/event-stream; charset=utf-8";
        Response.Headers["Cache-Control"] = "no-cache";
        Response.Headers["X-Accel-Buffering"] = "no";

        _logger.LogInformation("AI builder stream requested by user {UserId} for app {AppId}", userId, request.AppId);

        try
        {
            await foreach (AiBuilderStreamEvent evt in _aiBuilderService.GenerateComponentsStreamAsync(request, userId, tenantId, ct))
            {
                await WriteEventAsync(evt, ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            _logger.LogInformation("AI builder stream cancelled for app {AppId}", request.AppId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI builder stream failed before an error event could be emitted for app {AppId}", request.AppId);
            AiBuilderOutcomeReason reason = new()
            {
                Code = AiBuilderReasonCode.ModelUnavailable,
                Title = "AI Builder stream failed",
                Message = "AI Builder could not complete the generation stream. Please try again.",
                SuggestedActions = ["Try again. If this continues, check the AI Builder service logs."],
            };
            await WriteEventAsync(new AiBuilderStreamEvent { Type = "error", Message = reason.Message, Reason = reason }, ct);
        }
    }

    private static string? ValidateRequest(AiBuilderRequest request)
    {
        if (request.AppId <= 0)
            return "AppId must be greater than 0.";

        if (string.IsNullOrWhiteSpace(request.Prompt))
            return "Prompt is required.";

        if (request.Prompt.Length > MaxPromptLength)
            return $"Prompt cannot exceed {MaxPromptLength} characters.";

        if (request.ConversationHistory.Count > MaxConversationMessages)
            return $"Conversation history cannot exceed {MaxConversationMessages} messages.";

        if (request.CurrentComponents.Count > MaxCurrentComponents)
            return $"Current component context cannot exceed {MaxCurrentComponents} components.";

        if (request.CurrentWorkflows.Count > MaxCurrentWorkflows)
            return $"Current workflow context cannot exceed {MaxCurrentWorkflows} workflows.";

        if (request.CustomModulesCode.Length > MaxCustomModulesCodeLength)
            return $"Custom modules context cannot exceed {MaxCustomModulesCodeLength} characters.";

        return null;
    }

    private async Task WriteEventAsync(AiBuilderStreamEvent evt, CancellationToken ct)
    {
        string json = JsonSerializer.Serialize(evt, _jsonOptions);
        await Response.WriteAsync($"data: {json}\n\n", ct);
        await Response.Body.FlushAsync(ct);
    }
}
