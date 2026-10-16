import { describe, expect, it } from "vitest";
import { formatTokenCount } from "../formatTokenCount";

describe("formatTokenCount", () => {
  it("returns raw value below 1k", () => {
    expect(formatTokenCount(500)).toBe("500");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("floors thousands display", () => {
    expect(formatTokenCount(1_000)).toBe("1k");
    expect(formatTokenCount(10_000)).toBe("10k");
    expect(formatTokenCount(999_499)).toBe("999.4k");
    expect(formatTokenCount(999_999)).toBe("999.9k");
  });

  it("floors millions display so 1M is not shown early", () => {
    expect(formatTokenCount(950_000)).toBe("950k");
    expect(formatTokenCount(999_999)).toBe("999.9k");
    expect(formatTokenCount(1_000_000)).toBe("1M");
    expect(formatTokenCount(1_500_000)).toBe("1.5M");
  });
});
