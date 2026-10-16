using Microsoft.EntityFrameworkCore;
using Xorbix_Visual_Databricks_App_Builder.Models.EF;

namespace Xorbix_Visual_Databricks_App_Builder.DataAccess
{
    public class DatabricksUserTokenRepository : IDatabricksUserTokenRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IEncryptionHelper _encryption;

        public DatabricksUserTokenRepository(ApplicationDbContext context, IEncryptionHelper encryption)
        {
            _context = context;
            _encryption = encryption;
        }

        /// <inheritdoc/>
        public async Task<DatabricksUserToken?> GetByUserAndWorkspaceAsync(Guid userId, int workspaceConnectionId)
        {
            var token = await _context.DatabricksUserTokens
                                      .AsNoTracking()
                                      .FirstOrDefaultAsync(t => t.UserId == userId && t.WorkspaceConnectionId == workspaceConnectionId);

            if (token != null && !string.IsNullOrEmpty(token.RefreshToken))
            {
                token.RefreshToken = _encryption.Decrypt(token.RefreshToken);
            }

            return token;
        }

        /// <inheritdoc/>
        public async Task<IEnumerable<DatabricksUserToken>> GetByUserAsync(Guid userId)
        {
            var tokens = await _context.DatabricksUserTokens
                                       .AsNoTracking()
                                       .Where(t => t.UserId == userId)
                                       .ToListAsync();

            foreach (var token in tokens)
            {
                if (!string.IsNullOrEmpty(token.RefreshToken))
                {
                    token.RefreshToken = _encryption.Decrypt(token.RefreshToken);
                }
            }

            return tokens;
        }

        /// <inheritdoc/>
        public async Task<DatabricksUserToken> UpsertAsync(Guid userId, int workspaceConnectionId, string refreshToken, DateTime? expiresAt)
        {
            var existing = await _context.DatabricksUserTokens
                                         .FirstOrDefaultAsync(t => t.UserId == userId && t.WorkspaceConnectionId == workspaceConnectionId);

            if (existing != null)
            {
                // Decrypt existing token to compare
                string existingDecrypted = string.Empty;
                if (!string.IsNullOrEmpty(existing.RefreshToken))
                {
                    existingDecrypted = _encryption.Decrypt(existing.RefreshToken);
                }
                
                // Only update if the refresh token has actually changed
                // This preserves the original expiration date if Databricks returns the same token
                if (existingDecrypted != refreshToken)
                {
                    // New refresh token received - update both token and expiration
                    existing.RefreshToken = _encryption.Encrypt(refreshToken);
                    existing.RefreshTokenExpiresAt = expiresAt;
                    existing.RevokedAt = null;
                    existing.LastRotatedAt = DateTime.UtcNow;
                    existing.ModifiedOn = DateTime.UtcNow;
                    existing.ModifiedBy = userId;

                    _context.Update(existing);
                    await _context.SaveChangesAsync();
                }
                // If same token, keep existing expiration - don't update anything

                // Return with decrypted token for consistency
                existing.RefreshToken = refreshToken;
                return existing;
            }
            else
            {
                // Insert new token
                var newToken = new DatabricksUserToken
                {
                    UserId = userId,
                    WorkspaceConnectionId = workspaceConnectionId,
                    RefreshToken = _encryption.Encrypt(refreshToken),
                    RefreshTokenExpiresAt = expiresAt,
                    CreatedOn = DateTime.UtcNow,
                    CreatedBy = userId
                };

                _context.DatabricksUserTokens.Add(newToken);
                await _context.SaveChangesAsync();

                newToken.RefreshToken = refreshToken;
                return newToken;
            }
        }

        /// <inheritdoc/>
        public async Task<bool> RevokeAsync(
            Guid userId,
            int workspaceConnectionId,
            CancellationToken cancellationToken = default)
        {
            DatabricksUserToken? token = await _context.DatabricksUserTokens
                                      .FirstOrDefaultAsync(
                                          t => t.UserId == userId && t.WorkspaceConnectionId == workspaceConnectionId,
                                          cancellationToken);

            if (token == null)
            {
                return false;
            }

            token.RevokedAt = DateTime.UtcNow;
            token.ModifiedOn = DateTime.UtcNow;
            token.ModifiedBy = userId;

            _context.Update(token);
            await _context.SaveChangesAsync(cancellationToken);

            return true;
        }

        /// <inheritdoc/>
        public async Task<DatabricksUserToken?> RotateAsync(Guid userId, int workspaceConnectionId, string newRefreshToken, DateTime? expiresAt)
        {
            var token = await _context.DatabricksUserTokens
                                      .FirstOrDefaultAsync(t => t.UserId == userId && t.WorkspaceConnectionId == workspaceConnectionId);

            if (token == null)
            {
                return null;
            }

            token.RefreshToken = _encryption.Encrypt(newRefreshToken);
            token.RefreshTokenExpiresAt = expiresAt;
            token.RevokedAt = null;
            token.LastRotatedAt = DateTime.UtcNow;
            token.ModifiedOn = DateTime.UtcNow;
            token.ModifiedBy = userId;

            _context.Update(token);
            await _context.SaveChangesAsync();

            token.RefreshToken = newRefreshToken;
            return token;
        }

        /// <inheritdoc/>
        public async Task<int> HardDeleteByUserAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.DatabricksUserTokens
                .Where(t => t.UserId == userId)
                .ExecuteDeleteAsync(cancellationToken);
        }
    }
}
