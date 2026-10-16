using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Npgsql;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Xorbix_Visual_Databricks_App_Builder.HealthChecks
{
    public class PostgresHealthCheck : IHealthCheck
    {
        private readonly string _connectionString;

        public PostgresHealthCheck(IOptions<ConnectionStrings> connectionStrings)
        {
            _connectionString = connectionStrings?.Value?.PostgreSql ?? string.Empty;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_connectionString))
            {
                return HealthCheckResult.Unhealthy("PostgreSql connection string is missing.");
            }

            try
            {
                await using var connection = new NpgsqlConnection(_connectionString);
                await connection.OpenAsync(cancellationToken);

                await using var command = new NpgsqlCommand("SELECT 1", connection);
                await command.ExecuteScalarAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy(
                    "PostgreSQL health check failed.",
                    ex);
            }

            return HealthCheckResult.Healthy();
        }
    }
}