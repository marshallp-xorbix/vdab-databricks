using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "dbo");

            migrationBuilder.EnsureSchema(
                name: "iam");

            migrationBuilder.CreateTable(
                name: "BetaCodes",
                schema: "dbo",
                columns: table => new
                {
                    BetaCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Tier = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BillingInterval = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TrialPeriodDays = table.Column<int>(type: "integer", nullable: true),
                    TrialEndDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    MaxRedemptions = table.Column<int>(type: "integer", nullable: true),
                    RedemptionCount = table.Column<int>(type: "integer", nullable: false),
                    ExpiresOn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BetaCodes", x => x.BetaCodeId);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "StripeEventLogs",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    StripeEventId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    EventType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ProcessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Payload = table.Column<string>(type: "text", nullable: true),
                    Success = table.Column<bool>(type: "boolean", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CustomerId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    DetailSummary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StripeEventLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tenants",
                schema: "dbo",
                columns: table => new
                {
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    SubscriptionTier = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BillingCycle = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MaxUsers = table.Column<int>(type: "integer", nullable: false),
                    MaxPublishedApps = table.Column<int>(type: "integer", nullable: false),
                    MaxWorkspaceConnections = table.Column<int>(type: "integer", nullable: false),
                    SubscriptionStartDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    SubscriptionEndDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    TrialEndDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AutoRenew = table.Column<bool>(type: "boolean", nullable: false),
                    BillingCustomerId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    StripeSubscriptionId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    SubscriptionStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    CancelAtPeriodEnd = table.Column<bool>(type: "boolean", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: true),
                    InvoiceName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    InvoiceEmail = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tenants", x => x.TenantId);
                });

            migrationBuilder.CreateTable(
                name: "RoleClaims",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoleClaims_Roles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "iam",
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BetaCodeRedemptions",
                schema: "dbo",
                columns: table => new
                {
                    BetaCodeRedemptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    BetaCodeId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RedeemedOn = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BetaCodeRedemptions", x => x.BetaCodeRedemptionId);
                    table.ForeignKey(
                        name: "FK_BetaCodeRedemptions_BetaCodes_BetaCodeId",
                        column: x => x.BetaCodeId,
                        principalSchema: "dbo",
                        principalTable: "BetaCodes",
                        principalColumn: "BetaCodeId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_BetaCodeRedemptions_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionHistory",
                schema: "dbo",
                columns: table => new
                {
                    SubscriptionHistoryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    EventType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    SubscriptionTier = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    BillingCycle = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    ExternalTransactionId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    StripeInvoiceId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    StripePaymentIntentId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    PaymentStatus = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    StripeEventId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    EventDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionHistory", x => x.SubscriptionHistoryId);
                    table.ForeignKey(
                        name: "FK_SubscriptionHistory_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TenantInvites",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    TokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    InvitedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    InvitedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcceptedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResultingSeatId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequiresSeatPurchase = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantInvites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenantInvites_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FirstName = table.Column<string>(type: "text", nullable: false),
                    LastName = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    UsePasswordlessLogin = table.Column<bool>(type: "boolean", nullable: false),
                    AzureAdObjectId = table.Column<string>(type: "text", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    EmailNotificationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    WorkflowNotificationsEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TermsOfServiceVersionDate = table.Column<DateOnly>(type: "date", nullable: true),
                    TermsOfServiceAcceptedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PrivacyPolicyVersionDate = table.Column<DateOnly>(type: "date", nullable: true),
                    PrivacyPolicyAcceptedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                schema: "dbo",
                columns: table => new
                {
                    AuditLogId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    EntityId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    HistoricalEntityId = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Metadata = table.Column<string>(type: "text", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Severity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.AuditLogId);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "DatabricksConnections",
                schema: "dbo",
                columns: table => new
                {
                    PkId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceUrl = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    WorkspaceDisplayName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    ClientId = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ClientSecret = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    AccessTokenTtlMinutes = table.Column<int>(type: "integer", nullable: true),
                    RefreshTokenLifespanMinutes = table.Column<int>(type: "integer", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatabricksConnections", x => x.PkId);
                    table.ForeignKey(
                        name: "FK_DatabricksConnections_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DatabricksConnections_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IpAddress = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    UserAgent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    City = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Region = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    ReplacedByTokenId = table.Column<int>(type: "integer", nullable: true),
                    SessionId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_RefreshTokens_ReplacedByTokenId",
                        column: x => x.ReplacedByTokenId,
                        principalSchema: "iam",
                        principalTable: "RefreshTokens",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SubscriptionSeats",
                schema: "dbo",
                columns: table => new
                {
                    SubscriptionSeatId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsBundled = table.Column<bool>(type: "boolean", nullable: false),
                    SeatStartDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SeatEndDate = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CanceledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AssignedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SubscriptionSeats", x => x.SubscriptionSeatId);
                    table.ForeignKey(
                        name: "FK_SubscriptionSeats_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SubscriptionSeats_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "UserClaims",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserClaims_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserLogins",
                schema: "iam",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_UserLogins_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                schema: "iam",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RoleId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RoleId",
                        column: x => x.RoleId,
                        principalSchema: "iam",
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTenantMemberships",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    LastAccessedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    JoinedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTenantMemberships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTenantMemberships_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserTenantMemberships_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserTokens",
                schema: "iam",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_UserTokens_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Apps",
                schema: "dbo",
                columns: table => new
                {
                    PkId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    AppName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DatabricksAppName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    Description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    WorkspaceConnectionId = table.Column<int>(type: "integer", nullable: false),
                    WorkspacePath = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    LastPublishedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Theme = table.Column<string>(type: "text", nullable: true),
                    WorkflowDefinition = table.Column<string>(type: "text", nullable: false),
                    CustomModulesCode = table.Column<string>(type: "text", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Apps", x => x.PkId);
                    table.ForeignKey(
                        name: "FK_Apps_DatabricksConnections_WorkspaceConnectionId",
                        column: x => x.WorkspaceConnectionId,
                        principalSchema: "dbo",
                        principalTable: "DatabricksConnections",
                        principalColumn: "PkId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Apps_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DatabricksUserTokens",
                schema: "dbo",
                columns: table => new
                {
                    DatabricksUserTokenId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkspaceConnectionId = table.Column<int>(type: "integer", nullable: false),
                    RefreshToken = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                    RefreshTokenExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastRotatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatabricksUserTokens", x => x.DatabricksUserTokenId);
                    table.ForeignKey(
                        name: "FK_DatabricksUserTokens_DatabricksConnections_WorkspaceConnect~",
                        column: x => x.WorkspaceConnectionId,
                        principalSchema: "dbo",
                        principalTable: "DatabricksConnections",
                        principalColumn: "PkId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DatabricksUserTokens_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppComponents",
                schema: "dbo",
                columns: table => new
                {
                    PkId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AppId = table.Column<int>(type: "integer", nullable: false),
                    Description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    CodeName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    ComponentType = table.Column<int>(type: "integer", nullable: false),
                    ComponentVersion = table.Column<int>(type: "integer", nullable: false),
                    Properties = table.Column<string>(type: "text", nullable: false),
                    Bindings = table.Column<string>(type: "text", nullable: true),
                    Children = table.Column<string>(type: "text", nullable: true),
                    Layout = table.Column<string>(type: "text", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppComponents", x => x.PkId);
                    table.ForeignKey(
                        name: "FK_AppComponents_Apps_AppId",
                        column: x => x.AppId,
                        principalSchema: "dbo",
                        principalTable: "Apps",
                        principalColumn: "PkId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AppComponents_AppId",
                schema: "dbo",
                table: "AppComponents",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_AppComponents_AppId_CodeName",
                schema: "dbo",
                table: "AppComponents",
                columns: new[] { "AppId", "CodeName" });

            migrationBuilder.CreateIndex(
                name: "IX_Apps_OwnerId",
                schema: "dbo",
                table: "Apps",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_Apps_TenantId",
                schema: "dbo",
                table: "Apps",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Apps_WorkspaceConnectionId",
                schema: "dbo",
                table: "Apps",
                column: "WorkspaceConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActionType",
                schema: "dbo",
                table: "AuditLogs",
                column: "ActionType");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_IsArchived",
                schema: "dbo",
                table: "AuditLogs",
                column: "IsArchived");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TenantId",
                schema: "dbo",
                table: "AuditLogs",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TenantId_ActionType_Timestamp",
                schema: "dbo",
                table: "AuditLogs",
                columns: new[] { "TenantId", "ActionType", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_TenantId_Timestamp",
                schema: "dbo",
                table: "AuditLogs",
                columns: new[] { "TenantId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_Timestamp",
                schema: "dbo",
                table: "AuditLogs",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                schema: "dbo",
                table: "AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_BetaCodeRedemptions_BetaCodeId",
                schema: "dbo",
                table: "BetaCodeRedemptions",
                column: "BetaCodeId");

            migrationBuilder.CreateIndex(
                name: "IX_BetaCodeRedemptions_TenantId",
                schema: "dbo",
                table: "BetaCodeRedemptions",
                column: "TenantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BetaCodes_Code",
                schema: "dbo",
                table: "BetaCodes",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatabricksConnections_OwnerId",
                schema: "dbo",
                table: "DatabricksConnections",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_DatabricksConnections_TenantId",
                schema: "dbo",
                table: "DatabricksConnections",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_DatabricksConnections_TenantId_WorkspaceUrl",
                schema: "dbo",
                table: "DatabricksConnections",
                columns: new[] { "TenantId", "WorkspaceUrl" });

            migrationBuilder.CreateIndex(
                name: "IX_DatabricksUserTokens_UserId",
                schema: "dbo",
                table: "DatabricksUserTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DatabricksUserTokens_UserId_WorkspaceConnectionId",
                schema: "dbo",
                table: "DatabricksUserTokens",
                columns: new[] { "UserId", "WorkspaceConnectionId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DatabricksUserTokens_WorkspaceConnectionId",
                schema: "dbo",
                table: "DatabricksUserTokens",
                column: "WorkspaceConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                schema: "iam",
                table: "RefreshTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ReplacedByTokenId",
                schema: "iam",
                table: "RefreshTokens",
                column: "ReplacedByTokenId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_SessionId",
                schema: "iam",
                table: "RefreshTokens",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                schema: "iam",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                schema: "iam",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RoleClaims_RoleId",
                schema: "iam",
                table: "RoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                schema: "iam",
                table: "Roles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StripeEventLogs_CustomerId",
                schema: "dbo",
                table: "StripeEventLogs",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_StripeEventLogs_EventType",
                schema: "dbo",
                table: "StripeEventLogs",
                column: "EventType");

            migrationBuilder.CreateIndex(
                name: "IX_StripeEventLogs_ProcessedAt",
                schema: "dbo",
                table: "StripeEventLogs",
                column: "ProcessedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StripeEventLogs_StripeEventId",
                schema: "dbo",
                table: "StripeEventLogs",
                column: "StripeEventId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionHistory_EventDate",
                schema: "dbo",
                table: "SubscriptionHistory",
                column: "EventDate");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionHistory_ExternalTransactionId",
                schema: "dbo",
                table: "SubscriptionHistory",
                column: "ExternalTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionHistory_StripeEventId",
                schema: "dbo",
                table: "SubscriptionHistory",
                column: "StripeEventId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionHistory_TenantId",
                schema: "dbo",
                table: "SubscriptionHistory",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionSeats_TenantId_Status",
                schema: "dbo",
                table: "SubscriptionSeats",
                columns: new[] { "TenantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionSeats_TenantId_UserId",
                schema: "dbo",
                table: "SubscriptionSeats",
                columns: new[] { "TenantId", "UserId" },
                unique: true,
                filter: "\"UserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SubscriptionSeats_UserId",
                schema: "dbo",
                table: "SubscriptionSeats",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantInvites_TenantId",
                schema: "dbo",
                table: "TenantInvites",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantInvites_TenantId_NormalizedEmail_Pending",
                schema: "dbo",
                table: "TenantInvites",
                columns: new[] { "TenantId", "NormalizedEmail" },
                unique: true,
                filter: "\"Status\" = 'Pending' AND \"DeletedOn\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_TenantInvites_TokenHash",
                schema: "dbo",
                table: "TenantInvites",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tenants_BillingCustomerId",
                schema: "dbo",
                table: "Tenants",
                column: "BillingCustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_UserClaims_UserId",
                schema: "iam",
                table: "UserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserLogins_UserId",
                schema: "iam",
                table: "UserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                schema: "iam",
                table: "UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                schema: "iam",
                table: "Users",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                schema: "iam",
                table: "Users",
                column: "Email");

            migrationBuilder.CreateIndex(
                name: "IX_Users_TenantId",
                schema: "iam",
                table: "Users",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                schema: "iam",
                table: "Users",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_LastAccessedAt",
                schema: "iam",
                table: "UserTenantMemberships",
                column: "LastAccessedAt");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_TenantId",
                schema: "iam",
                table: "UserTenantMemberships",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_UserId_IsDefault",
                schema: "iam",
                table: "UserTenantMemberships",
                column: "UserId",
                unique: true,
                filter: "\"IsDefault\" = TRUE");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_UserId_TenantId",
                schema: "iam",
                table: "UserTenantMemberships",
                columns: new[] { "UserId", "TenantId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppComponents",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "AuditLogs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "BetaCodeRedemptions",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "DatabricksUserTokens",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "RefreshTokens",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "RoleClaims",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "StripeEventLogs",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SubscriptionHistory",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "SubscriptionSeats",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "TenantInvites",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "UserClaims",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "UserLogins",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "UserRoles",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "UserTenantMemberships",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "UserTokens",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "Apps",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "BetaCodes",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Roles",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "DatabricksConnections",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "Users",
                schema: "iam");

            migrationBuilder.DropTable(
                name: "Tenants",
                schema: "dbo");
        }
    }
}
