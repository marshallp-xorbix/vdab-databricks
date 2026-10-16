using System.Text.Json;
using System.Text.Json.Serialization;
using FluentResults;
using Ganss.Xss;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Legal;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <inheritdoc />
public sealed class LegalContentService : ILegalContentService
{
    private const string CacheKeyPrefix = "legal-page:v3:";
    private const string PagesEndpointPath = "wp-json/wp/v2/pages";
    private const string PagesFieldsQuery = "id,slug,content";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static readonly string[] AllowedContentTags =
    [
        // Semantic wrappers used heavily by WordPress block themes (content is often
        // rooted in <main>; omitting it strips the entire document when KeepChildNodes is false).
        "main", "section", "article", "header", "footer", "aside", "nav",
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "br", "hr", "ul", "ol", "li",
        "strong", "b", "em", "i", "u", "a", "blockquote",
        "table", "thead", "tbody", "tr", "th", "td",
        "div", "span", "figure", "figcaption",
    ];

    private static readonly string[] AllowedContentAttributes =
    [
        "href", "title", "target", "rel", "class", "id", "colspan", "rowspan",
    ];

    private static readonly string[] AllowedUriSchemes = ["http", "https", "mailto"];

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDistributedCache _cache;
    private readonly IOptions<WordPressConfiguration> _wordPressOptions;
    private readonly ILogger<LegalContentService> _logger;
    private readonly HtmlSanitizer _htmlSanitizer;

    /// <summary>
    /// Initializes a new instance of the <see cref="LegalContentService"/> class.
    /// </summary>
    public LegalContentService(
        IHttpClientFactory httpClientFactory,
        IDistributedCache cache,
        IOptions<WordPressConfiguration> wordPressOptions,
        ILogger<LegalContentService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _cache = cache;
        _wordPressOptions = wordPressOptions;
        _logger = logger;
        _htmlSanitizer = CreateSanitizer();
    }

    /// <inheritdoc />
    public async Task<Result<LegalPageResponse>> GetPageBySlugAsync(
        string slug,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(slug))
        {
            return Result.Fail(new BadRequestError("Legal page slug is required."));
        }

        string normalizedSlug = slug.Trim().ToLowerInvariant();
        WordPressConfiguration config = _wordPressOptions.Value;

        if (!IsAllowedSlug(normalizedSlug, config))
        {
            return Result.Fail(new NotFoundError($"Legal page '{normalizedSlug}' was not found."));
        }

        string cacheKey = $"{CacheKeyPrefix}{normalizedSlug}";
        string? cachedJson = await _cache.GetStringAsync(cacheKey, cancellationToken);
        if (!string.IsNullOrWhiteSpace(cachedJson))
        {
            LegalPageResponse? cached = JsonSerializer.Deserialize<LegalPageResponse>(cachedJson, JsonOptions);
            if (cached is not null)
            {
                return Result.Ok(cached);
            }
        }

        Result<LegalPageResponse> fetchResult = await FetchAndMapAsync(normalizedSlug, cancellationToken);
        if (fetchResult.IsFailed)
        {
            return fetchResult;
        }

        DistributedCacheEntryOptions cacheOptions = new()
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(Math.Max(1, config.CacheSeconds)),
        };
        string serialized = JsonSerializer.Serialize(fetchResult.Value, JsonOptions);
        await _cache.SetStringAsync(cacheKey, serialized, cacheOptions, cancellationToken);

        return fetchResult;
    }

    private async Task<Result<LegalPageResponse>> FetchAndMapAsync(
        string normalizedSlug,
        CancellationToken cancellationToken)
    {
        try
        {
            HttpClient client = _httpClientFactory.CreateClient(WordPressConfiguration.HttpClientName);
            string requestUri =
                $"{PagesEndpointPath}?slug={Uri.EscapeDataString(normalizedSlug)}&_fields={PagesFieldsQuery}";

            using HttpResponseMessage response = await client.GetAsync(requestUri, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "WordPress legal page request for slug {Slug} failed with status {StatusCode}",
                    normalizedSlug,
                    (int)response.StatusCode);

                return Result.Fail(CreateUpstreamFailure());
            }

            string json = await response.Content.ReadAsStringAsync(cancellationToken);
            List<WordPressPageDto>? pages = JsonSerializer.Deserialize<List<WordPressPageDto>>(json, JsonOptions);
            WordPressPageDto? page = pages?.FirstOrDefault();
            if (page is null)
            {
                return Result.Fail(new NotFoundError($"Legal page '{normalizedSlug}' was not found."));
            }

            return Result.Ok(MapToResponse(normalizedSlug, page));
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch WordPress legal page for slug {Slug}", normalizedSlug);
            return Result.Fail(CreateUpstreamFailure());
        }
    }

    private LegalPageResponse MapToResponse(string normalizedSlug, WordPressPageDto page)
    {
        string sanitizedHtml = _htmlSanitizer.Sanitize(page.Content?.Rendered ?? string.Empty);

        return new LegalPageResponse
        {
            Slug = normalizedSlug,
            HtmlContent = sanitizedHtml,
        };
    }

    private static bool IsAllowedSlug(string slug, WordPressConfiguration config)
    {
        return string.Equals(slug, config.TermsOfServiceSlug, StringComparison.OrdinalIgnoreCase)
            || string.Equals(slug, config.PrivacyPolicySlug, StringComparison.OrdinalIgnoreCase);
    }

    private static UpstreamDependencyError CreateUpstreamFailure()
    {
        return new UpstreamDependencyError(
            "Unable to load legal page content from the marketing site. Please try again later.");
    }

    private static HtmlSanitizer CreateSanitizer()
    {
        // Explicit allowlist so WordPress markup cannot introduce scripts or event handlers.
        HtmlSanitizer sanitizer = new();
        sanitizer.AllowedTags.Clear();
        foreach (string tag in AllowedContentTags)
        {
            sanitizer.AllowedTags.Add(tag);
        }

        sanitizer.AllowedAttributes.Clear();
        foreach (string attribute in AllowedContentAttributes)
        {
            sanitizer.AllowedAttributes.Add(attribute);
        }

        sanitizer.AllowedSchemes.Clear();
        foreach (string scheme in AllowedUriSchemes)
        {
            sanitizer.AllowedSchemes.Add(scheme);
        }

        return sanitizer;
    }

    private sealed class WordPressPageDto
    {
        [JsonPropertyName("slug")]
        public string? Slug { get; set; }

        [JsonPropertyName("content")]
        public WordPressRenderedField? Content { get; set; }
    }

    private sealed class WordPressRenderedField
    {
        [JsonPropertyName("rendered")]
        public string? Rendered { get; set; }
    }
}
