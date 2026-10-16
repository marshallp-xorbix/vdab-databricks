using Microsoft.AspNetCore.Identity;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Defines the contract for sending emails to application users.
/// </summary>
public interface IEmailSenderService : IEmailSender<ApplicationUser>
{
    // Inherits methods from IEmailSender<ApplicationUser>:
    // - SendConfirmationLinkAsync
    // - SendPasswordResetLinkAsync
    // - SendPasswordResetCodeAsync

    /// <summary>
    /// Sends a verification code for passwordless authentication.
    /// </summary>
    /// <param name="user">The user to send the code to.</param>
    /// <param name="email">The email address.</param>
    /// <param name="code">The verification code.</param>
    /// <param name="expiresAt">When the code expires.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendVerificationCodeAsync(ApplicationUser user, string email, string code, DateTime expiresAt, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a confirmation email with a link to verify the user's email address.
    /// Builds the full confirmation URL internally from the provided URL parameters.
    /// </summary>
    /// <param name="user">The user to send the confirmation email to.</param>
    /// <param name="email">The email address.</param>
    /// <param name="urlParameters">The URL parameters for the confirmation link.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendConfirmationEmailAsync(ApplicationUser user, string email, string urlParameters, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a welcome email to a newly created user with account setup instructions.
    /// Builds the full setup URL internally from the provided URL parameters.
    /// </summary>
    /// <param name="user">The user to send the welcome email to.</param>
    /// <param name="email">The email address.</param>
    /// <param name="urlParameters">The URL parameters for the account setup link.</param>
    /// <param name="roles">The roles assigned to the user.</param>
    /// <param name="isPasswordless">Whether the user is set up for passwordless authentication.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendWelcomeEmailAsync(ApplicationUser user, string email, string urlParameters, IList<string> roles, bool isPasswordless = false, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a notification email when someone attempts to register with an existing email address.
    /// When <paramref name="passwordlessOnly"/> is true, links to passwordless sign-in (no reset token).
    /// Otherwise includes a password-reset link built from <paramref name="urlParameters"/>.
    /// </summary>
    /// <param name="user">The existing user whose email was used in the registration attempt.</param>
    /// <param name="email">The email address.</param>
    /// <param name="urlParameters">The URL parameters for the password reset link (ignored when passwordless).</param>
    /// <param name="passwordlessOnly">When true, email a passwordless sign-in link instead of a reset link.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendDuplicateRegistrationAttemptAsync(
        ApplicationUser user,
        string email,
        string? urlParameters,
        bool passwordlessOnly = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a confirmation email to verify a new email address change.
    /// </summary>
    /// <param name="user">The user requesting the email change.</param>
    /// <param name="newEmail">The new email address to send the confirmation to.</param>
    /// <param name="urlParameters">The URL parameters for the confirmation link.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendEmailChangeConfirmationAsync(ApplicationUser user, string newEmail, string urlParameters, CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies the user's current email address that an email change was requested.
    /// </summary>
    /// <param name="user">The user requesting the email change.</param>
    /// <param name="currentEmail">The user's current email address.</param>
    /// <param name="newEmail">The requested new email address.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendEmailChangeNotificationAsync(
        ApplicationUser user,
        string currentEmail,
        string newEmail,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a password reset email initiated by an administrator.
    /// </summary>
    /// <param name="user">The user whose password is being reset.</param>
    /// <param name="email">The email address.</param>
    /// <param name="urlParameters">The URL parameters for the password reset link.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendAdminPasswordResetAsync(ApplicationUser user, string email, string urlParameters, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a payment failed billing notification.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="tenantDisplayName">Tenant display name.</param>
    /// <param name="invoiceId">Stripe invoice identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendBillingPaymentFailedAsync(string email, string tenantDisplayName, string? invoiceId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a subscription canceled billing notification.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="tenantDisplayName">Tenant display name.</param>
    /// <param name="effectiveEndDate">Effective cancellation end date.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendBillingSubscriptionCanceledAsync(string email, string tenantDisplayName, DateTimeOffset? effectiveEndDate, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a subscription renewal billing notification.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="tenantDisplayName">Tenant display name.</param>
    /// <param name="nextBillingDate">Next billing date.</param>
    /// <param name="activeSeatCount">Current active seat count.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendBillingSubscriptionRenewedAsync(string email, string tenantDisplayName, DateTimeOffset? nextBillingDate, int activeSeatCount, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a trial ending billing notification.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="tenantDisplayName">Tenant display name.</param>
    /// <param name="trialEnd">When the trial period ends.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendBillingTrialEndingAsync(string email, string tenantDisplayName, DateTimeOffset? trialEnd, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a notification before the first paid invoice after a promotional free period ends.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="tenantDisplayName">Tenant display name.</param>
    /// <param name="chargeDate">Estimated charge date.</param>
    /// <param name="estimatedAmount">Estimated charge amount in major currency units.</param>
    /// <param name="tier">Subscription tier name.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendBillingPromoEndingAsync(
        string email,
        string tenantDisplayName,
        DateTimeOffset? chargeDate,
        decimal estimatedAmount,
        string tier,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a tenant invitation email with a link the recipient can use to accept.
    /// </summary>
    /// <param name="email">Recipient email address.</param>
    /// <param name="tenantDisplayName">Tenant display name that the user is being invited to.</param>
    /// <param name="inviterName">Display name of the user who issued the invite.</param>
    /// <param name="rawToken">The raw (unhashed) invite token to embed in the accept link.</param>
    /// <param name="expiresAt">When the invite token expires (UTC).</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendInviteAsync(
        string email,
        string tenantDisplayName,
        string inviterName,
        string rawToken,
        DateTime expiresAt,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Notifies a tenant administrator that an extra paid seat could not be added when an
    /// invitee accepted an over-allotment invitation (for example, the billing update was
    /// declined). The invitee was not added; the admin should resolve billing and re-invite.
    /// </summary>
    /// <param name="email">Recipient (tenant administrator) email address.</param>
    /// <param name="tenantDisplayName">Tenant display name.</param>
    /// <param name="inviteeEmail">Email address of the invitee whose seat could not be added.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    Task SendSeatPurchaseFailedAsync(string email, string tenantDisplayName, string inviteeEmail, CancellationToken cancellationToken = default);
}

