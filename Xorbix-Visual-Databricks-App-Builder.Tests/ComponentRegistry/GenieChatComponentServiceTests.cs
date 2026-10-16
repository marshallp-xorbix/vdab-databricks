using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Genie;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class GenieChatComponentServiceTests
{
    [Fact]
    public void GenerateStreamlitCode_EmitsHelperCall_WithEnvVarNaming()
    {
        GenieChatComponentService service = new();
        GenieChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "myGenieChat",
            Type = ComponentType.GenieChat,
            Category = ComponentCategory.Visualization,
            Props = new GenieChatProps
            {
                GenieSpaceAppResourceName = "my-genie-space",
            },
        };

        string envVar = GenieChatEnvNaming.EnvironmentVariableName("my-genie-space");
        Assert.Equal("GENIE_SPACE_MY_GENIE_SPACE", envVar);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("_vdab_render_genie_chat(\"myGenieChat\", \"GENIE_SPACE_MY_GENIE_SPACE\", False, 600)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsTrue_WhenShowBorderEnabled()
    {
        GenieChatComponentService service = new();
        GenieChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "myGenieChat",
            Type = ComponentType.GenieChat,
            Category = ComponentCategory.Visualization,
            Props = new GenieChatProps
            {
                GenieSpaceAppResourceName = "my-genie-space",
                ShowBorder = true,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains("_vdab_render_genie_chat(\"myGenieChat\", \"GENIE_SPACE_MY_GENIE_SPACE\", True, 600)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_DoesNotReferenceFeedback()
    {
        GenieChatComponentService service = new();
        GenieChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "g1",
            Type = ComponentType.GenieChat,
            Category = ComponentCategory.Visualization,
            Props = new GenieChatProps { GenieSpaceAppResourceName = "space1" },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains(", False, 600)", code);
        Assert.DoesNotContain("send_message_feedback", code, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("feedback", code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GenerateStreamlitCode_PassesClampedHeight_WhenChatTotalHeightPixelsOutOfRange()
    {
        GenieChatComponentService service = new();
        GenieChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "g1",
            Type = ComponentType.GenieChat,
            Category = ComponentCategory.Visualization,
            Props = new GenieChatProps
            {
                GenieSpaceAppResourceName = "space1",
                ChatTotalHeightPixels = 99999,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains(", False, 2000)", code);
    }

    [Fact]
    public void GenerateStreamlitCode_PassesCustomHeight_WhenWithinBounds()
    {
        GenieChatComponentService service = new();
        GenieChatComponentDto component = new()
        {
            Id = "a",
            CodeName = "g1",
            Type = ComponentType.GenieChat,
            Category = ComponentCategory.Visualization,
            Props = new GenieChatProps
            {
                GenieSpaceAppResourceName = "space1",
                ChatTotalHeightPixels = 720,
            },
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);
        Assert.Contains(", False, 720)", code);
    }
}
