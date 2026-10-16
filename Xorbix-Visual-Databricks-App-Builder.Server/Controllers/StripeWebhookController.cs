using FluentResults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Handles inbound Stripe webhook callbacks.
/// </summary>
[AllowAnonymous]
[ApiController]
[Route("api/stripe")]
public class StripeWebhookController(
    ILogger<StripeWebhookController> _logger,
    IStripeWebhookService _stripeWebhookService) : ControllerBase
{
    /// <summary>
    /// Handles Stripe webhook callbacks.
    /// </summary>
    /// <returns>Success when webhook is processed or already handled.</returns>
    [HttpPost("webhook")]
    public async Task<IActionResult> HandleWebhook(
        [FromHeader(Name = "Stripe-Signature")] string signature,
        CancellationToken cancellationToken = default)
    {
        string payload;
        using (StreamReader reader = new StreamReader(Request.Body, Encoding.UTF8))
        {
            payload = await reader.ReadToEndAsync(cancellationToken);
        }

        _logger.LogInformation(
            "Received Stripe webhook payload. Signature present: {HasSignature}",
            !string.IsNullOrWhiteSpace(signature));

        Result result = await _stripeWebhookService.HandleWebhookAsync(payload, signature, cancellationToken);
        return this.HandleFluentResult(result);
    }
}
