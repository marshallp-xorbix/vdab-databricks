using System.Text;
using System.Text.Json;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Audit;

/// <summary>
/// Opaque, stable pagination position for audit log queries.
/// Uses <see cref="Timestamp"/> + <see cref="AuditLogId"/> so the cursor is a
/// total ordering — the id breaks ties when two rows share a timestamp.
/// </summary>
/// <remarks>
/// Audit logs are append-only and high-churn; offset pagination on a DESC-by-timestamp
/// list produces duplicates and skips as new rows are inserted between page requests.
/// Keyset pagination keyed on <c>(Timestamp, AuditLogId)</c> is stable under insert
/// pressure and fast at any depth.
/// </remarks>
public record AuditLogCursor(DateTime Timestamp, long AuditLogId)
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        // Compact: no whitespace, default casing. The wire form is opaque to clients.
        WriteIndented = false,
    };

    /// <summary>
    /// Encodes the cursor as a URL-safe opaque token. Clients should round-trip this
    /// value as-is via the <c>cursor</c> query parameter.
    /// </summary>
    public string Encode()
    {
        byte[] bytes = JsonSerializer.SerializeToUtf8Bytes(this, SerializerOptions);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    /// <summary>
    /// Decodes a cursor previously produced by <see cref="Encode"/>.
    /// Returns null when the input is empty or malformed; callers should treat that
    /// as a client error (HTTP 400) rather than silently fall through to no cursor.
    /// </summary>
    public static AuditLogCursor? TryDecode(string? encoded)
    {
        if (string.IsNullOrWhiteSpace(encoded))
        {
            return null;
        }

        try
        {
            string padded = encoded.Replace('-', '+').Replace('_', '/');
            int padding = padded.Length % 4;
            if (padding > 0)
            {
                padded = padded.PadRight(padded.Length + (4 - padding), '=');
            }

            byte[] bytes = Convert.FromBase64String(padded);
            return JsonSerializer.Deserialize<AuditLogCursor>(bytes, SerializerOptions);
        }
        catch (FormatException)
        {
            return null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
