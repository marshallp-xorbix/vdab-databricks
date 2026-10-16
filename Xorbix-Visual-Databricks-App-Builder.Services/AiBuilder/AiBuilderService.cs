using System.Runtime.CompilerServices;
using System.Threading.Channels;
using FluentResults;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

public class AiBuilderService : IAiBuilderService
{
    private readonly IAiModelResolverService _modelResolver;
    private readonly IAiBuilderKernelFactory _kernelFactory;
    private readonly IAiBuilderModelSelectionService _modelSelectionService;
    private readonly ILogger<AiBuilderService> _logger;
    private readonly IAiBuilderContextService _contextService;
    private readonly IAiBuilderGatewayTagContext _gatewayTagContext;
    private readonly IPlatformAiQuotaService _platformAiQuotaService;

    public AiBuilderService(
        IAiModelResolverService modelResolver,
        IAiBuilderKernelFactory kernelFactory,
        IAiBuilderModelSelectionService modelSelectionService,
        ILogger<AiBuilderService> logger,
        IAiBuilderContextService contextService,
        IAiBuilderGatewayTagContext gatewayTagContext,
        IPlatformAiQuotaService platformAiQuotaService)
    {
        _modelResolver = modelResolver;
        _kernelFactory = kernelFactory;
        _modelSelectionService = modelSelectionService;
        _logger = logger;
        _contextService = contextService;
        _gatewayTagContext = gatewayTagContext;
        _platformAiQuotaService = platformAiQuotaService;
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<AiBuilderStreamEvent> GenerateComponentsStreamAsync(
        AiBuilderRequest request,
        Guid userId,
        Guid tenantId,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        Result<ResolvedAiModelConfiguration> resolvedResult =
            await _modelResolver.ResolveAsync(tenantId, request.AiModelId, ct);
        if (resolvedResult.IsFailed)
        {
            AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyModelResolutionFailure(resolvedResult.Errors);
            yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, reason.Message, reason);
            yield break;
        }

        ResolvedAiModelConfiguration resolvedConfig = resolvedResult.Value;
        AiBuilderOutcomeReason? configurationReason = AiBuilderResultClassifier.GetConfigurationReason(resolvedConfig);
        if (configurationReason is not null)
        {
            yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, configurationReason.Message, configurationReason);
            yield break;
        }

