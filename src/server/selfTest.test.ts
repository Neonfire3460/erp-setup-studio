import { describe, expect, it } from "vitest";
import { SELF_TEST_CASES, runCase } from "./selfTestCases.server";

describe("pricing self-test (spec 10.2)", () => {
  it("has the 9 cases", () => expect(SELF_TEST_CASES).toHaveLength(9));
  for (const c of SELF_TEST_CASES) {
    it(`case ${c.n}: ${c.brand} ${c.entity} gives ${c.expected}`, () => {
      expect(runCase(c).retail).toBe(c.expected);
      expect(runCase(c).pass).toBe(true);
    });
  }
});
