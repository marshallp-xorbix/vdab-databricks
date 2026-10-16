using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using OpenTelemetry.Trace;
using System.Diagnostics;

namespace Xorbix_Visual_Databricks_App_Builder.Server.Middleware;

/// <summary>
/// Global exception handler that converts unhandled exceptions into RFC 9457 ProblemDetails responses.
/// </summary>
public sealed class GlobalExceptionHandler(IHostEnvironment env, ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    private static readonly Dictionary<Type, (int StatusCode, string Title)> ExceptionMap = new()
    {
        [typeof(UnauthorizedAccessException)] =
            (StatusCodes.Status401Unauthorized, "Unauthorized"),
        [typeof(KeyNotFoundException)] =
            (StatusCodes.Status404NotFound, "Not Found"),
        [typeof(NotImplementedException)] =
            (StatusCodes.Status501NotImplemented, "Not Implemented"),
        [typeof(InvalidOperationException)] =
            (StatusCodes.Status409Conflict, "Conflict"),
        [typeof(ArgumentException)] =
            (StatusCodes.Status400BadRequest, "Bad Request"),
        [typeof(ArgumentNullException)] =
            (StatusCodes.Status400BadRequest, "Bad Request"),
        [typeof(OperationCanceledException)] =
            (StatusCodes.Status499ClientClosedRequest, "Client Closed Request"),
        [typeof(TaskCanceledException)] =
            (StatusCodes.Status499ClientClosedRequest, "Client Closed Request"),
    };

    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (statusCode, title) = ExceptionMap.TryGetValue(exception.GetType(), out var mapped)
            ? mapped
            : (StatusCodes.Status500InternalServerError, "Internal Server Error");

        if (statusCode == StatusCodes.Status499ClientClosedRequest)
        {
            logger.LogInformation("Request cancelled by client: {Path}", httpContext.Request.Path);
        }
        else
        {
            logger.LogError(exception, "Unhandled exception on {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }

        Activity.Current?.AddException(exception);
        Activity.Current?.SetStatus(ActivityStatusCode.Error, exception.Message);

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception.Message,
            Instance = $"{httpContext.Request.Method} {httpContext.Request.Path}",
        };

        problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;

        if (exception.InnerException is not null)
        {
            problemDetails.Extensions["innerException"] = exception.InnerException.Message;
        }

        if (env.IsDevelopment() || env.IsStaging())
        {
            problemDetails.Extensions["stackTrace"] = exception.StackTrace;
        }

        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);

        return true;
    }
}
