using FluentResults;
using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Workflow;
using Xorbix_Visual_Databricks_App_Builder.Services;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Charts;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Data;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Genie;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Layout;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Model;
using Xorbix_Visual_Databricks_App_Builder.Services.ComponentRegistry.Components.Standard;
using Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Integration;

public class StreamlitTemplateServiceWorkflowTests
{
    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_IncludesWorkflowCallbacksAndRuntime()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
                [ComponentType.DataWindow] = new DataWindowComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
            WorkflowTestComponentFactory.CreateDataWindowComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_1",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "unityCatalogTable",
                            ["sqlTemplate"] = "SELECT * FROM main.sales.orders",
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "run",
                        "RunSql",
                        new Dictionary<string, object?>
                        {
                            ["statement"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "BuildSql",
                                ["nodeId"] = "build",
                            },
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "bind",
                        "SetBinding",
                        new Dictionary<string, object?>
                        {
                            ["source"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "RunSql",
                                ["nodeId"] = "run",
                                ["outputKey"] = "rows",
                            },
                            ["target"] = new Dictionary<string, object?>
                            {
                                ["componentCodeName"] = "orders_grid",
                                ["bindingType"] = "unityCatalogTable",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("build", "run", "onSuccess"),
                    WorkflowTestDefinitionFactory.CreateEdge("run", "bind", "always"),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Workflow App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("from databricks import sql", result.Value);
        Assert.Contains("on_change=handle_workflow_wf_1", result.Value);
        Assert.Contains("binding_value = _resolve_workflow_path('run.output.rows', workflow_state)", result.Value);
        Assert.Contains("binding_overrides['orders_grid:unityCatalogTable'] = binding_value", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_IncludesCustomModuleRuntimeWhenCallCustomModuleExists()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Button] = new ButtonComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateButtonComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_custom_module",
                "open_claims_button",
                "onClick",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "cm1",
                        "CallCustomModule",
                        new Dictionary<string, object?>
                        {
                            ["functionName"] = "send_email",
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Custom Module App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("import custom_modules", result.Value);
        Assert.Contains("ui_overrides = st.session_state.setdefault('ui_overrides', {})", result.Value);
        Assert.Contains("vdab_component_registry = {", result.Value);
        Assert.Contains("'open_claims_button':", result.Value);
        Assert.Contains("_invoke_custom_module('send_email', _ctx)", result.Value);
        Assert.Contains("on_click=handle_workflow_wf_custom_module", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_IncludesPrebuiltImportAndCallWhenCallPrebuiltModuleExists()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Button] = new ButtonComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateButtonComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_prebuilt",
                "open_claims_button",
                "onClick",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "pb1",
                        "CallPrebuiltModule",
                        new Dictionary<string, object?>
                        {
                            ["functionName"] = "change_text",
                            ["namedArguments"] = new Dictionary<string, object?>
                            {
                                ["component"] = "status_label",
                                ["new_label"] = "Updated",
                            },
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Prebuilt App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("from prebuilt_modules_library import change_text", result.Value);
        Assert.Contains("import custom_modules", result.Value);
        Assert.Contains(
            "_prebuilt_out = _normalize_custom_module_result(change_text(_ctx, 'status_label', 'Updated'))",
            result.Value);
        Assert.Contains("on_click=handle_workflow_wf_prebuilt", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_CustomModuleScenario_UsesUiOverridesAndSessionStateForSimpleControls()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Form] = new FormComponentService(),
                [ComponentType.Button] = new ButtonComponentService(),
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        FormComponentDto form = WorkflowTestComponentFactory.CreateFormComponent(
            children: ["btn-1", "text-1"]);
        ButtonComponentDto button = WorkflowTestComponentFactory.CreateButtonComponent("btn-1", "btnSend");
        button.Props.Label = "Send";
        TextInputComponentDto textInput = WorkflowTestComponentFactory.CreateTextInputComponent("text-1", "txtEmail");
        textInput.Props.Label = "Email";

        List<VdabComponentDto> components =
        [
            form,
            button,
            textInput,
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_send",
                "btnSend",
                "onClick",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "send_action",
                        "CallCustomModule",
                        new Dictionary<string, object?>
                        {
                            ["functionName"] = "send_email",
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(
            components,
            "Send Email App",
            workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("_invoke_custom_module('send_email', _ctx)", result.Value);
        Assert.Contains("ui_overrides.get('labels', {}).get('btnSend', None)", result.Value);
        Assert.Contains("ui_overrides.get('labels', {}).get('txtEmail', None)", result.Value);
        Assert.Contains("if 'txtEmail' not in st.session_state:", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_UsesChartDataOverrideForCharts()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
                [ComponentType.BarChart] = new BarChartComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
            WorkflowTestComponentFactory.CreateBarChartComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_chart",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "unityCatalogTable",
                            ["sqlTemplate"] = "SELECT 'Open' AS category, 5 AS count",
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "run",
                        "RunSql",
                        new Dictionary<string, object?>
                        {
                            ["statement"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "BuildSql",
                                ["nodeId"] = "build",
                            },
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "bind",
                        "SetBinding",
                        new Dictionary<string, object?>
                        {
                            ["source"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "RunSql",
                                ["nodeId"] = "run",
                                ["outputKey"] = "rows",
                            },
                            ["target"] = new Dictionary<string, object?>
                            {
                                ["componentCodeName"] = "orders_chart",
                                ["bindingType"] = "chartData",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("build", "run", "onSuccess"),
                    WorkflowTestDefinitionFactory.CreateEdge("run", "bind", "always"),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Workflow Chart App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("binding_overrides['orders_chart:chartData'] = binding_value", result.Value);
        Assert.Contains("orders_chart_data = _binding_override_to_dataframe(orders_chart_binding_override)", result.Value);
        Assert.True(
            result.Value.IndexOf("st.subheader('Orders by Status')", StringComparison.Ordinal) <
            result.Value.IndexOf("orders_chart_binding_override = binding_overrides.get('orders_chart:chartData')", StringComparison.Ordinal));
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_DataWindowUsesSchemaAwareDataframeArguments()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.DataWindow] = new DataWindowComponentService(),
            });

        DataWindowComponentDto dataWindow = WorkflowTestComponentFactory.CreateDataWindowComponent();
        dataWindow.Props.MaxRows = 25;
        dataWindow.Props.Width = "content";
        dataWindow.Props.Height = "stretch";
        dataWindow.Props.HideIndex = true;
        dataWindow.Props.Placeholder = "";

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(
            new List<VdabComponentDto> { dataWindow },
            "DataWindow Args App",
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition());

        Assert.True(result.IsSuccess);
        Assert.Contains("SELECT * FROM main.sales.orders LIMIT 25", result.Value);
        Assert.Contains("orders_grid_column_config = {", result.Value);
        Assert.Contains("'order_id': 'order_id'", result.Value);
        Assert.Contains("st.dataframe(orders_grid_data, width='content', height='stretch', hide_index=True, column_config=orders_grid_column_config, placeholder='')", result.Value);
        Assert.DoesNotContain(".head(", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_EditableDataWindowUsesConfiguredEditorArguments()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.EditableDataWindow] = new EditableDataWindowComponentService(),
            });

        EditableDataWindowComponentDto editableDataWindow = WorkflowTestComponentFactory.CreateEditableDataWindowComponent();
        editableDataWindow.Props.MaxRows = 25;
        editableDataWindow.Props.NumRows = "add";
        editableDataWindow.Props.HideIndex = false;
        editableDataWindow.Props.Disabled = true;
        editableDataWindow.Props.Placeholder = "";
        editableDataWindow.Props.Width = "content";
        editableDataWindow.Props.Height = "stretch";

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(
            new List<VdabComponentDto> { editableDataWindow },
            "EditableDataWindow Args App",
            WorkflowTestDefinitionFactory.CreateWorkflowDefinition());

        Assert.True(result.IsSuccess);
        Assert.Contains("SELECT * FROM main.sales.orders LIMIT 25", result.Value);
        Assert.Contains("num_rows='add'", result.Value);
        Assert.Contains("hide_index=False", result.Value);
        Assert.Contains("disabled=True", result.Value);
        Assert.Contains("height='stretch'", result.Value);
        Assert.Contains("placeholder=''", result.Value);
        Assert.Contains("width='content'", result.Value);
        Assert.Contains("orders_editor_pk_column = 'order_id'", result.Value);
        Assert.Contains("orders_editor_deleted_pks", result.Value);
        Assert.Contains("orders_editor_insert_records", result.Value);
        Assert.Contains("orders_editor_update_records", result.Value);
        Assert.Contains("DELETE FROM main.sales.orders", result.Value);
        Assert.Contains("UPDATE main.sales.orders SET", result.Value);
        Assert.Contains("INSERT INTO main.sales.orders", result.Value);
        Assert.DoesNotContain("INSERT OVERWRITE main.sales.orders", result.Value);
        Assert.DoesNotContain(".head(", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_FailsForUnsupportedTriggerEvent()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow("wf_invalid", "status_filter", "onClick"));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Invalid Workflow App", workflowDefinition);

        Assert.True(result.IsFailed);
        Assert.Contains("unsupported trigger event", result.Errors[0].Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_ShowModalInvokesDialogDirectly()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Button] = new ButtonComponentService(),
                [ComponentType.Modal] = new ModalComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateButtonComponent(),
            WorkflowTestComponentFactory.CreateModalComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "open_claims_modal",
                "open_claims_button",
                "onClick",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "show-modal",
                        "ShowModal",
                        new Dictionary<string, object?>
                        {
                            ["modalCodeName"] = "claims_modal",
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Modal Workflow App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("def show_claims_modal():", result.Value);
        Assert.Contains("show_claims_modal()", result.Value);
        Assert.Contains("workflow_state['show-modal'] = {'status': 'success', 'output': {'visible': True}, 'error': None}", result.Value);
        int modalDefIndex = result.Value.IndexOf("def show_claims_modal():", StringComparison.Ordinal);
        int firstButtonIndex = result.Value.IndexOf("if st.button(", StringComparison.Ordinal);
        Assert.True(modalDefIndex >= 0);
        Assert.True(firstButtonIndex >= 0);
        Assert.True(modalDefIndex < firstButtonIndex);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_TriggerToastUsesPresetDurationRuntime()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "show_saved_toast",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "toast-1",
                        "TriggerToast",
                        new Dictionary<string, object?>
                        {
                            ["body"] = "Saved",
                            ["icon"] = ":material/check:",
                            ["duration"] = new Dictionary<string, object?>
                            {
                                ["kind"] = "preset",
                                ["value"] = "long",
                            },
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Trigger Toast App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("_vdab_enqueue_toast('Saved', icon=':material/check:', duration='long')", result.Value);
        Assert.Contains("_vdab_flush_toasts()", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_SaveToTableUsesExplicitSelectedTarget()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Form] = new FormComponentService(),
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();

        List<VdabComponentDto> components =
        [
            formComponent,
            textInputComponent,
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_save",
                "parameter_form",
                "onSubmit",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "save",
                        "SaveToTable",
                        new Dictionary<string, object?>
                        {
                            ["sourceFormComponentCodeName"] = "parameter_form",
                            ["targetTable"] = new Dictionary<string, object?>
                            {
                                ["tableType"] = "unityCatalogTable",
                                ["workspaceConnectionId"] = 1,
                                ["catalog"] = "dbdemos",
                                ["schema"] = "vdab",
                                ["table"] = "risk_run_params",
                            },
                            ["columnMappings"] = new List<object?>
                            {
                                new Dictionary<string, object?>
                                {
                                    ["formChildComponentCodeName"] = "customer_name",
                                    ["targetColumnName"] = "customer_name",
                                },
                            },
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Save To Table App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("INSERT INTO dbdemos.vdab.risk_run_params", result.Value);
        Assert.Contains("sql_execute(insert_sql)", result.Value);
        Assert.Contains("def sql_query_df(", result.Value);
        Assert.Contains("def _require_sql_app_context(", result.Value);
        Assert.Contains("credentials_provider=lambda: cfg.authenticate", result.Value);
        Assert.Contains("_raise_sql_execute_error", result.Value);
        Assert.Contains("Failed to execute Databricks SQL as the app service principal.", result.Value);
        Assert.DoesNotContain("X-Forwarded-Access-Token", result.Value);
        Assert.DoesNotContain("user_token", result.Value);
        Assert.Contains("st.toast(error_message, icon=':material/error:')", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_RunSqlUsesLakebaseHelperFromReferencedBuildSqlSourceKind()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_lakebase_run_sql",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build-lakebase",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "lakebaseProvisionedDatabase",
                            ["sqlTemplate"] = "SELECT 1",
                            ["lakebaseAppResourceName"] = "my_lb",
                            ["lakebaseDatabaseName"] = "appdb",
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "run-lakebase",
                        "RunSql",
                        new Dictionary<string, object?>
                        {
                            ["statement"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "BuildSql",
                                ["nodeId"] = "build-lakebase",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("build-lakebase", "run-lakebase", "onSuccess"),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Lakebase RunSql App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("_vdab_lakebase_run_for_workflow('lakebaseProvisionedDatabase', ", result.Value);
        Assert.Contains("import urllib.request", result.Value);
        Assert.Contains("from sqlalchemy import create_engine, event, text", result.Value);

        string requirements = templateService.GenerateRequirementsFile(components, workflowDefinition);
        Assert.Contains("psycopg[binary]", requirements);
        Assert.DoesNotContain("databricks-sql-connector>=4.2.5", requirements);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_RunSqlUsesLakebaseHelperFromAutoscalingBuildSqlSourceKind()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateSliderComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_lakebase_autoscaling_run_sql",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build-autoscaling",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "lakebaseAutoscaling",
                            ["sqlTemplate"] = "SELECT 1",
                            ["lakebaseAppResourceName"] = "my_lb",
                            ["lakebaseDatabaseName"] = "appdb",
                        }),
                    WorkflowTestDefinitionFactory.CreateNode(
                        "run-autoscaling",
                        "RunSql",
                        new Dictionary<string, object?>
                        {
                            ["statement"] = new Dictionary<string, object?>
                            {
                                ["sourceActionType"] = "BuildSql",
                                ["nodeId"] = "build-autoscaling",
                            },
                        }),
                },
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateEdge("build-autoscaling", "run-autoscaling", "onSuccess"),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Lakebase Autoscaling RunSql App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("_vdab_lakebase_run_for_workflow('lakebaseAutoscaling', ", result.Value);
        Assert.Contains("from sqlalchemy import create_engine, event, text", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_StartDatabricksJobUsesTypedJobReferenceAndInfiniteToast()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Button] = new ButtonComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateButtonComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_start_job",
                "open_claims_button",
                "onClick",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "start-job",
                        "StartDatabricksJob",
                        new Dictionary<string, object?>
                        {
                            ["job"] = new Dictionary<string, object?>
                            {
                                ["workspaceConnectionId"] = 42,
                                ["jobId"] = "123456",
                                ["jobName"] = "Sales Sync",
                            },
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Start Databricks Job App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("job_id = '123456'", result.Value);
        Assert.Contains("duration='infinite'", result.Value);
        Assert.Contains("'jobName': job_name", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_BuildSqlRendersTypedPlaceholderMetadata()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_build_sql_placeholders",
                "customer_name",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "unityCatalogTable",
                            ["sqlTemplate"] = "SELECT * FROM main.sales.orders WHERE customer_name = {customer_name}",
                            ["placeholders"] = new List<object?>
                            {
                                new Dictionary<string, object?>
                                {
                                    ["token"] = "customer_name",
                                    ["componentCodeName"] = "customer_name",
                                    ["valueType"] = "string",
                                    ["formatHint"] = "sqlStringLiteral",
                                },
                            },
                        }),
                }));

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "BuildSql Placeholder App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains("placeholder_value = _get_vdab_component_value('customer_name')", result.Value);
        Assert.Contains("rendered_sql = rendered_sql.replace('{customer_name}', formatted_placeholder_value)", result.Value);
        Assert.Contains("'sqlSourceKind': 'unityCatalogTable'", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_FormRendersDefaultStreamlitArguments()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Form] = new FormComponentService(),
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();

        List<VdabComponentDto> components =
        [
            formComponent,
            textInputComponent,
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition();

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Form Defaults App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains(
            "with st.form(key=\"parameter_form\", clear_on_submit=False, enter_to_submit=True, border=True, width=\"stretch\", height=\"content\"):",
            result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_FormRendersConfiguredStreamlitArguments()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Form] = new FormComponentService(),
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        FormComponentDto formComponent = WorkflowTestComponentFactory.CreateFormComponent(children: new[] { "text-1" });
        formComponent.Props.ClearOnSubmit = true;
        formComponent.Props.EnterToSubmit = false;
        formComponent.Props.Border = false;
        formComponent.Props.Width = "content";
        formComponent.Props.Height = "stretch";

        TextInputComponentDto textInputComponent = WorkflowTestComponentFactory.CreateTextInputComponent();

        List<VdabComponentDto> components =
        [
            formComponent,
            textInputComponent,
        ];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition();

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(components, "Form Configured App", workflowDefinition);

        Assert.True(result.IsSuccess);
        Assert.Contains(
            "with st.form(key=\"parameter_form\", clear_on_submit=True, enter_to_submit=False, border=False, width=\"content\", height=\"stretch\"):",
            result.Value);
    }

    [Fact]
    public void GenerateAppYamlFile_IncludesLakebaseComment_WhenComponentsUseLakebase()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.DataWindow] = new DataWindowComponentService(),
            });

        List<VdabComponentDto> components = [WorkflowTestComponentFactory.CreateLakebaseDataWindowComponent()];
        WorkflowDefinitionDto workflowDefinition = new();

        string yaml = templateService.GenerateAppYamlFile(components, workflowDefinition);

        Assert.Contains("# Lakebase:", yaml);
        Assert.DoesNotContain("DATABRICKS_WAREHOUSE_ID", yaml);
    }

    [Fact]
    public void GenerateAppYamlFile_IncludesWarehouseValueFrom_WhenUnityCatalogBindingPresent()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.DataWindow] = new DataWindowComponentService(),
            });

        List<VdabComponentDto> components = [WorkflowTestComponentFactory.CreateDataWindowComponent()];
        WorkflowDefinitionDto workflowDefinition = new();

        string yaml = templateService.GenerateAppYamlFile(components, workflowDefinition, "warehouse-prod");

        Assert.Contains("DATABRICKS_WAREHOUSE_ID", yaml);
        Assert.Contains("valueFrom: \"warehouse-prod\"", yaml);
    }

