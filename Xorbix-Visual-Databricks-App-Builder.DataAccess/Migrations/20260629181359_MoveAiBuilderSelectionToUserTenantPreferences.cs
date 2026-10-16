using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class MoveAiBuilderSelectionToUserTenantPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserTenantPreferences",
                schema: "iam",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    PreferencesJson = table.Column<string>(type: "character varying(8192)", maxLength: 8192, nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserTenantPreferences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserTenantPreferences_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserTenantPreferences_Users_UserId",
                        column: x => x.UserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantPreferences_TenantId",
                schema: "iam",
                table: "UserTenantPreferences",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantPreferences_UserId_TenantId",
                schema: "iam",
                table: "UserTenantPreferences",
                columns: new[] { "UserId", "TenantId" },
                unique: true,
                filter: "\"DeletedOn\" IS NULL");

            migrationBuilder.Sql(
                """
                INSERT INTO iam."UserTenantPreferences" ("UserId", "TenantId", "PreferencesJson", "CreatedOn")
                SELECT
                    m."UserId",
                    m."TenantId",
                    jsonb_build_object('aiBuilder.selectedModelId', m."SelectedTenantAiModelId")::text,
                    NOW() AT TIME ZONE 'UTC'
                FROM iam."UserTenantMemberships" m
                WHERE m."SelectedTenantAiModelId" IS NOT NULL
                  AND m."DeletedOn" IS NULL;
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_TenantAiModels_Users_CreatedByUserId",
                schema: "dbo",
                table: "TenantAiModels");

            migrationBuilder.DropForeignKey(
                name: "FK_UserTenantMemberships_TenantAiModels_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships");

            migrationBuilder.DropIndex(
                name: "IX_UserTenantMemberships_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships");

            migrationBuilder.DropIndex(
                name: "IX_TenantAiModels_CreatedByUserId",
                schema: "dbo",
                table: "TenantAiModels");

            migrationBuilder.DropColumn(
                name: "SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE iam."UserTenantMemberships" m
                SET "SelectedTenantAiModelId" = (p."PreferencesJson"::jsonb ->> 'aiBuilder.selectedModelId')::integer
                FROM iam."UserTenantPreferences" p
                WHERE m."UserId" = p."UserId"
                  AND m."TenantId" = p."TenantId"
                  AND p."DeletedOn" IS NULL
                  AND p."PreferencesJson"::jsonb ? 'aiBuilder.selectedModelId';
                """);

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships",
                column: "SelectedTenantAiModelId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantAiModels_CreatedByUserId",
                schema: "dbo",
                table: "TenantAiModels",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_TenantAiModels_Users_CreatedByUserId",
                schema: "dbo",
                table: "TenantAiModels",
                column: "CreatedByUserId",
                principalSchema: "iam",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserTenantMemberships_TenantAiModels_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships",
                column: "SelectedTenantAiModelId",
                principalSchema: "dbo",
                principalTable: "TenantAiModels",
                principalColumn: "TenantAiModelId",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.DropTable(
                name: "UserTenantPreferences",
                schema: "iam");
        }
    }
}
