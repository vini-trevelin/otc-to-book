import { describe, expect, it } from "vitest";

import { formatUtcTime } from "@/lib/time";

describe("formatUtcTime", () => {
  it("preserves backend UTC timestamps instead of rendering local time", () => {
    expect(formatUtcTime("2026-06-19T12:00:00Z")).toBe("12:00:00");
  });
});
