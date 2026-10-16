using Azure.Identity;
using Azure.Storage.Blobs;
using MaxMind.GeoIP2;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text;
using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;


namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Resolves IP addresses to geolocation data using MaxMind GeoLite2 database.
/// </summary>
public class AuditArchivalService : IAuditArchivalService
{
    private readonly ApplicationDbContext _db;
    private readonly Lazy<BlobContainerClient> _containerLazy;
    private readonly ILogger<AuditArchivalService> _logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="AuditArchivalService"/> class.
    /// </summary>
    /// <remarks>
    /// Container client construction is deferred via <see cref="Lazy{T}"/> so that
    /// controllers which inject this service for unrelated endpoints (e.g. the audit
    /// log query endpoint) do not fail at DI time when blob storage is unconfigured.
    /// Configuration errors surface on the first archive operation instead.
    /// </remarks>
    public AuditArchivalService(ApplicationDbContext db, IOptions<AuditArchiveConfiguration> auditArchiveConfig, ILogger<AuditArchivalService> logger)
    {
        _db = db;
        _logger = logger;

        _containerLazy = new Lazy<BlobContainerClient>(() =>
        {
            string? containerUri = auditArchiveConfig.Value.ContainerUri;
            if (string.IsNullOrWhiteSpace(containerUri))
            {
                throw new InvalidOperationException(
                    "AuditArchive:ContainerUri is not configured. Archive operations are unavailable.");
            }

            if (!Uri.TryCreate(containerUri, UriKind.Absolute, out Uri? parsed))
            {
                throw new InvalidOperationException(
                    $"AuditArchive:ContainerUri is not a valid absolute URI: '{containerUri}'.");
            }

            return new BlobContainerClient(parsed, new DefaultAzureCredential());
        });
    }

    private BlobContainerClient Container => _containerLazy.Value;

    /// <inheritdoc/>
    public async Task ArchiveOldRecordsAsync(Guid tenantId, int year, int month, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Archiving audit logs for TenantId: {TenantId}, Year: {Year}, Month: {Month}", tenantId, year, month);

        var logs = await _db.AuditLogs
            .Where(x => x.TenantId == tenantId && x.Timestamp.Year == year && x.Timestamp.Month == month && !x.IsArchived)
            .ToListAsync(cancellationToken);

        if (!logs.Any()) return;

        string blobName = $"{tenantId}/{year}/{month}.json";
        var blobClient = Container.GetBlobClient(blobName);
        string json = JsonSerializer.Serialize(logs);

        using var ms = new MemoryStream(Encoding.UTF8.GetBytes(json));
        await blobClient.UploadAsync(ms, overwrite: true, cancellationToken);

        foreach (var log in logs) log.IsArchived = true;
        await _db.SaveChangesAsync(cancellationToken);

        _db.AuditLogs.RemoveRange(logs);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Archived and removed {Count} audit logs for TenantId: {TenantId}, Year: {Year}, Month: {Month}", logs.Count, tenantId, year, month);
    }

    /// <inheritdoc/>
    public async Task<string?> GetArchivedLogsAsync(Guid tenantId, int year, int month, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Retrieving archived logs for TenantId: {TenantId}, Year: {Year}, Month: {Month}", tenantId, year, month);

        string blobName = $"{tenantId}/{year}/{month}.json";
        var blobClient = Container.GetBlobClient(blobName);
        if (!await blobClient.ExistsAsync(cancellationToken))
        {
            _logger.LogWarning("No archived logs found for TenantId: {TenantId}, Year: {Year}, Month: {Month}", tenantId, year, month);
            return null;
        }

        var download = await blobClient.DownloadContentAsync(cancellationToken);
        _logger.LogInformation("Successfully retrieved archived logs for TenantId: {TenantId}, Year: {Year}, Month: {Month}", tenantId, year, month);
        return download.Value.Content.ToString();
    }
}
