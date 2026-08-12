export type HarnessIntentKind =
  | "reflection"
  | "read_sutta"
  | "quiz"
  | "profile_sync"
  | "corpus_search"
  | "admin_pipeline"
  | "ingest_transcript"
  | "unknown";

export type HarnessErrorCode =
  | "VALIDATION_ERROR"
  | "GUARDRAIL_VIOLATION"
  | "INTENT_UNKNOWN"
  | "MISSING_TOOL"
  | "TOOL_FAILURE"
  | "TIMEOUT"
  | "INSUFFICIENT_GROUNDING"
  | "UNAUTHORIZED";

export type HarnessFeedback = {
  score: number; // 1 for positive (saved), 0 for neutral, -1 for negative
  method: "implicit" | "explicit";
  detail?: string;
};

export class HarnessError extends Error {
  constructor(
    public code: HarnessErrorCode,
    message: string,
    public detail?: string,
  ) {
    super(message);
    this.name = "HarnessError";
  }
}

export type HarnessToolName =
  | "loadReadSuttas"
  | "retrieveCorpus"
  | "retrieveVectorCorpus"
  | "callReflectionModel"
  | "formatReflection"
  | "syncProgress"
  | "runPipelineCheck"
  | "recordTrace"
  | "identifySuttasInTranscript"
  | "generateSuttaMetadata"
  | "generateSuttaQuiz"
  | "validateIngestedSutta"
  | "verifyConclusion";

export type HarnessInput = {
  channel: "ui" | "api" | "cli" | "scheduled";
  text: string;
  userId?: string;
  readSuttaIds?: string[];
  metadata?: Record<string, unknown>;
  isAdmin?: boolean;
};

export type HarnessIntent = {
  kind: HarnessIntentKind;
  confidence: number;
  entities: {
    suttaIds: string[];
    wantsSync: boolean;
    query?: string;
  };
};

export type HarnessStep = {
  id: string;
  tool: HarnessToolName;
  required: boolean;
  retryLimit: number;
};

export type HarnessTraceEvent = {
  stepId: string;
  status: "started" | "succeeded" | "failed" | "skipped";
  at: string;
  detail?: string;
  durationMs?: number;
};

export type HarnessRunState = {
  runId: string;
  input: HarnessInput;
  intent: HarnessIntent;
  steps: HarnessStep[];
  trace: HarnessTraceEvent[];
  outputs: Record<string, unknown>;
  startTime: number;
  lastCheckpointAt?: string;
  status: "idle" | "running" | "succeeded" | "failed" | "interrupted";
};

/**
 * Point 26: Checkpointing Storage
 */
const CHECKPOINT_KEY_PREFIX = "dama:harness:checkpoint:";

function saveCheckpoint(state: HarnessRunState) {
  try {
    const richState = { ...state, lastCheckpointAt: new Date().toISOString() };
    localStorage.setItem(`${CHECKPOINT_KEY_PREFIX}${state.runId}`, JSON.stringify(richState));
  } catch (e) {
    console.warn("[Harness] Failed to save checkpoint:", e);
  }
}

