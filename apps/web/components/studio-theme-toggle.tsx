"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const storageKey = "studio-universe-theme";

export function StudioThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const theme = window.localStorage.getItem(storageKey) === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    setIsDark(theme === "dark");
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(storageKey, nextTheme);
    setIsDark(nextTheme === "dark");
  }

  return (
    <button
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      className="studio-theme-toggle"
      onClick={toggleTheme}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      type="button"
    >
      {isDark ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
    </button>
  );
}
