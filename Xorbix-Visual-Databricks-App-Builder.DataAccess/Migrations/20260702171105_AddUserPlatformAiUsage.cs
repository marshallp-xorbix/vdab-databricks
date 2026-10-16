using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPlatformAiUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserPlatformAiUsage",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodKey = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    TokensUsed = table.Column<long>(type: "bigint", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPlatformAiUsage", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPlatformAiUsage_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserPlatformAiUsageEvents",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PeriodKey = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    TotalTokens = table.Column<int>(type: "integer", nullable: false),
                    InputTokens = table.Column<int>(type: "integer", nullable: true),
                    OutputTokens = table.Column<int>(type: "integer", nullable: true),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: true),
                    AppId = table.Column<int>(type: "integer", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPlatformAiUsageEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPlatformAiUsageEvents_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserPlatformAiUsage_UserId_PeriodKey",
                schema: "dbo",
                table: "UserPlatformAiUsage",
                columns: new[] { "UserId", "PeriodKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserPlatformAiUsageEvents_UserId_PeriodKey",
                schema: "dbo",
                table: "UserPlatformAiUsageEvents",
                columns: new[] { "UserId", "PeriodKey" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPlatformAiUsage",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "UserPlatformAiUsageEvents",
                schema: "dbo");
        }
    }
}
