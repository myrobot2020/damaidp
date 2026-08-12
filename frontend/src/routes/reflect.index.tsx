import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ArrowUp } from "lucide-react";

type ReflectionBot = "simulation" | "buddha" | "psychologist" | "social" | "feminine";

export const Route = createFileRoute("/reflect/")({
  head: () => ({
    meta: [
      { title: "End of Day Reflection - DAMA" },
      {
        name: "description",
        content: "A calm daily reflection grounded in the suttas you have read.",
      },
    ],
  }),
  component: ReflectScreen,
});

function botLabel(bot: ReflectionBot): string {
  switch (bot) {
    case "simulation":
      return "Simulation Theory Bot";
    case "buddha":
      return "Buddha Bot";
    case "psychologist":
      return "Psychologist Bot";
    case "social":
      return "Social Cohesion Bot";
    case "feminine":
      return "Feminine Bot";
  }
}

function ReflectScreen() {
  const [text, setText] = useState("");
  const [bot, setBot] = useState<ReflectionBot>("buddha");
  const navigate = useNavigate();

  const submit = (mode: "dama" | ReflectionBot) => {
    const reflection = text.trim();
    if (!reflection) return;
    localStorage.setItem("dama:reflection", reflection);
    localStorage.setItem("dama:reflectionMode", mode);
    navigate({ to: "/reflect/thinking" });
  };

  const askBotLabel =
    bot === "buddha" ? "Ask BuddhaBot (in-app)" : `Ask ${botLabel(bot)} (in-app)`;

  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader title="Reflect" showBack={false} />
      <div className="px-7 pt-24">
        <div className="border-y paper-rule py-8">
          <div className="label-mono text-foreground/70">A question, a quiet thought</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What does the Buddha mean by ‘a finger snap’?"
            rows={5}
            className="mt-4 w-full resize-none bg-transparent text-reading text-[1.25rem] leading-relaxed placeholder:text-muted-foreground/55 focus:outline-none"
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4 border-b paper-rule pb-4">
          <div className="text-xs text-muted-foreground">{text.length} chars</div>
          <button
            type="button"
            onClick={() => submit(bot)}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 rounded-full border paper-rule px-5 py-3 text-sm text-muted-foreground transition-colors enabled:border-foreground enabled:text-foreground disabled:opacity-50"
          >
            Send <ArrowUp size={15} />
          </button>
        </div>

        <label className="mt-8 block">
          <span className="label-mono text-muted-foreground">Voice</span>
          <select
            value={bot}
            onChange={(e) => setBot(e.target.value as ReflectionBot)}
            className="mt-3 w-full rounded-full border paper-rule bg-transparent px-4 py-3 text-sm font-medium text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="AI voice"
          >
            <option value="buddha">{botLabel("buddha")}</option>
            <option value="psychologist">{botLabel("psychologist")}</option>
            <option value="social">{botLabel("social")}</option>
            <option value="simulation">{botLabel("simulation")}</option>
            <option value="feminine">{botLabel("feminine")}</option>
          </select>
        </label>
        <div className="sr-only">{askBotLabel}</div>
      </div>
    </div>
  );
}
