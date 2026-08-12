import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CanonQuote } from "@/components/CanonQuote";
import { sutta } from "@/data/an1116.ts";
import { REFLECTION_QUERY_STORAGE_KEY } from "@/lib/damaApi";
import { Bookmark, Check, ChevronDown, ChevronUp, Cpu, History } from "lucide-react";
import { type HarnessTraceEvent } from "@/lib/aiHarness";
import { recordHarnessFeedback } from "@/lib/harnessTools";
import { isDevMode } from "@/lib/devMode";

type StoredQuery =
  | {
      ok: true;
      answer: string;
      used_llm: boolean;
      chunks: { suttaid?: string; text: string }[];
      mode?: "dama5" | "buddhabot" | "simulation" | "buddha" | "psychologist" | "social" | "feminine";
      harnessState?: {
        runId: string;
        intent: any;
        trace: HarnessTraceEvent[];
        durationMs: number;
      };
    }
  | { ok: false; error: string };

function readStoredQuery(): StoredQuery | null {
  try {
    const raw = localStorage.getItem(REFLECTION_QUERY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredQuery;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/reflect/answer")({
  component: AnswerScreen,
});

const OFFLINE_EXPLANATION = `What you describe is a state of mind, and the Buddha taught that mind-states
arise from what we cultivate. The radiation of loving-kindness, when made to
grow, brings well-being even in sleep, calm in waking, and clarity in
difficulty. The feeling you sense is the natural fruit of practice, not
an accident.`;

function AnswerScreen() {
  const [question, setQuestion] = useState("");
  const [saved, setSaved] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [fromApi, setFromApi] = useState(false);
  const [showTrace, setShowTrace] = useState(false);
  const isDev = isDevMode();
  const [harnessState, setHarnessState] = useState<any>(null);
  const [mode, setMode] = useState<
    "dama5" | "buddhabot" | "simulation" | "buddha" | "psychologist" | "social" | "feminine" | "offline"
  >("offline");

  const modeLabel = (m: typeof mode) => {
    if (m === "dama5") return "dama5";
    if (m === "buddhabot" || m === "buddha") return "Buddha Bot";
    if (m === "psychologist") return "Psychologist Bot";
    if (m === "social") return "Social Cohesion Bot";
    if (m === "simulation") return "Simulation Theory Bot";
    if (m === "feminine") return "Feminine Bot";
    return "offline";
  };

  useEffect(() => {
    setQuestion(localStorage.getItem("dama:reflection") || "");
    const q = readStoredQuery();
    if (q && q.ok && q.answer.trim()) {
      setExplanation(q.answer.trim());
      setFromApi(true);
      setMode((q.mode as any) || "dama5");
      if (q.harnessState) setHarnessState(q.harnessState);
    } else {
      setExplanation(OFFLINE_EXPLANATION.replace(/\s+/g, " ").trim());
      setFromApi(false);
      setMode("offline");
    }
  }, []);

  const save = () => {
    const entry = {
      question,
      answer: explanation,
      source: sutta.id,
      savedAt: new Date().toISOString(),
      fromApi,
    };
    const prev = JSON.parse(localStorage.getItem("dama:journal") || "[]");
    localStorage.setItem("dama:journal", JSON.stringify([entry, ...prev]));
    setSaved(true);

    // Point 17: Implicit RLHF Signal
    if (harnessState?.runId) {
      void recordHarnessFeedback(harnessState.runId, {
        score: 1,
        method: "implicit",
        detail: "User saved reflection to journal"
      });
    }
  };

  return (
    <div className="min-h-screen dama-screen pb-12">
      <ScreenHeader title="Reflect" showBookmark />
      <div className="px-7 pt-24">
        <div className="label-mono text-foreground/70">Response</div>

        {question && (
          <div className="mt-4 border-y paper-rule py-4">
            <div className="label-mono text-muted-foreground">Your question</div>
            <p className="mt-2 text-reading text-lg leading-relaxed text-muted-foreground">"{question}"</p>
          </div>
        )}

        <section className="mt-6">
          <div className="label-mono text-muted-foreground mb-2">
            Explanation ({modeLabel(mode)})
          </div>
          <p className="text-reading text-xl leading-relaxed text-foreground whitespace-pre-wrap">
            {explanation}
          </p>
        </section>

        {harnessState && isDev && (
          <section className="mt-6">
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="w-full flex items-center justify-between border-y paper-rule py-4 hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-primary" />
                <span className="text-xs font-semibold label-mono uppercase tracking-wider">
                  Harness Trace (Point 30)
                </span>
              </div>
              {showTrace ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTrace && (
              <div className="mt-2 border-y paper-rule bg-primary/5 p-4 overflow-hidden">
                <div className="flex items-center justify-between mb-4 border-b paper-rule pb-2">
                  <div className="text-[10px] label-mono text-muted-foreground">
                    RUN_ID: <span className="text-primary">{harnessState.runId}</span>
                  </div>
                  <div className="text-[10px] label-mono text-muted-foreground">
                    TOTAL: <span className="text-primary">{harnessState.durationMs}ms</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {harnessState.trace.map((event: any, i: number) => (
                    <div key={i} className="relative pl-4 border-l-2 paper-rule">
                      <div className="absolute -left-[5px] top-1 size-2 rounded-full bg-primary shadow-[0_0_8px_var(--glow)]" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold label-mono text-foreground/90">
                          {event.stepId}
                        </span>
                        <span
                          className={`text-[9px] label-mono px-1.5 py-0.5 rounded ${
                            event.status === "succeeded"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {event.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/70">
                          {new Date(event.at).toLocaleTimeString()}
                        </span>
                        {event.durationMs && (
                          <span className="text-[10px] text-primary/60">{event.durationMs}ms</span>
                        )}
                      </div>
                      {event.detail && (
                        <p className="mt-1 text-[10px] text-muted-foreground italic leading-relaxed">
                          {event.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-2 border-t paper-rule flex items-center gap-2">
                  <History size={12} className="text-muted-foreground" />
                  <span className="text-[10px] label-mono text-muted-foreground">
                    Intent: {harnessState.intent.kind} ({(harnessState.intent.confidence * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-6">
          <CanonQuote text={sutta.canon} source={sutta.id} />
        </section>

        <button
          onClick={save}
          className={`mt-6 w-full rounded-full border py-4 font-medium flex items-center justify-center gap-2 ${
            saved ? "paper-rule text-primary" : "border-foreground bg-transparent text-foreground"
          }`}
        >
          {saved ? (
            <>
              <Check size={16} /> Saved to Journal
            </>
          ) : (
            <>
              <Bookmark size={16} /> Save to Journal
            </>
          )}
        </button>
      </div>
    </div>
  );
}
