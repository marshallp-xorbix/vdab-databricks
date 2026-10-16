using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Xorbix_Visual_Databricks_App_Builder.Models.DTOs.Auth;
using Xorbix_Visual_Databricks_App_Builder.ServiceDefaults;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Controllers;

/// <summary>
/// Base controller providing lazy-cached JWT identity claims for authenticated endpoints.
/// </summary>
[ApiController]
public abstract class AuthenticatedControllerBase : ControllerBase
{
    private Guid? _userId;
    private bool _userIdResolved;

    private Guid? _tenantId;
    private bool _tenantIdResolved;

    private string? _tenantRole;
    private bool _tenantRoleResolved;

    private Guid? _sessionId;
    private bool _sessionIdResolved;

    private AuthenticatedUserClaims? _claims;
    private bool _claimsResolved;

    /// <summary>JWT user ID from <see cref="ClaimTypes.NameIdentifier"/>.</summary>
    protected Guid? AuthenticatedUserId
    {
        get
        {
            if (!_userIdResolved)
            {
                _userId = this.GetAuthenticatedUserId();
                _userIdResolved = true;
            }
            return _userId;
        }
    }

    /// <summary>JWT tenant ID from the <c>tenant_id</c> claim.</summary>
    protected Guid? AuthenticatedTenantId
    {
        get
        {
            if (!_tenantIdResolved)
            {
                _tenantId = this.GetAuthenticatedTenantId();
                _tenantIdResolved = true;
            }
            return _tenantId;
        }
    }

    /// <summary>JWT tenant role from the <c>tenant_role</c> claim.</summary>
    protected string? AuthenticatedTenantRole
    {
        get
        {
            if (!_tenantRoleResolved)
            {
                _tenantRole = this.GetAuthenticatedTenantRole();
                _tenantRoleResolved = true;
            }
            return _tenantRole;
        }
    }

    /// <summary>JWT session ID from the <c>sid</c> claim.</summary>
    protected Guid? AuthenticatedSessionId
    {
        get
        {
            if (!_sessionIdResolved)
            {
                string? sessionIdClaim = this.GetClaimValue(AuthClaimTypes.SessionId);
                if (Guid.TryParse(sessionIdClaim, out Guid sessionId))
                {
                    _sessionId = sessionId;
                }

                _sessionIdResolved = true;
            }

            return _sessionId;
        }
    }

    /// <summary>Full authenticated user claims DTO.</summary>
    protected AuthenticatedUserClaims? AuthenticatedClaims
    {
        get
        {
            if (!_claimsResolved)
            {
                _claims = this.GetAuthenticatedUserClaims();
                _claimsResolved = true;
            }
            return _claims;
        }
    }

    /// <summary>Returns false when JWT user or tenant claims are missing.</summary>
    protected bool TryGetAuthenticatedContext(out Guid userId, out Guid tenantId)
    {
        userId = Guid.Empty;
        tenantId = Guid.Empty;

        if (!AuthenticatedUserId.HasValue || !AuthenticatedTenantId.HasValue)
        {
            return false;
        }

        userId = AuthenticatedUserId.Value;
        tenantId = AuthenticatedTenantId.Value;
        return true;
    }

    /// <summary>Returns false when JWT user claim is missing.</summary>
    protected bool TryGetAuthenticatedUser(out Guid userId)
    {
        userId = Guid.Empty;

        if (!AuthenticatedUserId.HasValue)
        {
            return false;
        }

        userId = AuthenticatedUserId.Value;
        return true;
    }

    /// <summary>
    /// Returns the caller's current session identifier from the access token, if present.
    /// </summary>
    protected Guid? TryGetCurrentSessionId() => AuthenticatedSessionId;

    /// <summary>Returns 401 when JWT user or tenant claims are missing.</summary>
    protected ActionResult? RequireAuthenticatedContext(out Guid userId, out Guid tenantId)
    {
        if (!TryGetAuthenticatedContext(out userId, out tenantId))
        {
            return Unauthorized();
        }

        return null;
    }

    /// <summary>Returns 401 when JWT user claim is missing.</summary>
    protected ActionResult? RequireAuthenticatedUser(out Guid userId)
    {
        if (!TryGetAuthenticatedUser(out userId))
        {
            return Unauthorized();
        }

        return null;
    }
}
