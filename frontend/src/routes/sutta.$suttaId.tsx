import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useSyncExternalStore, memo } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { CorpusHeaderNav } from "@/components/CorpusHeaderNav";
import { NextSuttaStrip } from "@/components/NextSuttaStrip";
import { CanonQuote } from "@/components/CanonQuote";
import { AudioPlayer } from "@/components/AudioPlayer";
import { an148Quiz } from "@/data/an148Quiz";
import mettaInfographic from "@/assets/an1116-metta-infographic.png";
import {
  clearSuttaRead,
  markSuttaRead,
  readReadingProgress,
  recordSuttaOpened,
  subscribeReadingProgress,
  INITIAL_READING_PROGRESS_SNAPSHOT,
} from "@/lib/readingProgress";
import { trackUxEvent } from "@/lib/uxLog";
import { readSettings, subscribeSettings } from "@/lib/settings";
import {
  Bookmark,
  Check,
  Circle,
  Hexagon,
  Languages,
  Shuffle,
  LayoutGrid,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

import {
  anBookFromSuttaId,
  canonIndexSubtitle,
  getCorpusAudSrc,
  getItem,
  getRandomSutta,
  isAn1116Sutta,
  itemDisplayHeading,
  ItemDetail,
} from "@/lib/damaApi";
import { transformKnowledgeGraph, type GraphNode } from "@/lib/knowledgeGraph";
import { getPracticeForItem, getPracticeMode } from "@/lib/practice";

/**
 * Reusable Section UI with Stable Empty State
 */
function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
  isEmpty = false,
  openLabel = "Open +",
  closeLabel = "Close —",
  className = "",
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isEmpty?: boolean;
  openLabel?: string;
  closeLabel?: string;
  className?: string;
}) {
  return (
    <section className={className}>
      <button
        onClick={onToggle}
        disabled={isEmpty}
        className={`flex items-center justify-between w-full rounded-2xl border paper-rule px-5 py-4 transition-all active:scale-[0.99] group ${
          isEmpty ? "opacity-30 bg-muted/5 cursor-not-allowed" : "bg-background/40"
        }`}
      >
        <div className="label-mono text-foreground font-bold uppercase tracking-widest text-[11px]">
          {title}
        </div>
        <div className={`text-primary text-xs font-mono uppercase tracking-tighter ${!isEmpty && "group-hover:underline"}`}>
          {isEmpty ? "Empty" : isOpen ? closeLabel : openLabel}
        </div>
      </button>
      {!isEmpty && isOpen && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * Knowledge Tree Node UI
 */
function TreeNode({ node, isRoot = false }: { node: GraphNode; isRoot?: boolean }) {
  return (
    <div className="relative ml-4">
      {!isRoot && <div className="absolute -left-4 top-4 w-4 border-t border-primary/30" />}
      <div className="flex items-start gap-2 py-2">
        <div className={`px-4 py-2 rounded-xl border paper-rule bg-background/60 shadow-sm ${isRoot ? 'ring-2 ring-primary/20 font-bold text-primary' : 'text-foreground/90'}`}>
          {node.label}
        </div>
      </div>
      {node.children && (
        <div className="ml-2 border-l border-primary/30 pl-2">
          {node.children.map((child, idx) => (
            <TreeNode key={idx} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuttaPanelImage({
  src,
  variant,
  className = "",
  onClick,
}: {
  src: string;
  variant: number;
  className?: string;
  onClick?: () => void;
}) {
  const styles = [
    "h-40 border-y paper-rule",
    "w-full h-52 rounded-[22px] border paper-rule",
    "ml-auto h-56 w-[72%] rounded-[1.35rem] border paper-rule",
    "mx-auto h-60 w-[76%] rounded-[1.35rem] border paper-rule",
  ];
  return (
    <div className={`${styles[variant]} overflow-hidden bg-background ${className}`}>
      <img
        src={src}
        alt=""
        className={`h-full w-full object-cover object-center ink-panel ${onClick ? "cursor-zoom-in" : ""}`}
        loading="lazy"
        onClick={onClick}
      />
    </div>
  );
}

function normalizeParam(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  try { return decodeURIComponent(raw); } catch { return String(raw); }
}

export const Route = createFileRoute("/sutta/$suttaId")({
  component: SuttaByIdScreen,
  head: ({ params }) => ({
    meta: [{ title: `DAMA — ${decodeURIComponent(params.suttaId ?? "sutta")}` }],
  }),
});

function SuttaByIdScreen() {
  const { suttaId } = Route.useParams();
  const id = useMemo(() => normalizeParam(suttaId), [suttaId]);
  const navigate = useNavigate();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    image: false,
    audio: false,
    sutta: false,
    commentary: false,
    tree: false,
    practice: false,
  });

  const toggleSection = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const transformedGraph = useMemo(() => transformKnowledgeGraph(item), [item]);
  const heroPngUrl = useMemo(() => item?.image_url?.replace(/(_hero)?\.(mp4|gif|webp)$/i, '.png'), [item?.image_url]);

  const audioSrc = useMemo(() => {
    const f = item?.aud_file?.trim();
    return f ? getCorpusAudSrc(f) : null;
  }, [item?.aud_file]);

  const [practicePicked, setPracticePicked] = useState("");
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);

  const settings = useSyncExternalStore(subscribeSettings, readSettings, () => ({ language: "en" }));
  const [lang, setLang] = useState<"en" | "ja">("en");
  useEffect(() => { setLang(settings.language as any); }, [settings.language]);

  const readingProgress = useSyncExternalStore(subscribeReadingProgress, readReadingProgress, () => INITIAL_READING_PROGRESS_SNAPSHOT);
  const isRead = Boolean(id && (readingProgress as any)[id]?.readAtMs);

  const showMettaInfographic = useMemo(() => isAn1116Sutta(id), [id]);

  const jaData = useMemo(() => {
    if (id === "1.48" || id === "AN 1.48") return an148Quiz.japaneseAudio;
    if (item?.mcq?.japaneseAudio) return item.mcq.japaneseAudio;
    return null;
  }, [id, item]);

  const hasJapanese = useMemo(() => {
    if (id === "1.48" || id === "AN 1.48") return true;
    return item?.languages?.includes("ja") ?? false;
  }, [id, item]);

  useEffect(() => {
    if (!id.trim()) return;
    const ac = new AbortController();
    setStatus("loading");
    getItem(id, lang, ac.signal).then(data => {
      setItem(data);
      setStatus("ok");
    }).catch(e => {
      if (!ac.signal.aborted) { setStatus("error"); setErrorMsg(e.message); }
    });
    return () => ac.abort();
  }, [id, lang]);

  const practice = useMemo(() => getPracticeForItem(id, item), [id, item]);
  const practiceMode = useMemo(() => getPracticeMode(id, item), [id, item]);

  if (!id.trim()) {
    return (
      <div className="min-h-screen dama-screen">
        <ScreenHeader title="Sutta Not Found" />
        <div className="mt-8 glass rounded-2xl p-6 text-center border-destructive/20 border">
          <Hexagon size={24} className="mx-auto text-destructive mb-3" />
          <div className="label-mono text-destructive font-bold uppercase">Invalid ID</div>
          <p className="mt-2 text-sm text-muted-foreground">The sutta ID provided is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dama-screen pb-64">
      <ScreenHeader
        center={<CorpusHeaderNav currentSuttaId={id} />}
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate({ to: "/browse" })} className="size-9 rounded-full border paper-rule bg-background/60 flex items-center justify-center text-foreground/80 transition-colors" title="Browse"><LayoutGrid size={16} /></button>
            <button onClick={async () => { const s = await getRandomSutta(); if (s) navigate({ to: "/sutta/$suttaId", params: { suttaId: s.suttaid } }); }} className="size-9 rounded-full border paper-rule bg-background/60 flex items-center justify-center text-foreground/80 transition-colors" title="Shuffle"><Shuffle size={16} /></button>
            <button
                onClick={() => hasJapanese && setLang(l => l === "en" ? "ja" : "en")}
                disabled={!hasJapanese}
                className={`h-9 px-3 rounded-full border paper-rule text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1.5 ${hasJapanese ? 'bg-background/60 text-primary' : 'opacity-30 bg-muted/5 grayscale text-muted-foreground cursor-not-allowed'}`}
                title={lang === "en" ? "日本語" : "EN"}
            >
              <Languages size={14} /> {lang === "en" ? "日本語" : "EN"}
            </button>
            <button onClick={() => isRead ? clearSuttaRead(id) : markSuttaRead(id)} className={`size-9 rounded-full border paper-rule bg-background/60 flex items-center justify-center transition-colors ${isRead ? "text-accent border-accent/70" : "text-foreground/80"}`} title={isRead ? "Marked as read" : "Mark as read"}>
              {isRead ? <Check size={16} /> : <Bookmark size={16} />}
            </button>
          </div>
        }
      />

      <div className="px-7">
        <header className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Hexagon size={8} className="text-primary fill-primary shrink-0" />
            <span className="font-mono text-primary text-[11px] leading-tight normal-case tracking-wide">{canonIndexSubtitle(id)}</span>
          </div>
        </header>

        {status === "loading" && <div className="mt-4 space-y-3"><div className="h-8 w-4/5 rounded-xl bg-muted/40" /><div className="mt-6 h-40 rounded-2xl bg-muted/25" /></div>}

        {status === "error" && (
          <div className="mt-8 glass rounded-2xl p-6 text-center border-destructive/20 border">
            <Hexagon size={24} className="mx-auto text-destructive mb-3" />
            <div className="label-mono text-destructive font-bold uppercase">Sutta Not Found</div>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg || "This sutta is not yet in the census."}</p>
            <button onClick={() => navigate({ to: "/" })} className="mt-6 px-6 py-2 rounded-full bg-muted/10 border text-xs label-mono">Go Back Home</button>
          </div>
        )}

        {status === "ok" && item && (
          <>
            <h1 className="text-reading text-[1.8rem] leading-tight mt-4 mb-2 lowercase first-letter:uppercase">
              {itemDisplayHeading(item)}
            </h1>

            <div className="mt-7 space-y-4">
              <CollapsibleSection title="VISUAL" isOpen={expanded.image} onToggle={() => toggleSection('image')} openLabel="View +" isEmpty={!heroPngUrl && !showMettaInfographic}>
                {heroPngUrl && (
                  <SuttaPanelImage
                    src={heroPngUrl}
                    variant={1}
                    className="my-4 shadow-sm"
                    onClick={() => window.open(heroPngUrl, "_blank")}
                  />
                )}
                {showMettaInfographic && (
                  <div className="rounded-2xl overflow-hidden ring-1 ring-primary/20 bg-background/40">
                    <img src={mettaInfographic} alt="Metta advantages" className="w-full h-auto object-contain block" loading="lazy" />
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="AUDIO" isOpen={expanded.audio} onToggle={() => toggleSection('audio')} openLabel="Listen +" isEmpty={!audioSrc && !jaData}>
                {lang === "ja" && jaData ? (
                  <div className="border-y paper-rule py-4">
                    <div className="label-mono text-primary text-xs mb-2 text-center uppercase tracking-widest">日本語オーディオ</div>
                    <audio controls src={jaData?.src} className="w-full h-10" />
                  </div>
                ) : audioSrc ? (
                  <div className="py-2">
                    <AudioPlayer src={audioSrc} label={lang === "ja" ? "日本語オーディオ" : "Teacher audio"} start={item.aud_start_s ?? 0} end={item.aud_end_s ?? 0} suttaId={id} />
                  </div>
                ) : null}
              </CollapsibleSection>

              <CollapsibleSection title="SUTTA" isOpen={expanded.sutta} onToggle={() => toggleSection('sutta')} isEmpty={!item.sutta}>
                <CanonQuote text={lang === "ja" ? jaData!.text : item.sutta} />
              </CollapsibleSection>

              <CollapsibleSection title="COMMENTARY" isOpen={expanded.commentary} onToggle={() => toggleSection('commentary')} isEmpty={!item.commentary}>
                <div className="space-y-6 px-1">
                  {(item.commentary || "").split("\n").filter(p => p.trim()).map((p, i) => (
                    <p key={i} className="text-reading text-[1.15rem] leading-[1.7] text-foreground/85 tracking-tight">{p}</p>
                  ))}
                </div>
              </CollapsibleSection>

              <CollapsibleSection title="TREE" isOpen={expanded.tree} onToggle={() => toggleSection('tree')} isEmpty={!transformedGraph}>
                <div className="overflow-x-auto pb-8"><TreeNode node={transformedGraph!} isRoot /></div>
              </CollapsibleSection>

              <CollapsibleSection title="PRACTICE" isOpen={expanded.practice} onToggle={() => toggleSection('practice')} isEmpty={practiceMode === "none"}>
                {practiceMode === "vow" && (
                  <div className="border-y paper-rule py-6"><div className="label-mono text-muted-foreground text-[10px] mb-2 uppercase">DAILY VOW</div><p className="text-reading text-2xl text-foreground">{practice.vow}</p></div>
                )}
                {practiceMode === "mcq" && (
                  <div className="space-y-4">
                    <p className="text-reading text-lg text-foreground/85 italic">"{practice.mcq.quote}"</p>
                    <div className="mt-4 space-y-3">
                      {practice.mcq.options.map((opt, i) => {
                        const active = practicePicked === opt.id;
                        const correct = practiceSubmitted && opt.id === practice.mcq.goldOptionId;
                        const wrong = practiceSubmitted && active && opt.id !== practice.mcq.goldOptionId;
                        return (
                          <button key={opt.id} type="button" onClick={() => { setPracticePicked(opt.id); setPracticeSubmitted(false); }}
                            className={`w-full rounded-[1.25rem] border p-4 text-left transition-colors ${correct ? "border-accent text-accent bg-accent/5" : wrong ? "border-destructive text-destructive bg-destructive/5" : active ? "border-foreground bg-foreground/5" : "paper-rule bg-background/20"}`}>
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 text-primary">{correct ? <Check size={17} /> : <Circle size={15} />}</span>
                              <span><span className="block text-sm font-semibold uppercase">{i + 1}. {opt.title}</span><span className="mt-1 block text-sm text-muted-foreground">{opt.body}</span></span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <button disabled={!practicePicked} onClick={() => setPracticeSubmitted(true)} className="mt-4 w-full rounded-full border border-foreground py-4 font-semibold text-foreground uppercase text-xs tracking-widest">Check Answer</button>
                  </div>
                )}
                {practiceMode === "technique" && (
                  <div className="border-y paper-rule py-6"><div className="label-mono text-muted-foreground text-[10px] mb-2 uppercase">{practice.technique.title.toUpperCase()}</div>
                    <ol className="mt-4 space-y-4">{practice.technique.steps.map((step, i) => (<li key={i} className="flex gap-4 text-base text-foreground/85"><span className="label-mono text-primary font-bold">{i + 1}</span><span>{step}</span></li>))}</ol>
                  </div>
                )}
              </CollapsibleSection>

              <section>
                <a
                    href={item.sc_url || "#"}
                    target={item.sc_url ? "_blank" : "_self"}
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between w-full rounded-2xl border paper-rule px-5 py-4 group transition-all ${!item.sc_url ? 'opacity-30 bg-muted/5 grayscale cursor-not-allowed' : 'bg-background/40'}`}
                >
                  <div className="label-mono text-foreground font-bold uppercase tracking-widest text-[11px]">SUTTACENTRAL</div>
                  <div className={`text-primary text-xs font-mono uppercase ${item.sc_url ? 'group-hover:underline' : ''}`}>{item.sc_url ? 'VIEW ↗' : 'Empty'}</div>
                </a>
              </section>

              <SuttaChatBot />
            </div>
          </>
        )}
      </div>
      <div className="fixed bottom-0 inset-x-0 z-50 px-7 pt-2 bg-background border-t paper-rule" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <NextSuttaStrip currentSuttaId={id} />
      </div>
    </div>
  );
}

const SuttaChatBot = memo(function SuttaChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <section>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full rounded-2xl border paper-rule bg-background/40 px-5 py-4 group">
        <div className="label-mono text-foreground font-bold uppercase tracking-widest text-[11px]">REFLECT</div>
        <div className="text-primary text-xs font-mono uppercase group-hover:underline">{isOpen ? "CLOSE —" : "OPEN +"}</div>
      </button>
      <div style={{ height: isOpen ? '650px' : '0px', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden', marginTop: isOpen ? '1.5rem' : '0' }} className="border paper-rule rounded-2xl overflow-hidden bg-background/40 transition-all duration-500">
        <div className="flex items-center justify-between px-5 py-2.5 bg-muted/10 border-b paper-rule"><span className="text-[10px] font-mono text-muted-foreground uppercase">REFLECT ASSISTANT</span><a href="https://norbu-ai.org/en/norbu" target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-primary hover:underline">OPEN IN NEW TAB ↗</a></div>
        <iframe src="https://norbu-ai.org/en/norbu" title="Reflect Chat" className="w-full h-[600px] border-none bg-white" loading="lazy" />
      </div>
    </section>
  );
});
