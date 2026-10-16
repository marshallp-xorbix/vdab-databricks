using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DatabricksDataConnector;

public class GenieSpacesListResponseParserTests
{
    [Fact]
    public void TryParse_standard_shape_maps_spaces_and_token()
    {
        const string json = """
            {"spaces":[{"space_id":"s1","title":"Alpha"}],"next_page_token":"t1"}
            """;

        Assert.True(GenieSpacesListResponseParser.TryParse(json, out GenieSpacesListParsedPage? page));
        Assert.NotNull(page);
        Assert.Equal("t1", page!.NextPageToken);
        Assert.Single(page.Spaces);
        Assert.Equal("s1", page.Spaces[0].SpaceId);
        Assert.Equal("Alpha", page.Spaces[0].Title);
    }

    [Fact]
    public void TryParse_finds_spaces_under_nested_object()
    {
        const string json = """
            {"result":{"spaces":[{"space_id":"n1","title":"Nested"}]}}
            """;

        Assert.True(GenieSpacesListResponseParser.TryParse(json, out GenieSpacesListParsedPage? page));
        Assert.NotNull(page);
        Assert.Single(page!.Spaces);
        Assert.Equal("n1", page.Spaces[0].SpaceId);
    }

    [Fact]
    public void TryParse_falls_back_to_first_array_with_space_id()
    {
        const string json = """
            {"items":[{"space_id":"i1","name":"Item"}]}
            """;

        Assert.True(GenieSpacesListResponseParser.TryParse(json, out GenieSpacesListParsedPage? page));
        Assert.NotNull(page);
        Assert.Single(page!.Spaces);
        Assert.Equal("i1", page.Spaces[0].SpaceId);
        Assert.Equal("Item", page.Spaces[0].Name);
    }

    [Fact]
    public void TryParse_accepts_id_instead_of_space_id()
    {
        const string json = """{"spaces":[{"id":"alt","title":"T"}]}""";

        Assert.True(GenieSpacesListResponseParser.TryParse(json, out GenieSpacesListParsedPage? page));
        Assert.NotNull(page);
        Assert.Equal("alt", page!.Spaces[0].Id);
    }
}
