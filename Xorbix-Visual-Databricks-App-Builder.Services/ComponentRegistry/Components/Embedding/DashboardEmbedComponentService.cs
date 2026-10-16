using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Embedding;

/// <summary>
/// Service for Dashboard embed component (Databricks Lakeview iframe).
/// </summary>
public class DashboardEmbedComponentService : BaseComponentService, IDashboardEmbedComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.DashboardEmbed;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new DashboardEmbedComponentDto
        {
            Id = "template-dashboard-embed",
            CodeName = "templateDashboardEmbed",
            Type = ComponentType.DashboardEmbed,
            Category = ComponentCategory.Visualization,
            Icon = "LayoutPanelTop",
            SchemaVersion = 1,
            Props = new DashboardEmbedProps
            {
                Src = string.Empty,
                Height = ComponentHeightBounds.DefaultPixels,
                Scrolling = true
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
        DashboardEmbedComponentDto? embed = component as DashboardEmbedComponentDto;
        if (embed == null)
        {
            return $"{indentation}st.error('Invalid Dashboard embed component')";
        }

        if (string.IsNullOrWhiteSpace(embed.Props.Src))
        {
            sb.AppendLine($"{indentation}st.info('Add a Databricks dashboard embed URL in the builder (Share → Embed iframe).')");
            return sb.ToString().TrimEnd();
        }

        string srcLiteral = ToPythonDoubleQuotedString(embed.Props.Src);
        int height = Math.Clamp(
            embed.Props.Height > 0 ? embed.Props.Height : ComponentHeightBounds.DefaultPixels,
            ComponentHeightBounds.MinPixels,
            ComponentHeightBounds.MaxPixels);
        bool scrolling = embed.Props.Scrolling ?? true;
        sb.AppendLine($"{indentation}components.iframe(src={srcLiteral}, height={height}, scrolling={ToPythonBool(scrolling)})");

        return sb.ToString().TrimEnd();
    }
}
