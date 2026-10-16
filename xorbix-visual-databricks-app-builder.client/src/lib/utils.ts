import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ApiError,
  CommonError,
  FluentError,
  type IFluentError,
  ProblemDetails,
} from "../models";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const parseApiDate = (date: string | Date): Date => {
  if (date instanceof Date) return date;
  // If string doesn't specify timezone, assume UTC
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(date)) {
    return new Date(date + "Z");
  }
  return new Date(date);
};

const NOT_FOUND_MESSAGE =
  "Nothing was found for this request. The resource may not exist or your account may not have access.";
const BAD_GATEWAY_MESSAGE =
  "Databricks returned an error. Try again or check workspace connectivity.";

/**
 * Extracts human-readable strings from a ProblemDetails errors array entry.
 */
function extractMessageFromErrorItem(item: unknown): string | null {
  if (typeof item === "string" && item.trim()) {
    return item.trim();
  }
  if (item && typeof item === "object" && "message" in item) {
    const message = (item as { message?: string }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return null;
}

/**
 * Extracts individual error messages from a ProblemDetails errors field.
 */
function extractMessagesFromProblemDetailsErrors(
  errors: ProblemDetails["errors"],
): string[] {
  if (Array.isArray(errors)) {
    return errors
      .map((item) => extractMessageFromErrorItem(item))
      .filter((message): message is string => message !== null);
  }
  if (errors && typeof errors === "object") {
    return Object.values(errors)
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .filter((message): message is string => typeof message === "string")
      .map((message) => message.trim())
      .filter((message) => message.length > 0);
  }
  return [];
}

/**
 * Converts a ProblemDetails object into a CommonError.
 * @param problemDetails The ProblemDetails object to convert.
 * @returns A CommonError object.
 */
function convertProblemDetailsToCommonError(
  problemDetails: ProblemDetails,
): CommonError {
  const detail =
    typeof problemDetails.detail === "string" ? problemDetails.detail.trim() : "";
  const extractedMessages =
    extractMessagesFromProblemDetailsErrors(problemDetails.errors);
  const title =
    typeof problemDetails.title === "string" ? problemDetails.title.trim() : "";

  let message: string;
  let messages: string[];

  if (detail) {
    message = detail;
    messages = extractedMessages.length > 0 ? extractedMessages : [detail];
  } else if (extractedMessages.length > 0) {
    message = extractedMessages.join(" ");
    messages = extractedMessages;
  } else if (title) {
    message = title;
    messages = [title];
  } else {
    message = "An error occurred";
    messages = [message];
  }

  return new CommonError({
    name: title || "Error",
    message,
    messages,
    status: problemDetails.status || 0,
    problemDetails: problemDetails,
  });
}

/**
 * Fallback message for ApiError without structured response data.
 */
function getApiErrorFallbackMessage(error: ApiError): string {
  if (error.status === 404) {
    return NOT_FOUND_MESSAGE;
  }
  if (error.status === 502) {
    return BAD_GATEWAY_MESSAGE;
  }
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }
  return "Request failed.";
}

/**
 * Converts a FluentResults error array response body into a CommonError.
 * Accepts entries shaped as plain strings or { message?, reasons? } objects.
 */
function convertFluentResultsToCommonError(
  error: ApiError,
  data: unknown[],
): CommonError {
  const fluentErrors = data.map((err) =>
    typeof err === "string"
      ? new FluentError({ message: err })
      : new FluentError(err as IFluentError),
  );
  const fluentMessages = fluentErrors
    .map((fe) => fe.message?.trim() || fe.reasons?.join(" ").trim() || "")
    .filter((msg) => msg.length > 0);
  const message =
    fluentMessages.length > 0
      ? fluentMessages.join(" ")
      : getApiErrorFallbackMessage(error);

  return new CommonError({
    name: "Validation Error",
    message,
    messages: fluentMessages.length > 0 ? fluentMessages : [message],
    status: error.status,
    fluentErrors: fluentErrors,
  });
}

/**
 * Parses an error for handling.
 * @param error The error to parse.
 * @returns A CommonError object.
 */
export function parseError(error: unknown): CommonError {
  if (error instanceof ApiError) {
    const data = error.data;

    // 1. Handle ProblemDetails (Standard ASP.NET Core Error)
    // ProblemDetails is an object with at least title, status, type, or detail
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      (data.title || data.type || data.status || data.detail)
    ) {
      return convertProblemDetailsToCommonError(new ProblemDetails(data));
    }

    // 2. Handle FluentResults Errors (array of strings or { message?, reasons? } objects)
    if (Array.isArray(data)) {
      return convertFluentResultsToCommonError(error, data);
    }

    // 3. Handle String Error (Raw text response)
    if (typeof data === "string") {
      return new CommonError({
        name: "ApiError",
        message: data,
        messages: [data],
        status: error.status,
        error: error,
      });
    }

    // 4. Fallback for ApiError without structured data
    const fallbackMessage = getApiErrorFallbackMessage(error);
    return new CommonError({
      name: "ApiError",
      message: fallbackMessage,
      messages: [fallbackMessage],
      status: error.status,
      error: error,
    });
  } else if (error instanceof Error) {
    // Handle common JS/TS errors
    const message = error.message.trim() || "Something went wrong.";
    return new CommonError({
      name: error.name || "Error",
      message,
      messages: [message],
      status: 0,
      stack: error.stack || "",
      error: error,
    });
  } else {
    // Handle unknown errors
    return new CommonError({
      name: "Error",
      message: "Something went wrong.",
      messages: ["Something went wrong."],
      status: 0,
    });
  }
}
