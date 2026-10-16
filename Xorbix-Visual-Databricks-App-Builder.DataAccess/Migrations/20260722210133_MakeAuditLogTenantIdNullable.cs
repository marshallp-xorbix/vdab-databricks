using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess.Migrations
{
    /// <inheritdoc />
    public partial class MakeAuditLogTenantIdNullable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Tenants_TenantId",
                schema: "dbo",
                table: "AuditLogs");

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                schema: "dbo",
                table: "AuditLogs",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Tenants_TenantId",
                schema: "dbo",
                table: "AuditLogs",
                column: "TenantId",
                principalSchema: "dbo",
                principalTable: "Tenants",
                principalColumn: "TenantId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AuditLogs_Tenants_TenantId",
                schema: "dbo",
                table: "AuditLogs");

            migrationBuilder.AlterColumn<Guid>(
                name: "TenantId",
                schema: "dbo",
                table: "AuditLogs",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_AuditLogs_Tenants_TenantId",
                schema: "dbo",
                table: "AuditLogs",
                column: "TenantId",
                principalSchema: "dbo",
                principalTable: "Tenants",
                principalColumn: "TenantId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
