using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Reflection;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Provides email sending functionality using Azure Communication Service.
/// </summary>
public class EmailSenderService : IEmailSenderService
{
    private const string UserNameTemplateKey = "UserName";

    private readonly ILogger<EmailSenderService> _logger;
    private readonly EmailClient? _emailClient;
    private readonly string _senderAddress;
    private readonly bool _isConfigured;
    private readonly bool _forceAllEmailsToDebugRecipient;
    private readonly string _debugEmailRecipient;
    private readonly string _confirmEmailUrl;
    private readonly string _confirmEmailChangeUrl;
    private readonly string _resetPasswordUrl;
    private readonly string _acceptInviteUrl;
    private readonly string _passwordlessUrl;

    private readonly Dictionary<string, string> _emailTemplates = [];

    /// <summary>
    /// Initializes a new instance of the <see cref="EmailSenderService"/> class.
    /// </summary>
    /// <param name="logger">The logger instance.</param>
    /// <param name="connectionStrings">The connection strings configuration.</param>
    /// <param name="emailConfiguration">The email configuration.</param>
    /// <param name="debugConfiguration">The debug configuration.</param>
    public EmailSenderService(
        ILogger<EmailSenderService> logger,
        IOptions<ConnectionStrings> connectionStrings,
        IOptions<EmailConfiguration> emailConfiguration,
        IOptions<DebugConfiguration> debugConfiguration,
        IOptions<ApplicationConfiguration> appConfig)
    {
        _logger = logger;

        if (string.IsNullOrWhiteSpace(appConfig.Value.FrontendUrl))
        {
            _logger.LogError("FrontendUrl is not configured in ApplicationConfiguration");
            throw new ArgumentException("FrontendUrl must be configured in ApplicationConfiguration");
        }

        _confirmEmailUrl = $"{appConfig.Value.FrontendUrl}/{ClientRoutes.ConfirmEmail}";
        _confirmEmailChangeUrl = $"{appConfig.Value.FrontendUrl}/{ClientRoutes.ConfirmEmailChange}";
        _resetPasswordUrl = $"{appConfig.Value.FrontendUrl}/{ClientRoutes.ResetPassword}";
        _acceptInviteUrl = $"{appConfig.Value.FrontendUrl}/{ClientRoutes.AcceptInvite}";
        _passwordlessUrl = $"{appConfig.Value.FrontendUrl}/{ClientRoutes.Passwordless}";

        var connectionString = connectionStrings.Value.CommunicationService;
        var emailConfig = emailConfiguration.Value;
        var useCustomDomain = emailConfig.UseCustomDomain;
        var domainConfig = useCustomDomain ? emailConfig.CustomDomain : emailConfig.AzureManagedDomain;
        var senderUsername = domainConfig.SenderUsername;
        var domain = domainConfig.Domain;
        DebugConfiguration debugConfig = debugConfiguration.Value;
        _forceAllEmailsToDebugRecipient = debugConfig.ForceAllEmailsToDebugRecipient;
        _debugEmailRecipient = debugConfig.DebugEmailRecipient?.Trim() ?? string.Empty;

        _senderAddress = string.Empty;

        if (!string.IsNullOrEmpty(connectionString))
        {
            _emailClient = new EmailClient(connectionString);

            // Construct sender address based on domain configuration
            // Note: For Azure Managed Domain, you'll need to update this after deployment
            // The actual domain will be visible in Azure Portal
            if (!string.IsNullOrEmpty(domain))
            {
                _senderAddress = $"{senderUsername}@{domain}";
            }
            else
            {
                _senderAddress = $"{senderUsername}@{emailConfig.AzureManagedDomain}";
                _logger.LogWarning("Using placeholder Azure Managed Domain. Update EmailConfiguration:SenderAddress in configuration with actual domain from Azure Portal.");
            }

            _isConfigured = true;
            _logger.LogInformation("Azure Communication Service Email configured with sender: {Sender}", _senderAddress);
        }
        else
        {
            _isConfigured = false;
            _senderAddress = $"{senderUsername}@localhost";
            _logger.LogWarning("Azure Communication Service connection string not configured. Email sending will be logged only.");
        }

        if (_forceAllEmailsToDebugRecipient)
        {
            if (string.IsNullOrWhiteSpace(_debugEmailRecipient))
            {
                _logger.LogWarning("Debug email override is enabled, but Debug:DebugEmailRecipient is empty. Emails will continue to use requested recipients.");
            }
            else
            {
                _logger.LogWarning("Debug email override is enabled. All outgoing emails will be routed to {DebugEmailRecipient}.", _debugEmailRecipient);
            }
        }

        // Load email templates
        LoadEmailTemplates();
    }

