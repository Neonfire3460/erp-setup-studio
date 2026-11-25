// ai.server.ts: one call to the Lovable AI gateway with a forced tool call. Server only (LOVABLE_API_KEY).
// Returns the tool's arguments, or a plain-words warning the page can show.

export type AiResult<T> = { args: T | null; warning: string | null };

export async function callTool<T>(opts: {
  system: string;
  prompt: string;
  tool: { name: string; description: string; parameters: Record<string, unknown> };
  model?: string;
}): Promise<AiResult<T>> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { args: null, warning: "The AI is not set up (LOVABLE_API_KEY missing)." };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.prompt },
        ],
        tools: [{ type: "function", function: opts.tool }],
        tool_choice: { type: "function", function: { name: opts.tool.name } },
      }),
    });
    if (res.status === 429)
      return { args: null, warning: "The AI is busy right now. Try again in a minute." };
    if (res.status === 402)
      return { args: null, warning: "The Lovable AI credits are used up. Fill these in by hand." };
    if (!res.ok) return { args: null, warning: `The AI could not answer (${res.status}).` };
    const j = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const raw = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!raw) return { args: null, warning: "The AI gave no answer. Try again." };
    return { args: JSON.parse(raw) as T, warning: null };
  } catch (e) {
    return {
      args: null,
      warning: `The AI could not be reached (${e instanceof Error ? e.message : "error"}).`,
    };
  }
}

/** Longest description the brand uses in the ERP (the AI keeps to it), between 60 and 240 characters. */
export function descriptionLimit(descriptions: string[]) {
  const lens = descriptions
    .map((d) => d.trim().length)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (!lens.length) return 100;
  return Math.min(240, Math.max(60, lens[Math.floor(lens.length * 0.98)] ?? 100));
}
