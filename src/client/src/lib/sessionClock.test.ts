import { describe, expect, it } from "vitest";
import { formatElapsed } from "./sessionClock";

describe("formatElapsed", () => {
  it("formats minutes and seconds under an hour", () => {
    expect(formatElapsed(0, 65_000)).toBe("1:05");
  });

  it("switches to hours past 60 minutes", () => {
    expect(formatElapsed(0, 3_723_000)).toBe("1:02:03");
  });

  it("computes from the session start, not from zero", () => {
    expect(formatElapsed(1_000, 61_000)).toBe("1:00");
  });

  it("returns 0:00 before the session start is known", () => {
    expect(formatElapsed(null, 65_000)).toBe("0:00");
  });

  it("never shows a negative elapsed time", () => {
    expect(formatElapsed(5_000, 0)).toBe("0:00");
  });
});