using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;

/// <summary>
/// Service for Expander layout component
/// </summary>
public class ExpanderComponentService : BaseComponentService, IExpanderComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Expander;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new ExpanderComponentDto
        {
            Id = "template-expander",
            CodeName = "templateExpander",
            Type = ComponentType.Expander,
            Category = ComponentCategory.Layout,
            Icon = "ChevronsUpDown",
            SchemaVersion = 1,
            Props = new ExpanderProps
            {
                SectionTitle = "Section",
                DefaultExpanded = false
            },
            SupportedEvents = new List<string>()
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        StringBuilder sb = new StringBuilder();
        ExpanderComponentDto? expander = component as ExpanderComponentDto;
        if (expander == null)
        {
            return $"{indentation}st.error('Invalid Expander component')";
        }

        string sectionTitle = expander.Props.SectionTitle ?? "Section";
        bool expanded = expander.Props.DefaultExpanded;

        sb.AppendLine($"{indentation}with st.expander('{EscapePythonSingleQuotedString(sectionTitle)}', expanded={ToPythonBool(expanded)}):");

        if (component.Children != null && component.Children.Any() && allComponents != null)
        {
            Dictionary<string, VdabComponentDto> componentsById = allComponents
                .GroupBy(childComponent => childComponent.Id)
                .ToDictionary(group => group.Key, group => group.First());

            List<VdabComponentDto> orderedChildren = component.Children
                .Where(childId => !string.IsNullOrWhiteSpace(childId))
                .Select(childId => componentsById.TryGetValue(childId, out VdabComponentDto? childComponent)
                    ? childComponent
                    : null)
                .Where(childComponent => childComponent != null)
                .Cast<VdabComponentDto>()
                .OrderBy(childComponent => LayoutJsonHelper.ParseLayoutY(childComponent.Layout))
                .ToList();

            if (orderedChildren.Count > 0)
            {
                foreach (VdabComponentDto childComponent in orderedChildren)
                {
                    string childCode = GenerationService != null
                        ? GenerationService.GenerateComponentCode(childComponent, indentation + "    ", allComponents)
                        : $"{indentation}    st.text('Add components to expander')";
                    sb.AppendLine(childCode);
                }
            }
            else
            {
                sb.AppendLine($"{indentation}    st.text('Add components to expander')");
            }
        }
        else
        {
            sb.AppendLine($"{indentation}    st.text('Add components to expander')");
        }

        return sb.ToString().TrimEnd();
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
