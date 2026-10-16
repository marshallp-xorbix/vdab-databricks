using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Model;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class ModelChatComponentServiceTests
{
    [Fact]
    public void GenerateStreamlitCode_EmitsHelperCall_WithEnvVarNaming()
    {
        ModelChatComponentService service = new();
        ModelChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "myModelChat",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = "my-endpoint",
            },
        };

        string envVar = ModelChatEnvNaming.EnvironmentVariableName("my-endpoint");
        Assert.Equal("SERVING_ENDPOINT_MY_ENDPOINT", envVar);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("_vdab_render_model_chat(\"myModelChat\", \"SERVING_ENDPOINT_MY_ENDPOINT\", False, 600)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_PassesLayoutProps()
    {
        ModelChatComponentService service = new();
        ModelChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "salesAgentChat",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = "sales-agent",
                ShowBorder = true,
                ChatTotalHeightPixels = 720,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("_vdab_render_model_chat(\"salesAgentChat\", \"SERVING_ENDPOINT_SALES_AGENT\", True, 720)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_ClampsHeight_WhenPropsOutOfRange()
    {
        ModelChatComponentService service = new();
        ModelChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "modelChat1",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = "endpoint",
                ChatTotalHeightPixels = 99999,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("_vdab_render_model_chat(\"modelChat1\", \"SERVING_ENDPOINT_ENDPOINT\", False, 2000)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_ClampsHeight_ToFloor_WhenBelowMin()
    {
        ModelChatComponentService service = new();
        ModelChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "modelChat1",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = "endpoint",
                ChatTotalHeightPixels = 100,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("_vdab_render_model_chat(\"modelChat1\", \"SERVING_ENDPOINT_ENDPOINT\", False, 300)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsBindingError_WhenResourceMissing()
    {
        ModelChatComponentService service = new();
        ModelChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "modelChat1",
            Type = ComponentType.ModelChat,
            Category = ComponentCategory.Visualization,
            Props = new ModelChatProps
            {
                ServingEndpointAppResourceName = string.Empty,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("st.error('Model Chat is not bound", code);
        Assert.DoesNotContain("_vdab_render_model_chat", code);
    }
}
