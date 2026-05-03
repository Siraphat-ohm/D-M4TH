import { describe, expect, test } from "bun:test";
import { formatSignedTime } from "../ui/shared/format";

describe("formatSignedTime", () => {
  test("formats positive time", () => {
    expect(formatSignedTime(10000)).toBe("0:10");
    expect(formatSignedTime(65000)).toBe("1:05");
  });

  test("formats zero time", () => {
    expect(formatSignedTime(0)).toBe("0:00");
  });

  test("formats negative time", () => {
    expect(formatSignedTime(-1000)).toBe("-0:01");
    expect(formatSignedTime(-73000)).toBe("-1:13");
  });

  test("uses ceil for consistent second increments", () => {
    // 0.1s shows as 1s
    expect(formatSignedTime(100)).toBe("0:01");
    // -0.1s shows as -1s
    expect(formatSignedTime(-100)).toBe("-0:01");
  });
});
