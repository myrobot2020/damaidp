import { Link } from "@tanstack/react-router";

export function SuttaInterpretLink({ suttaId }: { suttaId: string }) {
  return (
    <Link
      to="/practice/$suttaId"
      params={{ suttaId }}
      className="block w-full rounded-full border border-foreground bg-transparent py-4 text-center font-semibold text-foreground transition-all hover:bg-foreground hover:text-background active:scale-[0.98]"
    >
      Practice
    </Link>
  );
}
