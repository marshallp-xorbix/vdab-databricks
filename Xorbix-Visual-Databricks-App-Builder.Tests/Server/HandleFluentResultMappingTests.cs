using FluentResults;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Server;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Server;

/// <summary>
/// Pins the HTTP shape <c>HandleFluentResult</c> produces for the verification-throttle error family:
/// the 429 mapping, the <c>Retry-After</c> header, and the <c>remainingAttempts</c> / <c>retryAfter</c>
/// ProblemDetails extensions the SPA reads. The service layer only asserts the error objects themselves;
/// this covers the controller-mapping seam the arithmetic and header write actually live at.
/// </summary>
public class HandleFluentResultMappingTests
{
    private sealed class TestController : ControllerBase;

    /// <summary>
    /// A controller with a real <see cref="DefaultHttpContext"/> (via <see cref="ControllerTestHelpers"/>),
    /// so the <c>Retry-After</c> header write in the throttled branch has a response to write to.
    /// </summary>
    private static TestController CreateController() =>
        new()
        {
            ControllerContext = ControllerTestHelpers.BuildContext(Guid.NewGuid(), tenantId: null),
        };

    private static ProblemDetails ProblemOf(ActionResult response) =>
        Assert.IsType<ProblemDetails>(Assert.IsType<ObjectResult>(response).Value);

    [Fact]
    public void HandleFluentResult_ForTooManyRequestsError_MapsTo429WithRetryAfterHeaderAndExtension()
    {
        TestController controller = CreateController();
        DateTime retryAfterUtc = DateTime.UtcNow.AddSeconds(60);

        ActionResult response = controller.HandleFluentResult(
            Result.Fail(new TooManyRequestsError("Too many requests.", retryAfterUtc)));

        Assert.Equal(StatusCodes.Status429TooManyRequests, ControllerTestHelpers.StatusCodeOf(response));

        // The body carries the absolute retry instant (a boxed DateTime) the client parses as a date.
        ProblemDetails problem = ProblemOf(response);
        DateTime retryAfterExtension = Assert.IsType<DateTime>(problem.Extensions["retryAfter"]);
        Assert.Equal(retryAfterUtc, retryAfterExtension, TimeSpan.FromSeconds(1));

        // The header carries the same instant as a whole-second delta (RFC 9110), clamped non-negative.
        string retryAfterHeader = controller.HttpContext.Response.Headers.RetryAfter.ToString();
        Assert.True(int.TryParse(retryAfterHeader, out int seconds));
        Assert.InRange(seconds, 55, 60);
    }

    [Fact]
    public void HandleFluentResult_ForVerificationAttemptsError_MapsTo401WithRemainingAttempts()
    {
        TestController controller = CreateController();

        ActionResult response = controller.HandleFluentResult(
            Result.Fail(new VerificationAttemptsError("Invalid verification code. 3 attempts remaining.", 3)));

        // Unauthorized outranks 429 in the mapping, so a rejected-but-not-spent code is a plain 401.
        Assert.Equal(StatusCodes.Status401Unauthorized, ControllerTestHelpers.StatusCodeOf(response));
        Assert.Equal(3, Assert.IsType<int>(ProblemOf(response).Extensions["remainingAttempts"]));
    }

    [Fact]
    public void HandleFluentResult_ForVerificationCodeExhaustedError_MapsTo400WithZeroRemainingAttempts()
    {
        TestController controller = CreateController();

        ActionResult response = controller.HandleFluentResult(
            Result.Fail(new VerificationCodeExhaustedError("Maximum verification attempts exceeded.")));

        Assert.Equal(StatusCodes.Status400BadRequest, ControllerTestHelpers.StatusCodeOf(response));
        Assert.Equal(0, Assert.IsType<int>(ProblemOf(response).Extensions["remainingAttempts"]));
    }
}
