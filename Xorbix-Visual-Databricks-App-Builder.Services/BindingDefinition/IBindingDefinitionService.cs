using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Services.BindingDefinition;

public interface IBindingDefinitionService
{
    List<BindingSchemaDto> GetAllBindingSchemas();
    BindingSchemaDto? GetBindingSchema(string bindingType);
}

