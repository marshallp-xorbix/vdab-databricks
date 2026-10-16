using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xorbix_Visual_Databricks_App_Builder.DataAccess;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.Tests.DataAccess;

/// <summary>
/// Phase 0/1 gate: <c>.AddUserStore&lt;TombstoneAwareUserStore&gt;()</c> after
/// <c>.AddEntityFrameworkStores&lt;ApplicationDbContext&gt;()</c> must win DI resolution.
/// </summary>
public class IdentityUserStoreResolutionTests
{
    private static ServiceProvider BuildProvider(bool addTombstoneAwareStore)
    {
        ServiceCollection services = new();

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql("Host=localhost;Database=ef-model-check;Username=ef;Password=ef"));

        IdentityBuilder identityBuilder = services
            .AddIdentity<ApplicationUser, IdentityRole<Guid>>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddDefaultTokenProviders();

        if (addTombstoneAwareStore)
        {
            identityBuilder.AddUserStore<TombstoneAwareUserStore>();
        }

        return services.BuildServiceProvider();
    }

    [Fact]
    public void AddUserStore_TombstoneAware_WinsResolution()
    {
        using ServiceProvider provider = BuildProvider(addTombstoneAwareStore: true);

        IUserStore<ApplicationUser> store = provider.GetRequiredService<IUserStore<ApplicationUser>>();

        Assert.IsType<TombstoneAwareUserStore>(store);
    }

    [Fact]
    public void WithoutAddUserStore_ResolvesDefaultEfUserStore()
    {
        using ServiceProvider provider = BuildProvider(addTombstoneAwareStore: false);

        IUserStore<ApplicationUser> store = provider.GetRequiredService<IUserStore<ApplicationUser>>();

        Type storeType = store.GetType();
        Assert.Equal("UserStore`10", storeType.Name);
        Assert.Equal(
            "Microsoft.AspNetCore.Identity.EntityFrameworkCore",
            storeType.Namespace);
        Assert.IsNotType<TombstoneAwareUserStore>(store);
    }
}
