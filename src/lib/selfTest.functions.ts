import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SelfTestLine { label: string; pass: boolean }

// Admin only. Runs the section 10.2 cases through processSubmission with an in-memory context.
export const runPricingSelfTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SelfTestLine[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { SELF_TEST_CASES, ENTITIES, runCase } = await import("@/server/selfTestCases.server");
    return SELF_TEST_CASES.map((c) => ({
      label: `${c.n} · ${c.brand} · ${c.entity} (${ENTITIES[c.entity]?.currency ?? ""}) · cost in ${c.costCurrency}`,
      pass: runCase(c).pass,
    }));
  });
