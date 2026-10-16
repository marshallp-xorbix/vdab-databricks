using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

/// <summary>
/// Stable environment variable names for Lakebase workflow routing in generated <c>app.yaml</c> and Streamlit runtime.
/// </summary>
public static class LakebaseWorkflowEnvNaming
{
    /// <summary>
    /// Env var holding the provisioned Lakebase host from <c>valueFrom</c> (resource key).
    /// </summary>
    public static string ProvisionedHostEnvironmentVariableName(string resourceKey) =>
        $"VDAB_LB_HOST_{ToEnvSuffix(resourceKey)}";

    /// <summary>
    /// Env var holding the autoscaling Postgres endpoint path from <c>valueFrom</c>.
    /// </summary>
    public static string AutoscalingEndpointEnvironmentVariableName(string resourceKey) =>
        $"VDAB_LB_EP_{ToEnvSuffix(resourceKey)}";

    /// <summary>
    /// Optional env var name for a per-resource Postgres database override. Not emitted in app.yaml; workflow
    /// runtime uses <c>PGDATABASE</c> (same as Lakebase bindings) when unset.
    /// </summary>
    public static string DatabaseEnvironmentVariableName(string resourceKey) =>
        $"VDAB_LB_DB_{ToEnvSuffix(resourceKey)}";

    private static string ToEnvSuffix(string resourceKey)
    {
        string trimmed = resourceKey.Trim();
        if (trimmed.Length == 0)
        {
            return "UNBOUND";
        }

        StringBuilder sb = new();
        bool lastUnderscore = false;
        foreach (char c in trimmed)
        {
            if (char.IsLetterOrDigit(c))
            {
                sb.Append(char.ToUpperInvariant(c));
                lastUnderscore = false;
            }
            else
            {
                if (sb.Length > 0 && !lastUnderscore)
                {
                    sb.Append('_');
                    lastUnderscore = true;
                }
            }
        }

        string result = sb.ToString().TrimEnd('_');
        return result.Length > 0 ? result : "RESOURCE";
    }
}
