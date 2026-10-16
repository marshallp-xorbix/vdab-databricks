using Microsoft.EntityFrameworkCore.Migrations;
using Xorbix_Visual_Databricks_App_Builder.Models;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <summary>
    /// Seeds the initial beta access codes. Redeeming a beta code during account setup provisions a
    /// Stripe no-card free trial for the granted tier. Both codes grant a 30-day trial billed monthly
    /// once converted, and are capped at 100 redemptions.
    /// </summary>
    public partial class SeedInitialBetaCodes : Migration
    {
        private static readonly Guid IndividualBetaCodeId = new("7f3e2a10-9c44-4b6e-8d21-5a0f6b1c9e01");
        private static readonly Guid TeamBetaCodeId = new("b85d4c27-1e6a-4f90-a3c8-2d7e9f0a4b02");

        /// <summary>Fixed UTC timestamp stamped on every seeded row.</summary>
        private static readonly DateTime SeedTimestamp = new(2026, 6, 12, 0, 0, 0, DateTimeKind.Utc);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                schema: SchemaNames.Dbo,
                table: TableNames.BetaCodes,
                columns:
                [
                    "BetaCodeId", "Code", "Tier", "BillingInterval", "TrialPeriodDays",
                    "MaxRedemptions", "RedemptionCount", "IsActive", "CreatedOn",
                ],
                values: new object[,]
                {
                    { IndividualBetaCodeId, "VDAB-BETA-IND", "Individual", "Monthly", 30, 100, 0, true, SeedTimestamp },
                    { TeamBetaCodeId, "VDAB-BETA-TEAM", "Team", "Monthly", 30, 100, 0, true, SeedTimestamp },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                schema: SchemaNames.Dbo,
                table: TableNames.BetaCodes,
                keyColumn: "BetaCodeId",
                keyValues: [IndividualBetaCodeId, TeamBetaCodeId]);
        }
    }
}
