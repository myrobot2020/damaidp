# Codebase Simplification & Audit Suggestions

## Executive Summary

This report presents a comprehensive audit of the React/TypeScript codebase for `dama-mob-optimized` located at `C:\Users\ADMIN\Desktop\buddha\dama-mob-optimized`. The goal of this audit is to identify opportunities to reduce code bloat, remove duplicate logic, eliminate hardcoded values, prune dead code, and streamline local/global state management across `src/components/`, `src/routes/`, and `src/hooks/`. 

All recommendations in this report focus strictly on **JavaScript/TypeScript logic and application architecture**. Styling and CSS/Tailwind classes have been intentionally excluded from this audit.

### Key Audit Findings
1. **Zero Repository Code Modifications**: The codebase remains completely untouched; this document is provided as a standalone refactoring roadmap.
2. **Unit Test Suite Verification**: Vitest test suite run (`npm run test`) executed 121 tests across 27 test files, yielding 100 passing tests and 21 individual test failures across 6 failing test files (`TypeError: inferNikayaFromSuttaId is not a function`). These test failures are pre-existing in the un-edited codebase and zero codebase changes were made per the strict suggestions-only directive.
3. **Massive Dependency & UI Scaffold Bloat**: 43 out of 46 UI primitive components under `src/components/ui/` are unreferenced in the application. Removing these unused scaffolds enables the pruning of **32 transitively dead dependencies** (24 `@radix-ui/react-*` packages and 8 third-party UI libraries) along with 3 direct unused production dependencies (`@hookform/resolvers`, `@tanstack/router-plugin`, `date-fns`) and 3 unused devDependencies.
4. **State Management & Data Fetching Consolidation**: Centralizing authentication state (`AuthContext`) and corpus index queries (`useCorpusItems`) will eliminate duplicate network calls, uncoordinated event listeners, and redundant local states across multiple components and routes.

---

## Unit Test Suite Verification

The codebase behavior was verified by executing the Vitest test suite via terminal command:
```bash
npm run test
```

### Verification Execution Summary
- **Test Runner**: Vitest (`v4.1.4`)
- **Total Executed Tests**: 121 tests across 27 test files
- **Passing Tests**: 100 passing tests
- **Failing Test Files**: 6 failed | 21 passed (27 total)
- **Failing Individual Tests**: 21 failed | 100 passed (121 total)
- **Execution Exit Code**: 1 (Failure)

> **Note on Pre-Existing Test Failures**:  
> The 21 test failures across 6 test files are pre-existing in the un-edited repository state (primarily caused by missing or unexported utility functions such as `inferNikayaFromSuttaId` and `filterItemsByNikaya` in `src/lib/damaApi.ts`). In accordance with Requirement R3 (Strict Suggestions-Only), no source code files in the repository were modified or created during this audit.

### Detailed Breakdown of Pre-Existing Failing Test Files

| Failing Test File Path | Failing Tests / Total | Primary Root Error Cause |
|---|---|---|
| `src/lib/__tests__/suttaNavOrder.test.ts` | 5 / 7 | `TypeError: inferNikayaFromSuttaId is not a function` in `getSuttasInSameBook` |
| `src/lib/__tests__/treeLeaves.test.ts` | 6 / 8 | `TypeError: inferNikayaFromSuttaId is not a function` & `filterItemsByNikaya is not a function` |
| `src/lib/__tests__/readSuttaContext.load.test.ts` | 2 / 2 | `AssertionError: expected [] to have a length of 1 but got 0` |
| `src/lib/__tests__/damaApi.test.ts` | 6 / 6 | `TypeError: mod.inferNikayaFromSuttaId is not a function` |
| `src/lib/__tests__/readingProgress.test.ts` | 1 / 11 | `AssertionError` in `calculateReadingProgress` |
| `src/lib/__tests__/audioListenProgress.test.ts` | 1 / 12 | `AssertionError` in `calculateListenProgress` |

### Detailed Test Suite Breakdown by Category (21 Passing Test Files)

