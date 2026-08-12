import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bookmark, Home } from "lucide-react";

export function ScreenHeader({
  title,
  center,
  left,
  right,
  showHome = true,
  showBookmark = false,
}: {
  title?: string;
  /** Replaces centered title when set (e.g. corpus nav). */
  center?: ReactNode;
  /** Optional override for the left-side header control. */
  left?: ReactNode;
  /** Optional override for the right-side header control. */
  right?: ReactNode;
  showHome?: boolean;
  /** Deprecated: headers use Home now; kept so older routes don't break. */
  showBack?: boolean;
  showBookmark?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 grid grid-cols-[auto_1fr_auto] items-center gap-2 px-5 py-2 bg-background/88 backdrop-blur-md min-h-[52px] border-b paper-rule">
      {left != null ? (
        <div className="size-9 shrink-0 flex items-center justify-center">{left}</div>
      ) : showHome ? (
        <Link
          to="/"
          className="size-9 rounded-full border paper-rule bg-background/60 flex items-center justify-center shrink-0 text-foreground/80"
          aria-label="Home"
          title="Home"
        >
          <Home size={16} />
        </Link>
      ) : (
        <div className="size-9 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex flex-col items-center justify-center">
        {center != null ? (
          center
        ) : title ? (
          <h2 className="label-mono text-muted-foreground text-center truncate max-w-full">{title}</h2>
        ) : null}
      </div>
      {right != null ? (
        <div className="shrink-0 flex items-center justify-center">{right}</div>
      ) : showBookmark ? (
        <Link to="/reflect" className="size-9 rounded-full border paper-rule bg-background/60 flex items-center justify-center shrink-0 text-foreground/80">
          <Bookmark size={16} />
        </Link>
      ) : (
        <div className="size-9 shrink-0" aria-hidden />
      )}
    </header>
  );
}
