using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class HeatMapStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        HeatMapStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.HeatMapStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<HeatMapStoryComponentDto>(definition);
    }

    [Fact]
    public void GetDefinition_UsesUsaStateDefaults()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto definition = (HeatMapStoryComponentDto)service.GetDefinition();

        Assert.Equal("usa", definition.Props.MapScope);
        Assert.Equal("state", definition.Props.GeographicLevel);
        Assert.Equal("sequential", definition.Props.ColorScale);
        Assert.True(definition.Props.ShowLabels);
        Assert.True(definition.Props.ShowLegend);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map geographic area and metric fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map geographic area and metric fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as area_key", code);
        Assert.Contains("as metric_value", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("LIMIT 500", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__HEAT_MAP_PAYLOAD__", code);
        Assert.Contains("map_scope", code);
        Assert.Contains("'map_scope': 'usa'", code);
        Assert.Contains("'geographic_level': 'state'", code);
        Assert.Contains("highest", code);
        Assert.Contains("lowest", code);
        Assert.Contains("Drag to pan", code);
        Assert.DoesNotContain("lakebase_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesLatestPeriodFilter_WhenTimeFieldMapped()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TimeField = new ChartAxisConfigDto
        {
            Field = "order_month",
            ScaleType = "categorical",
            Transform = "none",
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("SELECT MAX(", code);
        Assert.Contains("`order_month`", code);
    }

    [Fact]
    public void GenerateStreamlitCode_AlwaysEmitsUsaStateScope()
    {
        HeatMapStoryComponentService service = new();
        HeatMapStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.MapScope = "europe";
        component.Props.GeographicLevel = "country";

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("'map_scope': 'usa'", code);
        Assert.Contains("'geographic_level': 'state'", code);
        Assert.DoesNotContain("Map scope/level beyond USA states is not yet supported", code);
    }

    private static HeatMapStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        HeatMapStoryProps props = new()
        {
            Title = "US Revenue Heat Map",
            MapScope = "usa",
            GeographicLevel = "state",
            ColorScale = "sequential",
            AggregationMethod = "sum",
            ShowLabels = true,
            ShowLegend = true,
        };

        if (mapFields)
        {
            props.GeographicArea = Axis("state_code");
            props.MetricValue = Axis("revenue", "continuous", "sum");
            props.Category = Axis("region");
            props.RiskScore = Axis("risk_score", "continuous", "avg");
            props.ChangePct = Axis("yoy_growth_pct", "continuous", "avg");
        }

        HeatMapStoryComponentDto component = new()
        {
            Id = "heatmap-1",
            CodeName = "usRevenueHeatMap",
            Type = ComponentType.HeatMapStory,
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
                            Table = "state_sales",
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
