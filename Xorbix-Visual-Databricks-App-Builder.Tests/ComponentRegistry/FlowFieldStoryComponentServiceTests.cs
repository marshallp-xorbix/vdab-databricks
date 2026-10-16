using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class FlowFieldStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        FlowFieldStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.FlowFieldStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<FlowFieldStoryComponentDto>(definition);
    }

    [Fact]
    public void GetDefinition_UsesFlowDefaults()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto definition = (FlowFieldStoryComponentDto)service.GetDefinition();

        Assert.True(definition.Props.ShowDropOffs);
        Assert.True(definition.Props.ShowLabels);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map source, destination, volume, and stage order fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map source, destination, volume, and stage order fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as source_stage", code);
        Assert.Contains("as destination_stage", code);
        Assert.Contains("as flow_volume", code);
        Assert.Contains("as stage_order", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("LIMIT 500", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__FLOW_FIELD_PAYLOAD__", code);
        Assert.Contains("largest_drop_off", code);
        Assert.Contains("bottleneck_stage", code);
        Assert.Contains("'show_drop_offs': True", code);
        Assert.DoesNotContain("curve_style", code);
        Assert.DoesNotContain("lakebase_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesLatestPeriodFilter_WhenTimeFieldMapped()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TimeField = Axis("period");

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("SELECT MAX(", code);
        Assert.Contains("`period`", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesOptionalColumns_WhenMapped()
    {
        FlowFieldStoryComponentService service = new();
        FlowFieldStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.ConversionPct = Axis("conversion_pct", "continuous", "avg");
        component.Props.DropOffCount = Axis("drop_off_count", "continuous", "sum");
        component.Props.AvgTimeInStage = Axis("avg_days_in_stage", "continuous", "avg");
        component.Props.Status = Axis("status");

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as conversion_pct", code);
        Assert.Contains("as drop_off", code);
        Assert.Contains("as avg_time_in_stage", code);
        Assert.Contains("as status", code);
    }

    private static FlowFieldStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        FlowFieldStoryProps props = new()
        {
            Title = "Sales Funnel Flow",
            ShowDropOffs = true,
            ShowLabels = true,
        };

        if (mapFields)
        {
            props.SourceStage = Axis("source_stage");
            props.DestinationStage = Axis("destination_stage");
            props.FlowVolume = Axis("flow_volume", "continuous", "sum");
            props.StageOrder = Axis("stage_order", "continuous", "max");
        }

        FlowFieldStoryComponentDto component = new()
        {
            Id = "flowfield-1",
            CodeName = "salesFunnelFlow",
            Type = ComponentType.FlowFieldStory,
            Category = ComponentCategory.Visualization,
            Props = props,
        };

        if (withBinding)
        {
            string bindingKey = lakebase ? "lakebaseProvisionedDatabase" : "unityCatalogTable";
            component.Bindings = new Dictionary<string, BindingDto>
            {
                [bindingKey] = new BindingDto
                {
                    BindingType = bindingKey,
                    Source = new BindingSourceDto
                    {
                        Kind = "resource",
                        Resource = new ResourceBindingSourceDto
                        {
                            Type = lakebase ? "lakebase" : "unityCatalogTable",
                            Catalog = "main",
                            Schema = "analytics",
                            Table = "funnel_flows",
                            Database = lakebase ? "databricks_postgres" : null,
                        },
                    },
                },
            };
        }

        return component;
    }

    private static ChartAxisConfigDto Axis(
        string field,
        string scaleType = "categorical",
        string transform = "none") =>
        new()
        {
            Field = field,
            DisplayName = field,
            ScaleType = scaleType,
            Transform = transform,
        };
}
