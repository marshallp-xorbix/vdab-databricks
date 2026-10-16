using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Parses Databricks Genie <see href="https://docs.databricks.com/api/workspace/genie/listspaces">ListSpaces</see> JSON,
/// including <c>next_page_token</c> and a few alternate wrapper shapes.
/// </summary>
internal static class GenieSpacesListResponseParser
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    internal static bool TryParse(string content, [NotNullWhen(true)] out GenieSpacesListParsedPage? page)
    {
        page = null;
        if (string.IsNullOrWhiteSpace(content))
        {
            return false;
        }

        try
        {
            using JsonDocument doc = JsonDocument.Parse(content);
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            List<GenieSpaceApiRow> spaces = DeserializeSpaces(root);
            string? nextToken = TryGetNextPageToken(root);
            page = new GenieSpacesListParsedPage(spaces, nextToken);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static List<GenieSpaceApiRow> DeserializeSpaces(JsonElement root)
    {
        if (TryGetPropertyIgnoreCase(root, "spaces", out JsonElement direct) &&
            direct.ValueKind == JsonValueKind.Array)
        {
            return DeserializeSpaceRows(direct);
        }

        foreach (JsonProperty p in root.EnumerateObject())
        {
            if (p.Value.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (TryGetPropertyIgnoreCase(p.Value, "spaces", out JsonElement nested) &&
                nested.ValueKind == JsonValueKind.Array)
            {
                return DeserializeSpaceRows(nested);
            }
        }

        foreach (JsonProperty p in root.EnumerateObject())
        {
            if (p.Value.ValueKind != JsonValueKind.Array || p.Value.GetArrayLength() == 0)
            {
                continue;
            }

            JsonElement first = p.Value[0];
            if (first.ValueKind == JsonValueKind.Object &&
                (HasPropertyIgnoreCase(first, "space_id") || HasPropertyIgnoreCase(first, "id")))
            {
                return DeserializeSpaceRows(p.Value);
            }
        }

        return [];
    }

    private static List<GenieSpaceApiRow> DeserializeSpaceRows(JsonElement arr)
    {
        List<GenieSpaceApiRow> list = [];
        foreach (JsonElement el in arr.EnumerateArray())
        {
            GenieSpaceApiRow? row = el.Deserialize<GenieSpaceApiRow>(JsonOptions);
            if (row != null)
            {
                list.Add(row);
            }
        }

        return list;
    }

    private static string? TryGetNextPageToken(JsonElement root)
    {
        if (TryGetPropertyIgnoreCase(root, "next_page_token", out JsonElement t) &&
            t.ValueKind == JsonValueKind.String)
        {
            string? s = t.GetString();
            return string.IsNullOrEmpty(s) ? null : s;
        }

        return null;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement obj, string name, out JsonElement value)
    {
        foreach (JsonProperty p in obj.EnumerateObject())
        {
            if (p.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                value = p.Value;
                return true;
            }
        }

        value = default;
        return false;
    }

    private static bool HasPropertyIgnoreCase(JsonElement obj, string name)
    {
        foreach (JsonProperty p in obj.EnumerateObject())
        {
            if (p.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }
}

internal sealed record GenieSpacesListParsedPage(List<GenieSpaceApiRow> Spaces, string? NextPageToken);

internal sealed class GenieSpaceApiRow
{
    [JsonPropertyName("space_id")]
    public string? SpaceId { get; set; }

    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }
}
