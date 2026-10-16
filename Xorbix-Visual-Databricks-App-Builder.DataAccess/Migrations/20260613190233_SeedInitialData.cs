using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore.Migrations;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <summary>
    /// Seeds the reference data every environment needs to run: the global Identity roles, the Xorbix and
    /// Demo tenants, the initial users, their global role assignments, and their tenant memberships.
    ///
    /// A migration cannot use <see cref="UserManager{TUser}"/>, so the Identity-managed columns
    /// (<c>NormalizedUserName</c>, <c>NormalizedEmail</c>, <c>SecurityStamp</c>, <c>ConcurrencyStamp</c>,
    /// and the admin <c>PasswordHash</c>) are produced here in the same way <c>UserManager.CreateAsync</c>
    /// would. See <see cref="BuildUserColumnValues"/>.
    /// </summary>
    public partial class SeedInitialData : Migration
    {
        // --- Identity roles ---
        private static readonly Guid AdministratorRoleId = new("dbde01b7-b0e2-4c10-8517-4e02740f37dc");
        private static readonly Guid DeveloperRoleId = new("41c347b8-52ab-470c-8a37-c80cfc968b29");

        // --- Tenants ---
        private static readonly Guid XorbixTenantId = new("34cc722c-bb62-4a04-ad59-149586edc800");
        private static readonly Guid DemoTenantId = new("379315f2-5e2d-4fac-b0f5-cb1a25423707");

        /// <summary>The only user seeded with password login; everyone else uses passwordless login.</summary>
        private static readonly SeedUser AdminUser =
            new(new("0b0ae3e3-5606-4a67-9a27-6ca6340c82ea"), "admin@xorbix.com", "Xorbix", "Admin");

        /// <summary>Owned by and a member of the Demo tenant (every other user belongs to Xorbix).</summary>
        private static readonly SeedUser DemoUser =
            new(new("0b7d2707-91c1-4eec-adb8-43f4d632833b"), "demo@xorbix.com", "Demo", "User");

        /// <summary>Password assigned to <see cref="AdminUser"/>. Hashed at apply time by the Identity hasher.</summary>
        private const string AdminPassword = "1HappyXorbixTurtle!";

        /// <summary>Fixed UTC timestamp stamped on every seeded row so the data is deterministic.</summary>
        private static readonly DateTime SeedTimestamp = new(2026, 6, 12, 0, 0, 0, DateTimeKind.Utc);

        /// <summary>Users owned by the Xorbix tenant (admin first). All are Xorbix-tenant members.</summary>
        private static readonly SeedUser[] XorbixUsers =
        [
            AdminUser,
            new(new("ea028717-2fb5-4461-aa5a-da71d6dbea75"), "tom.campbell@xorbix.com", "Tom", "Campbell"),
            new(new("d151a445-e19c-46ab-a172-64e1c3f7831d"), "asif@xorbix.com", "Asif", "Bakar"),
            new(new("31b47872-f963-4c22-abff-865cf9a429ec"), "chloe.suetholz@xorbix.com", "Chloe", "Suetholz"),
            new(new("a91548e6-773c-4426-a0d6-0c9a49881cf7"), "andrew.keenan@xorbix.com", "Andrew", "Keenan"),
            new(new("d8f96087-abf3-4611-a88a-09c62b079d47"), "andrew.mcqueen@xorbix.com", "Andrew", "McQueen"),
            new(new("37aa0c27-7a91-4218-a0a8-3f69f20100be"), "ben.schmirler@xorbix.com", "Ben", "Schmirler"),
            new(new("234934b8-8546-4117-be8c-fd54f595c627"), "connor.willans@xorbix.com", "Connor", "Willans"),
            new(new("e24c74ef-3efc-4bf6-9e20-684ac236674c"), "ross.vorbeck@xorbix.com", "Ross", "Vorbeck"),
            new(new("e4d7c1cc-b3c1-4c8a-a8c3-67918e3104fe"), "tanner.cellio@xorbix.com", "Tanner", "Cellio"),
            new(new("71346a13-3362-4042-b8cb-21a0618d1061"), "tyler.faulkner@xorbix.com", "Tyler", "Faulkner"),
            new(new("3ce0b62d-f20b-4e1a-80f2-d2005b3eb6e9"), "tyler.salaj@xorbix.com", "Tyler", "Salaj"),
            new(new("622ce6ba-035c-46b8-bec5-22a2e5d21d61"), "shilvana.momin@xorbix.com", "Shilvana", "Momin"),
            new(new("dc15bab2-057a-467e-a060-07e316f0c3b3"), "ryan.shiva@xorbix.com", "Ryan", "Shiva"),
            new(new("5c791662-6174-4319-acfe-6f58d61942b3"), "brooks.beffa@xorbix.com", "Brooks", "Beffa"),
            new(new("8b631a8a-bb04-45e8-aaee-3ad473dc7c52"), "tim.connolley@xorbix.com", "Tim", "Connolley"),
            new(new("f89684c8-a490-492d-a2fc-edfdc5fb3652"), "alexander.drobek@xorbix.com", "Alexander", "Drobek"),
            new(new("621bcfa3-624f-43b9-be24-c287ad62e292"), "aiden.vandenbush@xorbix.com", "Aiden", "Vandenbush"),
            new(new("871fbd3b-c11b-44a7-83d0-00f407e80508"), "patrick.marshall@xorbix.com", "Patrick", "Marshall"),
        ];

        /// <summary>Column order for the iam.Users insert. The value arrays in <see cref="BuildUserColumnValues"/> line up with this.</summary>
        private static readonly string[] UserColumns =
        [
            "Id", "FirstName", "LastName", "IsActive", "UsePasswordlessLogin", "TenantId",
            "EmailNotificationsEnabled", "WorkflowNotificationsEnabled", "CreatedOn",
            "UserName", "NormalizedUserName", "Email", "NormalizedEmail", "EmailConfirmed",
            "PasswordHash", "SecurityStamp", "ConcurrencyStamp",
            "PhoneNumberConfirmed", "TwoFactorEnabled", "LockoutEnabled", "AccessFailedCount",
        ];

        private static readonly string[] UserRoleColumns = ["UserId", "RoleId"];

        private static readonly string[] MembershipColumns =
            ["UserId", "TenantId", "Role", "IsDefault", "JoinedAt", "CreatedOn"];

        /// <summary>A user to insert into iam.Users. Identity-managed columns are derived in <see cref="BuildUserColumnValues"/>.</summary>
        private sealed record SeedUser(Guid Id, string Email, string FirstName, string LastName);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            SeedRoles(migrationBuilder);
            SeedTenants(migrationBuilder);
            SeedUsers(migrationBuilder);
            SeedUserRoles(migrationBuilder);
            SeedUserTenantMemberships(migrationBuilder);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Memberships have database-generated int keys, so delete them by tenant instead of by key.
            migrationBuilder.Sql($"""
                DELETE FROM {SchemaNames.Iam}."{TableNames.UserTenantMemberships}"
                WHERE "TenantId" IN ('{XorbixTenantId}', '{DemoTenantId}');
                """);

            foreach (SeedUser user in XorbixUsers)
            {
                migrationBuilder.DeleteData(
                    schema: SchemaNames.Iam,
                    table: TableNames.UserRoles,
                    keyColumns: UserRoleColumns,
                    keyValues: [user.Id, AdministratorRoleId]);
            }

            migrationBuilder.DeleteData(
                schema: SchemaNames.Iam,
                table: TableNames.UserRoles,
                keyColumns: UserRoleColumns,
                keyValues: [DemoUser.Id, DeveloperRoleId]);

            foreach (SeedUser user in XorbixUsers)
            {
                migrationBuilder.DeleteData(
                    schema: SchemaNames.Iam,
                    table: TableNames.Users,
                    keyColumn: "Id",
                    keyValue: user.Id);
            }

            migrationBuilder.DeleteData(
                schema: SchemaNames.Iam,
                table: TableNames.Users,
                keyColumn: "Id",
                keyValue: DemoUser.Id);

            migrationBuilder.DeleteData(
                schema: SchemaNames.Dbo,
                table: TableNames.Tenants,
                keyColumn: "TenantId",
                keyValues: [XorbixTenantId, DemoTenantId]);

            migrationBuilder.DeleteData(
                schema: SchemaNames.Iam,
                table: TableNames.Roles,
                keyColumn: "Id",
                keyValues: [AdministratorRoleId, DeveloperRoleId]);
        }

        private static void SeedRoles(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: SchemaNames.Iam,
                table: TableNames.Roles,
                columns: ["Id", "Name", "NormalizedName", "ConcurrencyStamp"],
                values: new object[,]
                {
                    { AdministratorRoleId, "Administrator", "ADMINISTRATOR", AdministratorRoleId.ToString() },
                    { DeveloperRoleId, "Developer", "DEVELOPER", DeveloperRoleId.ToString() },
                });
        }

        private static void SeedTenants(MigrationBuilder migrationBuilder)
        {
            // SubscriptionStatus 'active' marks the tier as granted/usable (no Stripe subscription).
            // Max* = 0 means unlimited. BillingCycle must be a BillingInterval name ('Monthly'/'Yearly').
            migrationBuilder.InsertData(
                schema: SchemaNames.Dbo,
                table: TableNames.Tenants,
                columns:
                [
                    "TenantId", "TenantName", "DisplayName", "IsActive", "SubscriptionTier", "BillingCycle",
                    "MaxUsers", "MaxPublishedApps", "MaxWorkspaceConnections", "AutoRenew",
                    "SubscriptionStatus", "CancelAtPeriodEnd", "OwnerId", "InvoiceName", "InvoiceEmail",
                    "CreatedOn",
                ],
                values: new object[,]
                {
                    {
                        XorbixTenantId, "Xorbix Technologies, Inc.", "Xorbix", true, "Enterprise", "Yearly",
                        0, 0, 0, true,
                        "active", false, AdminUser.Id, "Xorbix Technologies, Inc.", AdminUser.Email,
                        SeedTimestamp,
                    },
                    {
                        DemoTenantId, "ABC Company, Inc.", "Demo", true, "Team", "Monthly",
                        0, 0, 0, true,
                        "active", false, DemoUser.Id, "ABC Company, Inc.", DemoUser.Email,
                        SeedTimestamp,
                    },
                });
        }

        private static void SeedUsers(MigrationBuilder migrationBuilder)
        {
            // Computed at apply time so the stored hash always matches the format Identity verifies against.
            string adminPasswordHash = new PasswordHasher<ApplicationUser>().HashPassword(new ApplicationUser(), AdminPassword);

            List<object[]> rows = [];
            foreach (SeedUser user in XorbixUsers)
            {
                string passwordHash = user.Id == AdminUser.Id ? adminPasswordHash : null;
                rows.Add(BuildUserColumnValues(user, XorbixTenantId, passwordHash));
            }

            rows.Add(BuildUserColumnValues(DemoUser, DemoTenantId, passwordHash: null));

            migrationBuilder.InsertData(
                schema: SchemaNames.Iam,
                table: TableNames.Users,
                columns: UserColumns,
                values: ToRectangularArray(rows));
        }

        /// <summary>
        /// Produces one iam.Users row. A user has password login when <paramref name="passwordHash"/> is
        /// non-null; otherwise it uses passwordless login, which the verification-code flow requires
        /// <c>TwoFactorEnabled</c> for (mirrors <c>UserProvisioningService.BuildApplicationUser</c>).
        /// </summary>
        private static object[] BuildUserColumnValues(SeedUser user, Guid owningTenantId, string passwordHash)
        {
            bool usePasswordlessLogin = passwordHash is null;
            string normalizedEmail = user.Email.ToUpperInvariant();
            // Non-null, stable values matching what UserManager would generate. Identity only requires the
            // security stamp to be present and stable, and the concurrency stamp to be present.
            string securityStamp = user.Id.ToString("N").ToUpperInvariant();
            string concurrencyStamp = user.Id.ToString();

            // Positional — each value lines up with UserColumns above; keep the two in sync.
            return
            [
                user.Id, user.FirstName, user.LastName, true, usePasswordlessLogin, owningTenantId,
                true, true, SeedTimestamp,
                user.Email, normalizedEmail, user.Email, normalizedEmail, true,
                passwordHash, securityStamp, concurrencyStamp,
                false, usePasswordlessLogin, true, 0,
            ];
        }

        private static void SeedUserRoles(MigrationBuilder migrationBuilder)
        {
            // Every Xorbix user is a global Administrator; the demo user is a global Developer.
            List<object[]> rows = [.. XorbixUsers.Select(user => new object[] { user.Id, AdministratorRoleId })];
            rows.Add([DemoUser.Id, DeveloperRoleId]);

            migrationBuilder.InsertData(
                schema: SchemaNames.Iam,
                table: TableNames.UserRoles,
                columns: UserRoleColumns,
                values: ToRectangularArray(rows));
        }

        private static void SeedUserTenantMemberships(MigrationBuilder migrationBuilder)
        {
            // The Id column is identity-by-default and is intentionally omitted so the sequence assigns keys
            // and stays in sync with runtime inserts (e.g. a user registering).
            List<object[]> rows = [];
            foreach (SeedUser user in XorbixUsers)
            {
                // Xorbix is the default tenant; Demo membership grants secondary access.
                rows.Add(BuildMembershipColumnValues(user.Id, XorbixTenantId, AuthRoles.TenantAdmin, isDefault: true));
                rows.Add(BuildMembershipColumnValues(user.Id, DemoTenantId, AuthRoles.TenantAdmin, isDefault: false));
            }

            rows.Add(BuildMembershipColumnValues(DemoUser.Id, DemoTenantId, AuthRoles.Developer, isDefault: true));

            migrationBuilder.InsertData(
                schema: SchemaNames.Iam,
                table: TableNames.UserTenantMemberships,
                columns: MembershipColumns,
                values: ToRectangularArray(rows));
        }

        /// <summary>Produces one iam.UserTenantMemberships row. Positional — lines up with <see cref="MembershipColumns"/>.</summary>
        private static object[] BuildMembershipColumnValues(Guid userId, Guid tenantId, string role, bool isDefault) =>
            [userId, tenantId, role, isDefault, SeedTimestamp, SeedTimestamp];

        /// <summary>Stacks per-row value arrays into the rectangular <c>object[,]</c> shape InsertData requires.</summary>
        private static object[,] ToRectangularArray(IReadOnlyList<object[]> rows)
        {
            int columnCount = rows[0].Length;
            object[,] table = new object[rows.Count, columnCount];
            for (int rowIndex = 0; rowIndex < rows.Count; rowIndex++)
            {
                for (int columnIndex = 0; columnIndex < columnCount; columnIndex++)
                {
                    table[rowIndex, columnIndex] = rows[rowIndex][columnIndex];
                }
            }

            return table;
        }
    }
}
