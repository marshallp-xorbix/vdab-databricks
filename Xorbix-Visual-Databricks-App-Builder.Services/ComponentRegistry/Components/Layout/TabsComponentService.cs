using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;

/// <summary>
/// Service for Tabs layout component
/// </summary>
public class TabsComponentService : BaseComponentService, ITabsComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Tabs;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new TabsComponentDto
        {
            Id = "template-tabs",
            CodeName = "templateTabs",
            Type = ComponentType.Tabs,
            Category = ComponentCategory.Layout,
            Icon = "LayoutPanelTop",
            SchemaVersion = 1,
            Props = new TabsProps
            {
                Tabs = ["Tab 1", "Tab 2"],
                DefaultTabIndex = 0
            }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        TabsComponentDto? tabs = component as TabsComponentDto;
        if (tabs == null)
            return $"{indentation}st.error('Invalid Tabs component')";

        string varName = GetVariableName(component);
        List<string> tabLabels = tabs.Props.Tabs;
        if (tabLabels.Count == 0)
        {
            tabLabels = ["Tab 1"];
        }

        List<string> childrenIds = component.Children ?? [];
        Dictionary<int, List<VdabComponentDto>> paneChildrenByIndex = BuildPaneChildrenByIndex(childrenIds, allComponents);

        string labelsArray = "[" + string.Join(", ", tabLabels.Select(label => $"'{EscapePythonSingleQuotedString(label)}'")) + "]";
        sb.AppendLine($"{indentation}{varName} = st.tabs({labelsArray})");

        for (int i = 0; i < tabLabels.Count; i++)
        {
            sb.AppendLine($"{indentation}with {varName}[{i}]:");

            if (paneChildrenByIndex.TryGetValue(i, out List<VdabComponentDto>? paneChildren) && paneChildren.Count > 0)
            {
                foreach (VdabComponentDto child in paneChildren)
                {
                    string childCode = GenerationService != null
                        ? GenerationService.GenerateComponentCode(child, indentation + "    ", allComponents)
                        : $"{indentation}    st.text('{EscapePythonSingleQuotedString(tabLabels[i])}')";
                    sb.AppendLine(childCode);
                }
            }
            else
            {
                sb.AppendLine($"{indentation}    st.text('{EscapePythonSingleQuotedString(tabLabels[i])}')");
            }
        }

        return sb.ToString().TrimEnd();
    }

    private static Dictionary<int, List<VdabComponentDto>> BuildPaneChildrenByIndex(
        List<string> childrenIds,
        List<VdabComponentDto>? allComponents)
    {
        Dictionary<int, List<VdabComponentDto>> paneChildrenByIndex = new Dictionary<int, List<VdabComponentDto>>();
        if (allComponents == null || childrenIds.Count == 0)
        {
            return paneChildrenByIndex;
        }

        Dictionary<string, VdabComponentDto> componentsById = allComponents
            .GroupBy(component => component.Id)
            .ToDictionary(group => group.Key, group => group.First());

        foreach (string childId in childrenIds)
        {
            if (!componentsById.TryGetValue(childId, out VdabComponentDto? childComponent))
            {
                continue;
            }

            int tabIndex = LayoutJsonHelper.ParseTabIndex(childComponent.Layout);
            if (!paneChildrenByIndex.TryGetValue(tabIndex, out List<VdabComponentDto>? paneChildren))
            {
                paneChildren = new List<VdabComponentDto>();
                paneChildrenByIndex[tabIndex] = paneChildren;
            }

            paneChildren.Add(childComponent);
        }

        foreach (KeyValuePair<int, List<VdabComponentDto>> pane in paneChildrenByIndex)
        {
            pane.Value.Sort((left, right) => LayoutJsonHelper.ParseLayoutY(left.Layout).CompareTo(LayoutJsonHelper.ParseLayoutY(right.Layout)));
        }

        return paneChildrenByIndex;
    }

    private static string EscapePythonSingleQuotedString(string value)
    {
        return value
            .Replace("\\", "\\\\")
            .Replace("'", "\\'")
            .Replace("\r", "\\r")
            .Replace("\n", "\\n");
    }

}
