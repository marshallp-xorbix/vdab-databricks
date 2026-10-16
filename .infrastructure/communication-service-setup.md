# Azure Communication Service - Email Setup

Email functionality is provided by Azure Communication Service, which is deployed as part of the infrastructure template.

> **Note:** The Communication Service is **shared across all environments** (dev, stg, prd) within the same resource group. This reduces costs and simplifies management since email configuration doesn't need to be environment-specific.

## Quick Start

### Enable Email Service

Set `deployCommunicationService = true` in `main.dev.bicepparam`:

```bicep
param deployCommunicationService = true
param emailSenderDisplayName = 'VDAB Notifications'
param emailSenderUsername = 'donotreply'
param customEmailDomain = ''  // Leave empty for Azure Managed Domain
```

**Connection strings are automatically configured** during deployment. No manual steps required!

## Domain Options

### Azure Managed Domain (Default)
- **Format:** `donotreply@{guid}.azurecomm.net`
- **Setup:** Immediate, no configuration
- **Use:** Development and testing
- **Cost:** Free

### Custom Domain (Production)
- **Format:** `donotreply@yourdomain.com`
- **Setup:** Requires DNS configuration (15-30 min)
- **Use:** Production, customer-facing emails
- **Cost:** Free (better deliverability)

## Custom Domain Configuration

If using a custom domain (`customEmailDomain` parameter is set), you must configure DNS records after deployment:

### 1. Get DNS Records
1. Go to **Azure Portal** > **Communication Services** > **Email** > **Domains**.
2. Click on your custom domain (e.g., `mail.xorbix.com`).
3. You will see a list of required DNS records (TXT for verification, CNAME for DKIM, TXT for SPF).

### 2. Add to DNS Provider
Log in to your DNS provider (GoDaddy, Cloudflare, etc.) and add the records:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| TXT | @ | `v=spf1 include:spf.protection.outlook.com...` | SPF (Sender Policy Framework) |
| TXT | _azure-comm-verify | `<verification-code>` | Domain Ownership Verification |
| CNAME | selector1._domainkey | `selector1-domain-guid.azurecomm.net` | DKIM (DomainKeys Identified Mail) |
| CNAME | selector2._domainkey | `selector2-domain-guid.azurecomm.net` | DKIM (DomainKeys Identified Mail) |

### 3. Verify & Link
1. Wait 15-30 minutes for DNS propagation.
2. In the Azure Portal (Email Service Domain blade), click **Verify**.
3. Once the status is "Verified", go to the **Communication Service** resource (not the Email Service).
4. Click **Domains** in the left menu.
5. Click **Add domain** and select your verified custom domain to link it.

### 4. Test
Once verified and linked, you can send emails using:
`donotreply@yourdomain.com`

## Code Integration

### Install Package

```bash
dotnet add package Azure.Communication.Email
```

### Implementation Example

```csharp
using Azure.Communication.Email;

public class EmailSenderService : IEmailSenderService
{
    private readonly EmailClient _emailClient;
    private readonly IConfiguration _config;

    public EmailSenderService(IConfiguration config)
    {
        _config = config;
        var connectionString = config["CommunicationServiceConnectionString"];
        _emailClient = new EmailClient(connectionString);
    }

    public async Task SendEmailAsync(string to, string subject, string html)
    {
        var sender = GetSenderAddress();
        var message = new EmailMessage(sender, 
            new EmailContent(subject) { Html = html },
            new EmailRecipients(new[] { new EmailAddress(to) }));

        await _emailClient.SendAsync(WaitUntil.Completed, message);
    }

    private string GetSenderAddress()
    {
        var username = _config["EmailConfiguration__SenderUsername"];
        var useCustom = bool.Parse(_config["EmailConfiguration__UseCustomDomain"] ?? "false");
        
        return useCustom 
            ? $"{username}@{_config["EmailConfiguration__CustomDomain"]}"
            : $"{username}@{_config["EmailConfiguration__AzureManagedDomain"]}";
    }
}
```

## Monitoring

### Log Analytics Queries

```kql
// All email operations
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.COMMUNICATION"
| order by TimeGenerated desc

// Failed deliveries
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.COMMUNICATION"
| where Status == "Failed"
| project TimeGenerated, OperationName, ResultDescription

// Email volume by day
AzureDiagnostics
| where ResourceProvider == "MICROSOFT.COMMUNICATION"
| summarize Count=count() by bin(TimeGenerated, 1d)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection string missing | Check App Service → Configuration → Connection strings |
| Domain not verified | Verify DNS records, wait 15-30 min |
| Emails not sending | Check Application Insights for errors |
| Emails going to spam | Use custom domain with SPF/DKIM records |

## Resources

- [Azure Communication Services Docs](https://learn.microsoft.com/azure/communication-services/)
- [Custom Domain Setup](https://learn.microsoft.com/azure/communication-services/quickstarts/email/add-custom-verified-domains)
- [Email Best Practices](https://learn.microsoft.com/azure/communication-services/concepts/email/email-best-practices)
