using FluentResults;
using System.Globalization;

namespace Xorbix_Visual_Databricks_App_Builder.Models;

/// <summary>
/// Represents a <see cref="Error"/> that should result in a 400 Bad Request response from an API.
/// </summary>
public class BadRequestError(string message) : Error(message);

/// <summary>
/// Represents a <see cref="Error"/> that should result in a 404 Not Found response from an API.
/// </summary>
public class NotFoundError(string message) : Error(message);

/// <summary>
/// Represents a <see cref="Error"/> that should result in a 401 Unauthorized response from an API.
/// </summary>
public class UnauthorizedError(string message) : Error(message);

/// <summary>
/// Represents a <see cref="Error"/> that should result in a 409 Conflict response from an API.
/// </summary>
public class ConflictError(string message) : Error(message);

/// <summary>
/// Represents a <see cref="Error"/> that should result in a 403 Forbidden response from an API.
/// User is authenticated but not authorized for this operation.
/// </summary>
public class ForbiddenError(string message) : Error(message);

/// <summary>
/// Represents a general identity error.
/// </summary>
public class IdentityValidationError(string message) : Error(message);

/// <summary>
/// Represents a general identity error.
/// </summary>
public class IdentityDuplicateError(string message) : Error(message);

/// <summary>
/// Represents a <see cref="Error"/> used when a parameter does not pass validation 
/// </summary>
/// <param name="message"></param>
public class ValidationError(string message) : Error(message);

/// <summary>
/// Represents a <see cref="Success"/> that should result in a 202 Accepted response from an API.
/// </summary>
public class AcceptedSuccess(string message) : Success(message);

/// <summary>
/// Represents an error that should result in a 410 Gone response.
/// Use for soft-deleted or permanently removed resources.
/// </summary>
public class GoneError(string message) : Error(message);

/// <summary>
/// Represents an error that should result in a 501 Not Implemented response.
/// Useful for stub endpoints during phased development.
/// </summary>
public class NotImplementedError(string message) : Error(message);

/// <summary>
/// Represents a failure from an upstream dependency (e.g. Databricks API) that should result in a 502 Bad Gateway response.
/// Use a user-safe <paramref name="message"/>; log detailed diagnostics separately.
/// </summary>
public class UpstreamDependencyError(string message) : Error(message);

/// <summary>
/// Marks an error that carries how many verification attempts the caller has left. The API surfaces
/// this as a <c>remainingAttempts</c> problem-details extension so clients never hard-code the limit.
/// </summary>
public interface IRemainingAttemptsError
{
	/// <summary>Gets the number of verification submissions the caller may still make.</summary>
	int RemainingAttempts { get; }
}

/// <summary>
/// Represents a rejected verification code where the caller still has attempts left.
/// Results in a 401 Unauthorized response.
/// </summary>
public class VerificationAttemptsError : UnauthorizedError, IRemainingAttemptsError
{
	/// <summary>Initializes a new instance of the <see cref="VerificationAttemptsError"/> class.</summary>
	/// <param name="message">The user-facing error message.</param>
	/// <param name="remainingAttempts">The number of verification submissions the caller may still make.</param>
	public VerificationAttemptsError(string message, int remainingAttempts)
		: base(message)
	{
		Metadata[nameof(RemainingAttempts)] = remainingAttempts;
	}

	/// <inheritdoc/>
	public int RemainingAttempts
	{
		get
		{
			object? raw = Metadata[nameof(RemainingAttempts)];
			return raw is int value ? value : 0;
		}
	}
}

/// <summary>
/// Represents a verification challenge whose attempts are spent. The code has been invalidated and
/// the caller must request a new one. Results in a 400 Bad Request response.
/// </summary>
public class VerificationCodeExhaustedError : BadRequestError, IRemainingAttemptsError
{
	/// <summary>Initializes a new instance of the <see cref="VerificationCodeExhaustedError"/> class.</summary>
	/// <param name="message">The user-facing error message.</param>
	public VerificationCodeExhaustedError(string message)
		: base(message)
	{
		Metadata[nameof(RemainingAttempts)] = 0;
	}

	/// <inheritdoc/>
	public int RemainingAttempts => 0;
}

