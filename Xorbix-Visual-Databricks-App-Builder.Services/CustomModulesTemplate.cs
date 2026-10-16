namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Default scaffold for <c>custom_modules.py</c> shipped with generated VDAB apps.
/// </summary>
public static class CustomModulesTemplate
{
    /// <summary>
    /// Canonical default file body when the user has not provided custom code yet.
    /// </summary>
    public const string DefaultContent =
        "# VDAB custom Python helpers — edit this file in your app workspace.\r\n" +
        "# Use a Call Custom Module workflow action to invoke a top-level function defined here.\r\n" +
        "# The function receives ctx: ctx.get_value('codeName'), ctx.set_value(...), ctx.set_label(...).\r\n" +
        "\r\n" +
        "# def example_change_button_text(ctx):\r\n" +
        "#     ctx.set_label(\"button1\", \"Clicked!\") # button code name = 'button1'\r\n" +
        "#     return {\"ok\": True}\r\n";

    /// <summary>
    /// Returns normalized module content, or the default scaffold when null/whitespace.
    /// </summary>
    public static string ResolveContent(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return DefaultContent;
        }

        return raw.TrimEnd() + "\r\n";
    }
}
