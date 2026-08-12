import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, onAuthStateChange, unsubscribe } = vi.hoisted(() => {
  const unsub = vi.fn();
  const getS = vi.fn();
  const onChange = vi.fn(() => ({
    data: { subscription: { unsubscribe: unsub } },
  }));
  return { getSession: getS, onAuthStateChange: onChange, unsubscribe: unsub };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession,
      onAuthStateChange,
    },
  },
}));

import { useAuthSession } from "../use-auth-session";

describe("useAuthSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it("returns loading then session null when no user", async () => {
    const { result } = renderHook(() => useAuthSession());

    expect(result.current.loading).toBe(true);
    expect(result.current.supabaseReady).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it("subscribes to auth changes and unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useAuthSession());

    await waitFor(() => expect(getSession).toHaveBeenCalled());

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
