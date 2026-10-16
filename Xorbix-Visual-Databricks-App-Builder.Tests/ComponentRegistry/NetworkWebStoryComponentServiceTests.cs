using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Stories;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.ComponentRegistry;

public class NetworkWebStoryComponentServiceTests
{
    [Fact]
    public void GetDefinition_ReturnsVisualizationTemplate_WithSupportedBindings()
    {
        NetworkWebStoryComponentService service = new();
        VdabComponentDto definition = service.GetDefinition();

        Assert.Equal(ComponentType.NetworkWebStory, definition.Type);
        Assert.Equal(ComponentCategory.Visualization, definition.Category);
        Assert.Contains("unityCatalogTable", definition.SupportedBindings);
        Assert.Contains("lakebaseProvisionedDatabase", definition.SupportedBindings);
        Assert.Contains("lakebaseAutoscaling", definition.SupportedBindings);
        Assert.IsType<NetworkWebStoryComponentDto>(definition);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenFieldsNotMapped()
    {
        NetworkWebStoryComponentService service = new();
        NetworkWebStoryComponentDto component = CreateComponent(mapFields: false, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map source, target, relationship type, and weight fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsInfo_WhenMappedButUnbound()
    {
        NetworkWebStoryComponentService service = new();
        NetworkWebStoryComponentDto component = CreateComponent(mapFields: true, withBinding: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("Bind a table and map source, target, relationship type, and weight fields", code);
        Assert.DoesNotContain("components.html", code);
    }

    [Fact]
    public void GenerateStreamlitCode_EmitsSqlAndComponentsHtml_WhenUnityCatalogBound()
    {
        NetworkWebStoryComponentService service = new();
        NetworkWebStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("as source_entity_id", code);
        Assert.Contains("as target_entity_id", code);
        Assert.Contains("as relationship_type", code);
        Assert.Contains("as relationship_weight", code);
        Assert.Contains("LIMIT 1000", code);
        Assert.DoesNotContain("GROUP BY", code);
        Assert.Contains("sql_query_df", code);
        Assert.Contains("components.html", code);
        Assert.Contains("__NETWORK_WEB_PAYLOAD__", code);
        Assert.Contains("layout_algorithm", code);
        Assert.Contains("max_nodes", code);
        Assert.Contains("max_edges", code);
        Assert.Contains("Drag to pan", code);
        Assert.DoesNotContain("lakebase_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_UsesLakebaseQuery_WhenLakebaseBound()
    {
        NetworkWebStoryComponentService service = new();
        NetworkWebStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: true);

        string code = service.GenerateStreamlitCode(component, string.Empty, null);

        Assert.Contains("lakebase_query_df", code);
        Assert.Contains("components.html", code);
        Assert.DoesNotContain("sql_query_df", code);
    }

    [Fact]
    public void GenerateStreamlitCode_IncludesLatestPeriodFilter_WhenTimeFieldMapped()
    {
        NetworkWebStoryComponentService service = new();
        NetworkWebStoryComponentDto component = CreateComponent(mapFields: true, withBinding: true, lakebase: false);
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

    private static NetworkWebStoryComponentDto CreateComponent(
        bool mapFields,
        bool withBinding,
        bool lakebase = false)
    {
        NetworkWebStoryProps props = new()
        {
            Title = "Supply Chain Web",
            LayoutAlgorithm = "force",
            NodeSizeBy = "degree",
            NodeColorBy = "category",
            EdgeWidthBy = "weight",
            EdgeColorBy = "relationship_type",
            ShowArrows = true,
            HighlightDepth = 1,
            MaxNodes = 300,
            MaxEdges = 800,
        };

        if (mapFields)
        {
            props.SourceEntityId = Axis("source_entity_id");
            props.SourceEntityLabel = Axis("source_entity_label");
            props.TargetEntityId = Axis("target_entity_id");
            props.TargetEntityLabel = Axis("target_entity_label");
            props.RelationshipType = Axis("relationship_type");
            props.RelationshipWeight = Axis("relationship_weight", "continuous", "none");
            props.SourceCategory = Axis("source_category");
            props.TargetCategory = Axis("target_category");
        }

        NetworkWebStoryComponentDto component = new()
        {
            Id = "network-1",
            CodeName = "supplyChainWeb",
            Type = ComponentType.NetworkWebStory,
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
                            Table = "network_edges",
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
