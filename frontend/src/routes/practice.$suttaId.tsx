import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";

import { NextSuttaStrip } from "@/components/NextSuttaStrip";
import { ScreenHeader } from "@/components/ScreenHeader";
import { getBookOnePractice, getFallbackPractice, type SuttaPractice } from "@/data/bookOnePractices";
import { getItem, itemDisplayHeading, stripTranscriptNoise, type ItemDetail } from "@/lib/damaApi";

function normalizeParam(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return String(raw);
  }
}

export const Route = createFileRoute("/practice/$suttaId")({
  component: PracticeScreen,
  head: () => ({
    meta: [{ title: "Practice — DAMA" }, { name: "description", content: "Vow, MCQ, and technique." }],
  }),
});

function makeFallbackQuote(item: ItemDetail | null, id: string): string {
  if (!item) return id;
  return stripTranscriptNoise(item.sutta).replace(/\s+/g, " ").slice(0, 180);
}

type PracticeMode = "vow" | "mcq" | "technique";

function practiceModeForSutta(suttaId: string): PracticeMode {
  const lastNumber = suttaId
    .replace(/^AN\s+/i, "")
    .split(".")
    .map((part) => parseInt(part, 10))
    .filter(Number.isFinite)
    .at(-1);
  return (["vow", "mcq", "technique"] as const)[(lastNumber ?? suttaId.length) % 3];
}

function PracticeScreen() {
  const { suttaId } = Route.useParams();
  const id = useMemo(() => normalizeParam(suttaId), [suttaId]);
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [picked, setPicked] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id.trim()) return;
    let cancelled = false;
    setItem(null);
    void getItem(id)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    setPicked("");
    setSubmitted(false);
  }, [id]);

  const practice: SuttaPractice = useMemo(() => {
    return getBookOnePractice(id) ?? getFallbackPractice(id, makeFallbackQuote(item, id));
  }, [id, item]);
  const mode = useMemo(() => practiceModeForSutta(id), [id]);
  const goldOption = practice.mcq.options.find((option) => option.id === practice.mcq.goldOptionId);
  const isCorrect = submitted && picked === practice.mcq.goldOptionId;

  return (
    <div className="min-h-screen dama-screen pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <ScreenHeader title="Practice" />
      <main className="px-7 pt-6">
        <Link
          to="/sutta/$suttaId"
          params={{ suttaId: id }}
          className="label-mono text-primary inline-flex hover:underline"
        >
          {id}
        </Link>
        <h1 className="mt-2 text-reading text-[2.1rem] leading-tight">
          {item ? itemDisplayHeading(item) : "Practice"}
        </h1>

        {mode === "vow" ? (
          <section className="mt-6 border-y paper-rule py-6">
            <div className="label-mono text-muted-foreground">Vow</div>
            <p className="mt-4 text-reading text-2xl leading-relaxed">{practice.vow}</p>
          </section>
        ) : null}

        {mode === "mcq" ? (
        <section className="mt-7">
          <div className="label-mono text-muted-foreground">MCQ</div>
          <p className="mt-3 text-reading text-lg leading-relaxed text-foreground/85">
            "{practice.mcq.quote}"
          </p>
          <div className="mt-4 space-y-3">
            {practice.mcq.options.map((option, index) => {
              const active = picked === option.id;
              const correct = option.id === practice.mcq.goldOptionId;
              const showCorrect = submitted && correct;
              const showWrong = submitted && active && !correct;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setPicked(option.id);
                    setSubmitted(false);
                  }}
                  className={`w-full rounded-[1.25rem] border p-4 text-left transition-colors ${
                    showCorrect
                      ? "border-accent text-accent"
                      : showWrong
                        ? "border-destructive text-destructive"
                        : active
                          ? "border-foreground"
                          : "paper-rule"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-primary">
                      {showCorrect ? <Check size={17} /> : <Circle size={15} />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {index + 1}. {option.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                        {option.body}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!picked}
            onClick={() => setSubmitted(true)}
            className="mt-4 w-full rounded-full border border-foreground bg-transparent py-4 font-semibold text-foreground disabled:opacity-40"
          >
            Check
          </button>
          {submitted ? (
            <div className="mt-4 border-y paper-rule py-4">
              <div className="label-mono text-primary">
                {isCorrect ? "Aligned" : "Teacher answer"}
              </div>
              <p className="mt-2 text-sm font-semibold">{goldOption?.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {practice.mcq.teacherSummary}
              </p>
            </div>
          ) : null}
        </section>
        ) : null}

        {mode === "technique" ? (
        <section className="mt-8 border-y paper-rule py-6">
          <div className="label-mono text-muted-foreground">Technique</div>
          <h2 className="mt-3 text-reading text-2xl">{practice.technique.title}</h2>
          <ol className="mt-4 space-y-3">
            {practice.technique.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                <span className="label-mono text-primary">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
        ) : null}
      </main>
      <div
        className="fixed bottom-0 inset-x-0 z-50 px-7 pt-2 bg-background border-t paper-rule"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <NextSuttaStrip currentSuttaId={id} />
      </div>
    </div>
  );
}
