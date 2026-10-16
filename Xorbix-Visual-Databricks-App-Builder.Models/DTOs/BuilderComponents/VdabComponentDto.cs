using System.Text.Json;
using System.Text.Json.Serialization;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

/// <summary>
/// Base VDAB component structure
/// Props are dynamically typed based on component registry metadata from backend
///
/// IMPORTANT: Keep this schema synchronized with frontend interface at:
/// xorbix-visual-databricks-app-builder.client/src/types/components/vdabComponent.ts
///
/// </summary>
[JsonConverter(typeof(VdabComponentDtoConverter))]
public abstract class VdabComponentDto
{
    public required string Id { get; set; }
    public required string CodeName { get; set; }
    public required ComponentType Type { get; set; }
    public required ComponentCategory Category { get; set; }
    public string? Icon { get; set; }
    public string? Layout { get; set; }
    public int SchemaVersion { get; set; } = 1;
    public Dictionary<string, BindingDto>? Bindings { get; set; }
    public List<string>? SupportedBindings { get; set; } // e.g., ["unityCatalogTable"]
    public List<string>? SupportedEvents { get; set; } // e.g., ["onClick", "onChange"]
    public List<string>? Children { get; set; }
}

public class VdabComponentDtoConverter : JsonConverter<VdabComponentDto>
{
    public override VdabComponentDto Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.ParseValue(ref reader);
        var root = doc.RootElement;

        // Get the Type property to determine which concrete type to deserialize to
        var typeString = root.GetProperty("Type").GetString();
        if (!Enum.TryParse<ComponentType>(typeString, out var componentType))
            throw new JsonException($"Unknown component type: {typeString}");

        return componentType switch
        {
            ComponentType.TextInput => JsonSerializer.Deserialize<TextInputComponentDto>(root.GetRawText(), options)!,
            ComponentType.Toggle => JsonSerializer.Deserialize<ToggleComponentDto>(root.GetRawText(), options)!,
            ComponentType.Dropdown => JsonSerializer.Deserialize<DropdownComponentDto>(root.GetRawText(), options)!,
            ComponentType.DatePicker => JsonSerializer.Deserialize<DatePickerComponentDto>(root.GetRawText(), options)!,
            ComponentType.TimePicker => JsonSerializer.Deserialize<TimePickerComponentDto>(root.GetRawText(), options)!,
            ComponentType.Slider => JsonSerializer.Deserialize<SliderComponentDto>(root.GetRawText(), options)!,
            ComponentType.Columns => JsonSerializer.Deserialize<ColumnsComponentDto>(root.GetRawText(), options)!,
            ComponentType.Rows => JsonSerializer.Deserialize<RowsComponentDto>(root.GetRawText(), options)!,
            ComponentType.Checkbox => JsonSerializer.Deserialize<CheckboxComponentDto>(root.GetRawText(), options)!,
            ComponentType.Button => JsonSerializer.Deserialize<ButtonComponentDto>(root.GetRawText(), options)!,
            ComponentType.DataWindow => JsonSerializer.Deserialize<DataWindowComponentDto>(root.GetRawText(), options)!,
            ComponentType.EditableDataWindow => JsonSerializer.Deserialize<EditableDataWindowComponentDto>(root.GetRawText(), options)!,
            ComponentType.Form => JsonSerializer.Deserialize<FormComponentDto>(root.GetRawText(), options)!,
            ComponentType.Modal => JsonSerializer.Deserialize<ModalComponentDto>(root.GetRawText(), options)!,
            ComponentType.FileUpload => JsonSerializer.Deserialize<FileUploadComponentDto>(root.GetRawText(), options)!,
            ComponentType.Label => JsonSerializer.Deserialize<LabelComponentDto>(root.GetRawText(), options)!,
            ComponentType.BarChart => JsonSerializer.Deserialize<BarChartComponentDto>(root.GetRawText(), options)!,
            ComponentType.LineChart => JsonSerializer.Deserialize<LineChartComponentDto>(root.GetRawText(), options)!,
            ComponentType.PieChart => JsonSerializer.Deserialize<PieChartComponentDto>(root.GetRawText(), options)!,
            ComponentType.DonutChart => JsonSerializer.Deserialize<DonutChartComponentDto>(root.GetRawText(), options)!,
            ComponentType.AmoebaStory => JsonSerializer.Deserialize<AmoebaStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.NetworkWebStory => JsonSerializer.Deserialize<NetworkWebStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.TerrainStory => JsonSerializer.Deserialize<TerrainStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.HeatMapStory => JsonSerializer.Deserialize<HeatMapStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.PulseWaveStory => JsonSerializer.Deserialize<PulseWaveStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.FlowFieldStory => JsonSerializer.Deserialize<FlowFieldStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.HoneycombStory => JsonSerializer.Deserialize<HoneycombStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.SpiralStory => JsonSerializer.Deserialize<SpiralStoryComponentDto>(root.GetRawText(), options)!,
            ComponentType.Tabs => JsonSerializer.Deserialize<TabsComponentDto>(root.GetRawText(), options)!,
            ComponentType.Expander => JsonSerializer.Deserialize<ExpanderComponentDto>(root.GetRawText(), options)!,
            ComponentType.DashboardEmbed => JsonSerializer.Deserialize<DashboardEmbedComponentDto>(root.GetRawText(), options)!,
            ComponentType.GenieChat => JsonSerializer.Deserialize<GenieChatComponentDto>(root.GetRawText(), options)!,
            ComponentType.ModelChat => JsonSerializer.Deserialize<ModelChatComponentDto>(root.GetRawText(), options)!,
            _ => throw new JsonException($"Unsupported component type: {componentType}")
        };
    }

    public override void Write(Utf8JsonWriter writer, VdabComponentDto value, JsonSerializerOptions options)
    {
        JsonSerializer.Serialize(writer, (object)value, options);
    }
}
