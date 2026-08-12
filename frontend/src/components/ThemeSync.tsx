import { useEffect, useSyncExternalStore } from "react";

import { DEFAULT_SETTINGS, readSettings, subscribeSettings } from "@/lib/settings";

export function ThemeSync() {
  const settings = useSyncExternalStore(subscribeSettings, readSettings, () => DEFAULT_SETTINGS);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("charcoal", settings.theme === "charcoal");
    root.classList.toggle("dark", settings.theme === "charcoal");
    root.style.colorScheme = settings.theme === "charcoal" ? "dark" : "light";
    return () => {
      root.classList.remove("charcoal", "dark");
      root.style.colorScheme = "";
    };
  }, [settings.theme]);

  return null;
}
