using System.Text.Json;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Read/write helper for <see cref="EF.UserTenantPreference.PreferencesJson"/> payloads.
/// </summary>
public static class UserTenantPreferencesDocument
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
    };

    /// <summary>
    /// Reads an integer preference value when present and valid.
    /// </summary>
    public static int? GetInt(string preferencesJson, string key)
    {
        if (string.IsNullOrWhiteSpace(preferencesJson))
        {
            return null;
        }

        using JsonDocument document = JsonDocument.Parse(preferencesJson);
        if (!document.RootElement.TryGetProperty(key, out JsonElement valueElement))
        {
            return null;
        }

        if (valueElement.ValueKind == JsonValueKind.Number && valueElement.TryGetInt32(out int value))
        {
            return value;
        }

        return null;
    }

    /// <summary>
    /// Sets or removes an integer preference key and returns the updated JSON.
    /// </summary>
    public static string SetIntOrRemove(string preferencesJson, string key, int? value)
    {
        Dictionary<string, object?> values = ParseToDictionary(preferencesJson);

        if (value.HasValue)
        {
            values[key] = value.Value;
        }
        else
        {
            values.Remove(key);
        }

        return values.Count == 0
            ? "{}"
            : JsonSerializer.Serialize(values, SerializerOptions);
    }

    /// <summary>
    /// Returns whether the JSON object contains the key with the given integer value.
    /// </summary>
    public static bool ContainsIntValue(string preferencesJson, string key, int value)
    {
        int? current = GetInt(preferencesJson, key);
        return current.HasValue && current.Value == value;
    }

    private static Dictionary<string, object?> ParseToDictionary(string preferencesJson)
    {
        if (string.IsNullOrWhiteSpace(preferencesJson))
        {
            return new Dictionary<string, object?>(StringComparer.Ordinal);
        }

        using JsonDocument document = JsonDocument.Parse(preferencesJson);
        Dictionary<string, object?> values = new(StringComparer.Ordinal);

        foreach (JsonProperty property in document.RootElement.EnumerateObject())
        {
            values[property.Name] = property.Value.ValueKind switch
            {
                JsonValueKind.Number when property.Value.TryGetInt32(out int intValue) => intValue,
                JsonValueKind.String => property.Value.GetString(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                _ => property.Value.GetRawText(),
            };
        }

        return values;
    }
}
