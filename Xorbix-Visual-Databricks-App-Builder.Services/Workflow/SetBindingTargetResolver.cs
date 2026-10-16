using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;
using Xorbix_Visual_Databricks_App_Builder.Models.Workflow.Actions;

namespace Xorbix_Visual_Databricks_App_Builder.Services.Workflow;

internal static class SetBindingTargetResolver
{
    internal static SetBindingTargetType? GetTargetType(VdabComponentDto? component)
    {
        if (component == null)
        {
            return null;
        }

        return component.Type switch
        {
            ComponentType.BarChart or
            ComponentType.LineChart or
            ComponentType.PieChart or
            ComponentType.DonutChart => SetBindingTargetType.ChartData,
            ComponentType.DataWindow or
            ComponentType.EditableDataWindow => SetBindingTargetType.UnityCatalogTable,
            _ => null,
        };
    }
}