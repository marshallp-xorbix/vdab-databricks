using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddRefreshTokenTenantId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TenantId",
                schema: "iam",
                table: "RefreshTokens",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId_TenantId",
                schema: "iam",
                table: "RefreshTokens",
                columns: new[] { "UserId", "TenantId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RefreshTokens_UserId_TenantId",
                schema: "iam",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "TenantId",
                schema: "iam",
                table: "RefreshTokens");
        }
    }
}
