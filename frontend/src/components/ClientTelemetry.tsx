import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useAuthSession } from "@/hooks/use-auth-session";
import { trackUxEvent } from "@/lib/uxLog";

export function ClientTelemetry() {
  const { pathname } = useLocation();
  const { session } = useAuthSession();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    trackUxEvent("page_view", {
      path: pathname,
      signedIn: Boolean(session?.user?.id),
    });
  }, [pathname, session?.user?.id]);

  return null;
}

