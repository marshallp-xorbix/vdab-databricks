using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;

/// <summary>
/// Service for Modal component
/// </summary>
public class ModalComponentService : BaseComponentService, IModalComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.Modal;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new ModalComponentDto
        {
            Id = "template-modal",
            CodeName = "templateModal",
            Type = ComponentType.Modal,
            Category = ComponentCategory.Page,
            Icon = "MessageSquare",
            SchemaVersion = 1,
            Props = new ModalProps
            {
                Title = "My Modal"
            },
            Children = new List<string>() // for components inside the modal
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        var sb = new StringBuilder();
        var modal = component as ModalComponentDto;
        if (modal == null)
            return $"{indentation}st.error('Invalid Modal component')";

        var varName = GetVariableName(component);
        var title = modal.Props.Title.Replace("\"", "'");

        sb.AppendLine($"{indentation}@st.dialog(\"{title}\", width=\"large\")"); // TODO - make width configurable and render difference in VDAB
        sb.AppendLine($"{indentation}def show_{varName}():");

        // generate children inside dialog
        var childrenIds = component.Children ?? new List<string>();

        if (allComponents != null && childrenIds.Any())
        {
            Dictionary<string, VdabComponentDto> componentsById = allComponents
                .GroupBy(childComponent => childComponent.Id)
                .ToDictionary(group => group.Key, group => group.First());

            List<VdabComponentDto> orderedChildren = childrenIds
                .Where(childId => !string.IsNullOrWhiteSpace(childId))
                .Select(childId => componentsById.TryGetValue(childId, out VdabComponentDto? childComponent)
                    ? childComponent
                    : null)
                .Where(childComponent => childComponent != null)
                .Cast<VdabComponentDto>()
                .OrderBy(childComponent => LayoutJsonHelper.ParseLayoutY(childComponent.Layout))
                .ToList();

            foreach (VdabComponentDto child in orderedChildren)
            {
                // Use GenerationService for recursive child generation if available
                var childCode = GenerationService != null
                    ? GenerationService.GenerateComponentCode(child, indentation + "    ", allComponents)
                    : $"{indentation}    st.write(\"Modal Content\")";
                sb.AppendLine(childCode);
            }
        }
        else
        {
            sb.AppendLine($"{indentation}    st.write(\"Modal Content\")");
        }

        // close button
        sb.AppendLine($"{indentation}    if st.button(\"Close\", key=\"{varName}\"):");
        sb.AppendLine($"{indentation}        st.rerun()");

        return sb.ToString().TrimEnd();
    }
}