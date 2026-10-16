using Xorbix_Visual_Databricks_App_Builder.Services.AiBuilder;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.AiBuilder;

public class AiBuilderModuleFunctionParserTests
{
    [Fact]
    public void ParseCallableCustomFunctions_ReturnsCtxFirstFunctions()
    {
        string source = """
            def validate_order(ctx):
                return True

            def helper(value):
                return value
            """;

        List<AiBuilderModuleFunction> functions = AiBuilderModuleFunctionParser.ParseCallableCustomFunctions(source);

        Assert.Single(functions);
        Assert.Equal("validate_order", functions[0].FunctionName);
    }

    [Fact]
    public void ParsePrebuiltFunctions_RequiresCtxFirstParameter()
    {
        string source = """
            def change_text(ctx, component, new_label):
                pass
            """;

        List<AiBuilderModuleFunction> functions = AiBuilderModuleFunctionParser.ParsePrebuiltFunctions(source);

        Assert.Single(functions);
        Assert.Equal("change_text", functions[0].FunctionName);
        Assert.Equal(["ctx", "component", "new_label"], functions[0].ParameterNames);
    }
}
