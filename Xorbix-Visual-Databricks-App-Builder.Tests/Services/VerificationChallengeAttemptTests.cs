using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies the per-code attempt budget: the caller gets four submissions, the final one is a real
/// chance to get it right rather than a submission rejected unread, the remaining count is reported
/// so the client never hard-codes the limit, and the unknown-user path stays indistinguishable from
/// the expired-code path.
/// </summary>
public class VerificationChallengeAttemptTests
{
    private const string Email = "user@example.com";
    private const string CodeKey = "passwordless_code:user@example.com";
    private const string AttemptsKey = "passwordless_attempts:user@example.com";
    private const string ValidCode = "123456";
    private const string WrongCode = "000000";
    private const int MaxAttempts = 4; // mirrors VerificationChallengeService.MaxVerificationAttempts

    private static Mock<UserManager<ApplicationUser>> CreateUserManagerMock() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    private static IDistributedCache CreateCache() =>
        new MemoryDistributedCache(Options.Create(new MemoryDistributedCacheOptions()));

    private static ApplicationUser ActiveUser() =>
        new()
        {
            Id = Guid.NewGuid(),
            Email = Email,
            UserName = Email,
            IsActive = true,
            EmailConfirmed = true,
            UsePasswordlessLogin = true,
        };

    private static VerificationChallengeService CreateService(
        IDistributedCache cache,
        Mock<UserManager<ApplicationUser>> userManager,
        IAuthResponseService? authResponseService = null) =>
        new(
            NullLogger<VerificationChallengeService>.Instance,
            userManager.Object,
            Mock.Of<IEmailSenderService>(),
            cache,
            authResponseService ?? Mock.Of<IAuthResponseService>(),
            new AccountAccessPolicy(),
            new VerificationThrottleService(NullLogger<VerificationThrottleService>.Instance, cache),
            Options.Create(new DebugConfiguration { Skip2FA = false }));

    private static async Task<VerificationChallengeService> CreateServiceWithLiveCodeAsync(
        IDistributedCache cache,
        Mock<UserManager<ApplicationUser>> userManager,
        IAuthResponseService? authResponseService = null)
    {
        await cache.SetStringAsync(CodeKey, ValidCode);
        await cache.SetStringAsync(AttemptsKey, "0");
        return CreateService(cache, userManager, authResponseService);
    }

    [Theory]
    [InlineData(1, 3)]
    [InlineData(2, 2)]
    [InlineData(3, 1)]
    public async Task VerifyCodeAndAuthenticateAsync_ReportsRemainingAttemptsAfterEachWrongCode(
        int wrongSubmissions,
        int expectedRemaining)
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        IDistributedCache cache = CreateCache();
        VerificationChallengeService service = await CreateServiceWithLiveCodeAsync(cache, userManager);

        Result<AuthResponse> result = Result.Ok();
        for (int submission = 0; submission < wrongSubmissions; submission++)
        {
            result = await service.VerifyCodeAndAuthenticateAsync(Email, WrongCode);
        }

