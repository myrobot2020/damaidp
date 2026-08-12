import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RelevantSuttaStrip } from "@/components/RelevantSuttaStrip";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { SuttaMCQ } from "@/data/an148Quiz";
import { getSuttaMCQ } from "@/data/suttaQuizzes";
import { getCorpusAudSrc, getItem } from "@/lib/damaApi";
import {
  answerLeaf,
  ensureLeaf,
  hydrateLeaf,
  readLeaves,
  reviewLeafToGold,
  subscribeLeaves,
  upsertHydratedLeaf,
  type LeavesStore,
  INITIAL_LEAVES_SNAPSHOT,
} from "@/lib/leaves";

function normalizeParam(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return String(raw);
  }
}

export const Route = createFileRoute("/quiz/$suttaId")({
  component: QuizScreen,
  head: () => ({
    meta: [{ title: "Quiz — DAMA" }, { name: "description", content: "Reflection MCQ." }],
  }),
});

function QuizScreen() {
  const { suttaId } = Route.useParams();
  const id = useMemo(() => normalizeParam(suttaId), [suttaId]);

  const leaves = useSyncExternalStore(subscribeLeaves, readLeaves, () => INITIAL_LEAVES_SNAPSHOT);
  const leaf = useMemo(() => {
    if (!id) return null;
    const base = leaves[id] ?? null;
    return base ? hydrateLeaf(base) : null;
  }, [id, leaves]);

  useEffect(() => {
    if (!id) return;
    ensureLeaf(id);
    upsertHydratedLeaf(id);
  }, [id]);

  const staticMCQ = useMemo(() => {
    return getSuttaMCQ(id);
  }, [id]);
  const [corpusMCQ, setCorpusMCQ] = useState<SuttaMCQ | null>(null);
  const [corpusMCQLoad, setCorpusMCQLoad] = useState<"idle" | "loading" | "done">("idle");
  const mcq = corpusMCQ ?? staticMCQ;

  const [picked, setPicked] = useState<string>("");
  const [submittedOptionId, setSubmittedOptionId] = useState<string>("");
  const [itemAudio, setItemAudio] = useState<{ src: string; start: number; end: number } | null>(
    null,
  );

  const hasTeacherClip = Boolean(mcq?.teacherClip);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setCorpusMCQLoad("loading");
    setCorpusMCQ(null);
    (async () => {
      try {
        const item = await getItem(id);
        if (!cancelled) {
          setCorpusMCQ(item.mcq ?? null);
          setCorpusMCQLoad("done");
        }
      } catch {
        if (!cancelled) {
          setCorpusMCQ(null);
          setCorpusMCQLoad("done");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadAudio = async () => {
    if (!hasTeacherClip || itemAudio || !id) return;
    try {
      const it = await getItem(id);
      const src = it.aud_file ? getCorpusAudSrc(it.aud_file) : "";
      const start = typeof it.aud_start_s === "number" ? it.aud_start_s : 0;
      const end = typeof it.aud_end_s === "number" ? it.aud_end_s : 0;
      if (src && end > start) setItemAudio({ src, start, end });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!hasTeacherClip) return;
    void loadAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTeacherClip, id]);

  useEffect(() => {
    setPicked("");
    setSubmittedOptionId("");
    setItemAudio(null);
  }, [id]);

  if (!id.trim()) {
    return (
      <div className="min-h-screen dama-screen">
        <ScreenHeader title="Quiz" />
        <div className="px-5 pt-6">
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-muted-foreground">Missing sutta id</div>
          </div>
        </div>
      </div>
    );
  }

  if (!leaf) {
    return (
      <div className="min-h-screen dama-screen">
        <ScreenHeader title="Quiz" />
        <div className="px-5 pt-6">
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-muted-foreground">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!mcq && corpusMCQLoad === "loading") {
    return (
      <div className="min-h-screen dama-screen">
        <ScreenHeader title="Quiz" />
        <div className="px-5 pt-6">
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-muted-foreground">Loading MCQ…</div>
          </div>
        </div>
      </div>
    );
  }

  if (!mcq) {
    return (
      <div className="min-h-screen dama-screen">
        <ScreenHeader title="Quiz" />
        <div className="px-5 pt-6">
          <div className="glass rounded-2xl p-4">
            <div className="label-mono text-muted-foreground">MCQ not found</div>
            <p className="mt-2 text-sm text-muted-foreground">
              This sutta doesn’t have an MCQ yet.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (!picked) return;
    if (leaf.state === "yellow") {
      reviewLeafToGold(id, picked, mcq.goldOptionId);
    } else {
      answerLeaf(id, picked);
    }
    setSubmittedOptionId(picked);
  };

  const headerTitle =
    leaf.state === "yellow" ? "Review (Yellow Leaf)" : leaf.state === "gold" ? "Gold Leaf" : "Quiz";
  const submittedOption = mcq.options.find((opt) => opt.id === submittedOptionId) ?? null;
  const goldOption = mcq.options.find((opt) => opt.id === mcq.goldOptionId) ?? null;
  const isTeacherAligned = submittedOptionId === mcq.goldOptionId;

  return (
    <div className="min-h-screen dama-screen pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
      <ScreenHeader title={headerTitle} />
      <div className="px-5 pt-6">
        <Link
          to="/sutta/$suttaId"
          params={{ suttaId: id }}
          className="label-mono text-primary inline-flex hover:underline"
        >
          {id}
        </Link>
        <h1 className="mt-2 text-[18px] leading-snug font-semibold tracking-tight">{mcq.quote}</h1>

        {mcq.teacherClip ? (
          <div className="mt-4 glass rounded-2xl p-4">
            <div className="label-mono text-muted-foreground">Teacher</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Listen to the teacher micro-clip, then pick the closest interpretation.
            </p>
            {mcq.teacherClip && itemAudio ? (
              <div className="mt-4 space-y-3">
                <AudioPlayer
                  src={itemAudio.src}
                  label={mcq.teacherClip.label}
                  start={mcq.teacherClip.startS}
                  end={mcq.teacherClip.endS}
                  suttaId={id}
                />
                {mcq.japaneseAudio ? (
                  <div className="glass rounded-2xl p-4">
                    <div className="text-sm font-medium">{mcq.japaneseAudio.label}</div>
                    <audio
                      controls
                      preload="metadata"
                      src={mcq.japaneseAudio.src}
                      className="mt-3 w-full"
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <button
                  type="button"
                  className="rounded-xl glass px-4 py-2 text-sm font-medium"
                  onClick={() => void loadAudio()}
                >
                  Load audio
                </button>
                {mcq.japaneseAudio ? (
                  <div className="glass rounded-2xl p-4">
                    <div className="text-sm font-medium">{mcq.japaneseAudio.label}</div>
                    <audio
                      controls
                      preload="metadata"
                      src={mcq.japaneseAudio.src}
                      className="mt-3 w-full"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {mcq.options.map((opt, idx) => {
            const active = picked === opt.id;
            const submitted = submittedOptionId === opt.id;
            const correct = opt.id === mcq.goldOptionId;
            const feedbackClass =
              submittedOptionId && correct
                ? "bg-emerald-500/14 ring-emerald-400/55 text-emerald-50"
                : submitted && !correct
                  ? "bg-rose-500/10 ring-rose-400/45"
                  : active
                    ? "bg-primary/10 ring-primary/35"
                    : "bg-background/40 ring-white/10 hover:bg-primary/5 hover:ring-primary/20";
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setPicked(opt.id);
                  if (submittedOptionId) setSubmittedOptionId("");
                }}
                className={`w-full text-left rounded-2xl p-4 ring-1 transition-colors ${feedbackClass}`}
              >
                <div className="text-sm font-semibold">
                  {idx + 1}. {opt.title}
                </div>
                <div
                  className={`mt-1 text-sm ${
                    submittedOptionId && correct ? "text-emerald-100/80" : "text-muted-foreground"
                  }`}
                >
                  {opt.body}
                </div>
              </button>
            );
          })}
        </div>

        {submittedOptionId && mcq.teacherSummary ? (
          <div className="mt-5 rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/25">
            <div className="label-mono text-primary">
              {isTeacherAligned ? "Teacher-aligned" : "Teacher answer"}
            </div>
            <div className="mt-2 text-sm font-semibold">
              {isTeacherAligned ? submittedOption?.title : goldOption?.title}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {mcq.teacherSummary}
            </p>
          </div>
        ) : null}

        {!submittedOptionId ? (
          <button
            type="button"
            disabled={!picked}
            onClick={() => void submit()}
            className="mt-5 w-full rounded-2xl bg-primary text-primary-foreground font-medium py-4 flex items-center justify-center disabled:opacity-40"
          >
            {leaf.state === "yellow" ? "Submit (Try for Gold)" : "Submit (Grow Leaf)"}
          </button>
        ) : null}
      </div>

      <div
        className="fixed bottom-0 inset-x-0 z-50 px-3 pt-2 bg-background border-t border-border/60"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <RelevantSuttaStrip suttaId={id} audioEnabled={hasTeacherClip} />
      </div>
    </div>
  );
}
