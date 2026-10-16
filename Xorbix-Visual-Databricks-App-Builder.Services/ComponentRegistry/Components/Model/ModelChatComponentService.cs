using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

namespace Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Model;

/// <summary>
/// Conversational chat bound to a Databricks Model Serving endpoint app resource.
/// </summary>
public class ModelChatComponentService : BaseComponentService
{
    /// <inheritdoc/>
    public override ComponentType ComponentType => ComponentType.ModelChat;

    /// <inheritdoc/>
    public override VdabComponentDto GetDefinition()
    {
        return new ModelChatComponentDto
        {
            Id = "template-model-chat",
            CodeName = "templateModelChat",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Icon = "Bot",
            SchemaVersion = 1,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = string.Empty,
                Title = "Model Chat",
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
        if (component is not ModelChatComponentDto chat)
        {
            return $"{indentation}st.error('Invalid Model Chat component')";
        }

        string codeName = chat.CodeName?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(codeName))
        {
            return $"{indentation}st.error('Model Chat is missing codeName')";
        }

        string resourceName = chat.Props.ServingEndpointAppResourceName?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(resourceName))
        {
            return $"{indentation}st.error('Model Chat is not bound to a serving endpoint app resource. Select a resource in the builder.')";
        }

        string envVar = ModelChatEnvNaming.EnvironmentVariableName(resourceName);
        string codeNameLiteral = ToPythonDoubleQuotedString(codeName);
        string envLiteral = ToPythonDoubleQuotedString(envVar);
        string borderLiteral = ToPythonBool(chat.Props.ShowBorder);
        int heightPx = Math.Clamp(
            chat.Props.ChatTotalHeightPixels,
            ComponentHeightBounds.MinPixels,
            ComponentHeightBounds.MaxPixels);

        return $"{indentation}_vdab_render_model_chat({codeNameLiteral}, {envLiteral}, {borderLiteral}, {heightPx})";
    }
}
