import { createServerFn } from "@tanstack/start-client-core";
import { z } from "zod";

type OpenAIResponsesCreate = {
  model: string;
  input:
    | string
    | Array<{
        role: "system" | "user" | "assistant";
        content:
          | string
          | Array<
              | { type: "input_text"; text: string }
              | { type: "output_text"; text: string }
            >;
      }>;
  max_output_tokens?: number;
};

type OpenAIResponsesResult = {
  id?: string;
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

function getOutputText(r: OpenAIResponsesResult): string {
  const direct = (r.output_text ?? "").trim();
  if (direct) return direct;
  const out = r.output ?? [];
  for (const item of out) {
    for (const c of item.content ?? []) {
      if ((c.type ?? "") === "output_text" && (c.text ?? "").trim()) {
        return String(c.text).trim();
      }
    }
  }
  return "";
}

const inputSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string(),
});

export const postOpenAiReflection = createServerFn({ method: "POST" })
  .inputValidator(inputSchema)
  .handler(async ({ data }) => {
    const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      throw new Error("OpenAI is not configured. Set OPENAI_API_KEY in .env.local.");
    }

    const model = (process.env.OPENAI_REFLECTION_MODEL ?? "").trim() || "gpt-4o-mini";

    const body: OpenAIResponsesCreate = {
      model,
      input: [
        { role: "system", content: [{ type: "input_text", text: data.systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: data.prompt }] },
      ],
      max_output_tokens: 700,
    };

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 45_000);
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    }).finally(() => clearTimeout(t));

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(text || `OpenAI request failed (${resp.status})`);
    }

    const json = (await resp.json()) as OpenAIResponsesResult;
    const answer = getOutputText(json);
    if (!answer) throw new Error("OpenAI returned an empty response.");
    return { answer, model };
  });
