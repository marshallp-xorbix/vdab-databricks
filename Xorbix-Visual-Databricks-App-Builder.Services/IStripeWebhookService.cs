using FluentResults;
using Stripe;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Handles incoming Stripe webhook events.
/// </summary>
public interface IStripeWebhookService
{
    /// <summary>
    /// Validates and processes an incoming Stripe webhook payload.
    /// </summary>
    /// <param name="payload">Raw webhook payload JSON.</param>
    /// <param name="signature">Stripe-Signature header value.</param>
    /// <param name="cancellationToken">The cancellation token for the operation.</param>
    /// <returns>Success when the event is processed or already handled.</returns>
    Task<Result> HandleWebhookAsync(string payload, string signature, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates Stripe webhook signature and parses the Stripe event.
    /// </summary>
    /// <param name="payload">Raw webhook payload JSON.</param>
    /// <param name="signature">Stripe-Signature header value.</param>
    /// <returns>The parsed Stripe event when validation succeeds.</returns>
    Result<Event> ValidateSignatureAsync(string payload, string signature);
}
