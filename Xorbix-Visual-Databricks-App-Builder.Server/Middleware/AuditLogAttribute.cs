using System;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Middleware;

/// <summary>
/// Marks a controller action for automatic audit logging.
/// </summary>
[AttributeUsage(AttributeTargets.Method, AllowMultiple = false)]
public class AuditLogAttribute : Attribute
{
    /// <summary>
    /// The action type to record (e.g., "Create", "Update", "Delete", "Login").
    /// </summary>
    public string ActionType { get; }

    /// <summary>
    /// The entity type affected (e.g., "user", "connection", "app").
    /// </summary>
    public string EntityType { get; }

    /// <summary>
    /// Whether to log when the action result is a failure (4xx/5xx). Defaults to true.
    /// Set to false for noisy read-only endpoints where failure logging is not useful.
    /// </summary>
    public bool LogOnFailure { get; set; } = true;

    /// <summary>
    /// Whether to log when the action result is a success (2xx). Defaults to true.
    /// Set to false to only capture failures (e.g., failed login attempts).
    /// </summary>
    public bool LogOnSuccess { get; set; } = true;

    public AuditLogAttribute(string actionType, string entityType)
    {
        ActionType = actionType;
        EntityType = entityType;
    }
}