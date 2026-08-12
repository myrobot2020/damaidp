import type { Plugin } from "vite";

type OpenAIResponsesCreate = {
  model: string;
  input:
    | string
    | Array<{
        role: "system" | "user" | "assistant";
        content: Array<{ type: "input_text"; text: string }>;
      }>;
  max_output_tokens?: number;
};

type OpenAIResponsesResult = {
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

function readJsonBody(req: import("node:http").IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: import("node:http").ServerResponse, status: number, payload: any) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

type GeminiGenerateContentRequest = {
  system_instruction?: {
    parts: Array<{ text: string }>;
  };
  contents: Array<{
    role?: "user" | "model";
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      role?: string;
    };
  }>;
  error?: { message?: string };
};

function getGeminiText(r: GeminiGenerateContentResponse): string {
  const t = r?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  return t || "";
}

type ReflectionBot = "simulation" | "buddha" | "psychologist" | "social" | "feminine";

type ReadSuttaContext = {
  suttaid?: unknown;
  title?: unknown;
  text?: unknown;
};

function normalizeBot(raw: unknown): ReflectionBot {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (
    v === "simulation" ||
    v === "buddha" ||
    v === "psychologist" ||
    v === "social" ||
    v === "feminine"
  ) {
    return v;
  }
  if (v === "buddhabot") return "buddha";
  return "buddha";
}

function normalizeReadSuttaIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(raw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
  ).slice(0, 200);
}

function normalizeReadSuttas(
  raw: unknown,
): Array<{ suttaid: string; title?: string; text: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: ReadSuttaContext) => ({
      suttaid: typeof item?.suttaid === "string" ? item.suttaid.trim() : "",
      title: typeof item?.title === "string" ? item.title.trim() : undefined,
      text: typeof item?.text === "string" ? item.text.trim() : "",
    }))
    .filter((item) => item.suttaid && item.text)
    .slice(0, 8)
    .map((item) => ({ ...item, text: item.text.slice(0, 2_000) }));
}

function readSuttaGroundingPrompt(
  readSuttaIds: string[],
  readSuttas: Array<{ suttaid: string; title?: string; text: string }>,
): string {
  const allowed = readSuttaIds.length ? readSuttaIds.join(", ") : "(none)";
  const excerpts = readSuttas
    .map((s, idx) =>
      [`Excerpt ${idx + 1}`, `Sutta: ${s.suttaid}${s.title ? ` - ${s.title}` : ""}`, s.text].join(
        "\n",
      ),
    )
    .join("\n\n---\n\n");

  return [
    "Read-sutta boundary:",
    `- The user has marked only these suttas as read: ${allowed}.`,
    "- Answer only from the marked-read suttas and excerpts supplied below.",
    "- Do not use outside scripture, general Buddhist knowledge, or unstated claims.",
    "- If the supplied marked-read suttas do not support an answer, say that the marked-read suttas do not contain enough basis yet, then suggest reading/marking more suttas.",
    "- Mention the relevant sutta id(s) you used.",
    "",
    "Marked-read excerpts:",
    excerpts,
  ].join("\n");
}

function systemPromptForBot(
  bot: ReflectionBot,
  readSuttaIds: string[],
  readSuttas: Array<{ suttaid: string; title?: string; text: string }>,
): string {
  const shared = [
    "You are an in-app reflection assistant.",
    "Goal: help the user reduce suffering and increase clarity and kindness.",
    "Rules:",
    "- Do not claim to quote any scripture or book unless exact words are present in the supplied excerpts.",
    "- Be gentle, practical, and concise.",
    "- Never shame the user; encourage non-harm toward self and others.",
    "- End with 1 thoughtful follow-up question.",
    "Output format:",
    "- Short title",
    "- 4–7 bullet insights",
    "- 3-step practice for tonight",
    "- One follow-up question",
  ].join("\n");
  const grounding = readSuttaGroundingPrompt(readSuttaIds, readSuttas);

  switch (bot) {
    case "buddha":
      return [
        "Persona: Buddha Bot.",
        "Grounding: the user's marked-read suttas only.",
        "Avoid modern jargon and dogma. Invite introspection without adding unsupported doctrine.",
        grounding,
        shared,
      ].join("\n\n");
    case "psychologist":
      return [
        "Persona: Psychologist Bot.",
        "Style: warm, evidence-informed, practical.",
        "Constraints:",
        "- Do not diagnose or claim to be a licensed professional.",
        "- If the user seems at risk of self-harm, urge them to seek immediate local help.",
        "Focus on emotions, thoughts, behaviors, and values only where the supplied marked-read suttas support the reflection.",
        grounding,
        shared,
      ].join("\n\n");
    case "social":
      return [
        "Persona: Social Cohesion Bot.",
        "Focus: empathy, repairing trust, good speech, and actions that reduce conflict, only within the supplied marked-read suttas.",
        "Avoid politics.",
        grounding,
        shared,
      ].join("\n\n");
    case "simulation":
      return [
        "Persona: Simulation Theory Bot.",
        "Style: curious and imaginative, but grounded.",
        "Constraints:",
        "- Treat 'simulation' as a metaphor/hypothesis, not a proven fact.",
        "- Always bring the user back to what is supported by the supplied marked-read suttas.",
        grounding,
        shared,
      ].join("\n\n");
    case "feminine":
      return [
        "Persona: Feminine Bot.",
        "Style: tender, nurturing, steady.",
        "Constraints:",
        "- Avoid stereotypes, flirting, or sexual content.",
        "- Offer compassion and boundaries only from the supplied marked-read sutta basis.",
        grounding,
        shared,
      ].join("\n\n");
  }
}

