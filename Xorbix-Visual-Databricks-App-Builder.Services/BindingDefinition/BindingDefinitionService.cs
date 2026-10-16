using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.BuilderComponents.Bindings;

namespace Xorbix_Visual_Databricks_App_Builder.Services.BindingDefinition;

public class BindingDefinitionService : IBindingDefinitionService
{
    private readonly Dictionary<string, BindingSchemaDto> _bindingSchemas;

    public BindingDefinitionService()
    {
        _bindingSchemas = new Dictionary<string, BindingSchemaDto>
        {
            {
                "unityCatalogTable",
                new BindingSchemaDto
                {
                    Type = "unityCatalogTable",
                    Label = "Unity Catalog Table",
                    EditorType = "UnityCatalogTableSelector",
                    DefaultConfig = new Dictionary<string, object?>
                    {
                        { "bindingType", "unityCatalogTable" },
                        { "source", new Dictionary<string, object?>
                            {
                                { "kind", "resource" },
                                { "valueType", "table" },
                                { "resource", new Dictionary<string, object?>
                                    {
                                        { "type", "unityCatalogTable" },
                                        { "catalog", null },
                                        { "schema", null },
                                        { "table", null },
                                        { "primaryKeyColumn", null }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                "databricksVolume",
                new BindingSchemaDto
                {
                    Type = "databricksVolume",
                    Label = "Databricks Volume",
                    EditorType = "DatabricksVolumeSelector",
                    DefaultConfig = new Dictionary<string, object?>
                    {
                        { "bindingType", "databricksVolume" },
                        { "source", new Dictionary<string, object?>
                            {
                                { "kind", "resource" },
                                { "valueType", "file" },
                                { "resource", new Dictionary<string, object?>
                                    {
                                        { "type", "databricksVolume" },
                                        { "catalog", null },
                                        { "schema", null },
                                        { "volume", null },
                                        { "filePath", "" }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                "lakebaseProvisionedDatabase",
                new BindingSchemaDto
                {
                    Type = "lakebaseProvisionedDatabase",
                    Label = "Lakebase Provisioned Database",
                    EditorType = "LakebaseProvisionedDatabaseSelector",
                    DefaultConfig = new Dictionary<string, object?>
                    {
                        { "bindingType", "lakebaseProvisionedDatabase" },
                        { "source", new Dictionary<string, object?>
                            {
                                { "kind", "resource" },
                                { "valueType", "table" },
                                { "resource", new Dictionary<string, object?>
                                    {
                                        { "type", "lakebaseProvisionedDatabase" },
                                        { "database", null },
                                        { "instanceName", null },
                                        { "catalog", null },
                                        { "schema", null },
                                        { "table", null },
                                        { "primaryKeyColumn", null }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                "lakebaseAutoscaling",
                new BindingSchemaDto
                {
                    Type = "lakebaseAutoscaling",
                    Label = "Lakebase Autoscaling",
                    EditorType = "LakebaseAutoscalingTableSelector",
                    DefaultConfig = new Dictionary<string, object?>
                    {
                        { "bindingType", "lakebaseAutoscaling" },
                        { "source", new Dictionary<string, object?>
                            {
                                { "kind", "resource" },
                                { "valueType", "table" },
                                { "resource", new Dictionary<string, object?>
                                    {
                                        { "type", "lakebaseAutoscaling" },
                                        { "projectId", null },
                                        { "branchId", null },
                                        { "endpointId", null },
                                        { "database", null },
                                        { "catalog", null },
                                        { "schema", null },
                                        { "table", null },
                                        { "primaryKeyColumn", null }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
    }

    public List<BindingSchemaDto> GetAllBindingSchemas()
    {
        return _bindingSchemas.Values.ToList();
    }

    public BindingSchemaDto? GetBindingSchema(string bindingType)
    {
        return _bindingSchemas.TryGetValue(bindingType, out var schema) ? schema : null;
    }
}

