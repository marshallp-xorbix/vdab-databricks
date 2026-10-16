# Management Controller Documentation

## Overview

The `ManagementController` provides RESTful API endpoints for managing application-level settings and roles. It handles role CRUD operations (Create, Read, Delete) following the application's architectural pattern of Controller → Interface → Service.

**Base Route:** `/api/management`

**Authorization:** Requires Administrator role for all operations (currently commented out for development)

## Architecture

### Layer Structure
- **Controller:** `ManagementController` - Handles HTTP concerns, authentication, and response mapping
- **Interface:** `IManagementService` - Defines service contract
- **Service:** `ManagementService` - Contains business logic, validation, and role management operations

### Dependencies
- `ILogger<ManagementController>` - Structured logging
- `IManagementService` - Business logic service for role management

### Error Handling
Uses FluentResults pattern with `HandleFluentResult()` extension method to map service layer results to appropriate HTTP responses:
- `BadRequestError` → 400 Bad Request
- `ConflictError` → 409 Conflict
- `NotFoundError` → 404 Not Found
- `UnauthorizedError` → 401 Unauthorized

## Endpoints

### 1. Get All Roles
Retrieves a list of all roles in the application.

**Endpoint:** `GET /api/management/roles`

**Authorization:** Administrator

**Request:** None

**Response:** `200 OK`
```json
[
  "Administrator",
  "TenantAdmin",
  "Manager",
  "Developer",
  "CustomRole1"
]
```

**Response:** `401 Unauthorized` - User not authenticated

**Business Logic:**
- Queries all roles from database
- Orders roles alphabetically
- Returns as enumerable string collection

**Usage Example:**
```http
GET /api/management/roles
Authorization: Bearer <jwt-token>
```

---

### 2. Add Role
Creates a new custom role in the application.

**Endpoint:** `POST /api/management/roles`

**Authorization:** Administrator

**Request Body:** `AddRoleRequest`
```json
{
  "roleName": "CustomRole1"
}
```

**Response:** `201 Created`
```json
"CustomRole1"
```
Returns the created role name with location header.

**Response:** `400 Bad Request`
- Role name is empty or whitespace
- Role creation failed due to validation errors

**Response:** `409 Conflict`
- Role already exists

**Response:** `401 Unauthorized` - User not authenticated

**Business Logic:**
- Validates role name is not empty
- Checks if role already exists
- Creates new role using `RoleManager`
- Logs creation activity with user ID

**Usage Example:**
```http
POST /api/management/roles
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "roleName": "CustomRole1"
}
```

---

### 3. Remove Role
Deletes a custom role from the application.

**Endpoint:** `DELETE /api/management/roles/{roleName}`

**Authorization:** Administrator

**Path Parameters:**
- `roleName` (string, required) - Name of the role to delete

**Response:** `204 No Content` - Role successfully deleted

**Response:** `400 Bad Request`
- Role name is empty or whitespace
- Cannot delete system roles (Administrator, TenantAdmin, Manager, Developer)
- Role deletion failed

**Response:** `404 Not Found` - Role does not exist

**Response:** `401 Unauthorized` - User not authenticated

**Business Logic:**
- Validates role name is not empty
- Protects system roles from deletion
- Finds role by name
- Deletes role using `RoleManager`
- Logs deletion activity with user ID

**System Roles (Protected):**
- `Administrator` - Full system access across all tenants
- `TenantAdmin` - Full control of tenant account
- `Manager` - Developer access plus user/resource management
- `Developer` - Can create and modify workflows, templates, connections

**Usage Example:**
```http
DELETE /api/management/roles/CustomRole1
Authorization: Bearer <jwt-token>
```

---

## Service Layer (IManagementService)

### Methods

#### GetRolesAsync()
```csharp
Task<Result<IEnumerable<string>>> GetRolesAsync()
```
Retrieves all roles ordered alphabetically.

#### AddRoleAsync(string roleName, int createdByUserId)
```csharp
Task<Result<string>> AddRoleAsync(string roleName, int createdByUserId)
```
Creates a new role with validation and duplicate checking.

#### RemoveRoleAsync(string roleName, int deletedByUserId)
```csharp
Task<Result> RemoveRoleAsync(string roleName, int deletedByUserId)
```
Deletes a role with system role protection and existence validation.

---

## DTOs

### AddRoleRequest
```csharp
public class AddRoleRequest
{
    [Required]
    public string RoleName { get; set; }
}
```

---

## Security Considerations

1. **Authorization:** All endpoints require Administrator role (policy-based authorization)
2. **Audit Logging:** All role operations are logged with user ID for audit trail
3. **System Role Protection:** Cannot delete core system roles
4. **Input Validation:** Role names are validated for empty/whitespace
5. **Authentication:** User ID extracted from JWT claims for all operations

---

## Common Use Cases

### Listing Available Roles
Used to display all roles in admin UI for role assignment to users.

### Creating Custom Roles
Allows administrators to create organization-specific roles beyond the four system roles.

### Removing Obsolete Roles
Cleanup of custom roles that are no longer needed (system roles cannot be removed).

---

## Integration Points

### User Management
Role management integrates with `UserController` for user role assignment:
- `PUT /api/user/{id}/roles` - Assign/remove roles from users (uses roles from ManagementController)

### Authentication
Roles are used throughout the application for authorization:
- Policy-based: `RequireAdministratorRole`, `RequireManagerRole`
- Role-based: Direct role checks in business logic

---

## Error Responses

### 400 Bad Request
```json
{
  "errors": [
    {
      "message": "Role name is required"
    }
  ]
}
```

### 409 Conflict
```json
{
  "errors": [
    {
      "message": "Role 'CustomRole1' already exists"
    }
  ]
}
```

### 404 Not Found
```json
{
  "errors": [
    {
      "message": "Role 'CustomRole1' not found"
    }
  ]
}
```

---

## Development Notes

### Current State
- Authorization policy is commented out for development testing
- Should be uncommented for production: `[Authorize(Policy = AuthPolicies.RequireAdministratorRole)]`

### Service Registration
Registered in `Program.cs`:
```csharp
builder.Services.AddScoped<IManagementService, ManagementService>();
```

### Testing Considerations
- Test role creation with duplicate names
- Test system role deletion protection
- Test unauthorized access attempts
- Verify audit logging captures all operations
- Test role name validation (empty, whitespace, special characters)

---

## Future Enhancements

1. **Role Permissions:** Add granular permissions to roles
2. **Role Descriptions:** Support custom descriptions for roles
3. **Role Hierarchy:** Implement role inheritance
4. **Bulk Operations:** Add endpoints for bulk role operations
5. **Role Usage Reports:** Show which users are assigned to each role
6. **Soft Delete:** Implement soft delete for roles with usage history
