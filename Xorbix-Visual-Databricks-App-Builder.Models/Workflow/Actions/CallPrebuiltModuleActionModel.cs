using Xorbix_Visual_Databricks_App_Builder.Models.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

/// <summary>
/// Invokes a curated function from <c>prebuilt_modules_library.py</c> with a generated VDAB context and string literal arguments.
/// </summary>
public sealed class CallPrebuiltModuleActionModel : WorkflowActionNodeModel
{
    /// <summary>
    /// Top-level function name in <c>prebuilt_modules_library</c>.
    /// </summary>
    public required string FunctionName { get; init; }

    /// <summary>
    /// Named arguments for parameters after <c>ctx</c>; values are emitted as Python string literals.
    /// </summary>
    public Dictionary<string, string> NamedArguments { get; init; } = new(StringComparer.Ordinal);

    public override WorkflowActionKind ActionType => WorkflowActionKind.CallPrebuiltModule;
}
