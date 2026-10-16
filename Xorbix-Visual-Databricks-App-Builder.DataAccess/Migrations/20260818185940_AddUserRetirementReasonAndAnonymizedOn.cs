using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class AddUserRetirementReasonAndAnonymizedOn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AnonymizedOn",
                schema: "iam",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RetirementReason",
                schema: "iam",
                table: "Users",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AnonymizedOn",
                schema: "iam",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "RetirementReason",
                schema: "iam",
                table: "Users");
        }
    }
}
