using Azure.Communication.Email;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults.Config;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace Xorbix_Visual_Databricks_App_Builder.HealthChecks
{
    public sealed class EmailServiceHealthCheck : IHealthCheck
    {
        private readonly string _connectionString;
        private readonly EmailConfiguration _emailConfiguration;

        public EmailServiceHealthCheck(
            IOptions<ConnectionStrings> connectionStrings,
            IOptions<EmailConfiguration> emailConfiguration)
        {
            _connectionString = connectionStrings.Value.CommunicationService ?? string.Empty;
            _emailConfiguration = emailConfiguration.Value;
        }

        public Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_connectionString))
            {
                return Task.FromResult(
                    HealthCheckResult.Unhealthy("CommunicationService connection string is missing."));
            }

            if (string.IsNullOrWhiteSpace(_emailConfiguration.SenderDisplayName))
            {
                return Task.FromResult(
                    HealthCheckResult.Unhealthy("EmailConfiguration:SenderDisplayName is not configured."));
            }
            return Task.FromResult(HealthCheckResult.Healthy("Email service configuration is present; service not probed."));
        }
    }
}