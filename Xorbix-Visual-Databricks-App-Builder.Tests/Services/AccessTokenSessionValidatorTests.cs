using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies access-token session binding validation against security stamp and active sessions.
/// </summary>
public class AccessTokenSessionValidatorTests
{
    private static Mock<UserManager<ApplicationUser>> CreateUserManagerMock() =>
        new(Mock.Of<IUserStore<ApplicationUser>>(), null!, null!, null!, null!, null!, null!, null!, null!);

    private static AccessTokenSessionValidator CreateValidator(
        UserManager<ApplicationUser> userManager,
        IRefreshTokenRepository refreshTokenRepository,
        IMemoryCache? memoryCache = null) =>
        new(
            NullLogger<AccessTokenSessionValidator>.Instance,
            userManager,
            refreshTokenRepository,
            memoryCache ?? new MemoryCache(new MemoryCacheOptions()),
            new AccountAccessPolicy());

    [Fact]
    public async Task ValidateAsync_WhenSecurityStampMatchesAndSessionActive_ReturnsTrue()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "stamp-123",
            IsActive = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.HasActiveSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", sessionId.ToString());

        Assert.True(isValid);
    }

    [Fact]
    public async Task ValidateAsync_WhenSecurityStampMismatch_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "current-stamp",
            IsActive = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "old-stamp", sessionId.ToString());

        Assert.False(isValid);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenSessionInactive_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "stamp-123",
            IsActive = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.HasActiveSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", sessionId.ToString());

        Assert.False(isValid);
    }

    [Fact]
    public async Task ValidateAsync_WhenClaimsMissing_ReturnsFalse()
    {
        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(Guid.NewGuid(), null, null);

        Assert.False(isValid);
        userManager.Verify(
            manager => manager.FindByIdAsync(It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenUserNotFound_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync((ApplicationUser?)null);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", sessionId.ToString());

        Assert.False(isValid);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenUserInactive_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "stamp-123",
            IsActive = false,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", sessionId.ToString());

        Assert.False(isValid);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenUserRetired_IsActiveTrueDeletedOnSet_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "stamp-123",
            IsActive = true,
            DeletedOn = DateTime.UtcNow,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", sessionId.ToString());

        Assert.False(isValid);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenUserAnonymized_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "stamp-123",
            IsActive = true,
            AnonymizedOn = DateTime.UtcNow,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", sessionId.ToString());

        Assert.False(isValid);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenSessionIdClaimInvalid_ReturnsFalse()
    {
        Guid userId = Guid.NewGuid();

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object);

        bool isValid = await validator.ValidateAsync(userId, "stamp-123", "not-a-guid");

        Assert.False(isValid);
        userManager.Verify(
            manager => manager.FindByIdAsync(It.IsAny<string>()),
            Times.Never);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task ValidateAsync_WhenCacheHit_SkipsDatabaseLookups()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        const string securityStamp = "stamp-123";
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = securityStamp,
            IsActive = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.HasActiveSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        MemoryCache memoryCache = new(new MemoryCacheOptions());
        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object,
            memoryCache);

        Assert.True(await validator.ValidateAsync(userId, securityStamp, sessionId.ToString()));
        Assert.True(await validator.ValidateAsync(userId, securityStamp, sessionId.ToString()));

        userManager.Verify(manager => manager.FindByIdAsync(userId.ToString()), Times.Once);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task ValidateAsync_WhenFailureCached_SkipsDatabaseLookups()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        const string securityStamp = "old-stamp";
        ApplicationUser user = new()
        {
            Id = userId,
            SecurityStamp = "current-stamp",
            IsActive = true,
        };

        Mock<UserManager<ApplicationUser>> userManager = CreateUserManagerMock();
        userManager.Setup(manager => manager.FindByIdAsync(userId.ToString())).ReturnsAsync(user);

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();

        MemoryCache memoryCache = new(new MemoryCacheOptions());
        AccessTokenSessionValidator validator = CreateValidator(
            userManager.Object,
            refreshTokenRepository.Object,
            memoryCache);

        Assert.False(await validator.ValidateAsync(userId, securityStamp, sessionId.ToString()));
        Assert.False(await validator.ValidateAsync(userId, securityStamp, sessionId.ToString()));

        userManager.Verify(manager => manager.FindByIdAsync(userId.ToString()), Times.Once);
        refreshTokenRepository.Verify(
            repository => repository.HasActiveSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
