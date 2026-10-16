using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class AmoebaStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        AmoebaStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.AmoebaStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<AmoebaStoryComponentDto>(definition);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        AmoebaStoryComponentService service = new();
        AmoebaStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map entity, size, and position fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        AmoebaStoryComponentService service = new();
        AmoebaStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map entity, size, and position fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        AmoebaStoryComponentService service = new();
        AmoebaStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as entity_id", code);
        Assert.Contains("as size_value", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("LIMIT 100", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__AMOEBA_PAYLOAD__", code);
        Assert.Contains("layout_mode", code);
        Assert.Contains("pulse_threshold", code);
        Assert.Contains("pulse_threshold_mode", code);
        Assert.Contains("animation_speed", code);
        Assert.Contains("Drag to pan", code);
        Assert.DoesNotContain("lakebase_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        AmoebaStoryComponentService service = new();
        AmoebaStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesLatestPeriodFilter_WhenTimeFieldMapped()
    {
        AmoebaStoryComponentService service = new();
        AmoebaStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TimeField = new ChartAxisConfigDto
        {
            Field = "snapshot_date",
            ScaleType = "categorical",
            Transform = "none",
        };

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("SELECT MAX(", code);
        Assert.Contains("`snapshot_date`", code);
    }

    private static AmoebaStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        AmoebaStoryProps props = new()
        {
            Title = "Portfolio Amoeba",
            LayoutMode = "hybrid",
            SizeScale = "sqrt",
            MinRadiusPx = 42,
            MaxRadiusPx = 130,
            ColorBy = "category",
            PulseBy = "risk_score",
            ShapeVariation = 0.35,
            LabelMode = "compact",
            AnimationEnabled = true,
        };

        if (mapFields)
        {
            props.EntityId = Axis("customer_id");
            props.EntityLabel = Axis("customer_name");
            props.Category = Axis("segment");
            props.SizeMetric = Axis("revenue", "continuous", "sum");
            props.XMetric = Axis("growth_pct", "continuous", "avg");
            props.YMetric = Axis("risk_score", "continuous", "avg");
            props.ChangeMetric = Axis("change_pct", "continuous", "avg");
            props.HealthScore = Axis("health_score", "continuous", "avg");
            props.RiskScore = Axis("risk_score", "continuous", "avg");
        }

        AmoebaStoryComponentDto component = new()
        {
            Id = "amoeba-1",
            CodeName = "portfolioAmoeba",
            Type = ComponentType.AmoebaStory,
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
                            Table = "customers",
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