/// <summary>
/// Represents a throttled request that should result in a 429 Too Many Requests response. The
/// retry-after instant is exposed as <see cref="RetryAfterUtc"/>, which drives both the
/// <c>Retry-After</c> header and the <c>retryAfter</c> problem-details extension.
/// </summary>
public class TooManyRequestsError : Error
{
	/// <summary>Initializes a new instance of the <see cref="TooManyRequestsError"/> class.</summary>
	/// <param name="message">The user-facing error message.</param>
	/// <param name="retryAfterUtc">The UTC instant at which the caller may retry.</param>
	public TooManyRequestsError(string message, DateTime retryAfterUtc)
		: base(message)
	{
		Metadata[nameof(RetryAfterUtc)] = retryAfterUtc.ToString("O", CultureInfo.InvariantCulture);
	}

	/// <summary>Gets the UTC instant at which the caller may retry.</summary>
	public DateTime RetryAfterUtc
	{
		get
		{
			string? raw = Metadata[nameof(RetryAfterUtc)]?.ToString();
			return DateTime.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out DateTime parsed)
				? parsed
				: DateTime.UtcNow;
		}
	}
}

/// <summary>
/// Represents a partial-failure where Databricks provisioning succeeded but local persistence failed.
/// </summary>
public class PartialDatabricksProvisionError : Error
{
	public PartialDatabricksProvisionError(
		string message,
		string databricksAppName,
		int workspaceConnectionId,
		Exception exception)
		: base(message)
	{
		Metadata[nameof(DatabricksAppName)] = databricksAppName;
		Metadata[nameof(WorkspaceConnectionId)] = workspaceConnectionId;
		Metadata[nameof(ExceptionType)] = exception.GetType().Name;
	}

	public string DatabricksAppName => Metadata[nameof(DatabricksAppName)]?.ToString() ?? string.Empty;

	public int WorkspaceConnectionId
	{
		get
		{
			object? raw = Metadata[nameof(WorkspaceConnectionId)];
			return raw is int value ? value : 0;
		}
	}

	public string ExceptionType => Metadata[nameof(ExceptionType)]?.ToString() ?? string.Empty;
}

/// <summary>
/// Represents a field-level codeName validation error that should result in a 400 Bad Request response.
/// </summary>
public class CodeNameValidationError : BadRequestError
{
	public CodeNameValidationError(string message, string field, string componentId, string? codeName, string violation)
		: base(message)
	{
		Metadata[nameof(Field)] = field;
		Metadata[nameof(ComponentId)] = componentId;
		Metadata[nameof(CodeName)] = codeName ?? string.Empty;
		Metadata[nameof(Violation)] = violation;
		Metadata[nameof(ErrorCode)] = "CodeNameValidation";
	}

	public string Field => Metadata[nameof(Field)]?.ToString() ?? string.Empty;

	public string ComponentId => Metadata[nameof(ComponentId)]?.ToString() ?? string.Empty;

	public string CodeName => Metadata[nameof(CodeName)]?.ToString() ?? string.Empty;

	public string Violation => Metadata[nameof(Violation)]?.ToString() ?? string.Empty;

	public string ErrorCode => Metadata[nameof(ErrorCode)]?.ToString() ?? string.Empty;
}

/// <summary>
/// Represents a platform AI Builder monthly token quota exhaustion that should result in a 403 Forbidden response.
/// </summary>
public class PlatformAiQuotaExceededError : ForbiddenError
{
	public PlatformAiQuotaExceededError(
		string message,
		long tokensUsed,
		long tokenLimit,
		DateTime resetsAtUtc)
		: base(message)
	{
		Metadata[nameof(TokensUsed)] = tokensUsed;
		Metadata[nameof(TokenLimit)] = tokenLimit;
		Metadata[nameof(ResetsAtUtc)] = resetsAtUtc.ToString("O");
	}

	public long TokensUsed
	{
		get
		{
			object? raw = Metadata[nameof(TokensUsed)];
			return raw is long value ? value : Convert.ToInt64(raw ?? 0L);
		}
	}

	public long TokenLimit
	{
		get
		{
			object? raw = Metadata[nameof(TokenLimit)];
			return raw is long value ? value : Convert.ToInt64(raw ?? 0L);
		}
	}

	public DateTime ResetsAtUtc
	{
		get
		{
			string? raw = Metadata[nameof(ResetsAtUtc)]?.ToString();
			return DateTime.TryParse(raw, out DateTime parsed) ? parsed : DateTime.UtcNow;
		}
	}
}
