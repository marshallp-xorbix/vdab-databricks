using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <inheritdoc/>
public class AiBuilderKernelFactory(IHttpClientFactory _httpClientFactory) : IAiBuilderKernelFactory
{
    /// <inheritdoc/>
    public Kernel CreateKernel(ResolvedAiModelConfiguration configuration)
    {
        IKernelBuilder kernelBuilder = Kernel.CreateBuilder();
        kernelBuilder.Services.AddLogging();

        string baseUrl = DatabricksServingUrlHelper.BuildServingBaseUrl(configuration.WorkspaceUrl);
        if (string.IsNullOrWhiteSpace(configuration.WorkspaceUrl)
            || string.IsNullOrWhiteSpace(configuration.AccessToken)
            || string.IsNullOrWhiteSpace(configuration.EndpointName)
            || !Uri.TryCreate(baseUrl, UriKind.Absolute, out Uri? endpointUri))
        {
            return kernelBuilder.Build();
        }

        HttpClient httpClient = _httpClientFactory.CreateClient(DatabricksAiConfiguration.HttpClientName);
        httpClient.BaseAddress = endpointUri;

#pragma warning disable SKEXP0010
        kernelBuilder.AddOpenAIChatCompletion(
            modelId: configuration.EndpointName,
            endpoint: endpointUri,
            apiKey: configuration.AccessToken,
            httpClient: httpClient);
#pragma warning restore SKEXP0010

        return kernelBuilder.Build();
    }
}
