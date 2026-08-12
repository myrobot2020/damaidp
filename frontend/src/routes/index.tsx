import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Shuffle, Sparkles, Trees, User } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ScreenHeader } from "@/components/ScreenHeader";
import { readReadingProgress, getLastOpenedSuttaId, subscribeReadingProgress, INITIAL_READING_PROGRESS_SNAPSHOT } from "@/lib/readingProgress";
import { DEFAULT_SUTTA_ID, getItems, getRandomSutta, type ItemSummary } from "@/lib/damaApi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "DAMA" }, { name: "description", content: "DAMA" }],
  }),
  component: HomeScreen,
});

const NIKAYAS = [
  { id: "AN", label: "AN Nikāya", title: "Aṅguttara" },
  { id: "SN", label: "SN Nikāya", title: "Saṁyutta" },
  { id: "DN", label: "DN Nikāya", title: "Dīgha" },
  { id: "MN", label: "MN Nikāya", title: "Majjhima" },
  { id: "KN", label: "KN Nikāya", title: "Khuddaka" },
] as const;

function HomeScreen() {
  const navigate = useNavigate();
  const progress = useSyncExternalStore(subscribeReadingProgress, readReadingProgress, () => INITIAL_READING_PROGRESS_SNAPSHOT);
  const [items, setItems] = useState<ItemSummary[]>([]);

  useEffect(() => {
    getItems({ book: "all" }).then(res => setItems(res.items)).catch(() => {});
  }, []);

  const activeNikayas = useMemo(() => new Set(items.map(it => it.nikaya)), [items]);

  const getResumeId = (prefix: string) => {
    const upPrefix = prefix.toUpperCase();
    const validInIndex = new Set(items.map(it => it.suttaid));

    // 1. Check history in progress, but ONLY if it's in the actual index
    const lastForNik = Object.keys(progress)
      .filter(sid => sid.toUpperCase().startsWith(upPrefix) && validInIndex.has(sid))
      .sort((a, b) => (progress[b].openedAtMs || 0) - (progress[a].openedAtMs || 0))[0];

    if (lastForNik) return lastForNik;

    // 2. Fallback to first available in loaded index
    const firstInIndex = items.find(it => it.nikaya === upPrefix)?.suttaid;
    if (firstInIndex) return firstInIndex;

    // 3. Absolute fallbacks (validated against index if possible)
    if (upPrefix === "AN") return validInIndex.has(DEFAULT_SUTTA_ID) ? DEFAULT_SUTTA_ID : (items.find(it => it.nikaya === "AN")?.suttaid || DEFAULT_SUTTA_ID);
    if (upPrefix === "MN") return validInIndex.has("MN 1") ? "MN 1" : (items.find(it => it.nikaya === "MN")?.suttaid || "MN 1");

    return `${upPrefix} 1.1`;
  };

  const navToNikaya = (prefix: string) => {
    if (!activeNikayas.has(prefix as any)) return;
    navigate({ to: "/sutta/$suttaId", params: { suttaId: getResumeId(prefix) } });
  };

  return (
    <div className="min-h-screen dama-screen flex flex-col">
      <ScreenHeader title="DAMA" showBack={false} showHome={false} />
      <main className="flex-1 px-8 pt-0 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
        {/* HERO SECTION - Fixed broken image logic */}
        <div className="-mx-8 h-[16rem] overflow-hidden border-b paper-rule bg-background relative shadow-inner">
          <img
            src="/panels/buddha-mountain.png"
            alt="DAMA Hero"
            className="h-full w-full object-cover object-center ink-panel opacity-95"
            onError={(e) => {
                // Fallback to a gradient if image is truly missing
                (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/10 to-background" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {/* COLLECTION CARDS (AN and MN highlighted in user screenshot) */}
          {NIKAYAS.map((nik) => {
            const isActive = activeNikayas.has(nik.id as any);
            return (
              <button
                key={nik.id}
                onClick={() => navToNikaya(nik.id)}
                disabled={!isActive}
                className={`min-h-[9rem] rounded-[1.6rem] border-2 p-5 transition-all flex flex-col justify-between text-left group active:scale-[0.97] ${
                  isActive
                    ? "bg-background/60 border-primary/5 shadow-sm hover:border-primary/40 hover:bg-card/90"
                    : "bg-muted/10 border-transparent opacity-30 grayscale cursor-not-allowed"
                }`}
              >
                <div className={`${isActive ? "text-primary/90" : "text-muted-foreground/50"}`}>
                  <BookOpen size={24} strokeWidth={isActive ? 1.5 : 1} />
                </div>
                <div>
                  <div className={`text-reading text-[1.4rem] leading-tight ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{nik.label}</div>
                  <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] opacity-60">
                    {isActive ? "Suttas Available" : "Empty"}
                  </div>
                </div>
              </button>
            );
          })}

          {/* TOOL CARDS (Shuffle and Tree in user screenshot) */}
          {[
            { id: "shuffle", label: "Shuffle", detail: "Random", icon: Shuffle, onClick: async () => {
              const s = await getRandomSutta();
              if (s) navigate({ to: "/sutta/$suttaId", params: { suttaId: s.suttaid } });
            }},
            { id: "tree", label: "Tree", detail: "Knowledge", icon: Trees, onClick: () => navigate({ to: "/tree" }) },
            { id: "reflect", label: "Reflect", detail: "Chatbot", icon: Sparkles, onClick: () => navigate({ to: "/reflect" }) },
            { id: "profile", label: "Profile", detail: "Settings", icon: User, onClick: () => navigate({ to: "/profile" }) },
          ].map(({ id, label, detail, icon: Icon, onClick }) => (
            <button
              key={id}
              onClick={onClick}
              className="min-h-[9rem] rounded-[1.6rem] border-2 border-primary/5 bg-background/60 p-5 transition-all shadow-sm hover:border-primary/40 hover:bg-card/90 active:scale-[0.97] flex flex-col justify-between text-left"
            >
              <div className="text-primary/80">
                <Icon size={24} strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-reading text-[1.4rem] leading-tight text-foreground">{label}</div>
                <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] opacity-60">{detail}</div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