    [Fact]
    public void GenerateAppYamlFile_EscapesWarehouseResourceKey()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.DataWindow] = new DataWindowComponentService(),
            });

        List<VdabComponentDto> components = [WorkflowTestComponentFactory.CreateDataWindowComponent()];

        string yaml = templateService.GenerateAppYamlFile(components, new WorkflowDefinitionDto(), "wh\"prod");

        Assert.Contains("valueFrom: \"wh\\\"prod\"", yaml);
    }

    [Fact]
    public void GenerateAppYamlFile_IncludesVdabLakebaseEnv_FromBuildSqlLakebaseNodes()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.Slider] = new SliderComponentService(),
            });

        List<VdabComponentDto> components = [WorkflowTestComponentFactory.CreateSliderComponent()];

        WorkflowDefinitionDto workflowDefinition = WorkflowTestDefinitionFactory.CreateWorkflowDefinition(
            WorkflowTestDefinitionFactory.CreateWorkflow(
                "wf_lb_yaml",
                "status_filter",
                "onChange",
                new[]
                {
                    WorkflowTestDefinitionFactory.CreateNode(
                        "build-lakebase",
                        "BuildSql",
                        new Dictionary<string, object?>
                        {
                            ["sqlSourceKind"] = "lakebaseProvisionedDatabase",
                            ["sqlTemplate"] = "SELECT 1",
                            ["lakebaseAppResourceName"] = "db_res",
                            ["lakebaseDatabaseName"] = "appdb",
                        }),
                }));

        string yaml = templateService.GenerateAppYamlFile(components, workflowDefinition);

        Assert.Contains("VDAB_LB_HOST_DB_RES", yaml);
        Assert.Contains("valueFrom: \"db_res\"", yaml);
        Assert.DoesNotContain("VDAB_LB_DB", yaml);
    }

    [Fact]
    public void GenerateAppYamlFile_OmitsLakebaseComment_WhenNoLakebaseUsage()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        List<VdabComponentDto> components = [WorkflowTestComponentFactory.CreateTextInputComponent()];
        WorkflowDefinitionDto workflowDefinition = new();

        string yaml = templateService.GenerateAppYamlFile(components, workflowDefinition);

        Assert.DoesNotContain("# Lakebase:", yaml);
    }

    [Fact]
    public void GenerateAppYamlFile_IncludesGenieEnvEntries_OnSeparateYamlLines()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        List<VdabComponentDto> components =
        [
            new GenieChatComponentDto
            {
                Id = "genie-1",
                CodeName = "genie_chat_1",
                Type = ComponentType.GenieChat,
                Category = ComponentCategory.Visualization,
                Props = new GenieChatProps
                {
                    GenieSpaceAppResourceName = "genie-space",
                    Title = "Genie Chat",
                },
            },
        ];

        string yaml = templateService.GenerateAppYamlFile(components, new WorkflowDefinitionDto());
        string nl = Environment.NewLine;

        Assert.Contains($" - name: \"GENIE_SPACE_GENIE_SPACE\"{nl}   valueFrom: \"genie-space\"", yaml);
    }

    [Fact]
    public void GenerateAppYamlFile_DeduplicatesSameGenieResourceKey()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        List<VdabComponentDto> components =
        [
            new GenieChatComponentDto
            {
                Id = "genie-1",
                CodeName = "genie_chat_1",
                Type = ComponentType.GenieChat,
                Category = ComponentCategory.Visualization,
                Props = new GenieChatProps
                {
                    GenieSpaceAppResourceName = "genie-space",
                    Title = "One",
                },
            },
            new GenieChatComponentDto
            {
                Id = "genie-2",
                CodeName = "genie_chat_2",
                Type = ComponentType.GenieChat,
                Category = ComponentCategory.Visualization,
                Props = new GenieChatProps
                {
                    GenieSpaceAppResourceName = "genie-space",
                    Title = "Two",
                },
            },
        ];

        string yaml = templateService.GenerateAppYamlFile(components, new WorkflowDefinitionDto());
        int firstIndex = yaml.IndexOf("GENIE_SPACE_GENIE_SPACE", StringComparison.Ordinal);
        int lastIndex = yaml.LastIndexOf("GENIE_SPACE_GENIE_SPACE", StringComparison.Ordinal);

        Assert.True(firstIndex >= 0);
        Assert.Equal(firstIndex, lastIndex);
    }

    [Fact]
    public void GenerateAppYamlFile_IncludesServingEndpointEnvEntries_OnSeparateYamlLines()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        List<VdabComponentDto> components =
        [
            new ModelChatComponentDto
            {
                Id = "model-chat-1",
                CodeName = "model_chat_1",
                Type = ComponentType.ModelChat,
                Category = ComponentCategory.Visualization,
                Props = new ModelChatProps
                {
                    ServingEndpointAppResourceName = "sales-agent-endpoint",
                },
            },
        ];

        string yaml = templateService.GenerateAppYamlFile(components, new WorkflowDefinitionDto());
        string nl = Environment.NewLine;

        Assert.Contains($" - name: \"SERVING_ENDPOINT_SALES_AGENT_ENDPOINT\"{nl}   valueFrom: \"sales-agent-endpoint\"", yaml);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_ModelChat_IncludesEndpointQueryRuntime()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.ModelChat] = new ModelChatComponentService(),
            });

        List<VdabComponentDto> components =
        [
            new ModelChatComponentDto
            {
                Id = "model-chat-1",
                CodeName = "model_chat_1",
                Type = ComponentType.ModelChat,
                Category = ComponentCategory.Visualization,
                Props = new ModelChatProps
                {
                    ServingEndpointAppResourceName = "sales-agent-endpoint",
                },
            },
        ];

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(
            components,
            "Model Chat App",
            new WorkflowDefinitionDto());

        Assert.True(result.IsSuccess);
        Assert.Contains("def _vdab_render_model_chat(", result.Value);
        Assert.Contains("def _vdab_model_build_input(hist):", result.Value);
        Assert.Contains("endpoint_input.append({\"role\": role, \"content\": content})", result.Value);
        Assert.Contains("def _vdab_model_extract_responses_agent_text(resp) -> str:", result.Value);
        Assert.Contains("Endpoint response did not match the ResponsesAgent schema", result.Value);
        Assert.Contains("assistant message content with type output_text and text", result.Value);
        Assert.Contains("content_item.get(\"type\") == \"output_text\"", result.Value);
        Assert.DoesNotContain("\"generated_text\"", result.Value);
        Assert.DoesNotContain("\"answer\"", result.Value);
        Assert.DoesNotContain("\"result\"", result.Value);
        Assert.Contains("\"output\"", result.Value);
        Assert.Contains("w.api_client.do(", result.Value);
        Assert.Contains("path=f\"/serving-endpoints/{endpoint_name}/invocations\"", result.Value);
        Assert.Contains("body={\"input\": endpoint_input}", result.Value);
        Assert.DoesNotContain("w.serving_endpoints.query(", result.Value);
        Assert.DoesNotContain("messages=messages", result.Value);
        Assert.DoesNotContain("max_tokens=", result.Value);
        Assert.DoesNotContain("temperature=temperature", result.Value);
        Assert.DoesNotContain("stream=True", result.Value);
        Assert.Contains("st.error(st.session_state[error_key])", result.Value);
        Assert.Contains("thinking_ph.markdown(_vdab_model_thinking_bubbles_html(), unsafe_allow_html=True)", result.Value);
        Assert.DoesNotContain(
            "thinking_ph.empty()\n                        assistant_text = _vdab_model_query_text",
            result.Value);
        Assert.DoesNotContain("assistant_text = f\"**Error:**", result.Value);
        Assert.Contains("div.st-key-{container_key} {{", result.Value);
        Assert.Contains("div.st-key-{container_key} pre {{", result.Value);
        Assert.Contains("_vdab_render_model_chat(\"model_chat_1\", \"SERVING_ENDPOINT_SALES_AGENT_ENDPOINT\", False, 600)", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_GenieChat_IncludesBorderCssAndThinkingBubbles()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.GenieChat] = new GenieChatComponentService(),
            });

        List<VdabComponentDto> components =
        [
            new GenieChatComponentDto
            {
                Id = "g1",
                CodeName = "genie1",
                Type = ComponentType.GenieChat,
                Category = ComponentCategory.Visualization,
                SchemaVersion = 1,
                Props = new GenieChatProps
                {
                    GenieSpaceAppResourceName = "my-space",
                    ShowBorder = true,
                },
            },
        ];

        Result<string> result = templateService.GenerateStreamlitAppFromVdabComponents(
            components,
            "Genie App",
            new WorkflowDefinitionDto());

        Assert.True(result.IsSuccess);
        Assert.Contains("_vdab_genie_border_theme_css", result.Value);
        Assert.Contains("_vdab_genie_thinking_bubbles_html", result.Value);
        Assert.Contains("thinking_ph.empty()", result.Value);
        Assert.Contains("stVerticalBlockBorderWrapper", result.Value);
        Assert.Contains("vdab_genie_hist_", result.Value);
        Assert.Contains("vdab_genie_pending_", result.Value);
        Assert.Contains("_vdab_genie_messages_horizontal_clip_css", result.Value);
        Assert.Contains("st.container(height=", result.Value);
        Assert.Contains("autoscroll=True", result.Value);
        Assert.Contains("_vdab_genie_render_hist_entry", result.Value);
        Assert.Contains("st.rerun()", result.Value);
    }

    [Fact]
    public void GenerateStreamlitAppFromVdabComponents_EmitsWideLayoutAndBlockContainerMaxWidth()
    {
        StreamlitTemplateService templateService = WorkflowTestTemplateServiceFactory.CreateTemplateService(
            new Dictionary<ComponentType, IComponentService>
            {
                [ComponentType.TextInput] = new TextInputComponentService(),
            });

        List<VdabComponentDto> components =
        [
            WorkflowTestComponentFactory.CreateTextInputComponent(),
        ];

        Result<string> defaultResult = templateService.GenerateStreamlitAppFromVdabComponents(
            components,
            "Width App",
            new WorkflowDefinitionDto());

        Assert.True(defaultResult.IsSuccess);
        Assert.Contains("st.set_page_config(page_title='Width App', layout='wide')", defaultResult.Value);
        Assert.Contains($".block-container {{ max-width: {PageWidthBounds.DefaultPixels}px; }}", defaultResult.Value);
        int setPageConfigIndex = defaultResult.Value.IndexOf(
            "st.set_page_config(page_title='Width App', layout='wide')",
            StringComparison.Ordinal);
        int customModulesIndex = defaultResult.Value.IndexOf("import custom_modules", StringComparison.Ordinal);
        Assert.True(setPageConfigIndex >= 0 && customModulesIndex >= 0);
        Assert.True(
            setPageConfigIndex < customModulesIndex,
            "st.set_page_config must appear before import custom_modules");

        Result<string> customResult = templateService.GenerateStreamlitAppFromVdabComponents(
            components,
            "Width App",
            new WorkflowDefinitionDto(),
            1100);

        Assert.True(customResult.IsSuccess);
        Assert.Contains(".block-container { max-width: 1100px; }", customResult.Value);

        Result<string> clampedResult = templateService.GenerateStreamlitAppFromVdabComponents(
            components,
            "Width App",
            new WorkflowDefinitionDto(),
            9999);

        Assert.True(clampedResult.IsSuccess);
        Assert.Contains($".block-container {{ max-width: {PageWidthBounds.MaxPixels}px; }}", clampedResult.Value);
    }
}
