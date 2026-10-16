using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;

/// <summary>
/// Structured placeholder metadata for BuildSql workflow actions.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/sharedReferences.ts
/// </summary>
public class BuildSqlPlaceholderReference
{
    public required string Token { get; init; }

    public required string ComponentCodeName { get; init; }

    public required WorkflowValueType ValueType { get; init; }

    public BuildSqlFormatHint? FormatHint { get; init; }
}

/// <summary>
/// Supported typed values for workflow placeholder substitution.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/sharedReferences.ts
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum WorkflowValueType
{
    [JsonStringEnumMemberName("string")]
    String,

    [JsonStringEnumMemberName("number")]
    Number,

    [JsonStringEnumMemberName("boolean")]
    Boolean,

    [JsonStringEnumMemberName("date")]
    Date,

    [JsonStringEnumMemberName("datetime")]
    DateTime,

    [JsonStringEnumMemberName("unknown")]
    Unknown
}

/// <summary>
/// Supported formatting hints for SQL placeholder substitution.
/// Frontend sibling: xorbix-visual-databricks-app-builder.client/src/types/workflow/sharedReferences.ts
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BuildSqlFormatHint
{
    [JsonStringEnumMemberName("raw")]
    Raw,

    [JsonStringEnumMemberName("sqlStringLiteral")]
    SqlStringLiteral,

    [JsonStringEnumMemberName("sqlIdentifier")]
    SqlIdentifier,

    [JsonStringEnumMemberName("dateLiteral")]
    DateLiteral
}