using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class HoneycombStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        HoneycombStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.HoneycombStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<HoneycombStoryComponentDto>(definition);
    }

    [Fact]
    public void GetDefinition_UsesHoneycombDefaults()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto definition = (HoneycombStoryComponentDto)service.GetDefinition();

        Assert.True(definition.Props.ShowLabels);
        Assert.True(definition.Props.ShowRiskBorders);
        Assert.True(definition.Props.ShowTrendArrows);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map item, impact, priority, progress, and category fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map item, impact, priority, progress, and category fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as item_name", code);
        Assert.Contains("as impact_score", code);
        Assert.Contains("as priority_level", code);
        Assert.Contains("as progress_pct", code);
        Assert.Contains("as category", code);
        Assert.Contains("GROUP BY", code);
        Assert.Contains("LIMIT 100", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__HONEYCOMB_PAYLOAD__", code);
        Assert.Contains("high_impact_low_progress", code);
        Assert.Contains("delivery_health", code);
        Assert.Contains("'show_labels': True", code);
        Assert.Contains("'show_risk_borders': True", code);
        Assert.Contains("'show_trend_arrows': True", code);
        Assert.DoesNotContain("lakebase_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesLatestPeriodFilter_WhenTimeFieldMapped()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.TimeField = Axis("snapshot_date");

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("SELECT MAX(", code);
        Assert.Contains("`snapshot_date`", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesOptionalColumns_WhenMapped()
    {
        HoneycombStoryComponentService service = new();
        HoneycombStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
        component.Props.Trend = Axis("trend");
        component.Props.RiskScore = Axis("risk_score", "continuous", "avg");
        component.Props.Owner = Axis("owner");
        component.Props.DueDate = Axis("due_date");
        component.Props.Investment = Axis("investment", "continuous", "sum");
        component.Props.BenefitValue = Axis("benefit_value", "continuous", "sum");
        component.Props.Notes = Axis("notes");
        component.Props.Status = Axis("status");

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as trend", code);
        Assert.Contains("as risk_score", code);
        Assert.Contains("as owner", code);
        Assert.Contains("as due_date", code);
        Assert.Contains("as investment", code);
        Assert.Contains("as benefit_value", code);
        Assert.Contains("as notes", code);
        Assert.Contains("as status", code);
    }

    private static HoneycombStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        HoneycombStoryProps props = new()
        {
            Title = "Strategic Honeycomb",
            ShowLabels = true,
            ShowRiskBorders = true,
            ShowTrendArrows = true,
        };

        if (mapFields)
        {
            props.ItemName = Axis("item_name");
            props.ImpactScore = Axis("impact_score", "continuous", "avg");
            props.PriorityLevel = Axis("priority_level");
            props.ProgressPct = Axis("progress_pct", "continuous", "avg");
            props.Category = Axis("category");
        }

        HoneycombStoryComponentDto component = new()
        {
            Id = "honeycomb-1",
            CodeName = "strategicHoneycomb",
            Type = ComponentType.HoneycombStory,
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
                            Table = "strategic_initiatives",
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
