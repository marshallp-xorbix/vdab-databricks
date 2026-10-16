using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Application database context for Entity Framework Core with Identity support.
/// </summary>
public class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    /// <summary>
    /// Gets or sets the current user identifier for audit purposes.
    /// </summary>
    public string CurrentUserId { get; set; } = "System";

    /// <summary>
    /// Initializes a new instance of the <see cref="ApplicationDbContext"/> class.
    /// </summary>
    public ApplicationDbContext() { }

    /// <summary>
    /// Initializes a new instance of the <see cref="ApplicationDbContext"/> class.
    /// </summary>
    /// <param name="options">The options to be used by the DbContext.</param>
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // <inheritdoc />
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<decimal>().HavePrecision(10, 2);
        //configurationBuilder.Properties<string>().AreUnicode(false); // use to set varchar as default over nvarchar

        // Force all DateTime properties to be saved as-is but read with DateTimeKind.Utc
        configurationBuilder.Properties<DateTime>().HaveConversion<DateTimeUtcConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<DateTimeUtcConverter>();

        base.ConfigureConventions(configurationBuilder);
    }

    // Add your custom DbSets here (non-Identity tables)
    public virtual DbSet<Tenant> Tenants { get; set; } = null!; //TODO: Change the name of Tenant
    public virtual DbSet<DatabricksConnection> DatabricksConnections { get; set; } = null!;
    public virtual DbSet<DatabricksUserToken> DatabricksUserTokens { get; set; } = null!;
    public virtual DbSet<RefreshToken> RefreshTokens { get; set; } = null!;
    public virtual DbSet<SubscriptionHistory> SubscriptionHistory { get; set; } = null!;
    public virtual DbSet<StripeEventLog> StripeEventLogs { get; set; } = null!;
    public virtual DbSet<SubscriptionSeat> SubscriptionSeats { get; set; } = null!;

    public virtual DbSet<App> Apps { get; set; } = null!;
    public virtual DbSet<AppComponent> AppComponents { get; set; } = null!;
    public virtual DbSet<UserTenantMembership> UserTenantMemberships { get; set; } = null!;
    public virtual DbSet<TenantInvite> TenantInvites { get; set; } = null!;
    public virtual DbSet<AuditLog> AuditLogs { get; set; } = null!;
    public virtual DbSet<BetaCode> BetaCodes { get; set; } = null!;
    public virtual DbSet<BetaCodeRedemption> BetaCodeRedemptions { get; set; } = null!;
    public virtual DbSet<TenantAiModel> TenantAiModels { get; set; } = null!;
    public virtual DbSet<UserTenantPreference> UserTenantPreferences { get; set; } = null!;
    public virtual DbSet<UserPlatformAiUsage> UserPlatformAiUsages { get; set; } = null!;
    public virtual DbSet<UserPlatformAiUsageEvent> UserPlatformAiUsageEvents { get; set; } = null!;


    /// <summary>
    /// Configures the model that was discovered by convention from the entity types.
    /// </summary>
    /// <param name="modelBuilder">The builder being used to construct the model for this context.</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Set default schema to dbo
        modelBuilder.HasDefaultSchema(SchemaNames.Dbo);

        // Move Identity tables to iam schema
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable(TableNames.Users, SchemaNames.Iam);

            // Partial unique: live rows only hold the username/email slot (soft-deleted rows release it).
            entity.HasIndex(e => e.NormalizedUserName)
                .IsUnique()
                .HasFilter("\"DeletedOn\" IS NULL")
                .HasDatabaseName("UserNameIndex");

            entity.HasIndex(e => e.Email);
            entity.HasIndex(e => e.TenantId);

            entity.HasOne(e => e.OwningTenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasMany(e => e.TenantMemberships)
                .WithOne(m => m.User)
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasMany(e => e.Claims)
                .WithOne()
                .HasForeignKey(uc => uc.UserId)
                .IsRequired();

            entity.HasMany(e => e.Logins)
                .WithOne()
                .HasForeignKey(ul => ul.UserId)
                .IsRequired();

            entity.HasMany(e => e.Tokens)
                .WithOne()
                .HasForeignKey(ut => ut.UserId)
                .IsRequired();

            entity.HasMany(e => e.UserRoles)
                .WithOne()
                .HasForeignKey(ur => ur.UserId)
                .IsRequired();
        });

        modelBuilder.Entity<IdentityRole<Guid>>(entity =>
        {
            entity.ToTable(TableNames.Roles, SchemaNames.Iam);
        });

        modelBuilder.Entity<IdentityUserRole<Guid>>(entity =>
        {
            entity.ToTable(TableNames.UserRoles, SchemaNames.Iam);
        });

        modelBuilder.Entity<IdentityUserClaim<Guid>>(entity =>
        {
            entity.ToTable(TableNames.UserClaims, SchemaNames.Iam);
        });

        modelBuilder.Entity<IdentityUserLogin<Guid>>(entity =>
        {
            entity.ToTable(TableNames.UserLogins, SchemaNames.Iam);
        });

        modelBuilder.Entity<IdentityUserToken<Guid>>(entity =>
        {
            entity.ToTable(TableNames.UserTokens, SchemaNames.Iam);
        });

        modelBuilder.Entity<IdentityRoleClaim<Guid>>(entity =>
        {
            entity.ToTable(TableNames.RoleClaims, SchemaNames.Iam);
        });

        modelBuilder.Entity<Tenant>(entity =>
        {
            entity.ToTable(TableNames.Tenants, SchemaNames.Dbo);

            entity.HasIndex(e => e.BillingCustomerId);

            entity.HasMany(e => e.UserMemberships)
                .WithOne(m => m.Tenant)
                .HasForeignKey(m => m.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserTenantMembership>(entity =>
        {
            entity.ToTable(TableNames.UserTenantMemberships, SchemaNames.Iam);

            // Partial unique: one live membership per user/tenant; soft-deleted rows allow re-invite.
            entity.HasIndex(e => new { e.UserId, e.TenantId })
                .IsUnique()
                .HasFilter("\"DeletedOn\" IS NULL")
                .HasDatabaseName("IX_UserTenantMemberships_UserId_TenantId");

            // Filtered unique index: Only one default tenant per user
            entity.HasIndex(e => e.UserId)
                .HasFilter("\"IsDefault\" = TRUE")
                .IsUnique()
                .HasDatabaseName("IX_UserTenantMemberships_UserId_IsDefault");

            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.LastAccessedAt);
        });

        modelBuilder.Entity<UserTenantPreference>(entity =>
        {
            entity.ToTable(TableNames.UserTenantPreferences, SchemaNames.Iam);

            entity.HasIndex(e => new { e.UserId, e.TenantId })
                .IsUnique()
                .HasFilter("\"DeletedOn\" IS NULL")
                .HasDatabaseName("IX_UserTenantPreferences_UserId_TenantId");

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TenantAiModel>(entity =>
        {
            entity.ToTable(TableNames.TenantAiModels, SchemaNames.Dbo);

            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.DatabricksConnectionId);

            entity.HasIndex(e => new { e.TenantId, e.DisplayName })
                .HasFilter("\"DeletedOn\" IS NULL")
                .IsUnique()
                .HasDatabaseName("IX_TenantAiModels_TenantId_DisplayName");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.DatabricksConnection)
                .WithMany()
                .HasForeignKey(e => e.DatabricksConnectionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<UserPlatformAiUsage>(entity =>
        {
            entity.ToTable(TableNames.UserPlatformAiUsage, SchemaNames.Dbo);

            entity.HasIndex(e => new { e.UserId, e.PeriodKey })
                .IsUnique()
                .HasDatabaseName("IX_UserPlatformAiUsage_UserId_PeriodKey");

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserPlatformAiUsageEvent>(entity =>
        {
            entity.ToTable(TableNames.UserPlatformAiUsageEvents, SchemaNames.Dbo);

            entity.HasIndex(e => new { e.UserId, e.PeriodKey })
                .HasDatabaseName("IX_UserPlatformAiUsageEvents_UserId_PeriodKey");

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TenantInvite>(entity =>
        {
            entity.ToTable(TableNames.TenantInvites, SchemaNames.Dbo);

            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.TokenHash).IsUnique();

            // Filtered unique index: only one Pending invite per (tenant, normalized email)
            entity.HasIndex(e => new { e.TenantId, e.NormalizedEmail })
                .HasFilter("\"Status\" = 'Pending' AND \"DeletedOn\" IS NULL")
                .IsUnique()
                .HasDatabaseName("IX_TenantInvites_TenantId_NormalizedEmail_Pending");

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BetaCode>(entity =>
        {
            entity.ToTable(TableNames.BetaCodes, SchemaNames.Dbo);

            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<BetaCodeRedemption>(entity =>
        {
            entity.ToTable(TableNames.BetaCodeRedemptions, SchemaNames.Dbo);

            entity.HasIndex(e => e.BetaCodeId);

            // One beta redemption per tenant (v1 abuse guard).
            entity.HasIndex(e => e.TenantId).IsUnique();

            entity.HasOne(e => e.BetaCode)
                .WithMany()
                .HasForeignKey(e => e.BetaCodeId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DatabricksConnection>(entity =>
        {
            entity.ToTable(TableNames.DatabricksConnections, SchemaNames.Dbo);

            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => new { e.TenantId, e.WorkspaceUrl });

            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.DatabricksConnections)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DatabricksUserToken>(entity =>
        {
            entity.ToTable(TableNames.DatabricksUserTokens, SchemaNames.Dbo);

            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.WorkspaceConnectionId);
            entity.HasIndex(e => new { e.UserId, e.WorkspaceConnectionId })
                .IsUnique();

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.WorkspaceConnection)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceConnectionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SubscriptionHistory>(entity =>
        {
            entity.ToTable(TableNames.SubscriptionHistory, SchemaNames.Dbo);

            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.EventDate);
            entity.HasIndex(e => e.ExternalTransactionId);
            entity.HasIndex(e => e.StripeEventId);

            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.SubscriptionHistory)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<SubscriptionSeat>(entity =>
        {
            entity.ToTable(TableNames.SubscriptionSeats, SchemaNames.Dbo);

            entity.HasIndex(e => new { e.TenantId, e.Status });

            entity.HasIndex(e => new { e.TenantId, e.UserId })
                .IsUnique()
                .HasFilter("\"UserId\" IS NOT NULL");

            entity.HasOne(e => e.Tenant)
                .WithMany(t => t.Seats)
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<StripeEventLog>(entity =>
        {
            entity.ToTable(TableNames.StripeEventLogs, SchemaNames.Dbo);

            entity.HasIndex(e => e.StripeEventId)
                .IsUnique();

            entity.HasIndex(e => e.EventType);
            entity.HasIndex(e => e.ProcessedAt);
            entity.HasIndex(e => e.CustomerId);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable(TableNames.AuditLogs, SchemaNames.Dbo);

            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.ActionType);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.IsArchived);
            entity.HasIndex(e => new { e.TenantId, e.Timestamp });
            entity.HasIndex(e => new { e.TenantId, e.ActionType, e.Timestamp });

            entity.HasOne(e => e.Tenant)
                .WithMany()
                .HasForeignKey(e => e.TenantId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable(TableNames.RefreshTokens, SchemaNames.Iam);

            entity.HasIndex(e => e.Token)
                .IsUnique();

            entity.HasIndex(e => e.UserId);

            entity.HasIndex(e => new { e.UserId, e.TenantId });

            entity.HasIndex(e => e.ExpiresAt);

            entity.HasIndex(e => e.SessionId);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.ReplacedByToken)
                .WithMany()
                .HasForeignKey(e => e.ReplacedByTokenId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<AppComponent>(entity =>
        {
            entity.ToTable(TableNames.AppComponents, SchemaNames.Dbo);

            entity.HasIndex(e => e.AppId);
            entity.HasIndex(e => new { e.AppId, e.CodeName });

            entity.HasOne(e => e.App)
                .WithMany()
                .HasForeignKey(e => e.AppId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure App entity
        modelBuilder.Entity<App>(entity =>
        {
            entity.ToTable(TableNames.Apps, SchemaNames.Dbo);

            entity.HasIndex(e => e.OwnerId);
            entity.HasIndex(e => e.TenantId);
            entity.HasIndex(e => e.WorkspaceConnectionId);

            entity.HasOne(e => e.User)
                .WithMany()
                .HasForeignKey(e => e.OwnerId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.WorkspaceConnection)
                .WithMany()
                .HasForeignKey(e => e.WorkspaceConnectionId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Apply all custom entity configurations from the assembly
        // The line below is the reason we get the warning: 
        // No instantiatable types implementing IEntityTypeConfiguration were found while scanning assembly 'Xorbix-Visual-Databricks-App-Builder.DataAccess'
        // TODO - add this back, separate configuration classes for each entity to reduce onModelCreating bloat and better organization.
        //modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

    }

}
/// <summary>
/// Converts DateTime to UTC on read to ensure Kind is set to Utc.
/// Enforces that all DateTime properties are treated as UTC.
/// </summary>
public class DateTimeUtcConverter : ValueConverter<DateTime, DateTime>
{
    public DateTimeUtcConverter() : base(
        v => v, // Write: no change (assuming already UTC)
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc)) // Read: treat as UTC
    { }
}