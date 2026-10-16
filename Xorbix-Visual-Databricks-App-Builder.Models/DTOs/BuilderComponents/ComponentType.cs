using System.Text.Json.Serialization;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Component category enumeration for organizing components in the toolbox
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ComponentCategory
{
    Controls,
    Layout,
    Data,
    Page,
    Visualization
}

/// <summary>
/// Component type enumeration
///
/// IMPORTANT: Keep this synchronized with frontend enum at:
/// xorbix-visual-databricks-app-builder.client/src/types/components/componentTypes.ts
///
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ComponentType
{
    TextInput,
    Button,
    Checkbox,
    Toggle,
    Dropdown,
    DatePicker,
    TimePicker,
    Slider,
    Columns,
    Rows,
    DataWindow,
    EditableDataWindow,
    Form,
    Modal,
    FileUpload,
    Label,
    BarChart,
    LineChart,
    PieChart,
    DonutChart,
    AmoebaStory,
    NetworkWebStory,
    TerrainStory,
    HeatMapStory,
    PulseWaveStory,
    FlowFieldStory,
    HoneycombStory,
    SpiralStory,
    Tabs,
    Expander,
    DashboardEmbed,
    GenieChat,
    ModelChat,
}
