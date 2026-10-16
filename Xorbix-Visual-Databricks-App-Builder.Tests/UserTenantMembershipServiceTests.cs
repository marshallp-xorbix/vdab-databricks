using FluentResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Npgsql;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class UserTenantMembershipServiceTests
{
    [Fact]
    public async Task AddUserToTenantAsync_FirstMembership_SetsDefaultMembership()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        membershipRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());

        UserTenantMembership? capturedAddedMembership = null;
        membershipRepository
            .Setup(repository => repository.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Callback<UserTenantMembership, CancellationToken>((membership, _) => capturedAddedMembership = membership)
            .ReturnsAsync((UserTenantMembership membership, CancellationToken _) => membership);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result<UserTenantMembership> result = await service.AddUserToTenantAsync(
            userId,
            tenantId,
            AuthRoles.Developer,
            isDefault: false,
            addedByUserId: null,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedAddedMembership);
        Assert.True(capturedAddedMembership.IsDefault);
        membershipRepository.Verify(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()), Times.Never);
        membershipRepository.Verify(
            repository => repository.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AddUserToTenantAsync_SoftDeletedMembershipExists_ReactivatesMembership()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid addedByUserId = Guid.NewGuid();

        UserTenantMembership softDeletedMembership = new UserTenantMembership
        {
            Id = 42,
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            IsDefault = false,
            DeletedOn = DateTime.UtcNow.AddDays(-1),
            DeletedBy = Guid.NewGuid(),
        };

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        membershipRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        membershipRepository
            .Setup(repository => repository.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeletedMembership);
        membershipRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result<UserTenantMembership> result = await service.AddUserToTenantAsync(
            userId,
            tenantId,
            AuthRoles.TenantAdmin,
            isDefault: false,
            addedByUserId: addedByUserId,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(softDeletedMembership, result.Value);
        Assert.Null(softDeletedMembership.DeletedOn);
        Assert.Null(softDeletedMembership.DeletedBy);
        Assert.Equal(AuthRoles.Developer, softDeletedMembership.Role);
        Assert.True(softDeletedMembership.IsDefault);
        Assert.Equal(addedByUserId, softDeletedMembership.ModifiedBy);
        membershipRepository.Verify(
            repository => repository.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()),
            Times.Never);
        membershipRepository.Verify(
            repository => repository.UpdateAsync(softDeletedMembership, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task AddUserToTenantWithinTransactionAsync_SoftDeletedMembershipExists_ReactivatesMembership()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid addedByUserId = Guid.NewGuid();

        UserTenantMembership softDeletedMembership = new UserTenantMembership
        {
            Id = 42,
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            Status = MembershipStatus.Ended,
            IsDefault = false,
            DeletedOn = DateTime.UtcNow.AddDays(-1),
            DeletedBy = Guid.NewGuid(),
        };

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        membershipRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        membershipRepository
            .Setup(repository => repository.GetSoftDeletedByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(softDeletedMembership);
        membershipRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result<UserTenantMembership> result = await service.AddUserToTenantWithinTransactionAsync(
            userId,
            tenantId,
            AuthRoles.Developer,
            isDefault: false,
            addedByUserId: addedByUserId,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Same(softDeletedMembership, result.Value);
        Assert.Null(softDeletedMembership.DeletedOn);
        Assert.Equal(MembershipStatus.Active, softDeletedMembership.Status);
        Assert.True(softDeletedMembership.IsDefault);
        membershipRepository.Verify(
            repository => repository.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()),
            Times.Never);
        membershipRepository.Verify(
            repository => repository.UpdateAsync(softDeletedMembership, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task SetDefaultTenantAsync_AlreadyDefault_SucceedsWithoutError()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        UserTenantMembership membership = new UserTenantMembership
        {
            Id = 7,
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            Status = MembershipStatus.Active,
            IsDefault = true,
        };

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(membership);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result result = await service.SetDefaultTenantAsync(userId, tenantId);

        Assert.True(result.IsSuccess);
        membershipRepository.Verify(
            repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task AddUserToTenantAsync_DefaultRequested_ClearsExistingDefaultBeforeInsert()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid addedByUserId = Guid.NewGuid();

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        UserTenantMembership existingMembership = new UserTenantMembership
        {
            Id = 1,
            UserId = userId,
            TenantId = Guid.NewGuid(),
            Role = AuthRoles.Developer,
            IsDefault = false
        };

        UserTenantMembership previousDefaultMembership = new UserTenantMembership
        {
            Id = 2,
            UserId = userId,
            TenantId = Guid.NewGuid(),
            Role = AuthRoles.TenantAdmin,
            IsDefault = true
        };

        membershipRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([existingMembership]);
        membershipRepository
            .Setup(repository => repository.GetUserDefaultTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(previousDefaultMembership);

        UserTenantMembership? capturedAddedMembership = null;
        membershipRepository
            .Setup(repository => repository.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Callback<UserTenantMembership, CancellationToken>((membership, _) => capturedAddedMembership = membership)
            .ReturnsAsync((UserTenantMembership membership, CancellationToken _) => membership);

        membershipRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result<UserTenantMembership> result = await service.AddUserToTenantAsync(
            userId,
            tenantId,
            AuthRoles.Developer,
            isDefault: true,
            addedByUserId: addedByUserId,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.NotNull(capturedAddedMembership);
        Assert.True(capturedAddedMembership.IsDefault);
        Assert.False(previousDefaultMembership.IsDefault);
        Assert.Equal(addedByUserId, previousDefaultMembership.ModifiedBy);
        membershipRepository.Verify(repository => repository.UpdateAsync(
            It.Is<UserTenantMembership>(membership => membership.Id == previousDefaultMembership.Id),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RemoveUserFromTenantAsync_RemovingDefault_PromotesEarliestJoinedMembership()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        UserTenantMembership removedMembership = new UserTenantMembership
        {
            Id = 10,
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            IsDefault = true
        };

        UserTenantMembership earliestJoinedMembership = new UserTenantMembership
        {
            Id = 11,
            UserId = userId,
            TenantId = Guid.NewGuid(),
            Role = AuthRoles.Developer,
            IsDefault = false,
            JoinedAt = DateTime.UtcNow.AddDays(-30)
        };

        UserTenantMembership laterJoinedMembership = new UserTenantMembership
        {
            Id = 12,
            UserId = userId,
            TenantId = Guid.NewGuid(),
            Role = AuthRoles.TenantAdmin,
            IsDefault = false,
            JoinedAt = DateTime.UtcNow.AddDays(-1)
        };

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(removedMembership);
        membershipRepository
            .Setup(repository => repository.RemoveAsync(
                userId, tenantId, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        membershipRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([laterJoinedMembership, earliestJoinedMembership]);

        membershipRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result result = await service.RemoveUserFromTenantAsync(
            userId, tenantId, cancellationToken: CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(earliestJoinedMembership.IsDefault);
        membershipRepository.Verify(repository => repository.UpdateAsync(
            It.Is<UserTenantMembership>(membership => membership.Id == earliestJoinedMembership.Id && membership.IsDefault),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SetDefaultTenantAsync_UpdatesPreviousAndRequestedMemberships()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        UserTenantMembership requestedMembership = new UserTenantMembership
        {
            Id = 20,
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            IsDefault = false
        };

        UserTenantMembership previousDefaultMembership = new UserTenantMembership
        {
            Id = 21,
            UserId = userId,
            TenantId = Guid.NewGuid(),
            Role = AuthRoles.TenantAdmin,
            IsDefault = true
        };

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(requestedMembership);
        membershipRepository
            .Setup(repository => repository.GetUserDefaultTenantAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(previousDefaultMembership);
        membershipRepository
            .Setup(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result result = await service.SetDefaultTenantAsync(userId, tenantId, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(previousDefaultMembership.IsDefault);
        Assert.Equal(userId, previousDefaultMembership.ModifiedBy);
        Assert.True(requestedMembership.IsDefault);
        Assert.Equal(userId, requestedMembership.ModifiedBy);
        membershipRepository.Verify(repository => repository.UpdateAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task AddUserToTenantAsync_MembershipUniqueViolation_ReturnsAlreadyMemberConflict()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IUserTenantMembershipRepository> membershipRepository =
            CreateAddRepositoryThatThrowsUniqueViolation(
                userId,
                tenantId,
                IndexNames.UserTenantMembershipsUserIdTenantId);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result<UserTenantMembership> result = await service.AddUserToTenantAsync(
            userId,
            tenantId,
            AuthRoles.Developer,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        Assert.Contains(
            result.Errors,
            error => error.Message == "User is already a member of this tenant");
    }

    [Fact]
    public async Task AddUserToTenantAsync_DefaultUniqueViolation_ReturnsDefaultTenantConflict()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();

        Mock<IUserTenantMembershipRepository> membershipRepository =
            CreateAddRepositoryThatThrowsUniqueViolation(
                userId,
                tenantId,
                IndexNames.UserTenantMembershipsUserIdIsDefault);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result<UserTenantMembership> result = await service.AddUserToTenantAsync(
            userId,
            tenantId,
            AuthRoles.Developer,
            cancellationToken: CancellationToken.None);

        Assert.True(result.IsFailed);
        Assert.True(result.HasError<ConflictError>());
        Assert.Contains(
            result.Errors,
            error => error.Message == "User already has a default tenant membership.");
    }

    [Fact]
    public async Task RemoveUserFromTenantAsync_PassesDeletedByToRepository()
    {
        Guid userId = Guid.NewGuid();
        Guid tenantId = Guid.NewGuid();
        Guid deletedByUserId = Guid.NewGuid();

        UserTenantMembership membership = new UserTenantMembership
        {
            Id = 30,
            UserId = userId,
            TenantId = tenantId,
            Role = AuthRoles.Developer,
            IsDefault = false
        };

        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.GetByUserAndTenantAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(membership);
        membershipRepository
            .Setup(repository => repository.RemoveAsync(
                userId, tenantId, deletedByUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        UserTenantMembershipService service = CreateService(membershipRepository);

        Result result = await service.RemoveUserFromTenantAsync(
            userId, tenantId, deletedByUserId, CancellationToken.None);

        Assert.True(result.IsSuccess);
        membershipRepository.Verify(
            repository => repository.RemoveAsync(
                userId, tenantId, deletedByUserId, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private static Mock<IUserTenantMembershipRepository> CreateAddRepositoryThatThrowsUniqueViolation(
        Guid userId,
        Guid tenantId,
        string constraintName)
    {
        Mock<IUserTenantMembershipRepository> membershipRepository = new Mock<IUserTenantMembershipRepository>();
        membershipRepository
            .Setup(repository => repository.ExistsAsync(userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        membershipRepository
            .Setup(repository => repository.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<UserTenantMembership>());
        membershipRepository
            .Setup(repository => repository.GetSoftDeletedByUserAndTenantAsync(
                userId, tenantId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserTenantMembership?)null);
        membershipRepository
            .Setup(repository => repository.AddAsync(It.IsAny<UserTenantMembership>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException(
                "save failed",
                new PostgresException(
                    $"""23505: duplicate key value violates unique constraint "{constraintName}" """,
                    severity: string.Empty,
                    invariantSeverity: string.Empty,
                    sqlState: PostgresExceptionHelper.UniqueViolationSqlState)));

        return membershipRepository;
    }

    private static UserTenantMembershipService CreateService(Mock<IUserTenantMembershipRepository> membershipRepository)
    {
        Mock<UserManager<ApplicationUser>> userManager = new(
            Mock.Of<IUserStore<ApplicationUser>>(),
            null!, null!, null!, null!, null!, null!, null!, null!);
        Mock<IAuditLogService> auditLogService = new();
        auditLogService
            .Setup(s => s.LogActionAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<Guid?>(),
                It.IsAny<Guid?>(),
                It.IsAny<string?>(),
                It.IsAny<string?>(),
                It.IsAny<string>(),
                It.IsAny<string?>()))
            .ReturnsAsync(Result.Ok());

        Mock<ITenantInviteRepository> inviteRepository = new();
        inviteRepository
            .Setup(r => r.GetPendingByTenantAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<TenantInvite>());

        return new UserTenantMembershipService(
            NullLogger<UserTenantMembershipService>.Instance,
            membershipRepository.Object,
            Mock.Of<ISubscriptionSeatRepository>(),
            inviteRepository.Object,
            userManager.Object,
            auditLogService.Object,
            Mock.Of<ITenantAccessRevocationService>(),
            Options.Create(new AccountLifecycleConfiguration()));
    }
}