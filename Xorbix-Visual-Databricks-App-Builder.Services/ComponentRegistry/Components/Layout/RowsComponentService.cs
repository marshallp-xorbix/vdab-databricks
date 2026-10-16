using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;

/// <summary>
/// Service for Rows layout component
/// </summary>
public class RowsComponentService : BaseComponentService, IRowsComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Rows;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new RowsComponentDto
        {
            Id = "template-rows",
            CodeName = "templateRows",
            Type = ComponentType.Rows,
            Category = ComponentCategory.Layout,
            Icon = "Rows3",
            SchemaVersion = 1,
            Props = new RowsProps
            {
                RowCount = 2
            }
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        var sb = new StringBuilder();
        var rows = component as RowsComponentDto;
        if (rows == null)
            return $"{indentation}st.error('Invalid Rows component')";

        var varName = GetVariableName(component);
        var rowCount = rows.Props.RowCount ?? 2;
        var childrenIds = component.Children ?? new List<string>();

        sb.AppendLine($"{indentation}# Rows layout (using st.container for vertical stacking)");
        sb.AppendLine($"{indentation}{varName} = st.container();");
        sb.AppendLine($"{indentation}with {varName}:");

        if (allComponents != null && childrenIds.Any())
        {
            for (int i = 0; i < rowCount; i++)
            {
                if (i < childrenIds.Count && !string.IsNullOrEmpty(childrenIds[i]))
                {
                    var childComponent = allComponents.FirstOrDefault(c => c.Id == childrenIds[i]);
                    if (childComponent != null)
                    {
                        // Use GenerationService for recursive child generation if available
                        var childCode = GenerationService != null
                            ? GenerationService.GenerateComponentCode(childComponent, indentation + "    ", allComponents)
                            : $"{indentation}    st.text('Row {i + 1}')";
                        sb.AppendLine(childCode);
                    }
                    else
                    {
                        sb.AppendLine($"{indentation}    st.text('Row {i + 1}')");
                    }
                }
                else
                {
                    sb.AppendLine($"{indentation}    st.text('Row {i + 1}')");
                }
            }
        }

        return sb.ToString().TrimEnd();
    }
}