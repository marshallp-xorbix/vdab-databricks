using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class PulseWaveStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        PulseWaveStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.PulseWaveStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<PulseWaveStoryComponentDto>(definition);
    }

    [Fact]
    public void GetDefinition_UsesWaveDefaults()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto definition = (PulseWaveStoryComponentDto)service.GetDefinition();

        Assert.Equal("Metric", definition.Props.MetricName);
        Assert.Equal("sum", definition.Props.AggregationMethod);
        Assert.True(definition.Props.ShowBaseline);
        Assert.True(definition.Props.ShowEvents);
        Assert.True(definition.Props.ShowAnomalyMarkers);
        Assert.True(definition.Props.FillUnderWave);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map time, metric, and baseline fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map time, metric, and baseline fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as time_period", code);
        Assert.Contains("as metric_value", code);
        Assert.Contains("as baseline_value", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("ORDER BY", code);
        Assert.Contains("LIMIT 500", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__PULSE_WAVE_PAYLOAD__", code);
        Assert.Contains("largest_spike", code);
        Assert.Contains("largest_drop", code);
        Assert.Contains("'metric_name': 'Revenue'", code);
        Assert.Contains("'y_axis_label': 'revenue'", code);
        Assert.Contains("'show_baseline': True", code);
        Assert.Contains("'show_events': True", code);
        Assert.Contains("'show_anomaly_markers': True", code);
        Assert.Contains("Drag to pan", code);
        Assert.DoesNotContain("lakebase_query_df", code);
        Assert.DoesNotContain("SELECT MAX(", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesOptionalEventColumns_WhenMapped()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.EventName = Axis("event_name");
        component.Props.EventType = Axis("event_type");
        component.Props.ImpactScore = Axis("impact_score", "continuous", "avg");

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as event_name", code);
        Assert.Contains("as event_type", code);
        Assert.Contains("as impact_score", code);
        Assert.Contains("_events", code);
    }

    [Fact]
    public void GenerateStreamlitCode_DoesNotApplyLatestPeriodFilter_OnTimeSeriesAxis()
    {
        PulseWaveStoryComponentService service = new();
        PulseWaveStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("`period`", code);
        Assert.DoesNotContain("SELECT MAX(`period`)", code);
        Assert.DoesNotContain("WHERE `period` = (SELECT MAX(", code);
    }

    private static PulseWaveStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        PulseWaveStoryProps props = new()
        {
            Title = "Weekly Revenue Pulse",
            MetricName = "Revenue",
            AggregationMethod = "sum",
            ShowBaseline = true,
            ShowEvents = true,
            ShowAnomalyMarkers = true,
            FillUnderWave = true,
        };

        if (mapFields)
        {
            props.TimeField = Axis("period");
            props.MetricValue = Axis("revenue", "continuous", "sum");
            props.BaselineValue = Axis("target_revenue", "continuous", "avg");
        }

        PulseWaveStoryComponentDto component = new()
        {
            Id = "pulsewave-1",
            CodeName = "weeklyRevenuePulse",
            Type = ComponentType.PulseWaveStory,
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
                            Table = "weekly_revenue",
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
