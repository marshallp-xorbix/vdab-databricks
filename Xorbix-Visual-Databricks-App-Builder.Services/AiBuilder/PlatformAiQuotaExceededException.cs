namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Thrown when a platform-model LLM call is blocked because the user's monthly token quota is exhausted.
/// </summary>
public sealed class PlatformAiQuotaExceededException : Exception
{
    public PlatformAiQuotaExceededException(string message)
        : base(message)
    {
    }
}