export function getCheckpoint(runId: string): HarnessRunState | null {
  try {
    const raw = localStorage.getItem(`${CHECKPOINT_KEY_PREFIX}${runId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearCheckpoint(runId: string) {
  localStorage.removeItem(`${CHECKPOINT_KEY_PREFIX}${runId}`);
}

export type HarnessToolContext = {
  input: HarnessInput;
  intent: HarnessIntent;
  state: HarnessRunState;
};

export type HarnessTool = (ctx: HarnessToolContext) => Promise<unknown> | unknown;

export type HarnessRunResult =
  | { ok: true; state: HarnessRunState; output: unknown }
  | { ok: false; state: HarnessRunState; error: HarnessError };

export type HarnessComponentStatus = {
  step: number;
  component: string;
  category: string;
  inferredForDama: string;
  v1Implementation: string;
};

const SUTTA_ID_PATTERN = /\b(?:AN|SN|DN|MN|KN)?\s*\d+(?:\.\d+){1,3}\b/gi;

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function extractSuttaIds(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(SUTTA_ID_PATTERN)) {
    const normalized = match[0].trim().replace(/\s+/g, " ").toUpperCase();
    seen.add(normalized);
  }
  return Array.from(seen);
}

export function validateHarnessInput(input: HarnessInput): string[] {
  const errors: string[] = [];
  if (!input.text || !input.text.trim()) errors.push("Input text is required.");
  if (input.text.length > 10_000) errors.push("Input text must be 10,000 characters or fewer.");
  if (!["ui", "api", "cli", "scheduled"].includes(input.channel)) {
    errors.push("Input channel is not supported.");
  }
  return errors;
}

export function parseHarnessIntent(input: HarnessInput): HarnessIntent {
  const text = normalizeText(input.text).toLowerCase();
  const suttaIds = extractSuttaIds(input.text);
  const wantsSync = /\b(sync|backup|cloud|supabase|save progress)\b/i.test(input.text);

  // 1. Regex-based fast path
  if (/\b(reflect|reflection|mind|goodwill|answer|buddha bot|buddhabot)\b/.test(text)) {
    return { kind: "reflection", confidence: 0.9, entities: { suttaIds, wantsSync, query: text } };
  }
  if (/\b(quiz|question|mcq|leaf|review)\b/.test(text)) {
    return { kind: "quiz", confidence: 0.85, entities: { suttaIds, wantsSync } };
  }
  if (/\b(read|open|show|sutta|nikaya|canon)\b/.test(text) || suttaIds.length > 0) {
    return { kind: "read_sutta", confidence: 0.8, entities: { suttaIds, wantsSync } };
  }
  if (wantsSync) {
    return { kind: "profile_sync", confidence: 0.8, entities: { suttaIds, wantsSync } };
  }
  if (/\b(search|find|retrieve|where|look for)\b/.test(text)) {
    return { kind: "corpus_search", confidence: 0.75, entities: { suttaIds, wantsSync, query: text } };
  }
  if (/\b(pipeline|deploy|tally|validate|gcs|cloud run)\b/.test(text)) {
    return { kind: "admin_pipeline", confidence: 0.8, entities: { suttaIds, wantsSync } };
  }
  if (/\b(ingest|transcript|process video|extract suttas)\b/.test(text)) {
    return { kind: "ingest_transcript", confidence: 0.85, entities: { suttaIds, wantsSync } };
  }

  // 2. Hybrid "Cheap LLM" fallthrough (Placeholder for global scale)
  // In a real global scale app, this would be an async call to gpt-4o-mini
  // For now, we return unknown with low confidence if regex fails.
  return { kind: "unknown", confidence: 0.2, entities: { suttaIds, wantsSync } };
}

const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(?:\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\(\d{3}\)\s?\d{3}[-.\s]?\d{4}|\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|555-0199)/g,
  creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
};

const INJECTION_PATTERNS = [
  /\bignore\s+(?:all\s+)?previous\s+instructions\b/i,
  /\bsystem\s+override\b/i,
  /\byou\s+are\s+now\s+an\s+admin\b/i,
  /\bforget\s+(?:your\s+)?rules\b/i,
];

/**
 * Point 13 Implementation: PII Scrubbing
 * Replaces sensitive data patterns with generic tokens to protect user privacy.
 */
export function scrubPII(text: string): string {
  let scrubbed = text;
  scrubbed = scrubbed.replace(PII_PATTERNS.email, "[REDACTED_EMAIL]");
  scrubbed = scrubbed.replace(PII_PATTERNS.phone, "[REDACTED_PHONE]");
  scrubbed = scrubbed.replace(PII_PATTERNS.creditCard, "[REDACTED_DATA]");
  return scrubbed;
}

export function applyHarnessGuardrails(input: HarnessInput, intent: HarnessIntent): string[] {
  const errors: string[] = [];
  const text = input.text.toLowerCase();

  // 1. Prompt Injection Defense (Hacker Shield)
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      errors.push("Input contains restricted administrative override patterns.");
      break;
    }
  }

  if (intent.kind === "admin_pipeline" && !input.isAdmin) {
    errors.push("Administrative actions are restricted to authorized developers.");
  }

  if (/\b(delete all|drop table|wipe|reset production)\b/.test(text)) {
    if (!input.isAdmin) {
      errors.push("Destructive production actions require explicit human approval.");
    }
  }

  if (/\b(api[_ -]?key|password|secret)\b/.test(text)) {
    errors.push("Secrets must not be placed in prompts or client-visible metadata.");
  }

  // 5. Length/Quality Checks
  if (text.trim().length < 3 && intent.kind === "reflection") {
    errors.push("Input is too short to generate a meaningful reflection.");
  }

  return errors;
}

import { HARNESS_CONFIG } from "./harnessConfig";

export function planHarnessSteps(intent: HarnessIntent): HarnessStep[] {
  switch (intent.kind) {
    case "reflection":
      return [
        { id: "load-read-suttas", tool: "loadReadSuttas", required: true, retryLimit: HARNESS_CONFIG.RETRIES.DATA_LOAD },
        { id: "retrieve-grounding", tool: "retrieveCorpus", required: true, retryLimit: HARNESS_CONFIG.RETRIES.DATA_LOAD },
        { id: "call-model", tool: "callReflectionModel", required: true, retryLimit: HARNESS_CONFIG.RETRIES.CRITICAL_AI_CALL },
        { id: "verify-logic", tool: "verifyConclusion", required: true, retryLimit: 1 },
        { id: "format-output", tool: "formatReflection", required: true, retryLimit: 0 },
        { id: "record-trace", tool: "recordTrace", required: false, retryLimit: HARNESS_CONFIG.RETRIES.OPTIONAL_TRACE },
      ];
    case "profile_sync":
      return [
        { id: "sync-progress", tool: "syncProgress", required: true, retryLimit: HARNESS_CONFIG.RETRIES.DATA_LOAD },
        { id: "record-trace", tool: "recordTrace", required: false, retryLimit: HARNESS_CONFIG.RETRIES.OPTIONAL_TRACE },
      ];
    case "admin_pipeline":
      return [
        { id: "pipeline-check", tool: "runPipelineCheck", required: true, retryLimit: 0 },
        { id: "record-trace", tool: "recordTrace", required: false, retryLimit: HARNESS_CONFIG.RETRIES.OPTIONAL_TRACE },
      ];
    case "ingest_transcript":
      return [
        { id: "identify-suttas", tool: "identifySuttasInTranscript", required: true, retryLimit: HARNESS_CONFIG.RETRIES.DATA_LOAD },
        { id: "generate-metadata", tool: "generateSuttaMetadata", required: true, retryLimit: HARNESS_CONFIG.RETRIES.CRITICAL_AI_CALL },
        { id: "generate-quiz", tool: "generateSuttaQuiz", required: true, retryLimit: HARNESS_CONFIG.RETRIES.CRITICAL_AI_CALL },
        { id: "validate-sutta", tool: "validateIngestedSutta", required: true, retryLimit: 1 },
        { id: "record-trace", tool: "recordTrace", required: false, retryLimit: HARNESS_CONFIG.RETRIES.OPTIONAL_TRACE },
      ];
    case "corpus_search":
      return [
        { id: "vector-search", tool: "retrieveVectorCorpus", required: true, retryLimit: HARNESS_CONFIG.RETRIES.DATA_LOAD },
        { id: "record-trace", tool: "recordTrace", required: false, retryLimit: HARNESS_CONFIG.RETRIES.OPTIONAL_TRACE },
      ];
    case "read_sutta":
    case "quiz":
      return [
        { id: "retrieve-corpus", tool: "retrieveCorpus", required: true, retryLimit: HARNESS_CONFIG.RETRIES.DATA_LOAD },
        { id: "record-trace", tool: "recordTrace", required: false, retryLimit: HARNESS_CONFIG.RETRIES.OPTIONAL_TRACE },
      ];
    case "unknown":
      return [];
  }
}

function trace(stepId: string, status: HarnessTraceEvent["status"], detail?: string, durationMs?: number) {
  return { stepId, status, at: new Date().toISOString(), detail, durationMs };
}

export async function runHarness(
  input: HarnessInput,
  tools: Partial<Record<HarnessToolName, HarnessTool>>,
  resumeRunId?: string
): Promise<HarnessRunResult> {
  let state: HarnessRunState;

  // Point 13: Scrub PII from input text before any processing
  const scrubbedText = scrubPII(input.text);
  const safeInput = { ...input, text: scrubbedText };

  if (resumeRunId) {
    const existing = getCheckpoint(resumeRunId);
    if (existing) {
      state = { ...existing, status: "running" };
    } else {
      return { ok: false, state: {} as any, error: new HarnessError("MISSING_TOOL", "Could not find run to resume.") };
    }
  } else {
    const runId = Math.random().toString(36).substring(2, 15);
    const intent = parseHarnessIntent(safeInput);
    const steps = planHarnessSteps(intent);
    state = {
      runId,
      input: safeInput,
      intent,
      steps,
      trace: [],
      outputs: {},
      startTime: Date.now(),
      status: "running"
    };
  }

  const inputErrors = validateHarnessInput(state.input);
  const guardrailErrors = applyHarnessGuardrails(state.input, state.intent);

  if (inputErrors.length > 0) {
    state.status = "failed";
    return { ok: false, state, error: new HarnessError("VALIDATION_ERROR", inputErrors.join(" ")) };
  }
  if (guardrailErrors.length > 0) {
    state.status = "failed";
    return { ok: false, state, error: new HarnessError("GUARDRAIL_VIOLATION", guardrailErrors.join(" ")) };
  }

  let lastOutput: unknown = null;
  for (const step of state.steps) {
    // Skip steps already completed in a resumed run
    if (state.outputs[step.id] !== undefined) {
      lastOutput = state.outputs[step.id];
      continue;
    }

    const tool = tools[step.tool];
    if (!tool) {
      const msg = `Missing tool: ${step.tool}.`;
      state.trace.push(trace(step.id, step.required ? "failed" : "skipped", msg));
      if (step.required) {
        state.status = "failed";
        return { ok: false, state, error: new HarnessError("MISSING_TOOL", msg) };
      }
      continue;
    }

    let attempt = 0;
    while (attempt <= step.retryLimit) {
      if (attempt > 0) {
        // Exponential backoff: 500ms, 1000ms, etc.
        const delay = HARNESS_CONFIG.RETRIES.MIN_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const stepStart = Date.now();
      state.trace.push(trace(step.id, "started", `attempt ${attempt + 1}`));
      try {
        lastOutput = await tool({ input: state.input, intent: state.intent, state });
        state.outputs[step.id] = lastOutput;
        const duration = Date.now() - stepStart;
        state.trace.push(trace(step.id, "succeeded", undefined, duration));

        // Point 26: Save rich checkpoint after every successful step
        saveCheckpoint(state);
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = (e as any).code || "TOOL_FAILURE";
        const duration = Date.now() - stepStart;
        state.trace.push(trace(step.id, "failed", msg, duration));

        if (attempt >= step.retryLimit) {
          if (step.required) {
            state.status = "failed";
            saveCheckpoint(state);
            return { ok: false, state, error: new HarnessError(code, msg) };
          }
          break; // move to next step if not required
        }
        attempt += 1;
      }
    }
  }

  state.status = "succeeded";
  saveCheckpoint(state);
  return { ok: true, state, output: lastOutput };
}

export function buildDamaHarnessBlueprint(): HarnessComponentStatus[] {
  const rows: Array<[string, string, string, string]> = [
    ["Input / Command Layer", "Input", "Reflection UI, sutta pages, quiz flow, profile sync, CLI pipeline commands", "HarnessInput with ui/api/cli/scheduled channels"],
    ["Output Layer", "Input", "Mobile-friendly reflection answer, quiz state, sync status, JSON for APIs", "formatReflection tool slot"],
    ["Intent Parser", "Input", "Detect reflection, reading, quiz, sync, corpus search, pipeline tasks", "parseHarnessIntent"],
    ["Tool Layer", "Execution", "Corpus loader, read-context loader, LLM call, Supabase sync, pipeline checks", "Typed HarnessTool registry"],
    ["Tool Router", "Execution", "Map intent steps to local tools", "planHarnessSteps"],
    ["Execution Engine", "Execution", "Run steps with retries and timeouts at tool boundary", "runHarness retry loop"],
    ["Error Handler", "Execution", "Return user-safe failure messages", "HarnessRunResult errors"],
    ["State Manager (Short-term)", "Memory", "Carry current input, intent, steps, trace, step outputs", "HarnessRunState"],
    ["Logging & Tracing", "Memory", "Audit each step and attempt", "HarnessTraceEvent"],
    ["Planner (rule-based)", "Planning", "Deterministic v1 plan for each intent", "planHarnessSteps"],
    ["Orchestrator (Control Loop)", "Planning", "Connect parser, guardrails, planner, tools", "runHarness"],
    ["Validation Layer", "Safety", "Required input, length limits, channel limits", "validateHarnessInput"],
    ["Guardrails", "Safety", "No secrets in prompts, no unapproved destructive actions, require grounding", "applyHarnessGuardrails"],
    ["Prompt Builder / Context Assembler", "Model", "Use marked-read suttas and corpus excerpts", "Existing reflection middleware prompt builder"],
    ["Model Layer (LLM)", "Model", "OpenAI/Gemini reflection provider", "Existing /__llm/reflection path"],
    ["Output Parser", "Model", "Normalize provider output text", "Existing getOutputText/getGeminiText"],
    ["Feedback / Evaluation Loop", "Control", "Retry model/tool calls and later score answer quality", "Retry loop now; eval hooks next"],
    ["Knowledge Base", "Data", "data/validated-json plus GCS corpus", "Existing corpus pipeline"],
    ["Ingestion / Indexing Pipeline", "Data", "scripts2 pipeline validation, sync, index generation", "Existing npm pipe2 commands"],
    ["Retrieval Layer", "Data", "Read-sutta context selector and corpus APIs", "Existing readSuttaContext + retrieveCorpus tool slot"],
    ["Vector Memory", "Data", "Semantic search over corpus", "Not implemented; candidate pgvector/Supabase"],
    ["Structured Memory", "Data", "Profiles, reading/audio progress, leaves, UX logs", "Existing localStorage + Supabase schema"],
    ["Long-term Memory", "Data", "User history and progress continuity", "Existing Supabase sync hooks"],
    ["Agent Communication Protocol", "Agents", "Single-agent v1; message envelope later", "HarnessInput/HarnessRunResult envelope"],
    ["Planner (LLM / hybrid)", "Agents", "Advanced planning after deterministic core is stable", "Deferred"],
    ["Checkpointing Layer", "Agents", "Save/resume long workflows", "Trace/state shape ready"],
    ["Confidence / Calibration Layer", "Agents", "Intent confidence and future groundedness scores", "Intent confidence now"],
    ["Simulation / Testing Layer", "Agents", "Vitest/Playwright plus harness scenario tests", "Unit tests for pure harness"],
    ["Human-in-the-loop Interface", "Agents", "Approval for destructive/admin/cloud actions", "Guardrail errors now; UI later"],
    ["Monitoring & Metrics", "Ops", "Latency, success, cost, provider", "Trace shape now; production metrics later"],
    ["Configuration Layer", "Ops", "Env model/provider, corpus bases, Supabase, GCS", "Existing env variables"],
    ["Security Layer", "Ops", "Server-only API keys, Supabase RLS, no prompt secrets", "Existing server-side key pattern + guardrails"],
    ["Versioning Layer", "Ops", "Prompts, model, dataset, pipeline index", "Docs and env today; formal registry later"],
    ["Distributed Orchestration Layer", "Scale", "Queues for indexing/evals/deploy jobs", "Deferred"],
    ["Cloud Infrastructure Layer", "Scale", "Cloud Run, Cloud Build, GCS, Supabase", "Existing deploy configs"],
    ["CI/CD + Release Layer", "Scale", "npm test/e2e/build and Cloud Build trigger", "Existing scripts"],
    ["Model Adaptation Pipeline", "Scale", "Fine-tuning/evals after enough traces", "Deferred"],
  ];

  return rows.map(([component, category, inferredForDama, v1Implementation], idx) => ({
    step: idx + 1,
    component,
    category,
    inferredForDama,
    v1Implementation,
  }));
}
