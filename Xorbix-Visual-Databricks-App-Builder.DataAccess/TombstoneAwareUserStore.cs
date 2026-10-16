using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <summary>
/// Identity user store that ignores soft-deleted (tombstoned) users for email and username
/// lookups so the default <see cref="UserValidator{TUser}"/> treats those addresses as free.
/// <see cref="FindByIdAsync"/> remains unfiltered so purge, restore, and admin detail can
/// still resolve tombstones by id.
/// </summary>
public class TombstoneAwareUserStore(
    ApplicationDbContext context,
    IdentityErrorDescriber? describer = null)
    : UserStore<ApplicationUser, IdentityRole<Guid>, ApplicationDbContext, Guid>(context, describer)
{
    /// <inheritdoc />
    public override Task<ApplicationUser?> FindByEmailAsync(
        string normalizedEmail,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ThrowIfDisposed();

        return Users
            .Where(user => user.DeletedOn == null)
            .FirstOrDefaultAsync(user => user.NormalizedEmail == normalizedEmail, cancellationToken);
    }

    /// <inheritdoc />
    public override Task<ApplicationUser?> FindByNameAsync(
        string normalizedUserName,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        ThrowIfDisposed();

        return Users
            .Where(user => user.DeletedOn == null)
            .FirstOrDefaultAsync(user => user.NormalizedUserName == normalizedUserName, cancellationToken);
    }
}
