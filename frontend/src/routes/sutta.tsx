import { createFileRoute, Navigate, Outlet, useRouterState } from "@tanstack/react-router";
import { DEFAULT_SUTTA_ID, getItems } from "@/lib/damaApi";
import { useEffect, useState } from "react";

/**
 * Parent layout for `/sutta/*`. Child `sutta.$suttaId` must render via `<Outlet />`.
 * Visiting `/sutta` alone redirects to the default corpus id.
 */
export const Route = createFileRoute("/sutta")({
  component: SuttaLayout,
});

function SuttaLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const normalized = pathname.replace(/\/$/, "") || "/";
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (normalized === "/sutta") {
      getItems({ book: "all" }).then(res => {
        const first = res.items[0]?.suttaid;
        setTargetId(first || DEFAULT_SUTTA_ID);
      }).catch(() => {
        setTargetId(DEFAULT_SUTTA_ID);
      });
    }
  }, [normalized]);

  if (normalized === "/sutta") {
    if (!targetId) return null;
    return <Navigate to="/sutta/$suttaId" params={{ suttaId: targetId }} replace />;
  }
  return <Outlet />;
}
