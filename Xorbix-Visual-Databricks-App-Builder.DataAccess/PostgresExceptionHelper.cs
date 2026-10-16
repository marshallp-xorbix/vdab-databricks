using System.Text.RegularExpressions;
using Npgsql;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Shared helpers for interpreting PostgreSQL errors from EF Core and Npgsql.
/// </summary>
public static partial class PostgresExceptionHelper
{
    /// <summary>
    /// SQLSTATE 42P01 — undefined_table.
    /// </summary>
    public const string UndefinedTableSqlState = "42P01";

    /// <summary>
    /// SQLSTATE 23505 — unique_violation.
    /// </summary>
    public const string UniqueViolationSqlState = "23505";

    /// <summary>
    /// Returns true when <paramref name="exception"/> or an inner exception is a
    /// <see cref="PostgresException"/> with SQLSTATE 42P01 (undefined table).
    /// </summary>
    public static bool IsUndefinedTable(Exception exception) =>
        HasSqlState(exception, UndefinedTableSqlState);

    /// <summary>
    /// Returns true when <paramref name="exception"/> or an inner exception is a
    /// <see cref="PostgresException"/> with SQLSTATE 23505 (unique violation).
    /// </summary>
    public static bool IsUniqueViolation(Exception exception) =>
        HasSqlState(exception, UniqueViolationSqlState);

    /// <summary>
    /// When <paramref name="exception"/> (or an inner exception) is a unique violation,
    /// returns the violated constraint/index name from <see cref="PostgresException.ConstraintName"/>
    /// or, if that is empty, from the usual Postgres message text.
    /// </summary>
    /// <param name="exception">The exception to inspect.</param>
    /// <param name="constraintName">The constraint or index name when known; otherwise null.</param>
    /// <returns>True when the exception is a unique violation.</returns>
    public static bool TryGetUniqueViolationConstraintName(
        Exception exception,
        out string? constraintName)
    {
        constraintName = null;
        Exception? current = exception;
        while (current is not null)
        {
            if (current is PostgresException postgresException
                && string.Equals(postgresException.SqlState, UniqueViolationSqlState, StringComparison.Ordinal))
            {
                if (!string.IsNullOrWhiteSpace(postgresException.ConstraintName))
                {
                    constraintName = postgresException.ConstraintName;
                }
                else
                {
                    constraintName = TryParseConstraintNameFromMessage(
                        postgresException.MessageText ?? postgresException.Message);
                }

                return true;
            }

            current = current.InnerException;
        }

        return false;
    }

    private static bool HasSqlState(Exception exception, string sqlState)
    {
        Exception? current = exception;
        while (current is not null)
        {
            if (current is PostgresException postgresException
                && string.Equals(postgresException.SqlState, sqlState, StringComparison.Ordinal))
            {
                return true;
            }

            current = current.InnerException;
        }

        return false;
    }

    private static string? TryParseConstraintNameFromMessage(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return null;
        }

        Match match = UniqueConstraintNameRegex().Match(message);
        return match.Success ? match.Groups["name"].Value : null;
    }

    [GeneratedRegex(
        @"violates unique constraint ""(?<name>[^""]+)""",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex UniqueConstraintNameRegex();
}
