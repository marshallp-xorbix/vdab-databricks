using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class PartialUniqueUserNameAndMembershipIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserTenantMemberships_UserId_TenantId",
                schema: "iam",
                table: "UserTenantMemberships");

            migrationBuilder.DropIndex(
                name: "UserNameIndex",
                schema: "iam",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_UserId_TenantId",
                schema: "iam",
                table: "UserTenantMemberships",
                columns: new[] { "UserId", "TenantId" },
                unique: true,
                filter: "\"DeletedOn\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                schema: "iam",
                table: "Users",
                column: "NormalizedUserName",
                unique: true,
                filter: "\"DeletedOn\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_UserTenantMemberships_UserId_TenantId",
                schema: "iam",
                table: "UserTenantMemberships");

            migrationBuilder.DropIndex(
                name: "UserNameIndex",
                schema: "iam",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_UserTenantMemberships_UserId_TenantId",
                schema: "iam",
                table: "UserTenantMemberships",
                columns: new[] { "UserId", "TenantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                schema: "iam",
                table: "Users",
                column: "NormalizedUserName",
                unique: true);
        }
    }
}
