namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides IP-based geolocation lookups.
/// </summary>
public interface IGeoLocationService
{
    /// <summary>
    /// Resolves an IP address to geolocation data (city, country, region).
    /// </summary>
    /// <param name="ipAddress">The IP address to resolve.</param>
    /// <returns>A tuple of (City, Country, Region), with nulls if resolution fails.</returns>
    (string? City, string? Country, string? Region) Resolve(string ipAddress);
}
