import { describe, expect, it } from "vitest";
import { ApiError } from "../../models/ApiError";
import { parseError } from "../utils";
import { formatApiErrorMessage } from "../../utils/apiErrorMessage";

const NOT_FOUND_MESSAGE =
  "Nothing was found for this request. The resource may not exist or your account may not have access.";
const BAD_GATEWAY_MESSAGE =
  "Databricks returned an error. Try again or check workspace connectivity.";

describe("parseError", () => {
  it("prefers ProblemDetails detail over errors array", () => {
    const error = new ApiError("Bad Request", 400, {
      title: "Bad Request",
      status: 400,
      detail: "Code is invalid. Tier is required.",
      errors: ["Code is invalid.", "Tier is required."],
    });

    expect(parseError(error).message).toBe(
      "Code is invalid. Tier is required.",
    );
    expect(parseError(error).messages).toEqual([
      "Code is invalid.",
      "Tier is required.",
    ]);
  });

  it("space-joins ProblemDetails errors when detail is missing", () => {
    const error = new ApiError("Bad Request", 400, {
      title: "Bad Request",
      status: 400,
      errors: ["Code is invalid.", "Tier is required."],
    });

    expect(parseError(error).message).toBe("Code is invalid. Tier is required.");
  });

  it("extracts and joins object-shaped ProblemDetails errors", () => {
    const error = new ApiError("Bad Request", 400, {
      title: "Bad Request",
      status: 400,
      errors: [{ message: "First failure." }, { message: "Second failure." }],
    });

    expect(parseError(error).message).toBe("First failure. Second failure.");
  });

  it("falls back to trimmed ProblemDetails title when detail and errors are absent", () => {
    const error = new ApiError("Conflict", 409, {
      title: "  Conflict  ",
      status: 409,
    });

    expect(parseError(error).message).toBe("Conflict");
  });

  it("space-joins raw FluentResults array responses", () => {
    const error = new ApiError("Bad Request", 400, [
      { message: "Alpha." },
      { message: "Beta." },
    ]);

    expect(parseError(error).message).toBe("Alpha. Beta.");
    expect(parseError(error).messages).toEqual(["Alpha.", "Beta."]);
  });

  it("space-joins a raw array-of-strings FluentResults body", () => {
    const error = new ApiError("Bad Request", 400, [
      "Code is invalid.",
      "Tier is required.",
    ]);

    expect(parseError(error).message).toBe("Code is invalid. Tier is required.");
    expect(parseError(error).messages).toEqual([
      "Code is invalid.",
      "Tier is required.",
    ]);
  });

  it("falls back to reasons when a FluentResults entry has no message", () => {
    const error = new ApiError("Bad Request", 400, [
      { reasons: ["Code already used."] },
    ]);

    expect(parseError(error).message).toBe("Code already used.");
  });

  it("falls back to status copy for an empty FluentResults array", () => {
    const error = new ApiError("Bad Gateway", 502, []);

    expect(parseError(error).message).toBe(BAD_GATEWAY_MESSAGE);
  });

  it("returns raw string ApiError bodies", () => {
    const error = new ApiError("Bad Gateway", 502, "Upstream timeout");

    expect(parseError(error).message).toBe("Upstream timeout");
  });

  it("returns friendly copy for ApiError 404 without structured data", () => {
    const error = new ApiError("Not Found", 404);

    expect(parseError(error).message).toBe(NOT_FOUND_MESSAGE);
  });

  it("returns friendly copy for ApiError 502 without structured data", () => {
    const error = new ApiError("Bad Gateway", 502);

    expect(parseError(error).message).toBe(BAD_GATEWAY_MESSAGE);
  });

  it("returns trimmed ApiError message when no structured data is present", () => {
    const error = new ApiError("  Service Unavailable  ", 503);

    expect(parseError(error).message).toBe("Service Unavailable");
  });

  it("returns trimmed plain Error message", () => {
    const error = new Error("  Network failed  ");

    expect(parseError(error).message).toBe("Network failed");
  });

  it("returns generic copy for unknown errors", () => {
    expect(parseError(null).message).toBe("Something went wrong.");
  });

  it("returns generic copy for plain Error with empty message", () => {
    const error = new Error("   ");

    expect(parseError(error).message).toBe("Something went wrong.");
  });
});

describe("formatApiErrorMessage", () => {
  const fixtures: unknown[] = [
    new ApiError("Bad Request", 400, {
      title: "Bad Request",
      status: 400,
      detail: "Code is invalid. Tier is required.",
      errors: ["Code is invalid.", "Tier is required."],
    }),
    new ApiError("Bad Request", 400, {
      title: "Bad Request",
      status: 400,
      errors: ["Code is invalid.", "Tier is required."],
    }),
    new ApiError("Bad Request", 400, {
      title: "Bad Request",
      status: 400,
      errors: [{ message: "First failure." }, { message: "Second failure." }],
    }),
    new ApiError("Conflict", 409, { title: "Conflict", status: 409 }),
    new ApiError("Bad Request", 400, [{ message: "Alpha." }, { message: "Beta." }]),
    new ApiError("Bad Gateway", 502, "Upstream timeout"),
    new ApiError("Not Found", 404),
    new ApiError("Bad Gateway", 502),
    new ApiError("  Service Unavailable  ", 503),
    new Error("  Network failed  "),
    null,
    new Error("   "),
  ];

  it.each(fixtures)("matches parseError for %#", (fixture) => {
    expect(formatApiErrorMessage(fixture)).toBe(parseError(fixture).message);
  });
});
