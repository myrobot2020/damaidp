import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Square, Volume2, Leaf } from "lucide-react";
import { recordAudioListenProgress } from "@/lib/audioListenProgress";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function extFromSrc(src: string): string {
  const t = (src || "").split("?")[0]?.split("#")[0] ?? "";
  const dot = t.lastIndexOf(".");
  if (dot < 0) return "";
  return t.slice(dot + 1).trim().toLowerCase();
}

function canBrowserPlayAudioExt(ext: string): boolean | null {
  if (!ext) return null;
  if (typeof document === "undefined") return null;
  const el = document.createElement("audio");
  if (ext === "mp3" || ext === "mpeg") {
    const v = el.canPlayType("audio/mpeg");
    return v === "probably" || v === "maybe";
  }
  if (ext === "m4a" || ext === "mp4" || ext === "aac") {
    const v = el.canPlayType("audio/mp4");
    return v === "probably" || v === "maybe";
  }
  if (ext === "opus") {
    const v = el.canPlayType("audio/opus");
    return v === "probably" || v === "maybe";
  }
  if (ext === "webm" || ext === "weba") {
    const v = el.canPlayType("audio/webm");
    return v === "probably" || v === "maybe";
  }
  return null;
}

function mediaErrorMessage(code: number | undefined): string {
  if (code === 1) return "Playback aborted.";
  if (code === 2) return "Network error while loading audio.";
  if (code === 3) return "Audio decode error (unsupported or corrupted file).";
  if (code === 4) return "Audio source not supported or missing.";
  return "Could not play audio.";
}

