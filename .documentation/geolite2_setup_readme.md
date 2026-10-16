# GeoLite2 IP Geolocation Setup

## Overview

The Sessions feature uses [MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) to resolve user IP addresses to city, region, and country. GeoLite2 is a free IP geolocation database; the NuGet packages (`MaxMind.GeoIP2`, `UAParser`) are the reader libraries — the actual database file (`.mmdb`) must be obtained separately.

## Prerequisites

1. **MaxMind Account** — Sign up at https://www.maxmind.com/en/geolite2/signup (free, requires accepting the EULA).
2. **License Key** — In your MaxMind account dashboard → **Manage License Keys** → **Generate New License Key**.
3. **GeoLite2-City Database** — Download `GeoLite2-City.mmdb` from your account's **Download Databases** page.

## NuGet Packages

These are installed in the **Services** project:

| Package | Purpose |
|---|---|
| `MaxMind.GeoIP2` | Reads `.mmdb` database files to resolve IPs |
| `MaxMind.Db` | Low-level database reader (dependency of GeoIP2) |
| `UAParser` | Parses UserAgent strings into browser/OS/device |

## Configuration

### `GeoLiteConfiguration` Section (appsettings)

| Key | Description | Example |
|---|---|---|
| `DatabasePath` | Local file path where the `.mmdb` file will be stored/cached | `./data/GeoLite2-City.mmdb` |
| `BlobUri` | Azure Blob Storage URI to download the database from on startup | `https://<account>.blob.core.windows.net/<container>/GeoLite2-City.mmdb` |

### How It Works

1. **On application startup**, if `BlobUri` is configured and the file at `DatabasePath` does not exist, the app downloads the `.mmdb` file from Azure Blob Storage using `DefaultAzureCredential`.
2. **`GeoLocationService`** loads the database from `DatabasePath` and resolves IPs on demand.
3. **Graceful degradation** — If the database is not configured, not found, or fails to load, geolocation returns `null` values (no crash). Sessions will still display but without location data.

### Local Development

For local development, you can either:

- **Option A (Recommended)**: Upload the `.mmdb` to your Azure Storage account and configure the blob URI. The app downloads it automatically on first run.
- **Option B**: Download the `.mmdb` manually and set `DatabasePath` to the local file path. Leave `BlobUri` empty.

Example `appsettings.Local.json`:

```json
{
  "GeoLiteConfiguration": {
    "DatabasePath": "./data/GeoLite2-City.mmdb",
    "BlobUri": "https://yourstorageaccount.blob.core.windows.net/geolite2/GeoLite2-City.mmdb"
  }
}
```

### Production (Azure)

1. Upload `GeoLite2-City.mmdb` to an Azure Blob Storage container.
2. Ensure the App Service managed identity has **Storage Blob Data Reader** role on the container.
3. Configure `BlobUri` in App Configuration or appsettings.
4. Set `DatabasePath` to a writable path (e.g., `/home/data/GeoLite2-City.mmdb` on Linux App Service).

## Updating the Database

MaxMind updates GeoLite2 databases **weekly**. To refresh:

1. Download the latest `GeoLite2-City.mmdb` from your MaxMind account.
2. Upload it to the Azure Blob Storage container (overwriting the existing file).
3. Delete the local cached copy at `DatabasePath` (or restart the app service — the app re-downloads if the local file is missing).

> **Tip**: MaxMind provides [`geoipupdate`](https://github.com/maxmind/geoipupdate), a CLI tool that can auto-refresh databases on a schedule using your license key. You can run this in a CI pipeline or scheduled task to keep the blob up to date.

## EULA Notes

- GeoLite2 is free but requires attribution: *"This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com."*
- The `.mmdb` file must **not** be committed to source control or redistributed.
- See the [GeoLite2 EULA](https://www.maxmind.com/en/geolite2/eula) for full terms.

## Architecture

```
Program.cs (startup)
  └─ Downloads .mmdb from Blob Storage → local cache
  
GeoLocationService (singleton)
  └─ Loads .mmdb from local cache
  └─ Resolve(ipAddress) → (City, Country, Region)

JwtService
  └─ Calls GeoLocationService.Resolve() when creating/rotating refresh tokens

UserService
  └─ Backfills geo data on session load for tokens that are missing it
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Sessions show no location data | Database file missing or not configured | Check `DatabasePath` and `BlobUri` in `GeoLiteConfiguration` appsettings |
| "GeoLite2 database not found" in logs | File doesn't exist at configured path | Verify blob URI is correct and app has Storage Blob Data Reader role |
| "Failed to download GeoLite2 database" in logs | Auth failure or blob doesn't exist | Check managed identity permissions on the storage container |
| All IPs resolve to "Local" | Development traffic uses loopback/private IPs | Expected behavior — only public IPs resolve to real locations |