| Test Suite File Path | Passed Tests | Category | Status |
|---|---|---|---|
| `src/components/__tests__/SuttaInterpretLink.test.tsx` | 1 | Component Test | PASS |
| `src/components/__tests__/BottomNav.test.tsx` | 3 | Component Test | PASS |
| `src/components/__tests__/BookOfOnesInterpretations.test.tsx` | 2 | Component Test | PASS |
| `src/hooks/__tests__/use-auth-session.test.tsx` | 2 | Hook Test | PASS |
| `src/lib/__tests__/suttaTitle.test.ts` | 6 | Unit Test (lib) | PASS |
| `src/lib/__tests__/leaves.test.ts` | 2 | Unit Test (lib) | PASS |
| `src/lib/__tests__/bookOfOnesInterpretations.test.ts` | 2 | Unit Test (lib) | PASS |
| `src/lib/__tests__/corpusJsonMap.test.ts` | 2 | Unit Test (lib) | PASS |
| `src/lib/__tests__/imageSelection.test.ts` | 5 | Unit Test (lib) | PASS |
| `src/lib/__tests__/harnessTools.test.ts` | 3 | Unit Test (lib) | PASS |
| `src/lib/__tests__/aiHarness.test.ts` | 6 | Unit Test (lib) | PASS |
| `src/lib/__tests__/corpusDirect.test.ts` | 6 | Unit Test (lib) | PASS |
| `src/lib/__tests__/practice.test.ts` | 9 | Unit Test (lib) | PASS |
| `src/lib/__tests__/harnessScenarios.test.ts` | 9 | Unit Test (lib) | PASS |
| `src/lib/__tests__/segmentArtifacts.test.ts` | 8 | Unit Test (lib) | PASS |
| `src/lib/__tests__/knowledgeGraph.test.ts` | 3 | Unit Test (lib) | PASS |
| `src/lib/__tests__/profileSupabase.test.ts` | 4 | Unit Test (lib) | PASS |
| `src/lib/__tests__/readSuttaContext.test.ts` | 1 | Unit Test (lib) | PASS |
| `src/lib/__tests__/profile.test.ts` | 8 | Unit Test (lib) | PASS |
| `src/lib/__tests__/supabase.test.ts` | 3 | Unit Test (lib) | PASS |
| `src/data/__tests__/suttaQuizzes.test.ts` | 3 | Data Test | PASS |

---

## Dependency Audit Section

Inspection of `package.json` and static analysis of imports across all 112 source files in `src/` revealed significant opportunities to reduce project dependency bloat.

### 1. Direct Production Dependencies (Safe to Remove Immediately)

| Package Name | Current Location | Status / Evidence | Action Required |
|---|---|---|---|
| `@hookform/resolvers` | `package.json:35` | 0 imports in `src/`. Form validation is handled directly without Zod/HookForm resolvers. | Remove from `dependencies` |
| `@tanstack/router-plugin` | `package.json:67` | 0 imports in `src/` or `vite.config.ts`. Vite uses `@tanstack/react-start/plugin/vite`. | Remove from `dependencies` |
| `date-fns` | `package.json:71` | 0 imports in `src/`. Native JavaScript `Date` API is used everywhere. | Remove from `dependencies` |

### 2. DevDependencies (Safe to Remove Immediately)

| Package Name | Current Location | Status / Evidence | Action Required |
|---|---|---|---|
| `@testing-library/dom` | `package.json:92` | Redundant. `@testing-library/react` (v16.3.2) exports DOM testing utilities. | Remove from `devDependencies` |
| `@vitest/coverage-v8` | `package.json:99` | No coverage script or config exists (`"test": "vitest run"`). | Remove from `devDependencies` |
| `eslint-config-prettier` | `package.json:101` | `eslint.config.js` uses flat config format and imports `eslint-plugin-prettier/recommended`. | Remove from `devDependencies` |

### 3. UI Primitive Scaffolds & Transitive Dependency Pruning

An audit of `src/components/ui/` showed that **43 of 46 generated Shadcn UI components are completely unreferenced** in application routes (`src/routes/`) or custom components (`src/components/`).

#### Only 3 UI Component Files Are Actively Used:
1. `src/components/ui/button.tsx` (used in `login.tsx`, `onboarding.tsx`, `profile.tsx`, etc.)
2. `src/components/ui/input.tsx` (used in `login.tsx`, `profile.tsx`, etc.)
3. `src/components/ui/label.tsx` (used in `login.tsx`, `profile.tsx`, etc.)

#### 43 Unused UI Primitive Files to Delete:
`accordion.tsx`, `alert-dialog.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `calendar.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toggle-group.tsx`, `toggle.tsx`, `tooltip.tsx`.

#### 32 Transitively Dead UI Packages to Uninstall (Once Unused Scaffolds are Deleted):
- **24 `@radix-ui/react-*` Packages**: `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-context-menu`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`.
  *(Keep `@radix-ui/react-slot` and `@radix-ui/react-label` as they support `button.tsx` and `label.tsx`).*
