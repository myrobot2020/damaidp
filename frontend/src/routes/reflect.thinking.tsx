import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { REFLECTION_QUERY_STORAGE_KEY } from "@/lib/damaApi";
import { runHarness, type HarnessInput, HarnessError } from "@/lib/aiHarness";
import { isUserAdmin } from "@/lib/devMode";
import * as tools from "@/lib/harnessTools";

export const Route = createFileRoute("/reflect/thinking")({
  component: ThinkingScreen,
});

function ThinkingScreen() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const normalizeMode = (
    raw: string,
  ): "dama" | "simulation" | "buddha" | "psychologist" | "social" | "feminine" => {
    const v = (raw || "").trim().toLowerCase();
    if (v === "buddhabot") return "buddha";
    if (
      v === "simulation" ||
      v === "buddha" ||
      v === "psychologist" ||
      v === "social" ||
      v === "feminine"
    ) {
      return v;
    }
    return "dama";
  };

  useEffect(() => {
    const q = localStorage.getItem("dama:reflection") || "";
    const mode = normalizeMode(localStorage.getItem("dama:reflectionMode") || "dama");
    setQuestion(q);

    if (!q.trim()) {
      navigate({ to: "/reflect", replace: true });
      return;
    }

    const ac = new AbortController();
    const timeout = window.setTimeout(() => {
      setErrorMsg("AI request timed out. You can continue with offline text.");
      setErrorCode("TIMEOUT");
      setStatus("error");
      localStorage.setItem(
        REFLECTION_QUERY_STORAGE_KEY,
        JSON.stringify({ ok: false, error: "AI request timed out." }),
      );
    }, 60_000);

    const input: HarnessInput = {
      channel: "ui",
      text: q,
      metadata: { mode },
      isAdmin: isUserAdmin(),
    };

    (async () => {
      try {
        const result = await runHarness(input, tools);

        if (!result.ok) {
          throw result.error;
        }

        window.clearTimeout(timeout);
        navigate({ to: "/reflect/answer", replace: true });
      } catch (e) {
        if (ac.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        const code = e instanceof HarnessError ? e.code : "UNKNOWN_ERROR";
        setErrorMsg(msg);
        setErrorCode(code);
        setStatus("error");
        localStorage.setItem(
          REFLECTION_QUERY_STORAGE_KEY,
          JSON.stringify({ ok: false, error: msg, code }),
        );
      }
    })();

    return () => {
      window.clearTimeout(timeout);
      ac.abort();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader title="Reflect" />
      <div className="px-7 pt-24">
        <div className="h-20 border-y paper-rule" />

        {question && (
          <div className="mt-5 border-y paper-rule py-4">
            <div className="label-mono text-muted-foreground">You asked</div>
            <p className="mt-2 text-reading text-lg leading-relaxed text-muted-foreground line-clamp-3">
              "{question}"
            </p>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center">
          <div className="relative flex size-28 items-center justify-center rounded-full border paper-rule">
            <div className="absolute inset-4 rounded-full border border-primary/40 animate-ping" />
            <div className="size-3 rounded-full bg-primary" />
          </div>
          <p className="mt-8 max-w-xs text-center text-sm text-muted-foreground">
            {status === "error"
              ? "Could not prepare an AI answer. Check the detail below and try again."
              : "Preparing a response..."}
          </p>
          {status === "error" && errorMsg && (
            <div className="mt-4 w-full">
              <div className="label-mono text-[10px] text-destructive mb-1 text-center">ERROR_CODE: {errorCode}</div>
              <p className="text-center text-xs text-destructive/90 max-w-sm mx-auto break-words px-4">
                {errorMsg}
              </p>
            </div>
          )}
          {status === "error" && (
            <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => navigate({ to: "/reflect/answer", replace: true })}
                className="rounded-full border border-foreground bg-transparent font-medium text-foreground px-6 py-3 w-full"
              >
                Continue with offline text
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-full border paper-rule font-medium px-6 py-3 w-full"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
