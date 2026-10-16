using System.Reflection;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Xorbix_Visual_Databricks_App_Builder.Server.Controllers;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.Arch;

/// <summary>
/// Ensures tenant-scoped API controllers derive identity from JWT via <see cref="AuthenticatedControllerBase"/>
/// and require tenant membership at the controller level.
/// </summary>
public partial class AuthenticatedEndpointIdentityTests
{
    private static readonly string[] TenantScopedControllerNames =
    [
        nameof(AppController),
        nameof(AppActionsController),
        nameof(AppComponentController),
        nameof(AiBuilderController),
        nameof(CodeController),
        nameof(DatabricksController),
        nameof(DatabricksConnectionController),
        nameof(DatabricksDataConnectorController),
    ];

    private static readonly string[] TenantAdminScopedControllerNames =
    [
        nameof(BillingController),
    ];

    private static readonly string[] ExcludedFromAuthenticatedBaseRequirement =
    [
        nameof(StripeWebhookController),
        nameof(ComponentRegistryController),
    ];

    private static readonly string[] JwtIdentityTokens =
    [
        "RequireAuthenticatedContext",
        "RequireAuthenticatedUser",
        "TryGetAuthenticatedContext",
        "AuthenticatedTenantId",
        "AuthenticatedUserId",
        "TryGetAuthenticatedUser",
    ];

    [Theory]
    [MemberData(nameof(TenantScopedControllers))]
    public void TenantScopedControllers_ExtendAuthenticatedControllerBase(Type controllerType)
    {
        Assert.True(
            typeof(AuthenticatedControllerBase).IsAssignableFrom(controllerType),
            $"{controllerType.Name} must extend {nameof(AuthenticatedControllerBase)}.");
    }

