using Npgsql;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Pins SQLSTATE recognition used to map Postgres unique violations to <c>ConflictError</c>.
/// </summary>
public class PostgresExceptionHelperTests
{
    [Fact]
    public void IsUniqueViolation_True_ForDirect23505()
    {
        PostgresException exception = new(
            "23505: duplicate key",
            severity: string.Empty,
            invariantSeverity: string.Empty,
            sqlState: PostgresExceptionHelper.UniqueViolationSqlState);

        Assert.True(PostgresExceptionHelper.IsUniqueViolation(exception));
    }

    [Fact]
    public void IsUniqueViolation_True_ForNested23505()
    {
        PostgresException inner = new(
            "23505: duplicate key",
            severity: string.Empty,
            invariantSeverity: string.Empty,
            sqlState: PostgresExceptionHelper.UniqueViolationSqlState);
        Exception outer = new InvalidOperationException("save failed", inner);

        Assert.True(PostgresExceptionHelper.IsUniqueViolation(outer));
    }

    [Fact]
    public void IsUniqueViolation_False_ForUndefinedTable()
    {
        PostgresException exception = new(
            "42P01: relation does not exist",
            severity: string.Empty,
            invariantSeverity: string.Empty,
            sqlState: PostgresExceptionHelper.UndefinedTableSqlState);

        Assert.False(PostgresExceptionHelper.IsUniqueViolation(exception));
        Assert.True(PostgresExceptionHelper.IsUndefinedTable(exception));
    }

    [Fact]
    public void TryGetUniqueViolationConstraintName_ParsesMembershipIndexFromMessage()
    {
        PostgresException exception = CreateUniqueViolation(
            IndexNames.UserTenantMembershipsUserIdTenantId);

        Assert.True(
            PostgresExceptionHelper.TryGetUniqueViolationConstraintName(
                exception,
                out string? constraintName));
        Assert.Equal(IndexNames.UserTenantMembershipsUserIdTenantId, constraintName);
    }

    [Fact]
    public void TryGetUniqueViolationConstraintName_ParsesDefaultIndexFromNestedMessage()
    {
        PostgresException inner = CreateUniqueViolation(
            IndexNames.UserTenantMembershipsUserIdIsDefault);
        Exception outer = new InvalidOperationException("save failed", inner);

        Assert.True(
            PostgresExceptionHelper.TryGetUniqueViolationConstraintName(
                outer,
                out string? constraintName));
        Assert.Equal(IndexNames.UserTenantMembershipsUserIdIsDefault, constraintName);
    }

    [Fact]
    public void TryGetUniqueViolationConstraintName_False_WhenNotUniqueViolation()
    {
        PostgresException exception = new(
            "42P01: relation does not exist",
            severity: string.Empty,
            invariantSeverity: string.Empty,
            sqlState: PostgresExceptionHelper.UndefinedTableSqlState);

        Assert.False(
            PostgresExceptionHelper.TryGetUniqueViolationConstraintName(
                exception,
                out string? constraintName));
        Assert.Null(constraintName);
    }

    private static PostgresException CreateUniqueViolation(string constraintName) =>
        new(
            $"""23505: duplicate key value violates unique constraint "{constraintName}" """,
            severity: string.Empty,
            invariantSeverity: string.Empty,
            sqlState: PostgresExceptionHelper.UniqueViolationSqlState);
}
