using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Typed BuildSql workflow node model.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/actions/buildSql.ts
/// </summary>
public sealed class BuildSqlActionModel : WorkflowActionNodeModel
{
    public required WorkflowSqlSourceKind SqlSourceKind { get; init; }

    public required string SqlTemplate { get; init; }

    public List<BuildSqlPlaceholderReference> Placeholders { get; init; } = new();

    /// <summary>
    /// Databricks App resource name/key for Lakebase BuildSql nodes (matches App Settings resource <c>name</c> / <c>valueFrom</c>).
    /// Must be null/empty when <see cref="SqlSourceKind"/> is Unity Catalog.
    /// </summary>
    public string? LakebaseAppResourceName { get; init; }

    /// <summary>
    /// Postgres database name for the selected Lakebase app resource. Must be null/empty for Unity Catalog BuildSql.
    /// </summary>
    public string? LakebaseDatabaseName { get; init; }

    public override WorkflowActionKind ActionType => WorkflowActionKind.BuildSql;
}

/// <summary>
/// Supported SQL execution source kinds for typed workflow actions.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/sharedReferences.ts
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkflowSqlSourceKind
{
    [JsonStringEnumMemberName("unityCatalogTable")]
    UnityCatalogTable,

    [JsonStringEnumMemberName("lakebaseProvisionedDatabase")]
    LakebaseProvisionedDatabase,

    [JsonStringEnumMemberName("lakebaseAutoscaling")]
    LakebaseAutoscaling
}