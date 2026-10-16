using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Genie;

/// <summary>
/// Genie conversational chat (Databricks SDK) bound to a <c>genie_space</c> app resource.
/// </summary>
public class GenieChatComponentService : BaseComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.GenieChat;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new GenieChatComponentDto
        {
            Id = "template-genie-chat",
            CodeName = "templateGenieChat",
            Type = ComponentType.GenieChat,
            Category = ComponentCategory.Visualization,
            Icon = "MessageCircle",
            SchemaVersion = 1,
            Props = new GenieChatProps
            {
                GenieSpaceAppResourceName = string.Empty,
                Title = "Genie Chat",
                ChatTotalHeightPixels = ComponentHeightBounds.DefaultPixels,
            },
        };
    }

    /// <inheritdoc/>
    public override string GenerateStreamlitCode(
        VdabComponentDto component,
        string indentation = "    ",
        List<VdabComponentDto>? allComponents = null)
    {
        if (component is not GenieChatComponentDto chat)
        {
            return $"{indentation}st.error('Invalid Genie Chat component')";
        }

        string codeName = chat.CodeName?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(codeName))
        {
            return $"{indentation}st.error('Genie Chat is missing codeName')";
        }

        string resourceName = chat.Props.GenieSpaceAppResourceName?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(resourceName))
        {
            return $"{indentation}st.error('Genie Chat is not bound to a Genie space app resource. Select a resource in the builder.')";
        }

        string envVar = GenieChatEnvNaming.EnvironmentVariableName(resourceName);
        string codeNameLiteral = ToPythonDoubleQuotedString(codeName);
        string envLiteral = ToPythonDoubleQuotedString(envVar);
        string borderLiteral = chat.Props.ShowBorder ? "True" : "False";
        int heightPx = Math.Clamp(
            chat.Props.ChatTotalHeightPixels,
            ComponentHeightBounds.MinPixels,
            ComponentHeightBounds.MaxPixels);
        return $"{indentation}_vdab_render_genie_chat({codeNameLiteral}, {envLiteral}, {borderLiteral}, {heightPx})";
    }
}
