using System.Text;
using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

/// <summary>
/// Formats canvas, workflow, and module context appended to AI Builder prompts.
/// </summary>
internal static class AiBuilderPromptContextFormatter
{
    private const int MaxCustomModulesPromptLength = 12000;

    /// <summary>
    /// Builds the canvas, workflow, and custom-module context block for the user prompt.
    /// </summary>
    internal static string BuildCanvasContext(
        List<CanvasComponentSummaryDto> components,
        List<WorkflowSummaryDto> workflows,
        string customModulesCode)
    {
        StringBuilder sb = new();

        if (components.Count == 0)
        {
            sb.Append("\n\nThe canvas is currently empty.");
        }
        else
        {
            sb.Append("\n\nCURRENT CANVAS STATE (indentation = nesting depth):\n");

            Dictionary<string, CanvasComponentSummaryDto> byId = new(StringComparer.OrdinalIgnoreCase);
            foreach (CanvasComponentSummaryDto component in components)
            {
                if (string.IsNullOrWhiteSpace(component.Id) || byId.ContainsKey(component.Id))
                    continue;

                byId[component.Id] = component;
            }

            HashSet<string> childIds = components
                .SelectMany(c => c.Children)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            List<CanvasComponentSummaryDto> roots = byId.Values.Where(c => !childIds.Contains(c.Id)).ToList();
            List<CanvasComponentSummaryDto> pageRoots = roots.Where(c => !string.Equals(c.Type, "Modal", StringComparison.OrdinalIgnoreCase)).ToList();
            List<CanvasComponentSummaryDto> modalRoots = roots.Where(c => string.Equals(c.Type, "Modal", StringComparison.OrdinalIgnoreCase)).ToList();

            if (pageRoots.Count > 0)
            {
                sb.AppendLine("-- Main Page --");
                foreach (CanvasComponentSummaryDto root in pageRoots)
                    AppendComponentLine(sb, root, byId, depth: 1);
            }

            foreach (CanvasComponentSummaryDto modal in modalRoots)
            {
                sb.AppendLine($"-- Modal: {modal.CodeName}  id:{modal.Id} --");
                foreach (string childId in modal.Children)
                {
                    if (byId.TryGetValue(childId, out CanvasComponentSummaryDto? child))
                        AppendComponentLine(sb, child, byId, depth: 1);
                }
            }

            sb.Append("Use the exact id values above for delete and modify operations. When modifying, preserve existing props you are not changing.");
        }

        if (workflows.Count > 0)
        {
            sb.Append("\n\nCURRENT WORKFLOWS:\n");
            foreach (WorkflowSummaryDto workflow in workflows)
            {
                string nodeList = workflow.Nodes.Count > 0
                    ? "  nodes:[" + string.Join("→", workflow.Nodes.Select(FormatWorkflowNode)) + "]"
                    : string.Empty;
                string edgeList = workflow.Edges.Count > 0
                    ? "  edges:[" + string.Join(",", workflow.Edges.Select(e => $"{e.FromNodeId}->{e.ToNodeId}({e.Route})")) + "]"
                    : string.Empty;
                sb.AppendLine($"  codeName:{workflow.CodeName}  trigger:{workflow.TriggerComponentCodeName}.{workflow.TriggerEventKey}{nodeList}{edgeList}");
            }

            sb.Append("Use the exact codeName values above for deleteWorkflow.");
        }

        AppendModuleContext(sb, customModulesCode);

        return sb.ToString();
    }

    private static void AppendModuleContext(StringBuilder sb, string customModulesCode)
    {
        string resolvedCustomModulesCode = CustomModulesTemplate.ResolveContent(customModulesCode);
        List<AiBuilderModuleFunction> customFunctions = AiBuilderModuleFunctionParser.ParseCallableCustomFunctions(resolvedCustomModulesCode);
        List<AiBuilderModuleFunction> prebuiltFunctions = AiBuilderModuleFunctionParser.ParsePrebuiltFunctions(PrebuiltModulesLibrary.GetContent());

        sb.Append("\n\nCUSTOM MODULE FUNCTIONS (from current custom_modules.py):\n");
        if (customFunctions.Count == 0)
            sb.AppendLine("  none");
        else
            foreach (AiBuilderModuleFunction function in customFunctions)
                sb.AppendLine($"  {function.Signature}");

        sb.Append("\nPREBUILT MODULE FUNCTIONS (prefer these before writing custom code when suitable):\n");
        if (prebuiltFunctions.Count == 0)
            sb.AppendLine("  none");
        else
            foreach (AiBuilderModuleFunction function in prebuiltFunctions)
                sb.AppendLine($"  {function.Signature}");

        sb.Append("\nCURRENT custom_modules.py SOURCE:\n");
        sb.AppendLine("```python");
        sb.AppendLine(TruncateForPrompt(resolvedCustomModulesCode, MaxCustomModulesPromptLength));
        sb.AppendLine("```");
    }

    private static string TruncateForPrompt(string value, int maxLength)
    {
        if (value.Length <= maxLength)
            return value;

        return value[..maxLength] + "\n# ... truncated for AI Builder context ...";
    }

    private static string FormatWorkflowNode(WorkflowNodeSummaryDto node)
    {
        string paramsText = node.Params.HasValue && node.Params.Value.ValueKind == JsonValueKind.Object
            ? $" params:{JsonSerializer.Serialize(node.Params.Value, AiBuilderJsonOptions.Compact)}"
            : string.Empty;

        return $"{node.NodeId}({node.ActionType}{paramsText})";
    }

    private static void AppendComponentLine(
        StringBuilder sb,
        CanvasComponentSummaryDto component,
        Dictionary<string, CanvasComponentSummaryDto> byId,
        int depth)
    {
        string indent = new(' ', depth * 2);
        string propsStr = component.Props.HasValue && component.Props.Value.ValueKind == JsonValueKind.Object
            ? $"  props:{JsonSerializer.Serialize(component.Props.Value, AiBuilderJsonOptions.Compact)}"
            : string.Empty;

        sb.AppendLine($"{indent}[{component.Type}] codeName:{component.CodeName}  id:{component.Id}{propsStr}");

        foreach (string childId in component.Children)
        {
            if (byId.TryGetValue(childId, out CanvasComponentSummaryDto? child))
                AppendComponentLine(sb, child, byId, depth + 1);
        }
    }
}
