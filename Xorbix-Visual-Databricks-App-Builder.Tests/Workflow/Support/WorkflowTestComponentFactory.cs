using Xorbix_Visual_Databricks_App_Builder.Models;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Workflow.Support;

internal static class WorkflowTestComponentFactory
{
    public static SliderComponentDto CreateSliderComponent(
        string id = "slider-1",
        string codeName = "status_filter",
        IReadOnlyList<string>? supportedEvents = null)
    {
        return new SliderComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.Slider,
            Category = ComponentCategory.Controls,
            Props = new SliderProps
            {
                Label = "Status Filter",
                MinValue = 0,
                MaxValue = 10,
                DefaultValue = 1,
                UpperValue = 5,
                Disabled = false,
                Help = "",
                Ranged = false,
                Format = "",
                Step = 1,
            },
            SupportedEvents = supportedEvents?.ToList() ?? new List<string> { "onChange" },
        };
    }

    public static TextInputComponentDto CreateTextInputComponent(
        string id = "text-1",
        string codeName = "customer_name",
        IReadOnlyList<string>? supportedEvents = null)
    {
        return new TextInputComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.TextInput,
            Category = ComponentCategory.Controls,
            Props = new TextInputProps
            {
                Label = "Customer Name",
                Placeholder = "Enter customer name",
                DefaultValue = "",
                Multiline = false,
                Help = "",
                Disabled = false,
                Type = "default",
                Height = "",
            },
            SupportedEvents = supportedEvents?.ToList() ?? new List<string> { "onChange" },
        };
    }

    public static ButtonComponentDto CreateButtonComponent(
        string id = "button-1",
        string codeName = "open_claims_button")
    {
        return new ButtonComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.Button,
            Category = ComponentCategory.Controls,
            Props = new ButtonProps
            {
                Label = "Open Claims",
                Variant = "primary",
                Help = "Click to open claims modal",
                Disabled = false,
            },
            SupportedEvents = new List<string> { "onClick" },
        };
    }

    public static ModalComponentDto CreateModalComponent(
        string id = "modal-1",
        string codeName = "claims_modal")
    {
        return new ModalComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.Modal,
            Category = ComponentCategory.Page,
            Props = new ModalProps
            {
                Title = "Claims",
            },
            Children = new List<string>(),
        };
    }

    public static FormComponentDto CreateFormComponent(
        string id = "form-1",
        string codeName = "parameter_form",
        IReadOnlyList<string>? children = null)
    {
        return new FormComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.Form,
            Category = ComponentCategory.Layout,
            Props = new FormProps
            {
                SubmitButtonText = "Submit",
                ClearOnSubmit = false,
                EnterToSubmit = true,
                Border = true,
                Width = "stretch",
                Height = "content",
            },
            Children = children?.ToList() ?? new List<string>(),
            SupportedEvents = new List<string> { "onSubmit" },
        };
    }

    public static DataWindowComponentDto CreateDataWindowComponent(
        string id = "grid-1",
        string codeName = "orders_grid",
        IReadOnlyList<string>? supportedBindings = null,
        string catalog = "main",
        string schema = "sales",
        string table = "orders",
        IReadOnlyList<Dictionary<string, object?>>? columns = null)
    {
        IReadOnlyList<Dictionary<string, object?>> resolvedColumns = columns ??
        [
            new Dictionary<string, object?> { ["name"] = "order_id" },
            new Dictionary<string, object?> { ["name"] = "customer_name" },
            new Dictionary<string, object?> { ["name"] = "status" },
        ];

        return new DataWindowComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.DataWindow,
            Category = ComponentCategory.Data,
            Props = new DataWindowProps
            {
                Label = "Orders",
                MaxRows = 10,
                Scrollable = true,
                Placeholder = null,
                Width = "stretch",
                HideIndex = null,
                Height = "auto",
            },
            Bindings = new Dictionary<string, BindingDto>
            {
                ["unityCatalogTable"] = new BindingDto
                {
                    BindingType = "unityCatalogTable",
                    Source = new BindingSourceDto
                    {
                        Kind = "resource",
                        Resource = new ResourceBindingSourceDto
                        {
                            Type = "unityCatalogTable",
                            Catalog = catalog,
                            Schema = schema,
                            Table = table,
                            Columns = resolvedColumns.ToList(),
                        },
                    },
                },
            },
            SupportedBindings = supportedBindings?.ToList() ?? new List<string> { "unityCatalogTable" },
        };
    }

    public static EditableDataWindowComponentDto CreateEditableDataWindowComponent(
        string id = "editable-grid-1",
        string codeName = "orders_editor",
        string catalog = "main",
        string schema = "sales",
        string table = "orders")
    {
        return new EditableDataWindowComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.EditableDataWindow,
            Category = ComponentCategory.Data,
            Props = new EditableDataWindowProps
            {
                Label = "Orders Editor",
                MaxRows = 10,
                Scrollable = true,
                Placeholder = null,
                Disabled = false,
                NumRows = "fixed",
                HideIndex = null,
                Width = "stretch",
                Height = "auto",
            },
            Bindings = new Dictionary<string, BindingDto>
            {
                ["unityCatalogTable"] = new BindingDto
                {
                    BindingType = "unityCatalogTable",
                    Source = new BindingSourceDto
                    {
                        Kind = "resource",
                        Resource = new ResourceBindingSourceDto
                        {
                            Type = "unityCatalogTable",
                            Catalog = catalog,
                            Schema = schema,
                            Table = table,
                            Columns = new List<Dictionary<string, object?>>
                            {
                                new() { ["name"] = "order_id" },
                                new() { ["name"] = "customer_name" },
                                new() { ["name"] = "status" },
                            },
                            PrimaryKeyColumn = "order_id",
                        },
                    },
                },
            },
            SupportedBindings = new List<string> { "unityCatalogTable" },
        };
    }

    public static BarChartComponentDto CreateBarChartComponent(
        string id = "chart-1",
        string codeName = "orders_chart")
    {
        return new BarChartComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.BarChart,
            Category = ComponentCategory.Visualization,
            Props = new BarChartProps
            {
                Title = "Orders by Status",
                SeriesColor = "#1f77b4",
                XAxis = new ChartAxisConfigDto
                {
                    Field = "status",
                    DisplayName = "Status",
                    ScaleType = "categorical",
                    Transform = "none",
                },
                YAxis = new ChartAxisConfigDto
                {
                    DisplayName = "Count",
                    ScaleType = "continuous",
                    Transform = "count",
                },
            },
            SupportedBindings = new List<string> { "unityCatalogTable", "lakebaseProvisionedDatabase" },
        };
    }

    public static DataWindowComponentDto CreateLakebaseDataWindowComponent(
        string id = "lakebase-grid-1",
        string codeName = "lakebase_grid",
        string instanceName = "lakebase-instance",
        string database = "appdb",
        string catalog = "appdb",
        string schema = "public",
        string table = "customer_inputs",
        IReadOnlyList<Dictionary<string, object?>>? columns = null)
    {
        IReadOnlyList<Dictionary<string, object?>> resolvedColumns = columns ??
        [
            new Dictionary<string, object?> { ["name"] = "customer_name" },
            new Dictionary<string, object?> { ["name"] = "priority" },
        ];

        return new DataWindowComponentDto
        {
            Id = id,
            CodeName = codeName,
            Type = ComponentType.DataWindow,
            Category = ComponentCategory.Data,
            Props = new DataWindowProps
            {
                Label = "Lakebase Grid",
                MaxRows = 10,
                Scrollable = true,
                Placeholder = null,
                Width = "stretch",
                HideIndex = null,
                Height = "auto",
            },
            Bindings = new Dictionary<string, BindingDto>
            {
                ["lakebaseProvisionedDatabase"] = new BindingDto
                {
                    BindingType = "lakebaseProvisionedDatabase",
                    Source = new BindingSourceDto
                    {
                        Kind = "resource",
                        Resource = new ResourceBindingSourceDto
                        {
                            Type = "lakebaseProvisionedDatabase",
                            InstanceName = instanceName,
                            Database = database,
                            Catalog = catalog,
                            Schema = schema,
                            Table = table,
                            Columns = resolvedColumns.ToList(),
                            PrimaryKeyColumn = "customer_name",
                        },
                    },
                },
            },
            SupportedBindings = new List<string> { "lakebaseProvisionedDatabase" },
        };
    }
}