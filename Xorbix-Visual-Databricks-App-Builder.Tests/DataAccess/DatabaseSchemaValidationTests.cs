using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Npgsql;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Validates that a live (migrated) Postgres database matches the EF Core model by introspecting
/// <c>information_schema</c> and comparing tables, columns, nullability, and primary keys. This catches
/// out-of-band drift between a deployed database and the model that the migration-snapshot check
/// (<see cref="MigrationModelSyncTests"/>) cannot see.
///
/// Skipped unless <c>ConnectionStrings__PostgreSql</c> is set, and tagged
/// <c>Category=RequiresDatabaseSchema</c> so CI can exclude it with
/// <c>dotnet test --filter "Category!=RequiresDatabaseSchema"</c>.
/// </summary>
[Trait("Category", "RequiresDatabaseSchema")]
public class DatabaseSchemaValidationTests
{
    [RequiresDatabaseSchemaFact]
    public async Task EfModel_MatchesDatabaseSchema()
    {
        string connectionString =
            Environment.GetEnvironmentVariable(RequiresDatabaseSchemaFactAttribute.ConnectionStringEnvironmentVariable)!;

        DbContextOptions<ApplicationDbContext> options =
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(connectionString)
                .Options;

        using ApplicationDbContext context = new(options);
        await using NpgsqlConnection connection = new(connectionString);
        await connection.OpenAsync();

        List<string> discrepancies = [];

        foreach (IEntityType entityType in context.Model.GetEntityTypes().Where(type => !type.IsOwned()))
        {
            string? tableName = entityType.GetTableName();
            if (string.IsNullOrEmpty(tableName))
            {
                continue;
            }

            string schema = entityType.GetSchema() ?? "dbo";
            StoreObjectIdentifier storeObject = StoreObjectIdentifier.Table(tableName, schema);

            if (!await TableExistsAsync(connection, schema, tableName))
            {
                discrepancies.Add($"Missing table {schema}.{tableName} (entity {entityType.ClrType.Name}).");
                continue;
            }

            foreach (IProperty property in entityType.GetProperties())
            {
                string? columnName = property.GetColumnName(storeObject);
                if (string.IsNullOrEmpty(columnName))
                {
                    continue;
                }

                await ValidateColumnAsync(connection, schema, tableName, columnName, property, discrepancies);
            }

            await ValidatePrimaryKeyAsync(connection, schema, tableName, entityType, storeObject, discrepancies);
        }

        Assert.True(
            discrepancies.Count == 0,
            "EF model does not match the database schema:"
            + Environment.NewLine
            + string.Join(Environment.NewLine, discrepancies));
    }

    private static async Task<bool> TableExistsAsync(NpgsqlConnection connection, string schema, string table)
    {
        const string sql =
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = @schema AND table_name = @table";

        await using NpgsqlCommand command = new(sql, connection);
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("table", table);

        long count = Convert.ToInt64(await command.ExecuteScalarAsync() ?? 0L);
        return count > 0;
    }

    private static async Task ValidateColumnAsync(
        NpgsqlConnection connection,
        string schema,
        string table,
        string column,
        IProperty property,
        List<string> discrepancies)
    {
        const string sql =
            "SELECT character_maximum_length, is_nullable FROM information_schema.columns "
            + "WHERE table_schema = @schema AND table_name = @table AND column_name = @column";

        await using NpgsqlCommand command = new(sql, connection);
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("table", table);
        command.Parameters.AddWithValue("column", column);

        await using NpgsqlDataReader reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            discrepancies.Add($"Missing column {schema}.{table}.{column} (property {property.Name}).");
            return;
        }

        int? databaseMaxLength = reader.IsDBNull(0) ? null : reader.GetInt32(0);
        bool databaseNullable = reader.GetString(1).Equals("YES", StringComparison.OrdinalIgnoreCase);

        if (databaseNullable != property.IsNullable)
        {
            discrepancies.Add(
                $"Nullability mismatch {schema}.{table}.{column}: model={property.IsNullable}, database={databaseNullable}.");
        }

        int? modelMaxLength = property.GetMaxLength();
        if (modelMaxLength is not null && databaseMaxLength is not null && modelMaxLength != databaseMaxLength)
        {
            discrepancies.Add(
                $"Max-length mismatch {schema}.{table}.{column}: model={modelMaxLength}, database={databaseMaxLength}.");
        }
    }

    private static async Task ValidatePrimaryKeyAsync(
        NpgsqlConnection connection,
        string schema,
        string table,
        IEntityType entityType,
        StoreObjectIdentifier storeObject,
        List<string> discrepancies)
    {
        IKey? primaryKey = entityType.FindPrimaryKey();
        if (primaryKey is null)
        {
            return;
        }

        List<string> modelColumns = primaryKey.Properties
            .Select(property => property.GetColumnName(storeObject) ?? property.Name)
            .OrderBy(column => column, StringComparer.Ordinal)
            .ToList();

        List<string> databaseColumns = await GetPrimaryKeyColumnsAsync(connection, schema, table);
        databaseColumns.Sort(StringComparer.Ordinal);

        if (!modelColumns.SequenceEqual(databaseColumns))
        {
            discrepancies.Add(
                $"Primary-key mismatch {schema}.{table}: model=[{string.Join(", ", modelColumns)}], "
                + $"database=[{string.Join(", ", databaseColumns)}].");
        }
    }

    private static async Task<List<string>> GetPrimaryKeyColumnsAsync(NpgsqlConnection connection, string schema, string table)
    {
        const string sql =
            "SELECT kcu.column_name "
            + "FROM information_schema.table_constraints tc "
            + "JOIN information_schema.key_column_usage kcu "
            + "  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
            + "WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = @schema AND tc.table_name = @table";

        await using NpgsqlCommand command = new(sql, connection);
        command.Parameters.AddWithValue("schema", schema);
        command.Parameters.AddWithValue("table", table);

        List<string> columns = [];
        await using NpgsqlDataReader reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            columns.Add(reader.GetString(0));
        }

        return columns;
    }
}