async function callGemini(
  reflection: string,
  system: string,
): Promise<{ answer: string; model: string; provider: "gemini" }> {
  const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("Gemini is not configured. Set GEMINI_API_KEY in .env.local.");
  }

  const model = (process.env.GEMINI_REFLECTION_MODEL ?? "").trim() || "gemini-2.5-flash";

  const body: GeminiGenerateContentRequest = {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: reflection.trim() }] }],
    generationConfig: { maxOutputTokens: 700, temperature: 0.8 },
  };

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), 45_000);
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    },
  ).finally(() => clearTimeout(timeout));

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `Gemini request failed (${resp.status})`);
  }

  const json = (await resp.json()) as GeminiGenerateContentResponse;
  const answer = getGeminiText(json);
  if (!answer) {
    const err = (json as any)?.error?.message;
    throw new Error(err || "Gemini returned an empty response.");
  }
  return { answer, model, provider: "gemini" };
}

async function callOpenAI(
  reflection: string,
  system: string,
): Promise<{ answer: string; model: string; provider: "openai" }> {
  const apiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("OpenAI is not configured. Set OPENAI_API_KEY in .env.local.");
  }

  const model = (process.env.OPENAI_REFLECTION_MODEL ?? "").trim() || "gpt-4o-mini";

  const body: OpenAIResponsesCreate = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: reflection.trim() }] },
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
  return { answer, model, provider: "openai" };
}

export function openaiReflectionDevMiddleware(): Plugin {
  return {
    name: "openai-reflection-dev-middleware",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method !== "POST") return next();
          const url = req.url?.split("?")[0] ?? "";
          const isOpenAi = url === "/__openai/reflection";
          const isGemini = url === "/__gemini/reflection";
          const isAuto = url === "/__llm/reflection";
          if (!isOpenAi && !isGemini && !isAuto) return next();

          const json = (await readJsonBody(req)) as {
            reflection?: unknown;
            readSuttaIds?: unknown;
            readSuttas?: unknown;
          };
          const reflection = typeof json.reflection === "string" ? json.reflection.trim() : "";
          const bot = normalizeBot((json as any)?.bot);
          const readSuttaIds = normalizeReadSuttaIds(json.readSuttaIds);
          const readSuttas = normalizeReadSuttas(json.readSuttas);
          if (!reflection) return sendJson(res, 400, { error: "Missing reflection." });
          if (reflection.length > 10_000)
            return sendJson(res, 400, { error: "Reflection too long." });
          if (readSuttaIds.length === 0 || readSuttas.length === 0) {
            return sendJson(res, 400, {
              error: "Mark at least one sutta as read before asking the bot.",
            });
          }
          const system = systemPromptForBot(bot, readSuttaIds, readSuttas);

          if (isOpenAi) {
            const out = await callOpenAI(reflection, system);
            return sendJson(res, 200, out);
          }

          if (isGemini) {
            const out = await callGemini(reflection, system);
            return sendJson(res, 200, out);
          }

          // Auto: prefer OpenAI if configured, else Gemini.
          try {
            if ((process.env.OPENAI_API_KEY ?? "").trim()) {
              const out = await callOpenAI(reflection, system);
              return sendJson(res, 200, out);
            }
          } catch (e) {
            // fall through to Gemini
            void e;
          }

          const out = await callGemini(reflection, system);
          return sendJson(res, 200, out);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return sendJson(res, 500, { error: msg || "Unknown error." });
        }
      });
    },
  };
}
