"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

/**
 * ThemeProvider now delegates to the global DevpodTheme engine (theme.js)
 * which is loaded via a <Script> tag in layout.tsx. This provider keeps
 * the React context in sync so existing consumers (useTheme()) still work.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  // Sync from DevpodTheme on mount and on changes
  useEffect(() => {
    function sync() {
      const w = window as unknown as {
        DevpodTheme?: { getMode: () => string };
      };
      if (w.DevpodTheme) {
        const mode = w.DevpodTheme.getMode();
        if (mode === "light") {
          setTheme("light");
        } else if (mode === "dark") {
          setTheme("dark");
        } else {
          // system — resolve from media query
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          setTheme(prefersDark ? "dark" : "light");
        }
      } else {
        // Fallback: read from localStorage directly
        const stored = localStorage.getItem("devpod-theme") as string | null;
        if (stored === "light") setTheme("light");
        else if (stored === "dark") setTheme("dark");
      }
    }
    sync();
    window.addEventListener("devpod-theme-change", sync);
    return () => window.removeEventListener("devpod-theme-change", sync);
  }, []);

  // Keep the HTML class in sync for Tailwind dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    const w = window as unknown as {
      DevpodTheme?: { setMode: (m: string) => void };
    };
    if (w.DevpodTheme) {
      w.DevpodTheme.setMode(next);
    }
    setTheme(next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
