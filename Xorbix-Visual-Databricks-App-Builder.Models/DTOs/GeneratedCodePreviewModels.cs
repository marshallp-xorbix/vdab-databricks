using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

public class GeneratedCodePreviewRequest
{
    public string AppName { get; init; } = "Generated App";
    public int AppId { get; init; }
    public List<VdabComponentDto> FormComponents { get; init; } = new();
    public StreamlitThemeConfig? ThemeConfig { get; init; }
    public WorkflowDefinitionDto WorkflowDefinition { get; init; } = new();

    /// <summary>
    /// Optional <c>custom_modules.py</c> body for preview; when null and <see cref="AppId"/> is set, server may load from the app record.
    /// </summary>
    public string? CustomModulesCode { get; init; }
}

public class GeneratedCodePreviewResult
{
    public List<GeneratedCodePreviewFile> Files { get; set; } = new();
    public List<string> PreviewErrors { get; set; } = new();

    /// <summary>
    /// Read-only <c>prebuilt_modules_library.py</c> source for the Code tab platform library pane.
    /// </summary>
    public string PrebuiltModulesLibrarySource { get; set; } = string.Empty;
}

public class GeneratedCodePreviewFile
{
    public string Path { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}