    /// <summary>
    /// Resolves the final recipient address, applying debug override when configured.
    /// </summary>
    private string ResolveRecipientAddress(string requestedRecipient)
    {
        if (!_forceAllEmailsToDebugRecipient)
        {
            return requestedRecipient;
        }

        if (string.IsNullOrWhiteSpace(_debugEmailRecipient))
        {
            return requestedRecipient;
        }

        if (!string.Equals(requestedRecipient, _debugEmailRecipient, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogInformation("Debug email override active. Routing email from {RequestedRecipient} to {DebugRecipient}.",
                requestedRecipient,
                _debugEmailRecipient);
        }

        return _debugEmailRecipient;
    }

    /// <summary>
    /// Loads email templates from embedded resources in the Server project.
    /// </summary>
    private void LoadEmailTemplates()
    {
        try
        {
            var serverAssembly = Assembly.Load("Xorbix-Visual-Databricks-App-Builder.Server");
            var templateNames = new[]
            {
                "ConfirmEmail.html",
                "PasswordResetLink.html",
                "PasswordResetCode.html",
                "VerificationCode.html",
                "WelcomeUser.html",
                "WelcomeUserPasswordless.html",
                "DuplicateRegistrationAttempt.html",
                "DuplicateRegistrationAttemptPasswordless.html",
                "AdminPasswordReset.html",
                "ChangeEmailConfirmation.html",
                "EmailChangeNotification.html",
                "Invite.html"
            };

            foreach (var templateName in templateNames)
            {
                var resourceName = $"Xorbix_Visual_Databricks_App_Builder.Server.EmailTemplates.{templateName}";
                using var stream = serverAssembly.GetManifestResourceStream(resourceName);

                if (stream != null)
                {
                    using var reader = new StreamReader(stream);
                    _emailTemplates[templateName] = reader.ReadToEnd();
                    _logger.LogDebug("Loaded email template: {TemplateName}", templateName);
                }
                else
                {
                    _logger.LogWarning("Email template not found: {TemplateName}", templateName);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load email templates from embedded resources");
        }
    }

    /// <summary>
    /// HTML-encodes a value for safe interpolation into email markup. Used to prevent HTML/script
    /// injection when caller-supplied values (tenant names, emails, etc.) are placed into HTML.
    /// </summary>
    internal static string HtmlEncode(string value) => System.Net.WebUtility.HtmlEncode(value);

    /// <summary>
    /// Loads an email template and replaces placeholders with actual values.
    /// Replacement values are HTML-encoded before substitution to prevent HTML/script injection;
    /// callers must not pass pre-formatted HTML as a replacement value.
    /// </summary>
    private string LoadTemplate(string templateName, Dictionary<string, string> replacements)
    {
        if (!_emailTemplates.TryGetValue(templateName, out var template))
        {
            _logger.LogWarning("Template {TemplateName} not found, using fallback", templateName);
            return CreateFallbackTemplate(replacements);
        }

        foreach (var replacement in replacements)
        {
            template = template.Replace($"{{{{{replacement.Key}}}}}", HtmlEncode(replacement.Value));
        }

        return template;
    }

    /// <summary>
    /// Creates a simple fallback template if the main template can't be loaded.
    /// Replacement values are HTML-encoded before interpolation to prevent HTML/script injection.
    /// </summary>
    private static string CreateFallbackTemplate(Dictionary<string, string> replacements)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<html><body style='font-family: Arial, sans-serif;'>");

        foreach (var kvp in replacements)
        {
            sb.AppendLine($"<p><strong>{HtmlEncode(kvp.Key)}:</strong> {HtmlEncode(kvp.Value)}</p>");
        }

        sb.AppendLine("</body></html>");
        return sb.ToString();
    }

    /// <summary>
    /// Sends a confirmation link to the specified email address.
    /// </summary>
    /// <param name="user">The user to send the confirmation link to.</param>
    /// <param name="email">The email address.</param>
    /// <param name="confirmationLink">The confirmation link URL.</param>
    public async Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink)
    {
        _logger.LogInformation("Sending confirmation link to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient == null)
        {
            _logger.LogWarning("Email not configured. Confirmation link: {Link}", confirmationLink);
            return;
        }

        var subject = "Confirm your email address";

        var replacements = new Dictionary<string, string>
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "ConfirmationLink", confirmationLink }
        };

        var htmlContent = LoadTemplate("ConfirmEmail.html", replacements);

        await SendEmailInternalAsync(email, subject, htmlContent, $"Confirm your email: {confirmationLink}");
    }