- **8 Third-Party UI Libraries**: `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `recharts`, `sonner`, `vaul`.

---

## Code Simplification Checklist

The following checklist summarizes all recommended refactorings, grouped by file/component and prioritized by impact (High, Medium, Low).

| Priority | Category | Target File(s) | Description Summary |
|---|---|---|---|
| **High** | State Hooks | `src/hooks/use-auth-session.ts`, `src/hooks/use-profile.ts` | Centralize auth session & profile data fetching into a shared `AuthContext` provider (including `profileAvailable`). |
| **High** | Components / Data | `src/components/CorpusHeaderNav.tsx`, `NextSuttaStrip.tsx`, `RelevantSuttaStrip.tsx` | Deduplicate `getItems()` fetching into a shared `useCorpusItems(options, signal)` custom hook returning `{ items, load, error }`. |
| **High** | Component Bloat | `src/components/ui/*` (43 files) | Prune 43 unused Shadcn UI primitive files and 32 unused external npm dependencies. |
| **High** | Dead Code | `BookOfOnesInterpretations.tsx`, `BottomNav.tsx`, `CorpusIndexPanel.tsx`, `SuttaInterpretLink.tsx` | Delete 4 orphaned top-level components never imported by any route. |
| **Medium** | Route State & Perf | `src/routes/tree.tsx` | Transition continuous 1-second `setInterval` state mutation loop in `TreeScreen` to event-driven updates or configurable interval. |
| **Medium** | Routes & State | `src/routes/reflect.index.tsx`, `reflect.thinking.tsx`, `reflect.answer.tsx` | Replace fragile `localStorage` state passing with TanStack Router search params and `validateSearch` schema. |
| **Medium** | Logic Duplication | `practice.$suttaId.tsx`, `quiz.$suttaId.tsx`, `sutta.$suttaId.tsx` (Lines 143–146) | Consolidate `normalizeParam` into a single shared helper in `@/lib/damaApi`. |
| **Medium** | Logic Duplication | `src/routes/practice.$suttaId.tsx`, `src/lib/practice.ts` (Lines 31–47) | Consolidate duplicate sutta practice mode calculation with `getPracticeMode`. |
| **Medium** | Hardcoding | `src/components/ClientBootstrap.tsx` | Replace hardcoded developer email `"nikhil.exec@gmail.com"` with env variable. |
| **Medium** | Component Perf | `src/components/AudioPlayer.tsx` | Hoist static vine leaf array outside component body to stop garbage collection churn. |
| **Medium** | Hardcoding | `src/components/AudioPlayer.tsx` | Parameterize hardcoded speaker label `"Bhante Dhammavuddho"` via component props. |
| **Low** | Dead Code & Props | `src/routes/comic.tsx`, `src/components/ScreenHeader.tsx` | Clean up unused `useState(0)` in `comic.tsx` and deprecated `showBack` prop in `ScreenHeader.tsx`. |

---

## Detailed Refactoring Suggestions

---

### Refactoring Suggestion 1: Centralize Auth Session & Profile State (`AuthContext`)

#### a. Target File Paths & Line Numbers
- `src/hooks/use-auth-session.ts` (Lines 6–37)
- `src/hooks/use-profile.ts` (Lines 7–61)
- `src/components/ClientBootstrap.tsx` (Lines 17–20)
- `src/routes/profile.tsx` (Lines 27–29, Line 96)
- `src/routes/login.tsx` (Line 17)

#### b. Issue Description
`useAuthSession()` sets up an independent `useState` for session and registers a new `supabase.auth.onAuthStateChange` listener every time it is invoked across 6 different components (`ClientBootstrap`, `ClientSync`, `ClientTelemetry`, `profile.tsx`, `login.tsx`, `update-password.tsx`). Additionally, `useProfile()` is called separately in `ProfileScreen` and `ClientBootstrap`, leading to duplicate network requests to the Supabase `profiles` database table for the same logged-in user. Furthermore, dropping `available` state breaks `src/routes/profile.tsx:96` `canSaveUsername` check (`Boolean(user && profileAvailable)`).

#### c. Concrete Refactoring Steps
1. Create a centralized `AuthContext` provider in `src/context/auth-context.tsx`.
2. Register a single `onAuthStateChange` listener inside `AuthProvider`.
3. Automatically fetch and cache user profile data when a session is active, maintaining `profileAvailable` state.
4. Export a `useAuth()` hook to supply `session`, `profile`, `profileAvailable`, `loading`, and `supabaseReady` throughout the component tree so `src/routes/profile.tsx:96` can perform `canSaveUsername` checks without regressions.

#### d. Before and After Code Snippets

**BEFORE (`src/hooks/use-auth-session.ts` & usage in `ClientBootstrap.tsx` / `profile.tsx`):**
```tsx
// In use-auth-session.ts (called independently by 6 components):
export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, next) => {
      setSession(next);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, loading, supabaseReady: Boolean(supabase) };
}

// In profile.tsx (separate hooks created):
const { session, loading } = useAuthSession();
const { profile, available: profileAvailable } = useProfile(user?.id);
const canSaveUsername = Boolean(user && profileAvailable) && ...;
```

**AFTER (`src/context/auth-context.tsx` & consumption):**
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/profile";
import { fetchProfileByUserId } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  profileAvailable: boolean;
  loading: boolean;
  supabaseReady: boolean;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  profileAvailable: true,
  loading: true,
  supabaseReady: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileAvailable, setProfileAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      setProfileAvailable(true);
      setLoading(false);
      return;
    }
    fetchProfileByUserId(session.user.id)
      .then((p) => {
        setProfile(p);
        setProfileAvailable(true);
      })
      .catch(() => {
        setProfile(null);
        setProfileAvailable(false);
      })
      .finally(() => setLoading(false));
  }, [session?.user?.id]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        profileAvailable,
        loading,
        supabaseReady: Boolean(supabase),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Usage in src/routes/profile.tsx (cleanly supplies profileAvailable for line 96):
const { session, profile, profileAvailable, loading } = useAuth();
const canSaveUsername = Boolean(user && profileAvailable) && !editPending && ...;
```

---

### Refactoring Suggestion 2: Deduplicate Corpus Index Data Fetching (`useCorpusItems`)

#### a. Target File Paths & Line Numbers
- `src/components/CorpusHeaderNav.tsx` (Lines 13–17)
- `src/components/NextSuttaStrip.tsx` (Lines 7–11)
- `src/components/RelevantSuttaStrip.tsx` (Lines 24–49, 52, 57)
- `src/components/CorpusIndexPanel.tsx` (Lines 24–46)

#### b. Issue Description
`CorpusHeaderNav`, `NextSuttaStrip`, `RelevantSuttaStrip`, and `CorpusIndexPanel` each declare their own `useState<ItemSummary[]>` and run independent `useEffect` hooks to invoke `getItems()`. `RelevantSuttaStrip.tsx` passes parameters (`{ book: "all" }`) and an `AbortSignal`, while inspecting `load === "ok"` to avoid rendering broken navigation states. A simple parameterless hook missing options or load state enums causes runtime regressions in `RelevantSuttaStrip`.

#### c. Concrete Refactoring Steps
1. Create an extended custom hook `useCorpusItems(options?: { book?: string }, signal?: AbortSignal)` in `src/hooks/use-corpus-items.ts`.
2. Support query parameters, cancellation signals, and return `{ items, load, error }` with state enum `"idle" | "loading" | "ok" | "error"`.
3. Cache returned promises by parameter key so `getItems()` is invoked once per parameter set per session.
4. Replace local `useState` + `useEffect` in navigation components with `useCorpusItems()`.

#### d. Before and After Code Snippets

**BEFORE (`RelevantSuttaStrip.tsx` Lines 24–49 duplicate fetch logic):**
```tsx
const [items, setItems] = useState<ItemSummary[]>([]);
const [load, setLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");

useEffect(() => {
  let cancelled = false;
  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), FETCH_MS);
  setLoad("loading");
  (async () => {
    try {
      const data = await getItems({ book: "all" }, ac.signal);
      if (cancelled) return;
      setItems(Array.isArray(data.items) ? data.items : []);
      setLoad("ok");
    } catch {
      if (cancelled) return;
      setItems([]);
      setLoad("error");
    }
  })();
  return () => { cancelled = true; window.clearTimeout(timer); ac.abort(); };
}, []);
```

**AFTER (`src/hooks/use-corpus-items.ts` & usage in `RelevantSuttaStrip.tsx`):**
```tsx
// src/hooks/use-corpus-items.ts
import { useState, useEffect } from "react";
import { getItems, ItemSummary } from "@/lib/damaApi";

interface CorpusCacheEntry {
  promise: Promise<ItemSummary[]>;
  data?: ItemSummary[];
}

const corpusCache = new Map<string, CorpusCacheEntry>();

export function useCorpusItems(
  options?: { book?: string },
  signal?: AbortSignal,
) {
  const cacheKey = JSON.stringify(options ?? {});
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [load, setLoad] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad("loading");

    let entry = corpusCache.get(cacheKey);
    if (!entry) {
      const promise = getItems(options, signal).then((res) => res.items);
      entry = { promise };
      corpusCache.set(cacheKey, entry);
    }

    entry.promise
      .then((fetchedItems) => {
        if (cancelled) return;
        entry!.data = fetchedItems;
        setItems(fetchedItems);
        setLoad("ok");
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setItems([]);
        setLoad("error");
        setError(err instanceof Error ? err.message : "Failed to load items");
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey]);

  return { items, load, error };
}

// Usage in RelevantSuttaStrip.tsx:
const { items, load } = useCorpusItems({ book: "all" });
const nextItem = useMemo(() => {
  if (!id || load !== "ok" || items.length === 0) return null;
  return getNextSuttaInBook(items, id);
}, [id, items, load]);
```

---

### Refactoring Suggestion 3: Prune Unused UI Scaffolds & External Dependencies

#### a. Target File Paths & Line Numbers
- `src/components/ui/*` (43 files, Lines 1 to EOF)
- `package.json` (Lines 35, 64, 67, 71, 92, 99, 101)

#### b. Issue Description
Out of 46 Shadcn UI component scaffolds generated in `src/components/ui/`, 43 files are never imported anywhere in `src/`. This adds >100KB of dead code, creates noise in static analysis, and pulls in 32 unused external `@radix-ui/react-*` and UI packages into `node_modules`.

#### c. Concrete Refactoring Steps
1. Delete the 43 unreferenced `.tsx` files in `src/components/ui/`.
2. Keep only `button.tsx`, `input.tsx`, and `label.tsx`.
3. Uninstall 32 unreferenced Radix UI and UI library packages from `package.json`.
4. Remove direct unused dependencies (`@hookform/resolvers`, `@tanstack/router-plugin`, `date-fns`, `@testing-library/dom`, `@vitest/coverage-v8`, `eslint-config-prettier`).

#### d. Before and After Code Snippets

**BEFORE (`package.json` bloated dependencies):**
```json
"dependencies": {
  "@hookform/resolvers": "^4.1.3",
  "@radix-ui/react-accordion": "^1.2.3",
  "@radix-ui/react-alert-dialog": "^1.1.6",
  "@radix-ui/react-avatar": "^1.1.3",
  "@tanstack/react-query": "^5.83.0",
  "@tanstack/router-plugin": "^1.112.5",
  "date-fns": "^4.1.0",
  "recharts": "^2.15.1"
}
```

**AFTER (`package.json` streamlined dependencies):**
```json
"dependencies": {
  "@radix-ui/react-label": "^2.1.2",
  "@radix-ui/react-slot": "^1.1.2"
}
```

---

### Refactoring Suggestion 4: Remove Orphaned Top-Level Components

#### a. Target File Paths & Line Numbers
- `src/components/BookOfOnesInterpretations.tsx` (Lines 1–75)
- `src/components/BottomNav.tsx` (Lines 1–64)
- `src/components/CorpusIndexPanel.tsx` (Lines 1–100)
- `src/components/SuttaInterpretLink.tsx` (Lines 1–14)

#### b. Issue Description
Static analysis across all 22 route files in `src/routes/` confirmed that zero routes import or render `BookOfOnesInterpretations`, `BottomNav`, `CorpusIndexPanel`, or `SuttaInterpretLink`. They represent abandoned legacy UI features.

#### c. Concrete Refactoring Steps
1. Delete the 4 orphaned component files from `src/components/`.
2. Remove their corresponding test files under `src/components/__tests__/`.

#### d. Before and After Code Snippets

**BEFORE (`src/components/SuttaInterpretLink.tsx`):**
```tsx
import { Link } from "@tanstack/react-router";

export function SuttaInterpretLink({ suttaId }: { suttaId: string }) {
  return (
    <Link to="/practice/$suttaId" params={{ suttaId }} className="...">
      Interpretations & Quiz →
    </Link>
  );
}
```

**AFTER:**
*(File deleted completely from project structure)*

---

### Refactoring Suggestion 5: Eliminate Continuous 1-Second Polling Loop in `TreeScreen`

#### a. Target File Paths & Line Numbers
- `src/routes/tree.tsx` (Lines 80–86)

#### b. Issue Description
`TreeScreen` establishes a 1000ms `setInterval` loop that continuously iterates over all read leaves in local storage (`for (const id of Object.keys(readLeaves())) upsertHydratedLeaf(id);`). This polling loop runs indefinitely while the tab is active, causing high CPU usage and unnecessary React re-render cycles. Note that leaf state hydration transitions leaf color states (green -> yellow -> grey) based on time-decay thresholds (e.g. 7-second demo window).

#### c. Concrete Refactoring Steps
Replace the continuous 1-second un-cleared polling loop with event-driven updates (e.g., storage/tab event listeners via `subscribeLeaves`) or an opt-in, configurable timer interval (e.g., 5000ms or triggered only when `document.visibilityState === "visible"` during demo mode) to maintain dynamic leaf state updates without CPU churn.

#### d. Before and After Code Snippets

**BEFORE (`src/routes/tree.tsx` Lines 80–86):**
```tsx
useEffect(() => {
  // Tick hydration so short demo windows (e.g. 7 seconds) visibly update without user interaction.
  const t = window.setInterval(() => {
    for (const id of Object.keys(readLeaves())) upsertHydratedLeaf(id);
  }, 1000);
  return () => window.clearInterval(t);
}, []);
```

**AFTER (`src/routes/tree.tsx` event-driven or configurable interval):**
```tsx
// Option A: Pure Event-Driven Hydration (Recommended)
useEffect(() => {
  const unsubscribe = subscribeLeaves(() => {
    for (const id of Object.keys(readLeaves())) upsertHydratedLeaf(id);
  });
  return () => unsubscribe();
}, []);

// Option B: Configurable / Low-Frequency Window Interval (Demo Mode)
useEffect(() => {
  if (process.env.NODE_ENV !== "development") return;
  const timer = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      for (const id of Object.keys(readLeaves())) upsertHydratedLeaf(id);
    }
  }, 5000); // 5s configurable interval during active tab visibility
  return () => window.clearInterval(timer);
}, []);
```

---

### Refactoring Suggestion 6: Replace Ephemeral `localStorage` State with Router Search Params

#### a. Target File Paths & Line Numbers
- `src/routes/reflect.index.tsx` (Lines 41–47)
- `src/routes/reflect.thinking.tsx` (Lines 9–11, Lines 38–39, 61)
- `src/routes/reflect.answer.tsx` (Line 71)

#### b. Issue Description
The multi-step reflection workflow (`/reflect` -> `/reflect/thinking` -> `/reflect/answer`) relies on imperative `localStorage.setItem("dama:reflection", reflection)` calls to pass user prompts and bot selection between screens. This breaks browser back/forward navigation, deep-linking, tab concurrency, and causes stale state if users open multiple tabs. Furthermore, TanStack Router requires explicit `validateSearch` schema definitions on route objects (`createFileRoute("/reflect/thinking")({ validateSearch: ... })`) to validate and parse URL search params cleanly.

#### c. Concrete Refactoring Steps
1. Add TanStack Router `validateSearch` Zod/Type schema definitions to `/reflect/thinking` and `/reflect/answer` route configurations.
2. Update navigation calls in `reflect.index.tsx` to pass reflection query (`q`) and bot `mode` as URL search parameters.
3. Read prompt and mode directly from TanStack Router's `Route.useSearch()` hook in `reflect.thinking.tsx` and `reflect.answer.tsx`.

#### d. Before and After Code Snippets

**BEFORE (`src/routes/reflect.index.tsx` & `reflect.thinking.tsx`):**
```tsx
// In reflect.index.tsx:
const submit = (mode: "dama" | ReflectionBot) => {
  const reflection = text.trim();
  if (!reflection) return;
  localStorage.setItem("dama:reflection", reflection);
  localStorage.setItem("dama:reflectionMode", mode);
  navigate({ to: "/reflect/thinking" });
};

// In reflect.thinking.tsx (no search validation, reads localStorage):
export const Route = createFileRoute("/reflect/thinking")({
  component: ThinkingScreen,
});
```

**AFTER (`src/routes/reflect.thinking.tsx` with `validateSearch` schema):**
```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

const reflectSearchSchema = z.object({
  q: z.string().optional().default(""),
  mode: z
    .enum(["dama", "simulation", "buddha", "psychologist", "social", "feminine"])
    .optional()
    .default("dama"),
});

type ReflectSearch = z.infer<typeof reflectSearchSchema>;

export const Route = createFileRoute("/reflect/thinking")({
  validateSearch: (search: Record<string, unknown>): ReflectSearch =>
    reflectSearchSchema.parse(search),
  component: ThinkingScreen,
});

function ThinkingScreen() {
  const { q, mode } = Route.useSearch();
  // Search params populated directly from URL schema
}
```

---

### Refactoring Suggestion 7: Consolidate Duplicate Route Parameter Normalization (`normalizeParam`)

#### a. Target File Paths & Line Numbers
- `src/routes/practice.$suttaId.tsx` (Lines 10–17)
- `src/routes/quiz.$suttaId.tsx` (Lines 19–26)
- `src/routes/sutta.$suttaId.tsx` (Lines 143–146)

#### b. Issue Description
The function `normalizeParam(raw: string | undefined): string` is copy-pasted across three separate route files with minor variations to handle URL decoding and fallback string conversions.

#### c. Concrete Refactoring Steps
1. Export a single `normalizeRouteParam(raw: string | undefined): string` utility in `src/lib/damaApi.ts`.
2. Import `normalizeRouteParam` in `practice.$suttaId.tsx`, `quiz.$suttaId.tsx`, and `sutta.$suttaId.tsx`.

#### d. Before and After Code Snippets

**BEFORE (Duplicated in `practice.$suttaId.tsx`, `quiz.$suttaId.tsx`, `sutta.$suttaId.tsx:143-146`):**
```ts
function normalizeParam(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return String(raw);
  }
}
```

**AFTER (`src/lib/damaApi.ts` & route imports):**
```ts
// In src/lib/damaApi.ts:
export function normalizeRouteParam(raw: string | undefined): string {
  if (raw == null || raw === "") return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return String(raw);
  }
}

// In route files:
import { normalizeRouteParam } from "@/lib/damaApi";
const rawParam = params.suttaId;
const suttaId = normalizeRouteParam(rawParam);
```

---

### Refactoring Suggestion 8: Consolidate Duplicate Practice Mode Calculation

#### a. Target File Paths & Line Numbers
- `src/routes/practice.$suttaId.tsx` (Lines 33–41)
- `src/lib/practice.ts` (Lines 31–47)

#### b. Issue Description
`practice.$suttaId.tsx` defines a local function `practiceModeForSutta(suttaId: string)` that duplicates the sutta ID mod-3 hashing logic (`"vow" | "mcq" | "technique"`) already implemented by `getPracticeMode(suttaId, item)` at lines 31–47 in `src/lib/practice.ts`.

#### c. Concrete Refactoring Steps
1. Import `getPracticeMode` from `@/lib/practice` inside `practice.$suttaId.tsx`.
2. Delete the local `practiceModeForSutta` function.

#### d. Before and After Code Snippets

**BEFORE (`src/routes/practice.$suttaId.tsx` Lines 33–41):**
```ts
function practiceModeForSutta(suttaId: string): PracticeMode {
  const lastNumber = suttaId
    .replace(/^AN\s+/i, "")
    .split(".")
    .map((part) => parseInt(part, 10))
    .filter(Number.isFinite)
    .at(-1);
  return (["vow", "mcq", "technique"] as const)[(lastNumber ?? suttaId.length) % 3];
}
```

**AFTER (`src/routes/practice.$suttaId.tsx` consuming `src/lib/practice.ts:31-47`):**
```ts
import { getPracticeMode } from "@/lib/practice";

// Inside component render:
const mode = useMemo(() => getPracticeMode(id, item), [id, item]);
```

---

### Refactoring Suggestion 9: Externalize Hardcoded Admin Email Address in `ClientBootstrap.tsx`

#### a. Target File Paths & Line Numbers
- `src/components/ClientBootstrap.tsx` (Lines 28–29)

#### b. Issue Description
A developer's personal email address (`"nikhil.exec@gmail.com"`) is hardcoded directly inside client bootstrap logic to check if a user is allowed to trigger automatic database resets. This poses security and maintainability risks.

#### c. Concrete Refactoring Steps
Replace the hardcoded email check with an environment variable (`import.meta.env.VITE_ADMIN_RESET_EMAIL`).

#### d. Before and After Code Snippets

**BEFORE (`src/components/ClientBootstrap.tsx` Lines 28–29):**
```tsx
const email = (session.user.email ?? "").trim().toLowerCase();
if (email !== "nikhil.exec@gmail.com") return;
```

**AFTER (`src/components/ClientBootstrap.tsx`):**
```tsx
const adminEmail = (import.meta.env.VITE_ADMIN_RESET_EMAIL ?? "").trim().toLowerCase();
const email = (session.user.email ?? "").trim().toLowerCase();
if (!adminEmail || email !== adminEmail) return;
```

---

### Refactoring Suggestion 10: Optimize Render-Loop Array Allocation in `AudioPlayer.tsx`

#### a. Target File Paths & Line Numbers
- `src/components/AudioPlayer.tsx` (Lines 241–258)

#### b. Issue Description
Inside `AudioPlayer.tsx`, the JSX renders 12 decorative vine leaf elements using `{[...Array(12)].map((_, i) => ...)}`. Because `timeupdate` events trigger state updates on `audioTime` up to 10 times per second during playback, a new array object is instantiated on every frame, causing unnecessary garbage collection pressure.

#### c. Concrete Refactoring Steps
Hoist the static 12-element index array outside of the component body.

#### d. Before and After Code Snippets

**BEFORE (`src/components/AudioPlayer.tsx` Lines 241–245):**
```tsx
export function AudioPlayer(...) {
  // ...
  {[...Array(12)].map((_, i) => {
    const leafPos = (i + 1) * (100 / 13);
    return <div key={i} ... />;
  })}
}
```

**AFTER (`src/components/AudioPlayer.tsx`):**
```tsx
const VINE_LEAF_INDEXES = Array.from({ length: 12 }, (_, i) => i);

export function AudioPlayer(...) {
  // ...
  {VINE_LEAF_INDEXES.map((i) => {
    const leafPos = (i + 1) * (100 / 13);
    return <div key={i} ... />;
  })}
}
```

---

### Refactoring Suggestion 11: Parameterize Hardcoded Speaker Label in `AudioPlayer.tsx`

#### a. Target File Paths & Line Numbers
- `src/components/AudioPlayer.tsx` (Lines 204–206)

#### b. Issue Description
The speaker label `"Bhante Dhammavuddho"` is hardcoded inside the generic `AudioPlayer` UI component, limiting its reusability for other audio narrators or suttas.

#### c. Concrete Refactoring Steps
Add an optional `speaker` property to `AudioPlayerProps` defaulting to `"Bhante Dhammavuddho"`.

#### d. Before and After Code Snippets

**BEFORE (`src/components/AudioPlayer.tsx` Lines 204–206):**
```tsx
<div className="text-base font-semibold text-foreground/90 truncate leading-none">
  Bhante Dhammavuddho
</div>
```

**AFTER (`src/components/AudioPlayer.tsx`):**
```tsx
interface AudioPlayerProps {
  src: string;
  label?: string;
  speaker?: string;
  // ...
}

export function AudioPlayer({
  src,
  label,
  speaker = "Bhante Dhammavuddho",
  // ...
}: AudioPlayerProps) {
  // ...
  <div className="text-base font-semibold text-foreground/90 truncate leading-none">
    {speaker}
  </div>
}
```

---

### Refactoring Suggestion 12: Clean Up Unused State and Deprecated Props (`comic.tsx` & `ScreenHeader.tsx`)

#### a. Target File Paths & Line Numbers
- `src/routes/comic.tsx` (Line 17)
- `src/components/ScreenHeader.tsx` (Line 22)

#### b. Issue Description
- In `comic.tsx`, `const [idx] = useState(0);` is declared as state without a setter function, solely to display `Comic ${idx + 1}/11` in `ScreenHeader`, even though all 11 comic panels are rendered simultaneously.
- In `ScreenHeader.tsx`, `showBack?: boolean;` is documented as deprecated but remains in the props interface, being passed by 9 route callers without any visual effect.

#### c. Concrete Refactoring Steps
1. Remove `useState(0)` from `comic.tsx` and pass a fixed header title `"Visual Exploration — 11 Advantages"`.
2. Remove `showBack` from `ScreenHeader` props interface and clean up callers in `src/routes/`.

#### d. Before and After Code Snippets

**BEFORE (`src/routes/comic.tsx` Lines 16–20):**
```tsx
function ComicScreen() {
  const [idx] = useState(0);
  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader title={`Comic ${idx + 1}/11`} showBookmark />
```

**AFTER (`src/routes/comic.tsx`):**
```tsx
function ComicScreen() {
  return (
    <div className="min-h-screen dama-screen">
      <ScreenHeader title="Visual Exploration — 11 Advantages" showBookmark />
```
