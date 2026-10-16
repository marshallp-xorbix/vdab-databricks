using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class TerrainStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        TerrainStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.TerrainStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<TerrainStoryComponentDto>(definition);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map X, Y, and height fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map X, Y, and height fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as x_value", code);
        Assert.Contains("as y_value", code);
        Assert.Contains("as height_value", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("LIMIT 500", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__TERRAIN_PAYLOAD__", code);
        Assert.Contains("top_peaks", code);
        Assert.Contains("bottom_valleys", code);
        Assert.Contains("terrain_mode", code);
        Assert.Contains("'terrain_mode': 'surface'", code);
        Assert.Contains("'interpolation': 'bilinear'", code);
        Assert.Contains("'camera_preset': 'angled'", code);
        Assert.Contains("Drag to pan", code);
        Assert.DoesNotContain("lakebase_query_df", code);
    }

    [Fact]
    public void GetDefinition_UsesSurfaceDefaults()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto definition = (TerrainStoryComponentDto)service.GetDefinition();

        Assert.Equal("surface", definition.Props.TerrainMode);
        Assert.Equal("bilinear", definition.Props.Interpolation);
        Assert.Equal("angled", definition.Props.CameraPreset);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsHeatSurface_WhenModeExplicit()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TerrainMode = "heat_surface";
        component.Props.Interpolation = "none";
        component.Props.CameraPreset = "top";

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("'terrain_mode': 'heat_surface'", code);
        Assert.Contains("'interpolation': 'none'", code);
        Assert.Contains("'camera_preset': 'top'", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesLatestPeriodFilter_WhenTimeFieldMapped()
    {
        TerrainStoryComponentService service = new();
        TerrainStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TimeField = new ChartAxisConfigDto
        {
            Field = "report_month",
            ScaleType = "categorical",
            Transform = "none",
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("SELECT MAX(", code);
        Assert.Contains("`report_month`", code);
    }

    private static TerrainStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        TerrainStoryProps props = new()
        {
            Title = "Plant Output Terrain",
            TerrainMode = "surface",
            Interpolation = "bilinear",
            CameraPreset = "angled",
            AggregationMethod = "sum",
            ColorBy = "height_metric",
            ShowPeakLabels = true,
            ShowValleyLabels = true,
        };

        if (mapFields)
        {
            props.XDimension = Axis("report_month");
            props.YDimension = Axis("product_family");
            props.HeightMetric = Axis("output_units", "continuous", "sum");
            props.TerrainCategory = Axis("region");
            props.RiskScore = Axis("quality_risk_score", "continuous", "avg");
        }

        TerrainStoryComponentDto component = new()
        {
            Id = "terrain-1",
            CodeName = "plantOutputTerrain",
            Type = ComponentType.TerrainStory,
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
                            Table = "plant_output",
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
