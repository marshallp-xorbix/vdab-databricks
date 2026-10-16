using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Live-DB checks that <see cref="TombstoneAwareUserStore"/> hides soft-deleted users from
/// email/username lookup while still resolving them by id.
/// </summary>
[Trait("Category", "RequiresDatabaseSchema")]
public class TombstoneAwareUserStoreTests
{
    [RequiresDatabaseSchemaFact]
    public async Task FindByEmailAndName_SkipTombstones_FindById_ReturnsThem()
    {
        await using StoreTestScope scope = await StoreTestScope.CreateAsync();

        ApplicationUser? byEmailLive = await scope.Store.FindByEmailAsync(scope.NormalizedEmail);
        ApplicationUser? byNameLive = await scope.Store.FindByNameAsync(scope.NormalizedUserName);
        Assert.NotNull(byEmailLive);
        Assert.NotNull(byNameLive);
        Assert.Equal(scope.LiveUserId, byEmailLive.Id);
        Assert.Equal(scope.LiveUserId, byNameLive.Id);

        ApplicationUser? byEmailTombstone = await scope.Store.FindByEmailAsync(scope.TombstoneNormalizedEmail);
        ApplicationUser? byNameTombstone = await scope.Store.FindByNameAsync(scope.TombstoneNormalizedUserName);
        Assert.Null(byEmailTombstone);
        Assert.Null(byNameTombstone);

        ApplicationUser? byIdTombstone = await scope.Store.FindByIdAsync(scope.TombstoneUserId.ToString());
        Assert.NotNull(byIdTombstone);
        Assert.Equal(scope.TombstoneUserId, byIdTombstone.Id);
        Assert.NotNull(byIdTombstone.DeletedOn);
    }

    private sealed class StoreTestScope : IAsyncDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly List<Guid> _userIds;

        private StoreTestScope(
            ApplicationDbContext context,
            TombstoneAwareUserStore store,
            Guid liveUserId,
            Guid tombstoneUserId,
            string normalizedEmail,
            string normalizedUserName,
            string tombstoneNormalizedEmail,
            string tombstoneNormalizedUserName)
        {
            _context = context;
            Store = store;
            LiveUserId = liveUserId;
            TombstoneUserId = tombstoneUserId;
            NormalizedEmail = normalizedEmail;
            NormalizedUserName = normalizedUserName;
            TombstoneNormalizedEmail = tombstoneNormalizedEmail;
            TombstoneNormalizedUserName = tombstoneNormalizedUserName;
            _userIds = [liveUserId, tombstoneUserId];
        }

        public TombstoneAwareUserStore Store { get; }

        public Guid LiveUserId { get; }

        public Guid TombstoneUserId { get; }

        public string NormalizedEmail { get; }

        public string NormalizedUserName { get; }

        public string TombstoneNormalizedEmail { get; }

        public string TombstoneNormalizedUserName { get; }

        public static async Task<StoreTestScope> CreateAsync()
        {
            string connectionString =
                Environment.GetEnvironmentVariable(RequiresDatabaseSchemaFactAttribute.ConnectionStringEnvironmentVariable)!;

            DbContextOptions<ApplicationDbContext> options =
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseNpgsql(connectionString)
                    .Options;

            ApplicationDbContext context = new(options);
            string suffix = Guid.NewGuid().ToString("N")[..8];

            Guid liveUserId = Guid.NewGuid();
            string liveEmail = $"live-{suffix}@example.com";
            ApplicationUser liveUser = new()
            {
                Id = liveUserId,
                UserName = liveEmail,
                NormalizedUserName = liveEmail.ToUpperInvariant(),
                Email = liveEmail,
                NormalizedEmail = liveEmail.ToUpperInvariant(),
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString(),
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                IsActive = true,
            };

            Guid tombstoneUserId = Guid.NewGuid();
            string tombstoneEmail = $"tomb-{suffix}@example.com";
            ApplicationUser tombstoneUser = new()
            {
                Id = tombstoneUserId,
                UserName = tombstoneEmail,
                NormalizedUserName = tombstoneEmail.ToUpperInvariant(),
                Email = tombstoneEmail,
                NormalizedEmail = tombstoneEmail.ToUpperInvariant(),
                EmailConfirmed = true,
                SecurityStamp = Guid.NewGuid().ToString(),
                ConcurrencyStamp = Guid.NewGuid().ToString(),
                IsActive = false,
                DeletedOn = DateTime.UtcNow,
                DeletedBy = Guid.NewGuid(),
            };

            context.Users.AddRange(liveUser, tombstoneUser);
            await context.SaveChangesAsync();

            TombstoneAwareUserStore store = new(context, new IdentityErrorDescriber());
            return new StoreTestScope(
                context,
                store,
                liveUserId,
                tombstoneUserId,
                liveUser.NormalizedEmail!,
                liveUser.NormalizedUserName!,
                tombstoneUser.NormalizedEmail!,
                tombstoneUser.NormalizedUserName!);
        }

        public async ValueTask DisposeAsync()
        {
            List<ApplicationUser> users = await _context.Users
                .Where(user => _userIds.Contains(user.Id))
                .ToListAsync();
            _context.Users.RemoveRange(users);
            await _context.SaveChangesAsync();
            await _context.DisposeAsync();
        }
    }
}
