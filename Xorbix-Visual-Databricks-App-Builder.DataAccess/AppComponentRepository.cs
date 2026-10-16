using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;


namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    public class AppComponentRepository : IAppComponentRepository
    {
        private readonly ApplicationDbContext _context;

        public AppComponentRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <inheritdoc/>
        public async Task<AppComponent?> GetByIdAsync(int id)
        {
            return await _context.AppComponents
                                 .AsNoTracking()
                                 .FirstOrDefaultAsync(x => x.PkId == id);
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<AppComponent>> GetByAppIdAsync(int appId)
        {
            return await _context.AppComponents
                                 .AsNoTracking()
                                 .Where(x => x.AppId == appId)
                                 .ToListAsync();
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<AppComponent>> GetByAppIdsAsync(IEnumerable<int> appIds)
        {
            int[] ids = appIds.Distinct().ToArray();
            if (ids.Length == 0)
            {
                return [];
            }

            return await _context.AppComponents
                                 .AsNoTracking()
                                 .Where(x => ids.Contains(x.AppId))
                                 .ToListAsync();
        }

        /// <inheritdoc/>
        public async Task AddAsync(AppComponent appComponent)
        {
            _context.AppComponents.Add(appComponent);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task UpdateAsync(AppComponent appComponent)
        {
            _context.Update(appComponent);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task DeleteAsync(AppComponent appComponent)
        {
            _context.AppComponents.Remove(appComponent);
            await _context.SaveChangesAsync();
        }

        /// <inheritdoc/>
        public async Task<AppComponent> UpsertAsync(AppComponent appComponent)
        {
            if (appComponent.PkId > 0)
            {
                // Check if entity exists for update
                var existing = await _context.AppComponents
                    .FirstOrDefaultAsync(x => x.PkId == appComponent.PkId);

                if (existing != null)
                {
                    await UpdateAsync(appComponent);
                    return appComponent;
                }
            }

            // Insert new
            await AddAsync(appComponent);
            return appComponent;
        }
    }
}
