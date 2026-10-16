using System.Text;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.SharedReferences;
using Xorbix_Visual_Databricks_App_Builder.Services.Workflow.Actions.Generators;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Generators;

public class SaveToTableActionGeneratorTests
{
    [Fact]
    public void AppendRuntimeExecution_ReportsErrorWhenTriggerIsNotMatchingForm()
    {
        SaveToTableActionGenerator generator = new();
        SaveToTableActionModel actionNode = CreateUnitySaveAction();

        string runtime = GenerateRuntime(
            generator,
            actionNode,
            WorkflowTestComponentFactory.CreateSliderComponent(),
            WorkflowTestComponentFactory.CreateTextInputComponent());

        Assert.Contains("SaveToTable requires the typed source form trigger and a valid target table.", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_GeneratesUnityCatalogInsertRuntime()
    {
        SaveToTableActionGenerator generator = new();
        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();
        SaveToTableActionModel actionNode = CreateUnitySaveAction();

        string runtime = GenerateRuntime(generator, actionNode, formComponent, textInputComponent);

        Assert.Contains("source_form_values = {", runtime);
        Assert.Contains("'customer_name': st.session_state.get('customer_name')", runtime);
        Assert.Contains("INSERT INTO main.sales.orders ({column_sql}) VALUES ({value_sql})", runtime);
        Assert.Contains("sql_execute(insert_sql)", runtime);
        Assert.Contains("'rowsAffected': 1", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_GeneratesLakebaseInsertRuntime()
    {
        SaveToTableActionGenerator generator = new();
        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();
        SaveToTableActionModel actionNode = new()
        {
            Id = "save-lakebase",
            SourceFormComponentCodeName = "parameter_form",
            TargetTable = new LakebaseTableRef
            {
                WorkspaceConnectionId = 1,
                InstanceName = "lakebase-instance",
                Database = "appdb",
                Catalog = "appdb",
                Schema = "public",
                Table = "customer_inputs",
            },
            ColumnMappings = new List<SaveToTableColumnMapping>
            {
                new()
                {
                    FormChildComponentCodeName = "customer_name",
                    TargetColumnName = "customer_name",
                },
            },
        };

        string runtime = GenerateRuntime(generator, actionNode, formComponent, textInputComponent);

        Assert.Contains("INSERT INTO public.customer_inputs ({column_sql}) VALUES ({value_sql})", runtime);
        Assert.Contains("lakebase_execute_sql(insert_sql)", runtime);
        Assert.DoesNotContain("sql_execute(insert_sql)", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_GeneratesLakebaseAutoscalingInsertRuntime()
    {
        SaveToTableActionGenerator generator = new();
        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();
        SaveToTableActionModel actionNode = new()
        {
            Id = "save-autoscaling",
            SourceFormComponentCodeName = "parameter_form",
            TargetTable = new LakebaseAutoscalingTableRef
            {
                WorkspaceConnectionId = 1,
                ProjectId = "proj-1",
                BranchId = "branch-1",
                EndpointId = "ep-1",
                Database = "appdb",
                Catalog = "appdb",
                Schema = "public",
                Table = "customer_inputs",
            },
            ColumnMappings = new List<SaveToTableColumnMapping>
            {
                new()
                {
                    FormChildComponentCodeName = "customer_name",
                    TargetColumnName = "customer_name",
                },
            },
        };

        string runtime = GenerateRuntime(generator, actionNode, formComponent, textInputComponent);

        Assert.Contains("INSERT INTO public.customer_inputs ({column_sql}) VALUES ({value_sql})", runtime);
        Assert.Contains("lakebase_execute_sql(insert_sql)", runtime);
        Assert.Contains("'projectId': 'proj-1'", runtime);
        Assert.Contains("'branchId': 'branch-1'", runtime);
        Assert.Contains("'endpointId': 'ep-1'", runtime);
        Assert.Contains("'tableType': 'lakebaseAutoscaling'", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_EmitsExplicitColumnMappingFailurePath()
    {
        SaveToTableActionGenerator generator = new();
        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent();
        SaveToTableActionModel actionNode = new()
        {
            Id = "save-empty",
            SourceFormComponentCodeName = "parameter_form",
            TargetTable = new UnityCatalogTableRef
            {
                WorkspaceConnectionId = 1,
                Catalog = "main",
                Schema = "sales",
                Table = "orders",
            },
            ColumnMappings = new List<SaveToTableColumnMapping>(),
        };

        string runtime = GenerateRuntime(generator, actionNode, formComponent);

        Assert.Contains("raise ValueError('SaveToTable requires at least one explicit column mapping.')", runtime);
    }

    [Fact]
    public void AppendRuntimeExecution_ReportsInvalidTargetColumnIdentifier()
    {
        SaveToTableActionGenerator generator = new();
        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();
        SaveToTableActionModel actionNode = new()
        {
            Id = "save-invalid-column",
            SourceFormComponentCodeName = "parameter_form",
            TargetTable = new UnityCatalogTableRef
            {
                WorkspaceConnectionId = 1,
                Catalog = "main",
                Schema = "sales",
                Table = "orders",
            },
            ColumnMappings = new List<SaveToTableColumnMapping>
            {
                new()
                {
                    FormChildComponentCodeName = "customer_name",
                    TargetColumnName = "customer-name",
                },
            },
        };

        string runtime = GenerateRuntime(generator, actionNode, formComponent, textInputComponent);

        Assert.Contains("SaveToTable target columns must be valid SQL identifiers.", runtime);
    }

    private static SaveToTableActionModel CreateUnitySaveAction()
    {
        return new SaveToTableActionModel
        {
            Id = "save-1",
            SourceFormComponentCodeName = "parameter_form",
            TargetTable = new UnityCatalogTableRef
            {
                WorkspaceConnectionId = 1,
                Catalog = "main",
                Schema = "sales",
                Table = "orders",
            },
            ColumnMappings = new List<SaveToTableColumnMapping>
            {
                new()
                {
                    FormChildComponentCodeName = "customer_name",
                    TargetColumnName = "customer_name",
                },
            },
        };
    }

    private static string GenerateRuntime(
        SaveToTableActionGenerator generator,
        SaveToTableActionModel actionNode,
        VdabComponentDto triggerComponent,
        params VdabComponentDto[] components)
    {
        StringBuilder sb = new();
        List<VdabComponentDto> allComponents = new List<VdabComponentDto> { triggerComponent };
        allComponents.AddRange(components);

        generator.AppendRuntimeExecution(
            sb,
            actionNode,
            WorkflowTestTemplateServiceFactory.CreateGenerationContext(new[] { actionNode }, triggerComponentCodeName: triggerComponent.CodeName!, eventKey: triggerComponent.SupportedEvents?.FirstOrDefault() ?? "onSubmit"),
            triggerComponent,
            allComponents,
            "    ");

        return sb.ToString();
    }
}