export function AudioPlayer({
  src,
  label,
  start,
  end,
  suttaId,
}: {
  src: string;
  label: string;
  start: number;
  end: number;
  suttaId?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audioTime, setAudioTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [formatSupported, setFormatSupported] = useState<boolean | null>(null);
  const [duration, setDuration] = useState(0);

  const srcExt = useMemo(() => extFromSrc(src), [src]);

  const effectiveEnd = useMemo(() => {
    if (end > start) return end;
    if (duration > 0) return duration;
    return 1;
  }, [end, start, duration]);

  const clipLen = Math.max(0, effectiveEnd - start);
  const seg = Math.min(clipLen, Math.max(0, Math.min(audioTime, effectiveEnd) - start));

  const tick = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setAudioTime(el.currentTime);
    const sid = suttaId?.trim();
    if (sid && clipLen > 0) {
      const segNow = Math.min(clipLen, Math.max(0, Math.min(el.currentTime, effectiveEnd) - start));
      recordAudioListenProgress(sid, segNow / clipLen);
    }
    if (el.currentTime >= effectiveEnd - 0.05) {
      el.pause();
      el.currentTime = start;
      setAudioTime(start);
      setPlaying(false);
    }
  }, [clipLen, effectiveEnd, start, suttaId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => {
      const code = el.error?.code;
      const msg = mediaErrorMessage(code);
      setLoadError(msg);
      setPlaying(false);
    };
    const onLoadedMetadata = () => {
      setDuration(el.duration);
    };
    el.addEventListener("timeupdate", tick);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      el.removeEventListener("timeupdate", tick);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [tick]);

  useEffect(() => {
    setLoadError(null);
    setPlaying(false);
    setAudioTime(0);
    const v = canBrowserPlayAudioExt(srcExt);
    setFormatSupported(v);
  }, [src, srcExt]);

  const stop = () => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = start;
    setAudioTime(start);
    setPlaying(false);
  };

  const toggle = async () => {
    const el = audioRef.current;
    if (!el || !src || formatSupported === false) return;
    setLoadError(null);
    if (playing) {
      el.pause();
      return;
    }
    try {
      if (el.currentTime < start || el.currentTime > effectiveEnd) {
        el.currentTime = start;
      }
      setAudioTime(el.currentTime);
      await el.play();
    } catch {
      const msg = mediaErrorMessage(el.error?.code);
      setLoadError(msg);
      setPlaying(false);
    }
  };

  const seek = (clipOffset: number) => {
    const el = audioRef.current;
    if (!el || clipLen <= 0) return;
    const t = start + Math.min(clipLen, Math.max(0, clipOffset));
    el.currentTime = t;
    setAudioTime(t);
  };

  const progressPct = (seg / clipLen) * 100;

  return (
    <div className="rounded-3xl border paper-rule bg-background/40 p-6 flex flex-col gap-5 shadow-sm my-6">
      <audio ref={audioRef} src={src || undefined} preload="metadata" />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={!src || formatSupported === false}
            className="size-16 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shadow-lg hover:shadow-primary/20"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause size={28} fill="currentColor" />
            ) : (
              <Play size={28} fill="currentColor" className="ml-1" />
            )}
          </button>
          <div className="min-w-0">
            <div className="label-mono text-primary text-[10px] uppercase tracking-[0.2em] font-bold mb-1">
              {label}
            </div>
            <div className="text-base font-semibold text-foreground/90 truncate leading-none">
              Bhante Dhammavuddho
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={stop}
          disabled={!src}
          className="size-10 shrink-0 rounded-full border paper-rule flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background/60 disabled:opacity-40 active:scale-95 transition-all"
          aria-label="Stop"
        >
          <Square size={16} fill="currentColor" />
        </button>
      </div>

      <div className="space-y-3 px-1">
        <div className="relative h-4 flex items-center group">
          {/* Vine Container */}
          <div className="absolute inset-0 flex items-center pointer-events-none">
            <div className="w-full h-2.5 bg-muted/20 rounded-full relative overflow-hidden ring-1 ring-black/5">
              {/* Growing Vine Background */}
              <div
                className="h-full bg-gradient-to-r from-[#8B4513] via-[#228B22] to-[#2E8B57] rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              >
                {/* Animated Texture for the Vine */}
                <div
                    className="absolute inset-0 opacity-30 animate-pulse"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)'
                    }}
                />
              </div>

              {/* Growing Leaves along the vine */}
              <div className="absolute inset-0 flex items-center h-full">
                {[...Array(12)].map((_, i) => {
                    const leafPos = (i + 1) * (100 / 13);
                    const isVisible = progressPct >= leafPos;
                    return (
                        <div
                            key={i}
                            className={`absolute transition-all duration-700 ease-out ${isVisible ? 'opacity-60 scale-100 animate-wiggle' : 'opacity-0 scale-0'}`}
                            style={{
                                left: `${leafPos}%`,
                                transform: `rotate(${i % 2 === 0 ? 30 : -30}deg) ${isVisible ? '' : 'translateY(10px)'}`,
                            }}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#2E8B57]">
                                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" fill="currentColor" />
                            </svg>
                        </div>
                    );
                })}
              </div>
            </div>
          </div>

          <input
            id="audio-seek"
            type="range"
            aria-label="Seek"
            min={0}
            max={clipLen || 1}
            step={0.05}
            value={Number.isFinite(seg) ? seg : 0}
            disabled={!src}
            onChange={(e) => seek(Number(e.target.value))}
            className="relative w-full h-full appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-7
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-[#2E8B57]
              [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.2)] [&::-webkit-slider-thumb]:transition-transform
              active:[&::-webkit-slider-thumb]:scale-110"
          />
        </div>
        <div className="flex justify-between label-mono normal-case text-muted-foreground text-[11px] font-bold tracking-wider">
          <span>{fmt(seg)}</span>
          <div className="flex items-center gap-1.5 opacity-40">
            <div className={`size-1 rounded-full bg-primary ${playing ? 'animate-ping' : ''}`} />
            <span>PLAYING</span>
          </div>
          <span>{fmt(clipLen)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 pt-1 border-t border-black/5">
        <Volume2 size={16} className="shrink-0 text-muted-foreground/60" aria-hidden />
        <input
          id="audio-vol"
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.02}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 min-w-0 h-1 appearance-none bg-muted/30 rounded-full accent-primary cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        />
      </div>

      {loadError && (
        <p className="text-center text-[10px] text-destructive font-mono uppercase font-bold tracking-widest bg-destructive/5 py-2 rounded-xl">
          {loadError}
        </p>
      )}
    </div>
  );
}

export function TrackedNativeAudio({
  src,
  suttaId,
  className,
}: {
  src: string;
  suttaId: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    const sid = suttaId.trim();
    if (!el || !sid) return;
    const onTime = () => {
      const d = el.duration;
      if (!Number.isFinite(d) || d <= 0) return;
      recordAudioListenProgress(sid, el.currentTime / d);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [suttaId, src]);

  return (
    <div className="rounded-3xl border paper-rule bg-background/40 p-4 my-6">
        <div className="label-mono text-primary text-[10px] uppercase tracking-widest font-bold mb-2 text-center">Teacher Audio</div>
        <audio ref={audioRef} controls className={className ?? "w-full h-10"} src={src} preload="metadata" />
    </div>
  );
}
