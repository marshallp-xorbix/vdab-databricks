# User Management API

## Overview

The User Management API (`/api/user/*`) provides endpoints for managing user accounts. These endpoints are designed for administrators and managers to perform administrative tasks like creating users, managing roles, and modifying user settings.

## Authorization & Role Hierarchy

### Role Hierarchy

The system implements a strict role hierarchy where users can only modify other users with equal or lower role levels:

| Role | Level | Description |
|------|-------|-------------|
| **Administrator** | 4 | Full system access, can manage all users and roles |
| **TenantAdmin** | 3 | Tenant-wide administration |
| **Manager** | 2 | User and settings management within scope |
| **Developer** | 1 | Workflow creation and modification |

### Authorization Rules

1. **Self-Access**: Users can always view and modify their own account
2. **Role-Based Access**: 
   - Manager+ roles have elevated permissions
   - Elevated users can view/modify users with lower role levels
3. **Role Hierarchy Enforcement**:
   - Users cannot modify users with higher role levels
   - Users can only grant/revoke roles at their level or below
   - Implemented via `UserExtensions.CanModifyUser()` and `CanManageRoles()`

### Performance Optimization

Authorization checks are optimized to check JWT claims first before making database queries:

```csharp
// Fast path - check JWT claims first (no DB call)
if (User.IsInRole(AuthRoles.Administrator))
{
    // Administrators can access all users
}

// Slow path - query database only if needed
var targetUser = await _userService.GetUserById(targetUserId);
if (!User.CanModifyUser(targetUser.Roles))
{
    return Forbid();
}
```

## User Management Operations

### User Retrieval

**Get User by ID**

Retrieve user information by ID. Requires either self-access or elevated permissions.

**Authentication:** Required (JWT)

**Authorization:** 
- User can access their own account
- Manager+ can access any user with equal or lower role level

**Response:**
```json
{
  "id": 1,
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "isActive": true,
  "emailConfirmed": true,
  "twoFactorEnabled": false,
  "roles": ["Developer"]
}
```

**Get Active Users**

Retrieve all active users.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required

**Response:**
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["Developer"]
  }
]
```

**Get All Users**

Retrieve all users (including inactive).

**Authentication:** Required (JWT)

**Authorization:** Manager+ required

**Get User Roles**

Retrieve roles assigned to a user.

**Authentication:** Required (JWT)

**Authorization:** 
- User can view their own roles
- Manager+ can view roles of users with equal or lower role level

**Response:**
```json
["Developer", "Manager"]
```

### User Creation & Updates

**Create User**

Create a new user account.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required

**Request:**
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "password": "SecurePassword123!",
  "roles": ["Developer"]
}
```

**Response:**
```json
{
  "id": 2,
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": true,
  "roles": ["Developer"]
}
```

**Validation:**
- Email must be valid and unique
- Password must meet security requirements
- Requesting user must have permission to assign specified roles

**Update User**

Update existing user information.

**Authentication:** Required (JWT)

**Authorization:** 
- User can update their own profile (limited fields)
- Manager+ can update users with equal or lower role level

**Request:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe-Smith"
}
```

**Role Hierarchy Check:** Ensures requesting user's role level ≥ target user's role level

### User Lifecycle Management

**Deactivate User**

Deactivate (soft delete) a user account.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Response:**
```json
{
  "message": "User deactivated successfully"
}
```

**Behavior:**
- Sets `IsActive = false`
- User cannot login
- Data is preserved (soft delete)
- Can be reactivated later

**Reactivate User**

Reactivate a previously deactivated user.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Response:**
```json
{
  "message": "User reactivated successfully"
}
```

### Role Management

**Manage User Roles**

Add or remove roles for a user.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Request:**
```json
{
  "rolesToAdd": ["Manager"],
  "rolesToRemove": ["Developer"]
}
```

**Validation:**
- Requesting user must have permission to grant/revoke specified roles
- Uses `UserExtensions.CanManageRoles()` to validate role hierarchy
- Cannot remove Administrator role from self

**Response:**
```json
{
  "message": "User roles updated successfully",
  "currentRoles": ["Manager"]
}
```

### Security Operations

**Lock User Account**

Lock user account (prevents login).

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Response:**
```json
{
  "message": "User locked successfully"
}
```

**Unlock User Account**

Unlock previously locked account.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Enable Two-Factor Authentication**

Enable two-factor authentication for a user.

**Authentication:** Required (JWT)

**Authorization:** 
- User can enable 2FA on their own account
- Manager+ can enable 2FA for other users (role hierarchy enforced)

**Disable Two-Factor Authentication**

Disable two-factor authentication for a user.

**Authentication:** Required (JWT)

**Authorization:** 
- User can disable 2FA on their own account
- Manager+ can disable 2FA for other users (role hierarchy enforced)

**Update Security Stamp**

Force logout on all devices by updating security stamp.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Response:**
```json
{
  "message": "Security stamp updated. User will be logged out on all devices."
}
```

**Behavior:**
- Invalidates all existing JWT tokens
- User must login again on all devices

### Email Management

**Resend Confirmation Email**

Resend email confirmation link.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required

**Response:**
```json
{
  "message": "Confirmation email sent successfully"
}
```

**Use Case:** When user hasn't received or lost confirmation email

**Change User Email (Admin)**

Admin-initiated email change for a user.

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Request:**
```json
{
  "newEmail": "newemail@example.com"
}
```

**Behavior:**
- Sends confirmation email to new address
- Email not changed until confirmed
- Old email remains active until confirmation

**Initiate Password Reset (Admin)**

Admin-initiated password reset (bypasses forgot-password flow).

**Authentication:** Required (JWT)

**Authorization:** Manager+ required, role hierarchy enforced

**Response:**
```json
{
  "message": "Password reset initiated. Reset email sent to user."
}
```

**Use Case:** When user cannot access email or forgot-password flow fails

## Helper Methods & Extensions

### UserExtensions (ServiceDefaults/UserExtensions.cs)

Extension methods for `ClaimsPrincipal` to support role hierarchy and authorization:

```csharp
// Check if user has elevated permissions (Manager+)
public static bool HasElevatedPermissions(this ClaimsPrincipal user)