        VerificationAttemptsError error = Assert.Single(result.Errors.OfType<VerificationAttemptsError>());
        Assert.Equal(expectedRemaining, error.RemainingAttempts);
    }

    [Fact]
    public async Task VerifyCodeAndAuthenticateAsync_OnFourthWrongCode_ExhaustsAndInvalidatesTheCode()
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        IDistributedCache cache = CreateCache();
        VerificationChallengeService service = await CreateServiceWithLiveCodeAsync(cache, userManager);

        Result<AuthResponse> result = Result.Ok();
        for (int submission = 0; submission < 4; submission++)
        {
            result = await service.VerifyCodeAndAuthenticateAsync(Email, WrongCode);
        }

        VerificationCodeExhaustedError error = Assert.Single(result.Errors.OfType<VerificationCodeExhaustedError>());
        Assert.Equal(0, error.RemainingAttempts);
        Assert.Null(await cache.GetStringAsync(CodeKey));
    }

    [Fact]
    public async Task VerifyCodeAndAuthenticateAsync_OnFourthSubmission_StillAcceptsTheCorrectCode()
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);
        userManager.Setup(manager => manager.UpdateAsync(user)).ReturnsAsync(IdentityResult.Success);

        AuthResponse expected = new()
        {
            AccessToken = "access",
            RefreshToken = "refresh",
            ExpiresAt = DateTime.UtcNow.AddDays(1),
        };

        Mock<IAuthResponseService> authResponseService = new();
        authResponseService
            .Setup(responseService => responseService.GenerateAuthResponseAsync(
                user,
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<VerificationChallengeResponse?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok(expected));

        IDistributedCache cache = CreateCache();
        VerificationChallengeService service =
            await CreateServiceWithLiveCodeAsync(cache, userManager, authResponseService.Object);

        // Burn the first three, then get it right on the last allowed submission.
        for (int submission = 0; submission < 3; submission++)
        {
            await service.VerifyCodeAndAuthenticateAsync(Email, WrongCode);
        }

        Result<AuthResponse> result = await service.VerifyCodeAndAuthenticateAsync(Email, ValidCode);

        Assert.True(result.IsSuccess, string.Join(" | ", result.Errors.Select(error => error.Message)));
        Assert.Equal("access", result.Value.AccessToken);
    }

    [Fact]
    public async Task VerifyCodeAndAuthenticateAsync_WrongCodeUnknownUserAndExpiredCode_AreIndistinguishable()
    {
        // 1) Real, eligible account with a live code — the caller simply guesses wrong.
        ApplicationUser liveUser = ActiveUser();
        Mock<UserManager<ApplicationUser>> liveManager = CreateUserManagerMock();
        liveManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(liveUser);
        VerificationChallengeService liveService =
            await CreateServiceWithLiveCodeAsync(CreateCache(), liveManager);
        Result<AuthResponse> wrongCodeOnLiveCode = await liveService.VerifyCodeAndAuthenticateAsync(Email, WrongCode);

        // 2) Real, active account that has no live code (expired / never issued).
        Mock<UserManager<ApplicationUser>> noCodeManager = CreateUserManagerMock();
        noCodeManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(ActiveUser());
        Result<AuthResponse> expiredCode =
            await CreateService(CreateCache(), noCodeManager).VerifyCodeAndAuthenticateAsync(Email, WrongCode);

        // 3) No account at all.
        Mock<UserManager<ApplicationUser>> unknownManager = CreateUserManagerMock();
        unknownManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync((ApplicationUser?)null);
        Result<AuthResponse> unknownUser =
            await CreateService(CreateCache(), unknownManager).VerifyCodeAndAuthenticateAsync(Email, WrongCode);

        // All three walk the identical first-wrong-attempt response — a 401-mapped VerificationAttemptsError
        // with the same remaining count — so 401 no longer fingerprints an eligible account.
        foreach (Result<AuthResponse> result in new[] { wrongCodeOnLiveCode, expiredCode, unknownUser })
        {
            VerificationAttemptsError error = Assert.Single(result.Errors.OfType<VerificationAttemptsError>());
            Assert.Equal(3, error.RemainingAttempts);
        }

        // ...and the same message, so the response body leaks nothing either.
        Assert.Equal(wrongCodeOnLiveCode.Errors[0].Message, expiredCode.Errors[0].Message);
        Assert.Equal(wrongCodeOnLiveCode.Errors[0].Message, unknownUser.Errors[0].Message);
    }

    [Fact]
    public async Task VerifyCodeAndAuthenticateAsync_ForUnknownUser_ExhaustsIdenticallyToARealAccount()
    {
        Mock<UserManager<ApplicationUser>> unknownManager = CreateUserManagerMock();
        unknownManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync((ApplicationUser?)null);
        VerificationChallengeService service = CreateService(CreateCache(), unknownManager);

        // Four wrong attempts against an address with no account spend the same phantom budget a real
        // account has, ending in the same exhausted response a spent real code returns.
        Result<AuthResponse> result = Result.Ok();
        for (int submission = 0; submission < 4; submission++)
        {
            result = await service.VerifyCodeAndAuthenticateAsync(Email, WrongCode);
        }

        Assert.True(result.HasError<VerificationCodeExhaustedError>());

        // Exhaustion is sticky: a further probe still returns exhausted, exactly as a real spent code does.
        Result<AuthResponse> afterExhaustion = await service.VerifyCodeAndAuthenticateAsync(Email, WrongCode);
        Assert.True(afterExhaustion.HasError<VerificationCodeExhaustedError>());
    }

    [Fact]
    public async Task SendVerificationCodeAsync_ResetsTheAttemptBudgetForAnyAddress()
    {
        // An unknown address whose phantom budget was already exhausted...
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((ApplicationUser?)null);
        IDistributedCache cache = CreateCache();
        await cache.SetStringAsync(AttemptsKey, "4"); // a spent budget (MaxVerificationAttempts)
        VerificationChallengeService service = CreateService(cache, userManager);

        // ...is handed a clean budget by a fresh issuance, just like a real account would be, so an
        // attacker can't use "exhaust → re-issue → probe" to tell an account from a non-account.
        await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);

        Assert.Equal("0", await cache.GetStringAsync(AttemptsKey));
    }

    [Fact]
    public async Task SendVerificationCodeAsync_WhenInsideBackoff_ReturnsTooManyRequests()
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        VerificationChallengeService service = CreateService(CreateCache(), userManager);

        Result<VerificationChallengeResponse> first = await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);
        Result<VerificationChallengeResponse> second = await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);

        Assert.True(first.IsSuccess);
        Assert.True(first.Value.ResendAvailableAt > DateTime.UtcNow);
        Assert.True(second.IsFailed);
        Assert.True(second.HasError<TooManyRequestsError>());
    }

    [Fact]
    public async Task SendVerificationCodeAsync_PasswordVerifiedSend_IsNotThrottledByAnonymousTraffic()
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        VerificationChallengeService service = CreateService(CreateCache(), userManager);

        // An attacker who knows the address floods the anonymous endpoint (no user supplied) until it
        // backs off — mirroring the throttle-poisoning attack this isolation defends against.
        Result<VerificationChallengeResponse> anonymousFirst = await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);
        Result<VerificationChallengeResponse> anonymousSecond = await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);

        // The user then supplies the correct password; that 2FA send hands in the resolved user, so it
        // must go through on its own bucket rather than inheriting the poisoned anonymous backoff.
        Result<VerificationChallengeResponse> passwordVerified =
            await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.PasswordVerified, user);

        Assert.True(anonymousFirst.IsSuccess);
        Assert.True(anonymousSecond.IsFailed);
        Assert.True(anonymousSecond.HasError<TooManyRequestsError>());
        Assert.True(passwordVerified.IsSuccess);
    }

    [Fact]
    public async Task SendVerificationCodeAsync_TwoFactorResend_IsNotThrottledByAnonymousTraffic()
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        VerificationChallengeService service = CreateService(CreateCache(), userManager);

        // An attacker floods the anonymous passwordless bucket for this address.
        Result<VerificationChallengeResponse> anonymousFirst =
            await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);
        Result<VerificationChallengeResponse> anonymousSecond =
            await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);

        // A user mid-login resending their 2FA code runs on the resend bucket, so the flood can't
        // starve it.
        Result<VerificationChallengeResponse> resend =
            await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.TwoFactorResend);

        Assert.True(anonymousFirst.IsSuccess);
        Assert.True(anonymousSecond.IsFailed);
        Assert.True(anonymousSecond.HasError<TooManyRequestsError>());
        Assert.True(resend.IsSuccess);
    }

    [Fact]
    public async Task SendVerificationCodeAsync_ForUnknownEmail_IsThrottledLikeARealAccount()
    {
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(It.IsAny<string>())).ReturnsAsync((ApplicationUser?)null);

        VerificationChallengeService service = CreateService(CreateCache(), userManager);

        Result<VerificationChallengeResponse> first = await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);
        Result<VerificationChallengeResponse> second = await service.SendVerificationCodeAsync(Email, VerificationIssuanceScope.Anonymous);

        // Throttling runs before the user lookup, so an unknown address behaves exactly like a real
        // one — the 429 cannot be used to probe which addresses have accounts.
        Assert.True(first.IsSuccess);
        Assert.True(second.IsFailed);
        Assert.True(second.HasError<TooManyRequestsError>());
    }

    [Fact]
    public async Task VerifyCodeAndAuthenticateAsync_UnderConcurrentWrongGuesses_HonorsTheAttemptBudget()
    {
        ApplicationUser user = ActiveUser();
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByEmailAsync(Email)).ReturnsAsync(user);

        IDistributedCache cache = CreateCache();
        VerificationChallengeService service = await CreateServiceWithLiveCodeAsync(cache, userManager);

        // Fire many wrong guesses at one live code at once, released together so their read-check-write
        // windows overlap. Without serialization they would each read attempts=0, all pass the budget
        // check, and all be evaluated against the live code — hundreds of guesses for one increment.
        const int burst = 30;
        using SemaphoreSlim start = new(0, burst);
        Task<Result<AuthResponse>>[] guesses = Enumerable
            .Range(0, burst)
            .Select(_ => Task.Run(async () =>
            {
                await start.WaitAsync();
                return await service.VerifyCodeAndAuthenticateAsync(Email, WrongCode);
            }))
            .ToArray();

        start.Release(burst);
        Result<AuthResponse>[] results = await Task.WhenAll(guesses);

        // Only the budgeted guesses get a "wrong, N remaining" response (the final one flips to
        // exhausted); every excess submission is rejected as exhausted, never evaluated against the code.
        int countedWrongGuesses = results.Count(result => result.HasError<VerificationAttemptsError>());
        Assert.True(
            countedWrongGuesses <= MaxAttempts - 1,
            $"Expected at most {MaxAttempts - 1} counted wrong guesses; got {countedWrongGuesses}.");

        // The persisted budget caps at the limit and the spent code is invalidated.
        Assert.Equal(MaxAttempts.ToString(), await cache.GetStringAsync(AttemptsKey));
        Assert.Null(await cache.GetStringAsync(CodeKey));
    }
}
