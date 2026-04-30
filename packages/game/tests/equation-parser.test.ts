import { describe, expect, test } from "bun:test";
import { validateEquation } from "../src/equation-parser";

const tokens = (labels: string[]) => labels.map((label) => ({ label, value: 1 }));

describe("equation parser", () => {
  test("accepts chained equality and unary minus before non-zero numbers", () => {
    const result = validateEquation(tokens(["3", "+", "4", "=", "7", "+", "0", "=", "-", "6", "+", "13"]));

    expect(result.value).toBe(7);
  });

  test("rejects leading zeros", () => {
    expect(() => validateEquation(tokens(["0", "1", "2", "=", "12"]))).toThrow("Leading zero");
  });

  test("rejects more than 3 concatenated digit tiles", () => {
    expect(() => validateEquation(tokens(["1", "2", "3", "4", "=", "123"]))).toThrow("at most 3");
  });

  test("rejects unary minus before zero", () => {
    expect(() => validateEquation(tokens(["-", "0", "=", "0"]))).toThrow("non-zero");
  });

  test("rejects unequal chains", () => {
    expect(() => validateEquation(tokens(["3", "=", "3", "=", "4"]))).toThrow("same value");
  });
});
