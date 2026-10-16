using System.Transactions;
using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.AiBuilder;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;
using Xorbix_Visual_Databricks_App_Builder.Models.Mapping;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess;

/// <inheritdoc/>
public class UserPlatformAiUsageRepository(ApplicationDbContext _context) : IUserPlatformAiUsageRepository
{
    /// <inheritdoc/>
    public async Task<long> GetTokensUsedAsync(
        Guid userId,
        string periodKey,
        CancellationToken cancellationToken = default)
    {
        long? tokensUsed = await _context.UserPlatformAiUsages
            .AsNoTracking()
            .Where(u => u.UserId == userId && u.PeriodKey == periodKey)
            .Select(u => (long?)u.TokensUsed)
            .FirstOrDefaultAsync(cancellationToken);

        return tokensUsed ?? 0L;
    }

    /// <inheritdoc/>
    public async Task RecordUsageAsync(
        Guid userId,
        string periodKey,
        PlatformAiUsageRecordContext context,
        CancellationToken cancellationToken = default)
    {
        using TransactionScope transaction = new(
            TransactionScopeOption.Required,
            TransactionScopeAsyncFlowOption.Enabled);

        UserPlatformAiUsageEvent usageEvent = context.ToUsageEvent(userId, periodKey);
        _context.UserPlatformAiUsageEvents.Add(usageEvent);
        await _context.SaveChangesAsync(cancellationToken);

        DateTime now = DateTime.UtcNow;
        int tokenDelta = context.TotalTokens;

        int updatedCount = await _context.UserPlatformAiUsages
            .Where(u => u.UserId == userId && u.PeriodKey == periodKey)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.TokensUsed, u => u.TokensUsed + tokenDelta)
                .SetProperty(u => u.ModifiedOn, (DateTime?)now), cancellationToken);

        if (updatedCount == 0)
        {
            UserPlatformAiUsage newUsage = new()
            {
                UserId = userId,
                PeriodKey = periodKey,
                TokensUsed = tokenDelta,
                CreatedOn = now,
            };
            _context.UserPlatformAiUsages.Add(newUsage);
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                _context.Entry(newUsage).State = EntityState.Detached;
                await _context.UserPlatformAiUsages
                    .Where(u => u.UserId == userId && u.PeriodKey == periodKey)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.TokensUsed, u => u.TokensUsed + tokenDelta)
                        .SetProperty(u => u.ModifiedOn, (DateTime?)now), cancellationToken);
            }
        }

        transaction.Complete();
    }

    /// <inheritdoc/>
    public async Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        int eventsDeleted = await _context.UserPlatformAiUsageEvents
            .Where(e => e.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);

        int usagesDeleted = await _context.UserPlatformAiUsages
            .Where(u => u.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);

        return eventsDeleted + usagesDeleted;
    }
}
