using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class SpiralStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        SpiralStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.SpiralStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<SpiralStoryComponentDto>(definition);
    }

    [Fact]
    public void GetDefinition_UsesSpiralDefaults()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto definition = (SpiralStoryComponentDto)service.GetDefinition();

        Assert.True(definition.Props.ShowLabels);
        Assert.True(definition.Props.ShowRiskGlow);
        Assert.True(definition.Props.ShowVariance);
        Assert.False(definition.Props.SpaceByTimeline);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map journey, stage, timeline, progress, and metric fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map journey, stage, timeline, progress, and metric fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as journey_name", code);
        Assert.Contains("as stage", code);
        Assert.Contains("as timeline", code);
        Assert.Contains("as progress_pct", code);
        Assert.Contains("as metric_value", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("ORDER BY", code);
        Assert.Contains("LIMIT 100", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__SPIRAL_PAYLOAD__", code);
        Assert.Contains("schedule_variance_days", code);
        Assert.Contains("'journeys':", code);
        Assert.Contains("'selected_journey':", code);
        Assert.Contains("'space_by_timeline': False", code);
        Assert.Contains("id=\"journeySelect\"", code);
        Assert.DoesNotContain("Multi-journey compare deferred", code);
        Assert.DoesNotContain("lakebase_query_df", code);
        Assert.DoesNotContain("SELECT MAX(", code);
        Assert.DoesNotContain("WHERE `milestone_date` = (SELECT MAX(", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_OrdersByTimeline_WithoutLatestPeriodWrap()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("ORDER BY MAX(`milestone_date`)", code);
        Assert.DoesNotContain("WHERE `milestone_date` = (SELECT MAX(", code);
        Assert.DoesNotContain("SELECT MAX(`milestone_date`) FROM", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesOptionalColumns_WhenMapped()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TargetDate = Axis("target_date");
        component.Props.ActualDate = Axis("actual_date");
        component.Props.Status = Axis("status");
        component.Props.RiskScore = Axis("risk_score", "continuous", "avg");
        component.Props.Owner = Axis("owner");
        component.Props.KeyAchievement = Axis("key_achievement");
        component.Props.Cost = Axis("stage_cost", "continuous", "sum");

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as target_date", code);
        Assert.Contains("as actual_date", code);
        Assert.Contains("as status", code);
        Assert.Contains("as risk_score", code);
        Assert.Contains("as owner", code);
        Assert.Contains("as key_achievement", code);
        Assert.Contains("as cost", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSpaceByTimelineTrue_WhenEnabled()
    {
        SpiralStoryComponentService service = new();
        SpiralStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.SpaceByTimeline = true;

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("'space_by_timeline': True", code);
        Assert.DoesNotContain("Multi-journey compare deferred", code);
    }

    private static SpiralStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        SpiralStoryProps props = new()
        {
            Title = "Progressive Journey",
            ShowLabels = true,
            ShowRiskGlow = true,
            ShowVariance = true,
        };

        if (mapFields)
        {
            props.JourneyName = Axis("journey_name");
            props.Stage = Axis("stage");
            props.TimelineField = Axis("milestone_date");
            props.ProgressPct = Axis("progress_pct", "continuous", "avg");
            props.MetricValue = Axis("metric_value", "continuous", "sum");
        }

        SpiralStoryComponentDto component = new()
        {
            Id = "spiral-1",
            CodeName = "progressiveJourney",
            Type = ComponentType.SpiralStory,
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
                            Table = "journey_milestones",
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
