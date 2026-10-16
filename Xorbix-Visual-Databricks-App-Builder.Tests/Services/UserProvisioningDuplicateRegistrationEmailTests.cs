using FluentResults;
using Microsoft.AspNetCore.Identity;
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
/// Covers duplicate-registration notification link behavior under PasswordlessOnly.
/// </summary>
public class UserProvisioningDuplicateRegistrationEmailTests
{
    [Fact]
    public async Task CreateUserAsync_DuplicateSelfRegistration_WhenPasswordlessOnly_SendsPasswordlessLink()
    {
        ApplicationUser existing = new()
        {
            Id = Guid.NewGuid(),
            Email = "dup@example.com",
            UserName = "dup@example.com",
        };

        Mock<UserManager<ApplicationUser>> userManager = new(
            Mock.Of<IUserStore<ApplicationUser>>(),
            null!, null!, null!, null!, null!, null!, null!, null!);
        userManager.Setup(m => m.FindByEmailAsync(existing.Email)).ReturnsAsync(existing);

        Mock<IEmailSenderService> emailSender = new();
        emailSender
            .Setup(s => s.SendDuplicateRegistrationAttemptAsync(
                existing,
                existing.Email!,
                null,
                true,
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserProvisioningService sut = new(
            NullLogger<UserProvisioningService>.Instance,
            userManager.Object,
            emailSender.Object,
            Mock.Of<ITenantService>(),
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<ISeatManagementService>(),
            Mock.Of<IUserLifecycleService>(),
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = true }));

        Result<ApplicationUser> result = await sut.CreateUserAsync(
            new RegisterRequest
            {
                Email = existing.Email!,
                FirstName = "Dup",
                LastName = "User",
            },
            createdByUserId: null);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<IdentityDuplicateError>());
        emailSender.Verify(
            s => s.SendDuplicateRegistrationAttemptAsync(
                existing,
                existing.Email!,
                null,
                true,
                It.IsAny<CancellationToken>()),
            Times.Once);
        userManager.Verify(m => m.GeneratePasswordResetTokenAsync(It.IsAny<ApplicationUser>()), Times.Never);
    }

    [Fact]
    public async Task CreateUserAsync_DuplicateSelfRegistration_WhenPasswordBased_SendsResetParams()
    {
        ApplicationUser existing = new()
        {
            Id = Guid.NewGuid(),
            Email = "dup@example.com",
            UserName = "dup@example.com",
        };

        Mock<UserManager<ApplicationUser>> userManager = new(
            Mock.Of<IUserStore<ApplicationUser>>(),
            null!, null!, null!, null!, null!, null!, null!, null!);
        userManager.Setup(m => m.FindByEmailAsync(existing.Email)).ReturnsAsync(existing);
        userManager
            .Setup(m => m.GeneratePasswordResetTokenAsync(existing))
            .ReturnsAsync("reset-token");

        Mock<IEmailSenderService> emailSender = new();
        emailSender
            .Setup(s => s.SendDuplicateRegistrationAttemptAsync(
                existing,
                existing.Email!,
                It.IsAny<string?>(),
                false,
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserProvisioningService sut = new(
            NullLogger<UserProvisioningService>.Instance,
            userManager.Object,
            emailSender.Object,
            Mock.Of<ITenantService>(),
            Mock.Of<IUserTenantMembershipService>(),
            Mock.Of<ISeatManagementService>(),
            Mock.Of<IUserLifecycleService>(),
            Options.Create(new PolicyConsentConfiguration()),
            Options.Create(new AuthenticationConfiguration { PasswordlessOnly = false }));

        Result<ApplicationUser> result = await sut.CreateUserAsync(
            new RegisterRequest
            {
                Email = existing.Email!,
                FirstName = "Dup",
                LastName = "User",
            },
            createdByUserId: null);

        Assert.True(result.IsFailed);
        emailSender.Verify(
            s => s.SendDuplicateRegistrationAttemptAsync(
                existing,
                existing.Email!,
                It.Is<string?>(p => p != null && p.Contains("resetToken", StringComparison.Ordinal)),
                false,
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