        if (resolvedConfig.Source == AiModelSource.Platform)
        {
            Result quotaResult = await _platformAiQuotaService.EnsureCanUsePlatformModelAsync(userId, ct);
            if (quotaResult.IsFailed)
            {
                AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyModelResolutionFailure(quotaResult.Errors);
                yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, reason.Message, reason);
                yield break;
            }
        }

        _logger.LogInformation(
            "Starting AI builder stream for app {AppId} using model {ModelSource}",
            request.AppId,
            resolvedConfig.Source);

        Result<AgentContext> contextResult = await BuildAgentAsync(request, userId, tenantId, resolvedConfig, ct);
        if (contextResult.IsFailed)
        {
            string message = contextResult.Errors.FirstOrDefault()?.Message ?? "AI builder context could not be loaded.";
            AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyContextFailure(message);
            yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, reason.Message, reason);
            yield break;
        }

        Result<AiBuilderSelectedModelDto> persistResult = await _modelSelectionService.SetSelectedModelAsync(
            userId,
            tenantId,
            resolvedConfig.TenantAiModelId,
            ct);
        if (persistResult.IsFailed)
        {
            _logger.LogWarning(
                "Could not persist selected AI model {TenantAiModelId} for user {UserId}: {Error}",
                resolvedConfig.TenantAiModelId,
                userId,
                persistResult.Errors.FirstOrDefault()?.Message);
        }

        AgentContext ctx = contextResult.Value;

        _gatewayTagContext.Set(new AiBuilderGatewayTags
        {
            TenantId = tenantId,
            TenantName = ctx.TenantName,
            UserId = userId,
            AppId = request.AppId,
            AppName = ctx.AppName,
            ModelSource = resolvedConfig.Source,
            TenantAiModelId = resolvedConfig.TenantAiModelId,
            EndpointName = resolvedConfig.EndpointName,
        });

        Channel<string> progressChannel = Channel.CreateUnbounded<string>();
        ctx.Kernel.FunctionInvocationFilters.Add(new AiBuilderToolProgressFilter(msg => progressChannel.Writer.TryWrite(msg)));

        string finalText = string.Empty;
        Exception? agentException = null;

        async Task RunAgentAsync()
        {
            try
            {
                await foreach (AgentResponseItem<ChatMessageContent> response in ctx.Agent.InvokeAsync(ctx.UserMessage, ctx.Thread, cancellationToken: ct))
                    finalText = response.Message.Content ?? finalText;
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                agentException = ex;
            }
            finally
            {
                progressChannel.Writer.TryComplete();
            }
        }

        Task agentTask = RunAgentAsync();

        try
        {
            try
            {
                await foreach (string msg in progressChannel.Reader.ReadAllAsync(ct))
                    yield return new AiBuilderStreamEvent { Type = "progress", Message = msg };
            }
            finally
            {
                // Always observe the agent task, even if the consumer abandons the stream
                // (client disconnect / cancellation), so it is never left orphaned.
                await agentTask;
            }

            if (agentException is not null)
            {
                _logger.LogError(agentException, "AI builder stream failed for app {AppId}", request.AppId);
                AiBuilderOutcomeReason reason = AiBuilderResultClassifier.ClassifyAgentException(agentException);
                yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, reason.Message, reason);
                yield break;
            }

            List<CanvasOperationDto> operations = ctx.Plugin.GetOperations();
            AiBuilderResponse? finalOutcome = AiBuilderResultClassifier.ParseTaggedFinalOutcome(finalText, operations);
            if (finalOutcome is not null && operations.Count == 0)
            {
                yield return new AiBuilderStreamEvent
                {
                    Type = "result",
                    Result = finalOutcome,
                };
                yield break;
            }

            AiBuilderOutcomeReason? validationReason = AiBuilderOperationValidator.Validate(request, operations);
            if (validationReason is not null)
            {
                yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, validationReason.Message, validationReason);
                yield break;
            }

            if (operations.Count == 0 && finalOutcome is null)
            {
                AiBuilderOutcomeReason reason = AiBuilderResultClassifier.CreateModelToolCallingUnsupportedReason();
                yield return AiBuilderResultClassifier.CreateResultEvent(AiBuilderCompletionStatus.UnableToComplete, reason.Message, reason);
                yield break;
            }

            _logger.LogInformation("AI builder stream produced {Count} operations for app {AppId}", operations.Count, request.AppId);

            AiBuilderResponse result = finalOutcome ?? new AiBuilderResponse
            {
                Status = AiBuilderCompletionStatus.Completed,
                Operations = operations,
                Explanation = finalText,
            };

            if (result.Operations.Count == 0 && operations.Count > 0)
                result.Operations = operations;

            result = StoryAiFieldMappingHelper.ApplyIncompleteRequiredFieldMappings(result, operations);

            yield return new AiBuilderStreamEvent
            {
                Type = "result",
                Result = result,
            };
        }
        finally
        {
            _gatewayTagContext.Clear();
        }
    }

    private sealed record AgentContext(
        Kernel Kernel,
        CanvasToolPlugin Plugin,
        ChatCompletionAgent Agent,
        ChatMessageContent UserMessage,
        ChatHistoryAgentThread Thread,
        string AppName,
        string TenantName);

    private async Task<Result<AgentContext>> BuildAgentAsync(
        AiBuilderRequest request,
        Guid userId,
        Guid tenantId,
        ResolvedAiModelConfiguration resolvedConfig,
        CancellationToken cancellationToken)
    {
        Result<AiBuilderDatabricksContext> databricksContextResult =
            await _contextService.BuildDatabricksContextAsync(request.AppId, userId, tenantId, cancellationToken);
        if (databricksContextResult.IsFailed)
            return Result.Fail<AgentContext>(databricksContextResult.Errors);

        AiBuilderDatabricksContext databricksContext = databricksContextResult.Value;

        Kernel kernel = _kernelFactory.CreateKernel(resolvedConfig);
        CanvasToolPlugin plugin = new(
            request.CurrentComponents,
            request.CurrentWorkflows,
            databricksContext.WorkspaceConnectionId);
        kernel.Plugins.AddFromObject(plugin, "CanvasTools");

        // Omit Temperature so Claude/GPT reasoning models (which reject 0.0) use the provider default.
        OpenAIPromptExecutionSettings promptSettings = new()
        {
            MaxTokens = 4096,
            Temperature = null,
            FunctionChoiceBehavior = FunctionChoiceBehavior.Auto(),
        };

        ChatCompletionAgent agent = new()
        {
            Name = "DatabricksAppAgent",
            Instructions = AiBuilderPrompts.AgentPrompt,
            Kernel = kernel,
            Arguments = new KernelArguments(promptSettings),
        };

        ChatHistory history = new();
        foreach (ConversationMessageDto msg in request.ConversationHistory)
        {
            if (string.Equals(msg.Role, "user", StringComparison.OrdinalIgnoreCase))
                history.AddUserMessage(msg.Content);
            else if (string.Equals(msg.Role, "assistant", StringComparison.OrdinalIgnoreCase))
                history.AddAssistantMessage(msg.Content);
        }

        string canvasContext = AiBuilderPromptContextFormatter.BuildCanvasContext(
            request.CurrentComponents,
            request.CurrentWorkflows,
            request.CustomModulesCode);

        ChatMessageContent userMessage = new(
            AuthorRole.User,
            request.Prompt + canvasContext + databricksContext.Context);

        return Result.Ok(new AgentContext(
            kernel,
            plugin,
            agent,
            userMessage,
            new ChatHistoryAgentThread(history),
            databricksContext.AppName,
            databricksContext.TenantName));
    }
}
