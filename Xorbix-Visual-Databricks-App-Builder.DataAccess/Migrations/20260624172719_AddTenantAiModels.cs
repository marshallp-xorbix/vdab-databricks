using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantAiModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TenantAiModels",
                schema: "dbo",
                columns: table => new
                {
                    TenantAiModelId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TenantId = table.Column<Guid>(type: "uuid", nullable: false),
                    DatabricksConnectionId = table.Column<int>(type: "integer", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    EndpointName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    AccessToken = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ModifiedBy = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletedOn = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenantAiModels", x => x.TenantAiModelId);
                    table.ForeignKey(
                        name: "FK_TenantAiModels_DatabricksConnections_DatabricksConnectionId",
                        column: x => x.DatabricksConnectionId,
                        principalSchema: "dbo",
                        principalTable: "DatabricksConnections",
                        principalColumn: "PkId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TenantAiModels_Tenants_TenantId",
                        column: x => x.TenantId,
                        principalSchema: "dbo",
                        principalTable: "Tenants",
                        principalColumn: "TenantId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TenantAiModels_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalSchema: "iam",
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

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

            migrationBuilder.CreateIndex(
                name: "IX_TenantAiModels_DatabricksConnectionId",
                schema: "dbo",
                table: "TenantAiModels",
                column: "DatabricksConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantAiModels_TenantId",
                schema: "dbo",
                table: "TenantAiModels",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_TenantAiModels_TenantId_DisplayName",
                schema: "dbo",
                table: "TenantAiModels",
                columns: new[] { "TenantId", "DisplayName" },
                unique: true,
                filter: "\"DeletedOn\" IS NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_UserTenantMemberships_TenantAiModels_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships",
                column: "SelectedTenantAiModelId",
                principalSchema: "dbo",
                principalTable: "TenantAiModels",
                principalColumn: "TenantAiModelId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserTenantMemberships_TenantAiModels_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships");

            migrationBuilder.DropTable(
                name: "TenantAiModels",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_UserTenantMemberships_SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships");

            migrationBuilder.DropColumn(
                name: "SelectedTenantAiModelId",
                schema: "iam",
                table: "UserTenantMemberships");
        }
    }
}
