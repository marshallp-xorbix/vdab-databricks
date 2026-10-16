using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class BuildSqlActionGeneratorTests
{
    [Fact]
    public void AppendRuntimeExecution_RendersTypedPlaceholderRuntime()
    {
        BuildSqlActionGenerator generator = new();
        BuildSqlActionModel actionNode = new()
        {
            Id = "build-1",
            SqlSourceKind = WorkflowSqlSourceKind.UnityCatalogTable,
            SqlTemplate = "SELECT * FROM main.sales.orders WHERE customer_name = {customer_name}",
            Placeholders = new List<BuildSqlPlaceholderReference>
            {
                new()
                {
                    Token = "customer_name",
                    ComponentCodeName = "customer_name",
                    ValueType = WorkflowValueType.String,
                    FormatHint = BuildSqlFormatHint.SqlStringLiteral,
                },
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("rendered_sql = 'SELECT * FROM main.sales.orders WHERE customer_name = {customer_name}'", runtime);
        Assert.Contains("placeholder_value = _get_vdab_component_value('customer_name')", runtime);
        Assert.Contains("formatted_placeholder_value = _format_build_sql_placeholder(placeholder_value, 'string', 'sqlStringLiteral')", runtime);
        Assert.Contains("rendered_sql = rendered_sql.replace('{customer_name}', formatted_placeholder_value)", runtime);
        Assert.Contains("'sqlSourceKind': 'unityCatalogTable'", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_SupportsDateLiteralPlaceholderFormatting()
    {
        BuildSqlActionGenerator generator = new();
        BuildSqlActionModel actionNode = new()
        {
            Id = "build-date",
            SqlSourceKind = WorkflowSqlSourceKind.LakebaseProvisionedDatabase,
            SqlTemplate = "SELECT * FROM appdb.public.orders WHERE order_date = {order_date}",
            Placeholders = new List<BuildSqlPlaceholderReference>
            {
                new()
                {
                    Token = "order_date",
                    ComponentCodeName = "order_date",
                    ValueType = WorkflowValueType.Date,
                    FormatHint = BuildSqlFormatHint.DateLiteral,
                },
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("_format_build_sql_placeholder(placeholder_value, 'date', 'dateLiteral')", runtime);
        Assert.Contains("'sqlSourceKind': 'lakebaseProvisionedDatabase'", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_EmitsLakebaseAutoscalingSourceKind()
    {
        BuildSqlActionGenerator generator = new();
        BuildSqlActionModel actionNode = new()
        {
            Id = "build-autoscaling",
            SqlSourceKind = WorkflowSqlSourceKind.LakebaseAutoscaling,
            SqlTemplate = "SELECT 1",
            Placeholders = new List<BuildSqlPlaceholderReference>(),
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("'sqlSourceKind': 'lakebaseAutoscaling'", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_EscapesMultilineSqlTemplate()
    {
        BuildSqlActionGenerator generator = new();
        BuildSqlActionModel actionNode = new()
        {
            Id = "build-multiline",
            SqlSourceKind = WorkflowSqlSourceKind.LakebaseProvisionedDatabase,
            SqlTemplate = "INSERT INTO dbdemos.customer_reviews (\n  customer_name\n)\nVALUES ({customer_name})",
            Placeholders = new List<BuildSqlPlaceholderReference>
            {
                new()
                {
                    Token = "customer_name",
                    ComponentCodeName = "customerName",
                    ValueType = WorkflowValueType.String,
                    FormatHint = BuildSqlFormatHint.SqlStringLiteral,
                },
            },
        };

        string runtime = GenerateRuntime(generator, actionNode);

        Assert.Contains("rendered_sql = 'INSERT INTO dbdemos.customer_reviews (\\n  customer_name\\n)\\nVALUES ({customer_name})'", runtime);
        Assert.DoesNotContain("rendered_sql = 'INSERT INTO dbdemos.customer_reviews (\n", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_ThrowsForUnsupportedFormatHint()
    {
        BuildSqlActionGenerator generator = new();
        BuildSqlActionModel actionNode = new()
        {
            Id = "build-invalid",
            SqlSourceKind = WorkflowSqlSourceKind.UnityCatalogTable,
            SqlTemplate = "SELECT {customer_name}",
            Placeholders = new List<BuildSqlPlaceholderReference>
            {
                new()
                {
                    Token = "customer_name",
                    ComponentCodeName = "customer_name",
                    ValueType = WorkflowValueType.String,
                    FormatHint = (BuildSqlFormatHint)99,
                },
            },
        };

        InvalidOperationException exception = Assert.Throws<InvalidOperationException>(() => GenerateRuntime(generator, actionNode));

        Assert.Contains("Unsupported BuildSql placeholder formatHint", exception.Message);
    }

    private static string GenerateRuntime(BuildSqlActionGenerator generator, BuildSqlActionModel actionNode)
    {
        StringBuilder sb = new();
        generator.AppendRuntimeExecution(
            sb,
            actionNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(new[] { actionNode }),
            triggerComponent: null,
            components: new List<Models.DTOs.BuilderComponents.VdabComponentDto>(),
            indentation: "    ");

        return sb.ToString();
    }
}