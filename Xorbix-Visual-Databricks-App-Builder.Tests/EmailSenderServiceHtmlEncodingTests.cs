using Xorbix_Visual_Databricks_App_Builder.Services;

namespace Xorbix_Visual_Databricks_App_Builder.Tests;

public class EmailSenderServiceHtmlEncodingTests
{
    [Theory]
    [InlineData("<script>alert('x')</script>", "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;")]
    [InlineData("Acme & Co", "Acme &amp; Co")]
    [InlineData("\"Quoted\"", "&quot;Quoted&quot;")]
    public void HtmlEncode_EncodesDangerousCharacters(string input, string expected)
    {
        string result = EmailSenderService.HtmlEncode(input);

        Assert.Equal(expected, result);
    }

    [Fact]
    public void HtmlEncode_LeavesPlainTextUnchanged()
    {
        string input = "Acme Corporation";

        string result = EmailSenderService.HtmlEncode(input);

        Assert.Equal(input, result);
    }
}
