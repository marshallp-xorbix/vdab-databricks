using Azure.Core;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Options;
using System.Formats.Tar;
using System.IO.Compression;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Extensions;

/// <summary>
/// Downloads the GeoLite2 MaxMind database from Azure Blob Storage on startup
/// when it is not already cached at the configured local path.
/// <para>
/// Lists all blobs in the configured container and selects the most recently uploaded one.
/// Supports raw <c>.mmdb</c> blobs, <c>.zip</c> archives, and <c>.tar.gz</c> archives
/// with arbitrary internal folder structures.
/// </para>
/// </summary>
public static class GeoLiteDatabaseHelper
{
    /// <summary>
    /// Downloads the most recent blob from the GeoLite container and ensures the
    /// <c>.mmdb</c> database is present at <see cref="GeoLiteConfiguration.DatabasePath"/>.
    /// <para>
    /// When the most recent blob is a <c>.zip</c> or <c>.tar.gz</c>, the archive is downloaded
    /// to a temporary file, the <c>.mmdb</c> entry is located regardless of folder depth,
    /// extracted, and the temp file is cleaned up.
    /// </para>
    /// Skips silently when configuration values are not provided.
    /// </summary>
    /// <param name="app">The built web application.</param>
    /// <param name="credential">The Azure credential used to authenticate with Blob Storage.</param>
    public static async Task EnsureGeoLiteDatabaseAsync(this WebApplication app, TokenCredential credential)
    {
        GeoLiteConfiguration geoLiteConfig = app.Services.GetRequiredService<IOptions<GeoLiteConfiguration>>().Value;
        ILogger logger = app.Services.GetRequiredService<ILogger<Program>>();

        if (string.IsNullOrWhiteSpace(geoLiteConfig.ContainerUri) || string.IsNullOrWhiteSpace(geoLiteConfig.DatabasePath))
        {
            logger.LogDebug("GeoLite2 database path or container URI not configured. Skipping geolocation database setup.");
            return;
        }

        if (File.Exists(geoLiteConfig.DatabasePath))
        {
            logger.LogDebug("GeoLite2 database already exists at {Path}, skipping download.", geoLiteConfig.DatabasePath);
            return;
        }

        try
        {
            string? directory = Path.GetDirectoryName(geoLiteConfig.DatabasePath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            BlobContainerClient containerClient = new BlobContainerClient(new Uri(geoLiteConfig.ContainerUri), credential);
            BlobItem? latestBlob = await FindMostRecentBlobAsync(containerClient);

            if (latestBlob is null)
            {
                logger.LogWarning("No blobs found in container {ContainerUri}. Geolocation will be unavailable.", geoLiteConfig.ContainerUri);
                return;
            }

            BlobClient blobClient = containerClient.GetBlobClient(latestBlob.Name);
            logger.LogDebug("Selected most recent blob: {BlobName} (uploaded {LastModified})",
                latestBlob.Name, latestBlob.Properties.LastModified);

            ArchiveType archiveType = DetectArchiveType(latestBlob.Name);

            switch (archiveType)
            {
                case ArchiveType.Zip:
                    await DownloadAndExtractZipAsync(blobClient, geoLiteConfig.DatabasePath, logger);
                    break;
                case ArchiveType.TarGz:
                    await DownloadAndExtractTarGzAsync(blobClient, geoLiteConfig.DatabasePath, logger);
                    break;
                default:
                    logger.LogDebug("Downloading GeoLite2 database from {BlobName}...", latestBlob.Name);
                    await blobClient.DownloadToAsync(geoLiteConfig.DatabasePath);
                    logger.LogDebug("GeoLite2 database downloaded to {Path}", geoLiteConfig.DatabasePath);
                    break;
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to download GeoLite2 database from {ContainerUri}. Geolocation will be unavailable.", geoLiteConfig.ContainerUri);
        }
    }

    /// <summary>
    /// Determines the archive type based on the blob file name extension.
    /// </summary>
    private static ArchiveType DetectArchiveType(string blobName)
    {
        if (blobName.EndsWith(".tar.gz", StringComparison.OrdinalIgnoreCase)
            || blobName.EndsWith(".tgz", StringComparison.OrdinalIgnoreCase))
        {
            return ArchiveType.TarGz;
        }

        if (blobName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            return ArchiveType.Zip;
        }

        return ArchiveType.Raw;
    }

    /// <summary>
    /// Lists all blobs in the container and returns the one with the most recent
    /// <see cref="BlobItemProperties.LastModified"/> timestamp.
    /// </summary>
    private static async Task<BlobItem?> FindMostRecentBlobAsync(BlobContainerClient containerClient)
    {
        BlobItem? latest = null;

        await foreach (BlobItem blob in containerClient.GetBlobsAsync())
        {
            if (latest is null || blob.Properties.LastModified > latest.Properties.LastModified)
            {
                latest = blob;
            }
        }

        return latest;
    }

    /// <summary>
    /// Downloads a zip archive from Blob Storage to a temporary file, searches all entries
    /// (regardless of folder depth) for the <c>.mmdb</c> file, extracts it to the target path,
    /// and cleans up the temporary file.
    /// </summary>
    private static async Task DownloadAndExtractZipAsync(BlobClient blobClient, string targetPath, ILogger logger)
    {
        string tempPath = targetPath + ".tmp.zip";

        try
        {
            logger.LogDebug("Downloading GeoLite2 zip from {BlobName}...", blobClient.Name);
            await blobClient.DownloadToAsync(tempPath);

            using ZipArchive archive =  await ZipFile.OpenReadAsync(tempPath);
            ZipArchiveEntry? mmdbEntry = archive.Entries
                .FirstOrDefault(e => e.FullName.EndsWith(".mmdb", StringComparison.OrdinalIgnoreCase)
                                     && e.Length > 0);

            if (mmdbEntry is null)
            {
                logger.LogWarning("No .mmdb file found inside the zip archive {BlobName}.", blobClient.Name);
                return;
            }

            logger.LogDebug("Found .mmdb entry at archive path: {EntryPath}", mmdbEntry.FullName);
            await mmdbEntry.ExtractToFileAsync(targetPath, overwrite: true);
            logger.LogDebug("GeoLite2 database extracted to {Path} ({CompressedSize:N0} -> {FullSize:N0} bytes)",
                targetPath, mmdbEntry.CompressedLength, mmdbEntry.Length);
        }
        finally
        {
            DeleteTempFile(tempPath);
        }
    }

    /// <summary>
    /// Downloads a <c>.tar.gz</c> archive from Blob Storage to a temporary file, decompresses
    /// with GZip, reads the tar entries to find the <c>.mmdb</c> file at any folder depth,
    /// extracts it to the target path, and cleans up the temporary file.
    /// </summary>
    private static async Task DownloadAndExtractTarGzAsync(BlobClient blobClient, string targetPath, ILogger logger)
    {
        string tempPath = targetPath + ".tmp.tar.gz";

        try
        {
            logger.LogInformation("Downloading GeoLite2 tar.gz from {BlobName}...", blobClient.Name);
            await blobClient.DownloadToAsync(tempPath);

            await using FileStream fileStream = File.OpenRead(tempPath);
            await using GZipStream gzipStream = new GZipStream(fileStream, CompressionMode.Decompress);
            await using TarReader tarReader = new TarReader(gzipStream);

            TarEntry? entry;
            while ((entry = await tarReader.GetNextEntryAsync()) is not null)
            {
                if (entry.EntryType == TarEntryType.RegularFile
                    && entry.Name.EndsWith(".mmdb", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogDebug("Found .mmdb entry at archive path: {EntryPath}", entry.Name);
                    await entry.ExtractToFileAsync(targetPath, overwrite: true);
                    logger.LogInformation("GeoLite2 database extracted from tar.gz to {Path}", targetPath);
                    return;
                }
            }

            logger.LogWarning("No .mmdb file found inside the tar.gz archive {BlobName}.", blobClient.Name);
        }
        finally
        {
            DeleteTempFile(tempPath);
        }
    }

    /// <summary>
    /// Deletes a temporary file if it exists, suppressing any errors.
    /// </summary>
    private static void DeleteTempFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Best-effort cleanup; temp file will be overwritten next startup.
        }
    }

    private enum ArchiveType
    {
        Raw,
        Zip,
        TarGz
    }
}