    /// <inheritdoc/>
    public async Task SendConfirmationEmailAsync(ApplicationUser user, string email, string urlParameters, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending confirmation email to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient == null)
        {
            _logger.LogWarning("Email not configured. Confirmation link params: {Params}", urlParameters);
            return;
        }

        string confirmationLink = $"{_confirmEmailUrl}?{urlParameters}";

        string subject = "Confirm your email address";

        Dictionary<string, string> replacements = new()
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "ConfirmationLink", confirmationLink }
        };

        string htmlContent = LoadTemplate("ConfirmEmail.html", replacements);

        await SendEmailInternalAsync(email, subject, htmlContent, $"Confirm your email: {confirmationLink}", cancellationToken);
    }

    /// <summary>
    /// Sends a confirmation email to verify a new email address change.
    /// </summary>
    /// <param name="user">The user requesting the email change.</param>
    /// <param name="newEmail">The new email address to send the confirmation to.</param>
    /// <param name="urlParameters">The URL parameters for the confirmation link.</param>
    public async Task SendEmailChangeConfirmationAsync(ApplicationUser user, string newEmail, string urlParameters, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending email change confirmation to user {UserId} at new email {NewEmail}", user.Id, newEmail);

        if (!_isConfigured || _emailClient == null)
        {
            _logger.LogWarning("Email not configured. Email change confirmation link: {Link}", urlParameters);
            return;
        }

        string subject = "Confirm your new email address";

        string confirmationLink = $"{_confirmEmailChangeUrl}?{urlParameters}";

        Dictionary<string, string> replacements = new()
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "ConfirmationLink", confirmationLink }
        };

        string? htmlContent = LoadTemplate("ChangeEmailConfirmation.html", replacements);

        await SendEmailInternalAsync(newEmail, subject, htmlContent, $"Confirm your new email address: {confirmationLink}", cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendEmailChangeNotificationAsync(
        ApplicationUser user,
        string currentEmail,
        string newEmail,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Sending email change notification to user {UserId} at current email {CurrentEmail}",
            user.Id,
            currentEmail);

        if (!_isConfigured || _emailClient == null)
        {
            _logger.LogWarning(
                "Email not configured. Email change notification for {CurrentEmail} -> {NewEmail}",
                currentEmail,
                newEmail);
            return;
        }

        string subject = "Email address change requested";

        Dictionary<string, string> replacements = new()
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "NewEmail", newEmail },
        };

        string htmlContent = LoadTemplate("EmailChangeNotification.html", replacements);

        await SendEmailInternalAsync(
            currentEmail,
            subject,
            htmlContent,
            $"An email change to {newEmail} was requested for your account.",
            cancellationToken);
    }

    /// <summary>
    /// Sends a password reset link to the specified email address.
    /// </summary>
    /// <param name="user">The user requesting the password reset.</param>
    /// <param name="email">The email address.</param>
    /// <param name="resetLink">The password reset link URL.</param>
    public async Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink)
    {
        _logger.LogInformation("Sending password reset link to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient is null)
        {
            _logger.LogWarning("Email not configured. Password reset link: {Link}", resetLink);
            return;
        }

        var subject = "Reset your password";

        var replacements = new Dictionary<string, string>
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "ResetLink", resetLink }
        };

        var htmlContent = LoadTemplate("PasswordResetLink.html", replacements);

        await SendEmailInternalAsync(email, subject, htmlContent, $"Reset your password: {resetLink}");
    }

    /// <summary>
    /// Sends a password reset email initiated by an administrator.
    /// </summary>
    /// <param name="user">The user whose password is being reset.</param>
    /// <param name="email">The email address.</param>
    /// <param name="urlParameters">The URL parameters for the password reset link.</param>
    public async Task SendAdminPasswordResetAsync(ApplicationUser user, string email, string urlParameters, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending admin-initiated password reset link to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient is null)
        {
            _logger.LogWarning("Email not configured. Admin password reset link: {Link}", urlParameters);
            return;
        }

        string subject = "Password Reset Initiated by Administrator";

        string resetLink = $"{_resetPasswordUrl}/reset-password?{urlParameters}";

        Dictionary<string, string> replacements = new()
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "ResetLink", resetLink }
        };

        string? htmlContent = LoadTemplate("AdminPasswordReset.html", replacements);

        await SendEmailInternalAsync(email, subject, htmlContent, $"Your password has been reset by an administrator: {resetLink}", cancellationToken);
    }

    /// <summary>
    /// Sends a password reset code to the specified email address.
    /// </summary>
    /// <param name="user">The user requesting the password reset.</param>
    /// <param name="email">The email address.</param>
    /// <param name="resetCode">The password reset code.</param>
    public async Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode)
    {
        _logger.LogInformation("Sending password reset code to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient is null)
        {
            _logger.LogWarning("Email not configured. Password reset code: {Code}", resetCode);
            return;
        }

        var subject = "Your password reset code";

        var replacements = new Dictionary<string, string>
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "ResetCode", resetCode }
        };

        var htmlContent = LoadTemplate("PasswordResetCode.html", replacements);

        await SendEmailInternalAsync(email, subject, htmlContent, $"Your password reset code is: {resetCode}");
    }

    /// <summary>
    /// Sends a verification code for passwordless authentication.
    /// </summary>
    /// <param name="user">The user to send the code to.</param>
    /// <param name="email">The email address.</param>
    /// <param name="code">The verification code.</param>
    /// <param name="expiresAt">When the code expires.</param>
    public async Task SendVerificationCodeAsync(ApplicationUser user, string email, string code, DateTime expiresAt, CancellationToken cancellationToken = default)
    {
        int minutesUntilExpiration = (int)(expiresAt - DateTime.UtcNow).TotalMinutes;

        _logger.LogInformation("Sending verification code to user {UserId} ({Email}), expires in {Minutes} minutes",
            user.Id, email, minutesUntilExpiration);

        if (!_isConfigured || _emailClient is null)
        {
            _logger.LogWarning("Email not configured. Verification code: {Code}", code);
            return;
        }

        var subject = "Your verification code";

        var replacements = new Dictionary<string, string>
        {
            { UserNameTemplateKey, user.UserName ?? "User" },
            { "Code", code },
            { "MinutesUntilExpiration", minutesUntilExpiration.ToString() }
        };

        var htmlContent = LoadTemplate("VerificationCode.html", replacements);

        await SendEmailInternalAsync(email, subject, htmlContent, $"Your verification code is: {code} (expires in {minutesUntilExpiration} minutes)", cancellationToken);
    }

    /// <summary>
    /// Internal method to send email using Azure Communication Service.
    /// </summary>
    private async Task SendEmailInternalAsync(string toEmail, string subject, string htmlContent, string plainTextContent, CancellationToken cancellationToken = default)
    {
        string recipientAddress = ResolveRecipientAddress(toEmail);

        try
        {
            var emailMessage = new EmailMessage(
                senderAddress: _senderAddress,
                content: new EmailContent(subject)
                {
                    Html = htmlContent,
                    PlainText = plainTextContent
                },
                recipients: new EmailRecipients(new List<EmailAddress>
                {
                    new EmailAddress(recipientAddress)
                }));

            EmailSendOperation emailSendOperation = await _emailClient!.SendAsync(WaitUntil.Completed, emailMessage, cancellationToken);

            if (emailSendOperation.HasValue && emailSendOperation.Value.Status == EmailSendStatus.Succeeded)
            {
                _logger.LogInformation("Email sent successfully. Requested recipient: {RequestedRecipient}. Actual recipient: {ActualRecipient}. MessageId: {MessageId}",
                toEmail, recipientAddress, emailSendOperation.Id);
                return;
            }

            _logger.LogWarning("Email sending did not succeed. Requested recipient: {RequestedRecipient}. Actual recipient: {ActualRecipient}. Status: {Status}",
                toEmail,
                recipientAddress,
                emailSendOperation.HasValue ? emailSendOperation.Value.Status.ToString() : "No Value");
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (RequestFailedException ex)
        {
            _logger.LogError(ex, "Failed to send email. Requested recipient: {RequestedRecipient}. Actual recipient: {ActualRecipient}. Status: {Status}, ErrorCode: {ErrorCode}",
                toEmail, recipientAddress, ex.Status, ex.ErrorCode);
            throw new InvalidOperationException($"Failed to send email to {recipientAddress}.", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error sending email. Requested recipient: {RequestedRecipient}. Actual recipient: {ActualRecipient}",
                toEmail,
                recipientAddress);
            throw new InvalidOperationException($"Unexpected error sending email to {recipientAddress}.", ex);
        }
    }

    /// <inheritdoc/>
    public async Task SendWelcomeEmailAsync(ApplicationUser user, string email, string urlParameters, IList<string> roles, bool isPasswordless = false, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending welcome email to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient == null)
        {
            _logger.LogWarning("Email not configured. Welcome email params: {Params}", urlParameters);
            return;
        }

        string setupLink = $"{_confirmEmailUrl}?{urlParameters}";

        string subject = "Welcome to Visual Databricks App Builder";

        Dictionary<string, string> replacements = new()
        {
            { UserNameTemplateKey, $"{user.FirstName} {user.LastName}".Trim() },
            { "SetupLink", setupLink },
            { "Roles", string.Join(", ", roles) }
        };

        string templateName = isPasswordless ? "WelcomeUserPasswordless.html" : "WelcomeUser.html";
        string htmlContent = LoadTemplate(templateName, replacements);

        await SendEmailInternalAsync(email, subject, htmlContent,
            $"Welcome! {(isPasswordless ? "Activate your account" : "Set up your account")}: {setupLink}. Roles: {string.Join(", ", roles)}",
            cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendDuplicateRegistrationAttemptAsync(
        ApplicationUser user,
        string email,
        string? urlParameters,
        bool passwordlessOnly = false,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Sending duplicate registration attempt notification to user {UserId} ({Email})", user.Id, email);

        if (!_isConfigured || _emailClient == null)
        {
            _logger.LogWarning(
                "Email not configured. Duplicate registration attempt detected for: {Email}. PasswordlessOnly={PasswordlessOnly}. Params: {Params}",
                email,
                passwordlessOnly,
                urlParameters);
            return;
        }

        string actionLink = passwordlessOnly
            ? _passwordlessUrl
            : $"{_resetPasswordUrl}?{urlParameters}";

        string subject = "Account Registration Attempt Detected";

        Dictionary<string, string> replacements = new()
        {
            { UserNameTemplateKey, $"{user.FirstName} {user.LastName}".Trim() },
            { "Email", email },
            { "ResetLink", actionLink },
            { "ActionLink", actionLink },
        };

        string templateName = passwordlessOnly
            ? "DuplicateRegistrationAttemptPasswordless.html"
            : "DuplicateRegistrationAttempt.html";
        string htmlContent = LoadTemplate(templateName, replacements);

        string plainText = passwordlessOnly
            ? $"A registration attempt was made with your email ({email}). If this was you, sign in: {actionLink}"
            : $"A registration attempt was made with your email ({email}). If this was you, reset your password: {actionLink}";

        await SendEmailInternalAsync(email, subject, htmlContent, plainText, cancellationToken);
    }

    /// <summary>
    /// Returns false when Azure Communication Service email is not configured.
    /// </summary>
    private bool IsEmailSendingConfigured(string billingNotificationType)
    {
        if (_isConfigured && _emailClient != null)
        {
            return true;
        }

        _logger.LogWarning(
            "Email not configured. Skipping {BillingNotificationType} billing notification.",
            billingNotificationType);
        return false;
    }

    /// <inheritdoc/>
    public async Task SendBillingPaymentFailedAsync(string email, string tenantDisplayName, string? invoiceId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        if (!IsEmailSendingConfigured("payment failed"))
        {
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string safeInvoiceId = string.IsNullOrWhiteSpace(invoiceId) ? "N/A" : invoiceId;
        string subject = $"Payment failed for {safeTenantDisplayName}";

        string htmlContent = $"<html><body style='font-family: Arial, sans-serif;'><h2>Payment failed</h2><p>We could not process the latest payment for <strong>{HtmlEncode(safeTenantDisplayName)}</strong>.</p><p>Invoice: <strong>{HtmlEncode(safeInvoiceId)}</strong></p><p>Please update your payment method to avoid service interruption.</p></body></html>";
        string plainTextContent = $"Payment failed for {safeTenantDisplayName}. Invoice: {safeInvoiceId}. Please update your payment method.";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendBillingSubscriptionCanceledAsync(string email, string tenantDisplayName, DateTimeOffset? effectiveEndDate, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        if (!IsEmailSendingConfigured("subscription canceled"))
        {
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string formattedEffectiveEndDate = effectiveEndDate.HasValue
            ? effectiveEndDate.Value.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'")
            : "immediately";

        string subject = $"Subscription canceled for {safeTenantDisplayName}";
        string htmlContent = $"<html><body style='font-family: Arial, sans-serif;'><h2>Subscription canceled</h2><p>The subscription for <strong>{HtmlEncode(safeTenantDisplayName)}</strong> has been canceled.</p><p>Effective date: <strong>{formattedEffectiveEndDate}</strong></p></body></html>";
        string plainTextContent = $"Subscription canceled for {safeTenantDisplayName}. Effective date: {formattedEffectiveEndDate}.";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendBillingSubscriptionRenewedAsync(string email, string tenantDisplayName, DateTimeOffset? nextBillingDate, int activeSeatCount, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        if (!IsEmailSendingConfigured("subscription renewed"))
        {
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string formattedNextBillingDate = nextBillingDate.HasValue
            ? nextBillingDate.Value.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'")
            : "N/A";
        int safeSeatCount = Math.Max(activeSeatCount, 0);

        string subject = $"Subscription renewed for {safeTenantDisplayName}";
        string htmlContent = $"<html><body style='font-family: Arial, sans-serif;'><h2>Subscription renewed</h2><p>Your subscription for <strong>{HtmlEncode(safeTenantDisplayName)}</strong> renewed successfully.</p><p>Active seats: <strong>{safeSeatCount}</strong></p><p>Next billing date: <strong>{formattedNextBillingDate}</strong></p></body></html>";
        string plainTextContent = $"Subscription renewed for {safeTenantDisplayName}. Active seats: {safeSeatCount}. Next billing date: {formattedNextBillingDate}.";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendBillingTrialEndingAsync(string email, string tenantDisplayName, DateTimeOffset? trialEnd, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        if (!IsEmailSendingConfigured("trial ending"))
        {
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string formattedTrialEnd = trialEnd.HasValue
            ? trialEnd.Value.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'")
            : "soon";

        string subject = $"Trial ending soon for {safeTenantDisplayName}";
        string htmlContent = $"<html><body style='font-family: Arial, sans-serif;'><h2>Your trial is ending soon</h2><p>The trial period for <strong>{HtmlEncode(safeTenantDisplayName)}</strong> ends on <strong>{formattedTrialEnd}</strong>.</p><p>To continue using the service without interruption, please add a payment method or choose a subscription plan before your trial expires.</p></body></html>";
        string plainTextContent = $"Trial ending soon for {safeTenantDisplayName}. Your trial ends on {formattedTrialEnd}. Please add a payment method or choose a subscription plan to continue.";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendBillingPromoEndingAsync(
        string email,
        string tenantDisplayName,
        DateTimeOffset? chargeDate,
        decimal estimatedAmount,
        string tier,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        if (!IsEmailSendingConfigured("promo ending"))
        {
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string safeTier = string.IsNullOrWhiteSpace(tier) ? "subscription" : tier;
        string formattedChargeDate = chargeDate.HasValue
            ? chargeDate.Value.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'")
            : "your next billing date";
        string formattedAmount = estimatedAmount.ToString("0.00");

        string subject = $"Promotional period ending for {safeTenantDisplayName}";
        string htmlContent = $"<html><body style='font-family: Arial, sans-serif;'><h2>Your promotional period is ending</h2><p>The promotional period for <strong>{HtmlEncode(safeTenantDisplayName)}</strong> ({HtmlEncode(safeTier)}) is ending.</p><p>Your first standard charge of <strong>${formattedAmount}</strong> is scheduled around <strong>{formattedChargeDate}</strong>.</p><p>No action is required if your payment method is up to date.</p></body></html>";
        string plainTextContent = $"Promotional period ending for {safeTenantDisplayName} ({safeTier}). Estimated charge: ${formattedAmount} around {formattedChargeDate}.";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendInviteAsync(
        string email,
        string tenantDisplayName,
        string inviterName,
        string rawToken,
        DateTime expiresAt,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            _logger.LogWarning("SendInviteAsync called with empty email. Skipping.");
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string safeInviterName = string.IsNullOrWhiteSpace(inviterName) ? "A teammate" : inviterName;
        string encodedToken = Uri.EscapeDataString(rawToken);
        string acceptLink = $"{_acceptInviteUrl}?token={encodedToken}";
        string formattedExpiry = expiresAt.ToString("yyyy-MM-dd HH:mm 'UTC'");

        _logger.LogInformation("Sending tenant invite email to {Email} for tenant {TenantName}", email, safeTenantDisplayName);

        if (!_isConfigured || _emailClient is null)
        {
            _logger.LogWarning("Email not configured. Invite link: {Link}", acceptLink);
            return;
        }

        string subject = $"You're invited to {safeTenantDisplayName}";

        Dictionary<string, string> replacements = new()
        {
            { "TenantName", safeTenantDisplayName },
            { "InviterName", safeInviterName },
            { "InvitedEmail", email },
            { "AcceptLink", acceptLink },
            { "ExpiryDate", formattedExpiry }
        };

        string htmlContent = LoadTemplate("Invite.html", replacements);
        string plainTextContent = $"Hello {email},\n\n{safeInviterName} invited you to join {safeTenantDisplayName} on Visual Databricks App Builder. Accept here (expires {formattedExpiry}): {acceptLink}";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }

    /// <inheritdoc/>
    public async Task SendSeatPurchaseFailedAsync(string email, string tenantDisplayName, string inviteeEmail, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return;
        }

        string safeTenantDisplayName = string.IsNullOrWhiteSpace(tenantDisplayName) ? "your organization" : tenantDisplayName;
        string safeInviteeEmail = string.IsNullOrWhiteSpace(inviteeEmail) ? "an invited user" : inviteeEmail;
        string subject = $"Action needed: couldn't add a seat for {safeTenantDisplayName}";

        string htmlContent = $"<html><body style='font-family: Arial, sans-serif;'><h2>Couldn't add a seat</h2><p><strong>{HtmlEncode(safeInviteeEmail)}</strong> tried to accept their invitation to <strong>{HtmlEncode(safeTenantDisplayName)}</strong>, but we were unable to add the additional paid seat to your subscription.</p><p>This usually means the billing update could not be processed. Please review your payment method and subscription, then re-invite the user.</p></body></html>";
        string plainTextContent = $"{safeInviteeEmail} tried to accept their invitation to {safeTenantDisplayName}, but we could not add the additional paid seat to your subscription. Please review your payment method and subscription, then re-invite the user.";

        await SendEmailInternalAsync(email, subject, htmlContent, plainTextContent, cancellationToken);
    }
}
