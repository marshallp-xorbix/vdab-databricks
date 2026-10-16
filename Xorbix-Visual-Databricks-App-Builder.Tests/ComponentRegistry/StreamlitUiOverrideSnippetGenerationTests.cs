using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class StreamlitUiOverrideSnippetGenerationTests
{
    [Fact]
    public void ButtonCode_IncludesUiOverrideLabelResolution()
    {
        ButtonComponentService service = new();
        ButtonComponentDto button = WorkflowTestComponentFactory.CreateButtonComponent(codeName: "btnSend");
        string code = service.GenerateStreamlitCode(button);

        Assert.Contains("ui_overrides.get('labels', {}).get('btnSend', None)", code);
        Assert.Contains("label=_vdab_disp_lbl_", code);
    }

    [Fact]
    public void TextInputCode_IncludesLabelOverrideAndSessionStateInit()
    {
        TextInputComponentService service = new();
        TextInputComponentDto text = WorkflowTestComponentFactory.CreateTextInputComponent(codeName: "txtEmail");
        string code = service.GenerateStreamlitCode(text);

        Assert.Contains("ui_overrides.get('labels', {}).get('txtEmail', None)", code);
        Assert.Contains("if 'txtEmail' not in st.session_state:", code);
        Assert.Contains("st.session_state['txtEmail']", code);
        Assert.Contains("label=_vdab_disp_lbl_", code);
        Assert.DoesNotContain("value=", code);
    }

    [Fact]
    public void DropdownCode_IncludesLabelOverrideAndSessionStateInitForSelectbox()
    {
        DropdownComponentService service = new();
        DropdownComponentDto dropdown = new()
        {
            Id = "dd-1",
            CodeName = "ddStatus",
            Type = ComponentType.Dropdown,
            Category = ComponentCategory.Controls,
            Props = new DropdownProps
            {
                Label = "Status",
                Options =
                [
                    new DropdownOptionDto { Value = "a" },
                    new DropdownOptionDto { Value = "b" },
                ],
                DefaultValue = "b",
                Multiselect = false,
                Disabled = false,
            },
            SupportedEvents = ["onChange"],
        };

        string code = service.GenerateStreamlitCode(dropdown);

        Assert.Contains("ui_overrides.get('labels', {}).get('ddStatus', None)", code);
        Assert.Contains("if 'ddStatus' not in st.session_state:", code);
        Assert.Contains("st.session_state['ddStatus']", code);
        Assert.Contains("st.selectbox(", code);
    }

    [Fact]
    public void CheckboxCode_IncludesSessionStateBoolInit()
    {
        CheckboxComponentService service = new();
        CheckboxComponentDto checkbox = new()
        {
            Id = "cb-1",
            CodeName = "cbAgree",
            Type = ComponentType.Checkbox,
            Category = ComponentCategory.Controls,
            Props = new CheckboxProps
            {
                Label = "Agree",
                DefaultChecked = true,
                Disabled = false,
            },
            SupportedEvents = ["onChange"],
        };

        string code = service.GenerateStreamlitCode(checkbox);

        Assert.Contains("ui_overrides.get('labels', {}).get('cbAgree', None)", code);
        Assert.Contains("st.session_state['cbAgree'] = True", code);
        Assert.DoesNotContain("value=", code);
    }

    [Fact]
    public void ToggleCode_IncludesSessionStateBoolInit()
    {
        ToggleComponentService service = new();
        ToggleComponentDto toggle = new()
        {
            Id = "tg-1",
            CodeName = "tgOn",
            Type = ComponentType.Toggle,
            Category = ComponentCategory.Controls,
            Props = new ToggleProps
            {
                Label = "On",
                DefaultValue = false,
                Disabled = false,
            },
            SupportedEvents = ["onChange"],
        };

        string code = service.GenerateStreamlitCode(toggle);

        Assert.Contains("ui_overrides.get('labels', {}).get('tgOn', None)", code);
        Assert.Contains("st.session_state['tgOn'] = False", code);
    }
}
