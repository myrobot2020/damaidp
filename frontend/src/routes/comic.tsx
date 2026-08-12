import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { sutta } from "@/data/an1116";
import { ScreenHeader } from "@/components/ScreenHeader";

export const Route = createFileRoute("/comic")({
  head: () => ({
    meta: [
      { title: "Visual Exploration — DAMA" },
      { name: "description", content: "Symbolic visualizations of the 11 advantages of loving-kindness." },
    ],
  }),
  component: ComicScreen,
});

function ComicScreen() {
  const [idx] = useState(0);
  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader title={`Comic ${idx + 1}/11`} showBookmark />
      <div className="px-5">
        <h1 className="text-2xl font-semibold tracking-tight">Visual Exploration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each advantage rendered as a symbolic panel.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {sutta.advantages.map((a) => (
            <figure
              key={a.n}
              className="relative rounded-2xl overflow-hidden glass aspect-[3/4] group"
            >
              <img src={a.img} alt={a.title} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute top-2 left-2 size-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold glow-soft">
                {a.n}
              </div>
              <figcaption className="absolute bottom-0 inset-x-0 p-3">
                <div className="text-xs font-medium leading-tight line-clamp-2">{a.title}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
