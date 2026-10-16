using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;

/// <summary>
/// Service for Columns layout component
/// </summary>
public class ColumnsComponentService : BaseComponentService, IColumnsComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Columns;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new ColumnsComponentDto
        {
            Id = "template-columns",
            CodeName = "templateColumns",
            Type = ComponentType.Columns,
            Category = ComponentCategory.Layout,
            Icon = "Columns3",
            SchemaVersion = 1,
            Props = new ColumnsProps
            {
                ColumnCount = 2
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
        var columns = component as ColumnsComponentDto;
        if (columns == null)
            return $"{indentation}st.error('Invalid Columns component')";

        var varName = GetVariableName(component);
        var colCount = columns.Props.ColumnCount ?? 2;
        var childrenIds = component.Children ?? new List<string>();

        sb.AppendLine($"{indentation}{varName} = st.columns({colCount})");

        if (allComponents != null && childrenIds.Any())
        {
            for (int i = 0; i < colCount; i++)
            {
                sb.AppendLine($"{indentation}with {varName}[{i}]:");

                if (i < childrenIds.Count && !string.IsNullOrEmpty(childrenIds[i]))
                {
                    var childComponent = allComponents.FirstOrDefault(c => c.Id == childrenIds[i]);
                    if (childComponent != null)
                    {
                        // Use GenerationService for recursive child generation if available
                        var childCode = GenerationService != null
                            ? GenerationService.GenerateComponentCode(childComponent, indentation + "    ", allComponents)
                            : $"{indentation}    st.text('Column {i + 1}')";
                        sb.AppendLine(childCode);
                    }
                    else
                    {
                        sb.AppendLine($"{indentation}    st.text('Column {i + 1}')");
                    }
                }
                else
                {
                    sb.AppendLine($"{indentation}    st.text('Column {i + 1}')");
                }
            }
        }

        return sb.ToString().TrimEnd();
    }
}