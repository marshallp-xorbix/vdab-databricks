using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents;

public class ComponentRegistryResponseDto
{
    public required List<VdabComponentDto> Components { get; set; }
    public required List<BindingSchemaDto> BindingSchemas { get; set; }
    public int Version { get; set; } = 1;
}
