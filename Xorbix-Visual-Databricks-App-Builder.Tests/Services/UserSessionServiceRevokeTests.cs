using FluentResults;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Services;

/// <summary>
/// Verifies user session revocation revokes the full rotation chain and reports caller impact.
/// </summary>
public class UserSessionServiceRevokeTests
{
    private static RefreshTokenRevokeInfo CreateRevokeInfo(
        int liveTokenId,
        Guid userId,
        Guid sessionId,
        bool isRevoked = false) =>
        new()
        {
            Id = liveTokenId,
            UserId = userId,
            SessionId = sessionId,
            IsRevoked = isRevoked,
        };

    [Fact]
    public async Task RevokeSessionAsync_RevokesEntireSessionChain()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        int liveTokenId = 42;
        Guid adminId = Guid.NewGuid();

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.GetRevokeInfoByIdAsync(liveTokenId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateRevokeInfo(liveTokenId, userId, sessionId));
        refreshTokenRepository
            .Setup(repository => repository.RevokeSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(2);

        UserSessionService service = new(
            NullLogger<UserSessionService>.Instance,
            refreshTokenRepository.Object,
            Mock.Of<IGeoLocationService>());

        Result<Models.DTOs.User.RevokeSessionResponse> result = await service.RevokeSessionAsync(
            userId, liveTokenId, adminId, callerSessionId: null);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.RevokedCurrentSession);
        refreshTokenRepository.Verify(
            repository => repository.RevokeSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()),
            Times.Once);
        refreshTokenRepository.Verify(
            repository => repository.RevokeByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RevokeSessionAsync_WhenCallerSessionMatches_ReturnsRevokedCurrentSessionTrue()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        int liveTokenId = 7;

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.GetRevokeInfoByIdAsync(liveTokenId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateRevokeInfo(liveTokenId, userId, sessionId));
        refreshTokenRepository
            .Setup(repository => repository.RevokeSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(1);

        UserSessionService service = new(
            NullLogger<UserSessionService>.Instance,
            refreshTokenRepository.Object,
            Mock.Of<IGeoLocationService>());

        Result<Models.DTOs.User.RevokeSessionResponse> result = await service.RevokeSessionAsync(
            userId, liveTokenId, Guid.NewGuid(), callerSessionId: sessionId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.RevokedCurrentSession);
    }

    [Fact]
    public async Task RevokeSessionAsync_WhenTokenNotFound_ReturnsNotFound()
    {
        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.GetRevokeInfoByIdAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((RefreshTokenRevokeInfo?)null);

        UserSessionService service = new(
            NullLogger<UserSessionService>.Instance,
            refreshTokenRepository.Object,
            Mock.Of<IGeoLocationService>());

        Result<Models.DTOs.User.RevokeSessionResponse> result = await service.RevokeSessionAsync(
            Guid.NewGuid(), 99, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }

    [Fact]
    public async Task RevokeSessionAsync_WhenTokenAlreadyRevoked_ReturnsSuccessWithoutRevokingAgain()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        int liveTokenId = 55;

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.GetRevokeInfoByIdAsync(liveTokenId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateRevokeInfo(liveTokenId, userId, sessionId, isRevoked: true));

        UserSessionService service = new(
            NullLogger<UserSessionService>.Instance,
            refreshTokenRepository.Object,
            Mock.Of<IGeoLocationService>());

        Result<Models.DTOs.User.RevokeSessionResponse> result = await service.RevokeSessionAsync(
            userId, liveTokenId, Guid.NewGuid(), callerSessionId: sessionId);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.RevokedCurrentSession);
        refreshTokenRepository.Verify(
            repository => repository.RevokeSessionAsync(
                It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task RevokeSessionAsync_WhenRevokeCountIsZero_ReturnsNotFound()
    {
        Guid userId = Guid.NewGuid();
        Guid sessionId = Guid.NewGuid();
        int liveTokenId = 61;

        Mock<IRefreshTokenRepository> refreshTokenRepository = new();
        refreshTokenRepository
            .Setup(repository => repository.GetRevokeInfoByIdAsync(liveTokenId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateRevokeInfo(liveTokenId, userId, sessionId));
        refreshTokenRepository
            .Setup(repository => repository.RevokeSessionAsync(userId, sessionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        UserSessionService service = new(
            NullLogger<UserSessionService>.Instance,
            refreshTokenRepository.Object,
            Mock.Of<IGeoLocationService>());

        Result<Models.DTOs.User.RevokeSessionResponse> result = await service.RevokeSessionAsync(
            userId, liveTokenId, Guid.NewGuid());

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<NotFoundError>());
    }
}
