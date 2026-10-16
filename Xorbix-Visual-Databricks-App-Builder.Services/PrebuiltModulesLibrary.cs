using System.Reflection;
using System.Text;

namespace Xorbix_Visual_Databricks_App_Builder.Services;

/// <summary>
/// Embedded <c>prebuilt_modules_library.py</c> shipped with VDAB for Call Prebuilt Module workflow actions.
/// </summary>
public static class PrebuiltModulesLibrary
{
    /// <summary>
    /// Importable Python module name (without <c>.py</c>).
    /// </summary>
    public const string ModuleName = "prebuilt_modules_library";

    /// <summary>
    /// File name used in generated app bundles and code preview metadata.
    /// </summary>
    public const string FileName = "prebuilt_modules_library.py";

    private static readonly Lazy<string> ContentLazy = new Lazy<string>(ReadEmbedded);

    /// <summary>
    /// Returns the canonical UTF-8 text of the prebuilt modules library.
    /// </summary>
    public static string GetContent() => ContentLazy.Value;

    private static string ReadEmbedded()
    {
        Assembly assembly = typeof(PrebuiltModulesLibrary).Assembly;
        string suffix = "prebuilt_modules_library.py";
        string? resourceName = assembly.GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith(suffix, StringComparison.Ordinal));
        if (resourceName == null)
        {
            throw new InvalidOperationException(
                $"Embedded resource ending with '{suffix}' not found in assembly '{assembly.FullName}'.");
        }

        using Stream stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Failed to open embedded resource '{resourceName}'.");
        using StreamReader reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        return reader.ReadToEnd();
    }
}
