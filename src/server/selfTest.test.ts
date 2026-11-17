import { describe, expect, it } from "vitest";
import { SELF_TEST_CASES, runCase } from "./selfTestCases.server";
import { hasErrors, ticketSchema, submitSchema } from "@/lib/workflow";
import { checkTemplateRows } from "@/lib/excelFiles";

describe("pricing self-test (spec 10.2)", () => {
  it("has the 9 cases", () => expect(SELF_TEST_CASES).toHaveLength(9));
  for (const c of SELF_TEST_CASES) {
    it(`case ${c.n}: ${c.brand} ${c.entity} gives ${c.expected}`, () => {
      expect(runCase(c).retail).toBe(c.expected);
      expect(runCase(c).pass).toBe(true);
    });
  }
});

describe("submission workflow rules", () => {
  it("warnings do not block submission but errors do", () => {
    expect(hasErrors([{ level: "warning", code: "price_on_request", message: "zero" }])).toBe(
      false,
    );
    expect(hasErrors([{ level: "error", code: "cost_invalid", message: "missing" }])).toBe(true);
  });
  it("ticket divisors must be greater than zero and at most one", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect(ticketSchema.safeParse({ id, divisors: [0] }).success).toBe(false);
    expect(ticketSchema.safeParse({ id, divisors: [1.01] }).success).toBe(false);
    expect(ticketSchema.safeParse({ id, divisors: [0.75, 0.75] }).success).toBe(true);
  });
  it("template checks apply copies and allow zero cost with a warning", () => {
    const row = {
      row: 2,
      itemCode: "00012",
      alternativeCode: "",
      description: "Controller",
      alternateDescription: "",
      brandActivity: "",
      subActivity: "Lightware",
      costPrice: 0,
      costRaw: "0",
      measurementUnit: "",
    };
    const result = checkTemplateRows([row], {
      brandActivity: "Lightware",
      subActivities: ["Lightware"],
    });
    expect(result.rows[0]?.alternativeCode).toBe("00012");
    expect(result.rows[0]?.alternateDescription).toBe("Controller");
    expect(result.rows[0]?.brandActivity).toBe("Lightware");
    expect(result.checks.get(2)?.some((c) => c.code === "price_on_request")).toBe(true);
    expect(
      submitSchema.safeParse({
        brand: "Lightware",
        path: "owner/file",
        sheets: [{ entityCode: "001", costCurrency: "AED", rows: result.rows }],
      }).success,
    ).toBe(true);
  });
});
