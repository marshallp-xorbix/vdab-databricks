using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddMembershipStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Status",
                schema: "iam",
                table: "UserTenantMemberships",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Soft-deleted rows were Ended memberships; live rows stay Active (default 0).
            migrationBuilder.Sql(
                """
                UPDATE iam."UserTenantMemberships"
                SET "Status" = 2
                WHERE "DeletedOn" IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                schema: "iam",
                table: "UserTenantMemberships");
        }
    }
}