// Get numeric role hierarchy level (1-4)
public static int GetRoleHierarchyLevel(string role)

// Get highest role level for user
public static int GetHighestRoleLevel(this ClaimsPrincipal user)

// Check if user can modify another user based on role hierarchy
public static bool CanModifyUser(this ClaimsPrincipal requestingUser, 
                                  IEnumerable<string> targetUserRoles)

// Check if user can grant/revoke specific roles
public static bool CanManageRoles(this ClaimsPrincipal user, 
                                   IEnumerable<string> rolesToManage)
```

### CheckUserModificationPermissions (UserController)

Private helper method that centralizes authorization logic:

```csharp
private async Task<bool> CheckUserModificationPermissions(
    int targetUserId, 
    int requestingUserId, 
    string actionName)
{
    // 1. Allow self-access for certain operations
    if (targetUserId == requestingUserId) return true;

    // 2. Fast path - check JWT claims first (Administrators always allowed)
    if (User.IsInRole(AuthRoles.Administrator))
    {
        _logger.LogInformation(
            "{ActionName}: Administrator user bypassing hierarchy check", 
            actionName);
        return true;
    }

    // 3. Check if user has elevated permissions (Manager+)
    if (!User.HasElevatedPermissions())
    {
        _logger.LogWarning(
            "{ActionName}: User does not have elevated permissions", 
            actionName);
        return false;
    }

    // 4. Slow path - query database for target user's roles
    var targetUserResult = await _userService.GetUserById(targetUserId);
    if (targetUserResult.IsFailed)
    {
        _logger.LogWarning(
            "{ActionName}: Target user not found: {UserId}", 
            actionName, targetUserId);
        return false;
    }

    // 5. Check role hierarchy
    if (!User.CanModifyUser(targetUserResult.Value.Roles))
    {
        _logger.LogWarning(
            "{ActionName}: User cannot modify target user due to role hierarchy", 
            actionName);
        return false;
    }

    return true;
}
```

**Usage in Controller Methods:**
```csharp
public async Task<ActionResult<UserDto>> UpdateUser(int id, UpdateUserDto dto)
{
    var requestingUserId = this.GetAuthenticatedUserId();
    
    if (!await CheckUserModificationPermissions(id, requestingUserId, nameof(UpdateUser)))
    {
        return Forbid();
    }

    // Proceed with update...
}
```

## Implementation Notes

### Security Considerations

1. **Role Hierarchy Enforcement**: All modifications check requesting user's role level vs target user's role level
2. **JWT Claims First**: Performance optimization checks in-memory claims before database queries
3. **Soft Deletes**: User deletion is non-destructive (sets `IsActive = false`)
4. **Audit Logging**: All operations logged with user IDs and action names
5. **Self-Access Protection**: Users always have access to their own account info

### Error Responses

All endpoints follow standard error response format:

```json
{
  "error": "Error message description",
  "details": ["Additional detail 1", "Additional detail 2"]
}
```

Common status codes:
- `200 OK` - Success
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions or role hierarchy violation
- `404 Not Found` - User not found
- `500 Internal Server Error` - Server error

### Related Documentation

- [Identity & Authentication](./identity_readme.md) - Self-service authentication flows
- [JWT Configuration](./identity_readme.md#jwt-configuration) - Token settings
- [Role Policies](./identity_readme.md#authorization-policies) - Policy definitions
