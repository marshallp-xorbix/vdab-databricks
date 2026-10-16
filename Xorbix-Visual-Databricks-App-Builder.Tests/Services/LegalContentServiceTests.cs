using System.Net;
using System.Net.Http.Headers;
using System.Text;
using FluentResults;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Legal;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

public class LegalContentServiceTests
{
    [Fact]
    public async Task GetPageBySlugAsync_UnknownSlug_ReturnsNotFound()
    {
        LegalContentService sut = CreateService(HttpStatusCode.OK, "[]");

        Result<LegalPageResponse> result = await sut.GetPageBySlugAsync(
            "not-a-legal-page",
            TestContext.Current.CancellationToken);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, e => e is NotFoundError);
    }

    [Fact]
    public async Task GetPageBySlugAsync_EmptySlug_ReturnsBadRequest()
    {
        LegalContentService sut = CreateService(HttpStatusCode.OK, "[]");

        Result<LegalPageResponse> result = await sut.GetPageBySlugAsync(
            "  ",
            TestContext.Current.CancellationToken);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, e => e is BadRequestError);
    }

    [Fact]
    public async Task GetPageBySlugAsync_ValidSlug_MapsSanitizedHtml()
    {
        string body =
            """
            [{
              "slug": "privacy-policy",
              "content": { "rendered": "<p>Hello <script>alert(1)</script>world</p>" }
            }]
            """;

        LegalContentService sut = CreateService(HttpStatusCode.OK, body);

        Result<LegalPageResponse> result = await sut.GetPageBySlugAsync(
            "privacy-policy",
            TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccess);
        Assert.Equal("privacy-policy", result.Value.Slug);
        Assert.Contains("Hello", result.Value.HtmlContent, StringComparison.Ordinal);
        Assert.Contains("world", result.Value.HtmlContent, StringComparison.Ordinal);
        Assert.DoesNotContain("<script>", result.Value.HtmlContent, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert(1)", result.Value.HtmlContent, StringComparison.Ordinal);
    }

    [Fact]
    public async Task GetPageBySlugAsync_MainWrappedContent_PreservesBody()
    {
        // Real vdab.ai legal pages wrap body copy in <main>; stripping that tag must not empty the page.
        string body =
            """
            [{
              "slug": "terms-and-conditions",
              "content": { "rendered": "<main class=\"wp-block-group\"><h1>Terms and Conditions</h1><p>By accessing VDAB you agree to these terms.</p></main>" }
            }]
            """;

        LegalContentService sut = CreateService(HttpStatusCode.OK, body);

        Result<LegalPageResponse> result = await sut.GetPageBySlugAsync(
            "terms-and-conditions",
            TestContext.Current.CancellationToken);

        Assert.True(result.IsSuccess);
        Assert.Contains("Terms and Conditions", result.Value.HtmlContent, StringComparison.Ordinal);
        Assert.Contains("By accessing VDAB", result.Value.HtmlContent, StringComparison.Ordinal);
        Assert.False(string.IsNullOrWhiteSpace(result.Value.HtmlContent));
    }

    [Fact]
    public async Task GetPageBySlugAsync_UpstreamFailure_ReturnsUpstreamDependencyError()
    {
        LegalContentService sut = CreateService(HttpStatusCode.InternalServerError, "error");

        Result<LegalPageResponse> result = await sut.GetPageBySlugAsync(
            "terms-and-conditions",
            TestContext.Current.CancellationToken);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, e => e is UpstreamDependencyError);
    }

    [Fact]
    public async Task GetPageBySlugAsync_EmptyWordPressResult_ReturnsNotFound()
    {
        LegalContentService sut = CreateService(HttpStatusCode.OK, "[]");

        Result<LegalPageResponse> result = await sut.GetPageBySlugAsync(
            "privacy-policy",
            TestContext.Current.CancellationToken);

        Assert.True(result.IsFailed);
        Assert.Contains(result.Errors, e => e is NotFoundError);
    }

    private static LegalContentService CreateService(HttpStatusCode statusCode, string body)
    {
        Mock<HttpMessageHandler> handler = new();
        handler
            .Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(() =>
            {
                HttpResponseMessage response = new()
                {
                    StatusCode = statusCode,
                    Content = new StringContent(body, Encoding.UTF8, "application/json"),
                };
                response.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
                return response;
            });

        HttpClient client = new(handler.Object)
        {
            BaseAddress = new Uri("https://vdab.ai/"),
        };

        Mock<IHttpClientFactory> httpClientFactory = new();
        httpClientFactory
            .Setup(f => f.CreateClient(WordPressConfiguration.HttpClientName))
            .Returns(client);

        IOptions<WordPressConfiguration> options = Options.Create(new WordPressConfiguration
        {
            BaseUrl = WordPressConfiguration.DefaultBaseUrl,
            TimeoutSeconds = 30,
            CacheSeconds = 300,
            TermsOfServiceSlug = "terms-and-conditions",
            PrivacyPolicySlug = "privacy-policy",
        });

        IDistributedCache cache = new MemoryDistributedCache(
            Options.Create(new MemoryDistributedCacheOptions()));

        return new LegalContentService(
            httpClientFactory.Object,
            cache,
            options,
            NullLogger<LegalContentService>.Instance);
    }
}
