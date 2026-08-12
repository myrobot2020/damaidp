import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import advantage01 from "@/assets/advantages/01.jpg";
import advantage02 from "@/assets/advantages/02.jpg";
import advantage03 from "@/assets/advantages/03.jpg";
import advantage04 from "@/assets/advantages/04.jpg";
import advantage05 from "@/assets/advantages/05.jpg";
import { BOOK_OF_ONES_INTERPRETATIONS } from "@/lib/bookOfOnesInterpretations";

const BOOK_OF_ELEVENS_STYLE_IMAGES: Record<number, string> = {
  1: advantage01,
  2: advantage02,
  3: advantage03,
  4: advantage04,
  5: advantage05,
};

function normalizeSuttaId(id: string) {
  return id.trim().replace(/^AN\s+/i, "");
}

export function BookOfOnesInterpretations({ currentSuttaId }: { currentSuttaId: string }) {
  const current = BOOK_OF_ONES_INTERPRETATIONS.find(
    (item) => normalizeSuttaId(item.suttaId) === normalizeSuttaId(currentSuttaId),
  );
  if (!current) return null;

  return (
    <section className="mt-8" aria-labelledby="book-of-ones-interpretations">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-primary" />
        <h2
          id="book-of-ones-interpretations"
          className="label-mono text-sm text-foreground tracking-wide"
        >
          Book of Ones interpretations
        </h2>
      </div>
      <div className="mt-3">
        {[current].map((item) => (
          <article
            key={item.suttaId}
            className="overflow-hidden rounded-2xl glass"
          >
            <div className="relative aspect-[3/4] overflow-hidden">
              <img
                src={BOOK_OF_ELEVENS_STYLE_IMAGES[item.imageIndex]}
                alt={item.imageAlt}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
              <div className="absolute left-2 top-2 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold glow-soft">
                {item.imageIndex}
              </div>
            </div>
            <div className="p-3">
              <div className="label-mono text-primary text-[11px]">{item.suttaId}</div>
              <h3 className="mt-1 text-sm font-semibold leading-snug">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>
              <Link
                to="/practice/$suttaId"
                params={{ suttaId: item.suttaId }}
                className="mt-3 block w-full rounded-xl bg-primary px-3 py-2.5 text-center text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Practice
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