    [Theory]
    [MemberData(nameof(TenantScopedControllers))]
    public void TenantScopedControllers_RequireTenantMembershipPolicy(Type controllerType)
    {
        AuthorizeAttribute? authorize = controllerType.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorize);
        Assert.Equal(AuthPolicies.RequireTenantMembership, authorize!.Policy);
    }

    [Theory]
    [MemberData(nameof(TenantAdminScopedControllers))]
    public void TenantAdminScopedControllers_ExtendAuthenticatedControllerBase(Type controllerType)
    {
        Assert.True(
            typeof(AuthenticatedControllerBase).IsAssignableFrom(controllerType),
            $"{controllerType.Name} must extend {nameof(AuthenticatedControllerBase)}.");
    }

    [Theory]
    [MemberData(nameof(TenantAdminScopedControllers))]
    public void TenantAdminScopedControllers_RequireTenantAdminRolePolicy(Type controllerType)
    {
        AuthorizeAttribute? authorize = controllerType.GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(authorize);
        Assert.Equal(AuthPolicies.RequireTenantAdminRole, authorize!.Policy);
    }

    [Theory]
    [MemberData(nameof(AuthorizedControllersRequiringBase))]
    public void AuthorizedControllers_ExtendAuthenticatedControllerBase(Type controllerType)
    {
        Assert.True(
            typeof(AuthenticatedControllerBase).IsAssignableFrom(controllerType),
            $"{controllerType.Name} must extend {nameof(AuthenticatedControllerBase)}.");
    }

    [Theory]
    [MemberData(nameof(TenantScopedControllerNameData))]
    [MemberData(nameof(TenantAdminScopedControllerNameData))]
    public void TenantScopedControllerActions_DeriveIdentityFromJwt(string controllerName)
    {
        string source = ReadControllerSource(controllerName);
        IEnumerable<string> violations = FindIdentityViolations(source, controllerName);
        Assert.True(
            !violations.Any(),
            $"{controllerName} has action(s) missing JWT identity extraction:{Environment.NewLine}{string.Join(Environment.NewLine, violations)}");
    }

    public static IEnumerable<object[]> TenantScopedControllerNameData()
    {
        foreach (string controllerName in TenantScopedControllerNames)
            yield return [controllerName];
    }

    public static IEnumerable<object[]> TenantAdminScopedControllerNameData()
    {
        foreach (string controllerName in TenantAdminScopedControllerNames)
            yield return [controllerName];
    }

    public static IEnumerable<object[]> TenantScopedControllers() =>
        ResolveControllerTypes(TenantScopedControllerNames);

    public static IEnumerable<object[]> TenantAdminScopedControllers() =>
        ResolveControllerTypes(TenantAdminScopedControllerNames);

    public static IEnumerable<object[]> AuthorizedControllersRequiringBase()
    {
        Assembly serverAssembly = typeof(AppController).Assembly;

        foreach (Type controllerType in serverAssembly.GetTypes())
        {
            if (!controllerType.IsClass
                || controllerType.IsAbstract
                || !controllerType.Name.EndsWith("Controller", StringComparison.Ordinal)
                || controllerType == typeof(AuthenticatedControllerBase))
            {
                continue;
            }

            if (ExcludedFromAuthenticatedBaseRequirement.Contains(controllerType.Name))
            {
                continue;
            }

            if (controllerType.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
            {
                continue;
            }

            AuthorizeAttribute? classAuthorize = controllerType.GetCustomAttribute<AuthorizeAttribute>();
            bool hasAuthorizedAction = classAuthorize is not null
                || controllerType.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                    .Any(method => method.GetCustomAttribute<AuthorizeAttribute>() is not null
                        && method.GetCustomAttribute<AllowAnonymousAttribute>() is null);

            if (!hasAuthorizedAction)
            {
                continue;
            }

            yield return [controllerType];
        }
    }

    private static IEnumerable<object[]> ResolveControllerTypes(string[] controllerNames)
    {
        Assembly serverAssembly = typeof(AppController).Assembly;

        foreach (string controllerName in controllerNames)
        {
            Type? controllerType = serverAssembly.GetType(
                $"Xorbix_Visual_Databricks_App_Builder.Server.Controllers.{controllerName}");
            Assert.NotNull(controllerType);
            yield return [controllerType!];
        }
    }

    private static string ReadControllerSource(string controllerName)
    {
        string path = GetControllerSourcePath(controllerName);
        Assert.True(File.Exists(path), $"Controller source not found at {path}");
        return File.ReadAllText(path);
    }

    private static string GetControllerSourcePath(string controllerName)
    {
        string testAssemblyDir = Path.GetDirectoryName(typeof(AuthenticatedEndpointIdentityTests).Assembly.Location)!;
        string repoRoot = Path.GetFullPath(Path.Combine(testAssemblyDir, "..", "..", "..", ".."));
        return Path.Combine(repoRoot, "Xorbix-Visual-Databricks-App-Builder.Server", "Controllers", $"{controllerName}.cs");
    }

    private static IEnumerable<string> FindIdentityViolations(string source, string controllerName)
    {
        MatchCollection actionBlocks = ActionBlockRegex().Matches(source);

        foreach (Match block in actionBlocks)
        {
            string actionBlock = block.Value;
            string actionName = ExtractActionName(actionBlock);
            if (actionName is null)
            {
                continue;
            }

            if (actionBlock.Contains("[AllowAnonymous]", StringComparison.Ordinal))
            {
                continue;
            }

            if (actionBlock.Contains($"AuthPolicies.{nameof(AuthPolicies.RequireAdministratorRole)}", StringComparison.Ordinal))
            {
                continue;
            }

            if (actionBlock.Contains("{tenantId", StringComparison.Ordinal))
            {
                continue;
            }

            if (JwtIdentityTokens.Any(token => actionBlock.Contains(token, StringComparison.Ordinal)))
            {
                continue;
            }

            yield return $"  - {controllerName}.{actionName}";
        }
    }

    private static string? ExtractActionName(string actionBlock)
    {
        Match match = ActionNameRegex().Match(actionBlock);
        return match.Success ? match.Groups[1].Value : null;
    }

    [GeneratedRegex(@"\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete)([^\]]*)\][\s\S]*?(?=\n\s+\[(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete|Authorize|AllowAnonymous)|\n\s*#pragma|\n\s*private\s+(?:static\s+)?(?:async\s+)?)", RegexOptions.Multiline)]
    private static partial Regex ActionBlockRegex();

    [GeneratedRegex(@"public\s+(?:async\s+)?(?:Task<[^>]+>|Task|IActionResult|ActionResult(?:<[^>]+>)?)\s+(\w+)\s*\(", RegexOptions.Multiline)]
    private static partial Regex ActionNameRegex();
}
