using MaxMind.Db;
using MaxMind.GeoIP2;
using MaxMind.GeoIP2.Exceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Resolves IP addresses to geolocation data using MaxMind GeoLite2 database.
/// </summary>
public class GeoLocationService : IGeoLocationService, IDisposable
{
    private readonly ILogger<GeoLocationService> _logger;
    private readonly DatabaseReader? _reader;

    /// <summary>
    /// Initializes a new instance of the <see cref="GeoLocationService"/> class.
    /// </summary>
    /// <param name="logger">The logger instance.</param>
    /// <param name="geoLiteConfig">GeoLite2 configuration containing the database path.</param>
    public GeoLocationService(ILogger<GeoLocationService> logger, IOptions<GeoLiteConfiguration> geoLiteConfig)
    {
        _logger = logger;

        string? dbPath = geoLiteConfig.Value.DatabasePath;

        if (string.IsNullOrWhiteSpace(dbPath) || !File.Exists(dbPath))
        {
            _logger.LogWarning("GeoLite2 database not found at path: {Path}. Geolocation will be unavailable.", dbPath ?? "(not configured)");
            _reader = null;
            return;
        }

        try
        {
            _reader = new DatabaseReader(dbPath);
            _logger.LogInformation("GeoLite2 database loaded from {Path}", dbPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load GeoLite2 database from {Path}", dbPath);
            _reader = null;
        }
    }

    /// <inheritdoc/>
    public (string? City, string? Country, string? Region) Resolve(string ipAddress)
    {
        if (_reader == null || string.IsNullOrWhiteSpace(ipAddress))
        {
            return (null, null, null);
        }

        // Skip loopback and private addresses
        if (ipAddress is "::1" or "127.0.0.1" || ipAddress.StartsWith("192.168.") || ipAddress.StartsWith("10.") || ipAddress.StartsWith("172."))
        {
            return ("Local", "Local", null);
        }

        try
        {
            MaxMind.GeoIP2.Responses.CityResponse response = _reader.City(ipAddress);
            string? city = response.City?.Name;
            string? country = response.Country?.Name;
            string? region = response.MostSpecificSubdivision?.Name;

            return (city, country, region);
        }
        catch (AddressNotFoundException)
        {
            _logger.LogDebug("IP address {IpAddress} not found in GeoLite2 database", ipAddress);
            return (null, null, null);
        }
        catch (InvalidDatabaseException ex)
        {
            _logger.LogError(ex, "Invalid GeoLite2 database file");
            return (null, null, null);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to resolve geolocation for IP {IpAddress}", ipAddress);
            return (null, null, null);
        }
    }

    /// <summary>
    /// Disposes the MaxMind database reader.
    /// </summary>
    public void Dispose()
    {
        _reader?.Dispose();
        GC.SuppressFinalize(this);
    }
}
