using System.Linq;
using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.StreamlitGeneration;

/// <summary>
/// Emits Python fragments so simple widgets respect <c>ui_overrides</c> labels and
/// <see cref="WorkflowTemplateHelper"/> session_state keys used by custom module <c>ctx</c>.
/// </summary>
internal static class StreamlitUiOverrideSnippets
{
    public static void AppendResolvedLabelVariables(
        StringBuilder sb,
        string indentation,
        string varName,
        string componentCodeName,
        string staticLabelFallback)
    {
        string codeLit = WorkflowTemplateHelper.BuildPythonStringLiteral(componentCodeName);
        string fallbackLit = WorkflowTemplateHelper.BuildPythonStringLiteral(staticLabelFallback);
        sb.AppendLine($"{indentation}_vdab_lbl_{varName} = ui_overrides.get('labels', {{}}).get({codeLit}, None)");
        sb.AppendLine($"{indentation}_vdab_disp_lbl_{varName} = _vdab_lbl_{varName} if _vdab_lbl_{varName} is not None else {fallbackLit}");
    }

    public static void AppendSessionStateInitIfMissing(
        StringBuilder sb,
        string indentation,
        string sessionKey,
        string pythonRhsExpression)
    {
        string keyLit = WorkflowTemplateHelper.BuildPythonStringLiteral(sessionKey);
        sb.AppendLine($"{indentation}if {keyLit} not in st.session_state:");
        sb.AppendLine($"{indentation}    st.session_state[{keyLit}] = {pythonRhsExpression}");
    }

    public static void AppendSessionStateInitIfMissingStringValue(
        StringBuilder sb,
        string indentation,
        string sessionKey,
        string value)
    {
        AppendSessionStateInitIfMissing(
            sb,
            indentation,
            sessionKey,
            WorkflowTemplateHelper.BuildPythonStringLiteral(value));
    }

    public static void AppendSessionStateInitIfMissingBool(
        StringBuilder sb,
        string indentation,
        string sessionKey,
        bool value)
    {
        AppendSessionStateInitIfMissing(
            sb,
            indentation,
            sessionKey,
            value ? "True" : "False");
    }

    public static string BuildPythonStringListLiteral(IReadOnlyList<string> values)
    {
        if (values.Count == 0)
        {
            return "[]";
        }

        return "[" + string.Join(", ", values.Select(v => WorkflowTemplateHelper.BuildPythonStringLiteral(v))) + "]";
    }
}
