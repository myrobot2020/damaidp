import { Link, useLocation } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

export function BottomNav({ topSlot }: { topSlot?: ReactNode }) {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el || typeof document === "undefined") return;

    const root = document.documentElement;
    const setPad = () => {
      const r = el.getBoundingClientRect();
      // small buffer for shadows/glow and iOS rounding
      const px = Math.ceil(r.height + 8);
      root.style.setProperty("--dama-bottom-pad", `${px}px`);
    };

    setPad();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => setPad());
      ro.observe(el);
    }

    window.addEventListener("resize", setPad);
    return () => {
      window.removeEventListener("resize", setPad);
      ro?.disconnect();
      // Only clear if we're still the same mounted nav.
      root.style.setProperty("--dama-bottom-pad", "0px");
    };
  }, [pathname]);

  return (
    <nav
      ref={(n) => {
        navRef.current = n;
      }}
      className="fixed bottom-0 inset-x-0 z-50 px-3 pt-2 bg-background border-t border-border/60"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {topSlot}
      <div className="flex items-center justify-center">
        <Link
          to="/"
          className="size-12 rounded-full bg-background ring-1 ring-white/10 flex items-center justify-center transition-colors hover:bg-primary/10"
          aria-label="Home"
          title="Home"
        >
          <Home
            size={22}
            className={pathname === "/" ? "text-primary" : "text-muted-foreground"}
            style={pathname === "/" ? { filter: "drop-shadow(0 0 6px var(--glow))" } : undefined}
          />
        </Link>
      </div>
    </nav>
  );
}
