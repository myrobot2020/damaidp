import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Hexagon, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_SUTTA_ID, getItems } from "@/lib/damaApi";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingFlow,
  head: () => ({
    meta: [{ title: "Welcome to DAMA" }],
  }),
});

function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const [targetId, setTargetId] = useState(DEFAULT_SUTTA_ID);

  useEffect(() => {
    getItems({ book: "all" }).then(res => {
      const first = res.items[0]?.suttaid;
      if (first) setTargetId(first);
    }).catch(() => {});
  }, []);

  // Step 0: Splash Screen Timer (2.5 seconds)
  useEffect(() => {
    if (step === 0) {
      const timer = setTimeout(() => setStep(1), 2500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const finish = () => {
    localStorage.setItem("dama:onboardingComplete", "true");
    navigate({ to: "/sutta/$suttaId", params: { suttaId: targetId } });
  };

  const next = () => setStep((s) => s + 1);

  // --- 1. Splash Screen ---
  if (step === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="relative">
          <Hexagon size={64} className="text-primary fill-primary/20 animate-pulse" />
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-widest text-primary font-mono">DAMA</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen dama-screen flex flex-col">
      <div className="flex-1 px-6 pt-12 pb-10 flex flex-col">
        {/* Progress Indicator */}
        <div className="flex gap-1.5 mb-10">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i <= step ? "flex-1 bg-primary shadow-[0_0_8px_var(--glow)]" : "w-2 bg-white/10"
              }`}
            />
          ))}
        </div>

        <div className="flex-1 flex flex-col justify-center">
          {/* --- 2. Welcome + Intention --- */}
          {step === 1 && (
            <>
              <div className="label-mono text-primary mb-4">AN 1.31–40</div>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                “The mind is difficult to restrain, swift, and wanders at will. The trained mind
                brings happiness.”
              </h2>
              <div className="mt-12 space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  What is your mind seeking right now?
                </p>
                {["Peace", "Understanding", "Clarity", "Relief from restlessness"].map((opt) => (
                  <button
                    key={opt}
                    onClick={next}
                    className="w-full text-left p-4 rounded-2xl glass border border-white/5 hover:border-primary/30 transition-colors flex items-center justify-between group"
                  >
                    <span className="text-sm font-medium">{opt}</span>
                    <ChevronRight
                      size={16}
                      className="text-muted-foreground group-hover:text-primary"
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* --- 3. Awareness --- */}
          {step === 2 && (
            <>
              <div className="label-mono text-primary mb-4">AN 3.86</div>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                “Whatever a person frequently thinks and ponders upon, that becomes the inclination
                of their mind.”
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed italic">
                Your daily reflections shape who you become.
              </p>
              <div className="mt-auto pt-10">
                <Button onClick={next} size="lg" className="w-full rounded-2xl gap-2">
                  Continue <ArrowRight size={18} />
                </Button>
              </div>
            </>
          )}

          {/* --- 4. Core Mechanic --- */}
          {step === 3 && (
            <>
              <div className="label-mono text-primary mb-4">AN 4.41</div>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                “One should know one’s own mind. One should know how it arises, how it ceases, and
                how to train it.”
              </h2>
              <div className="mt-8 glass rounded-2xl p-5 border border-white/5">
                <div className="text-sm leading-relaxed">
                  <strong>The Method:</strong> Listen to a short teaching, reflect on it, and deepen
                  your understanding day by day.
                </div>
              </div>
              <div className="mt-auto pt-10">
                <Button onClick={next} size="lg" className="w-full rounded-2xl gap-2">
                  I'm ready to observe <CheckCircle2 size={18} />
                </Button>
              </div>
            </>
          )}

          {/* --- 5. Gradual Progress --- */}
          {step === 4 && (
            <>
              <div className="label-mono text-primary mb-4">AN 3.99</div>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight">
                “Little by little, one by one, moment by moment, the wise person removes impurities
                from the mind, just as a goldsmith purifies gold.”
              </h2>
              <p className="mt-6 text-muted-foreground leading-relaxed">
                Training is a journey. Consistency matters more than speed.
              </p>
              <div className="mt-auto pt-10">
                <Button onClick={next} size="lg" className="w-full rounded-2xl gap-2">
                  Understood <ArrowRight size={18} />
                </Button>
              </div>
            </>
          )}

          {/* --- 6. Call to Action --- */}
          {step === 5 && (
            <>
              <div className="label-mono text-primary mb-4">AN 5.24</div>
              <h2 className="text-2xl font-semibold leading-tight tracking-tight text-center">
                “The one who has heard the Dhamma, reflects on it, and lives in accordance with it —
                such a person makes progress.”
              </h2>
              <div className="mt-12 flex flex-col items-center">
                <Button
                  onClick={finish}
                  size="lg"
                  className="w-full rounded-2xl py-8 text-lg font-bold"
                >
                  Begin the First Teaching
                </Button>
                <p className="mt-4 text-xs text-muted-foreground label-mono uppercase tracking-widest">
                  START: AN 5.4.40
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
