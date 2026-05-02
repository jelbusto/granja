"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { THEMES, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "azul",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = useRef(createClient()).current;
  const [theme, setThemeState] = useState<Theme>("azul");

  // Apply localStorage immediately (avoids flash; also set by inline script in layout)
  useEffect(() => {
    const saved = localStorage.getItem("dp-theme") as Theme | null;
    if (saved && (THEMES as readonly string[]).includes(saved)) {
      setThemeState(saved);
    }
  }, []);

  // Load from DB after auth resolves — overrides localStorage for cross-device sync
  useEffect(() => {
    async function loadFromDB() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      type P = { tema: string | null };
      const { data } = await (supabase
        .from("usuarios_perfil" as never)
        .select("tema")
        .eq("id", user.id)
        .single()) as { data: P | null; error: unknown };
      if (data?.tema && (THEMES as readonly string[]).includes(data.tema)) {
        const t = data.tema as Theme;
        setThemeState(t);
        localStorage.setItem("dp-theme", t);
        document.documentElement.setAttribute("data-theme", t);
      }
    }
    loadFromDB();
  }, [supabase]);

  function setTheme(t: Theme) {
    setThemeState(t);
    localStorage.setItem("dp-theme", t);
    document.documentElement.setAttribute("data-theme", t);
    // Save to DB in background
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      (supabase
        .from("usuarios_perfil" as never)
        .update({ tema: t } as never)
        .eq("id", user.id) as unknown as Promise<unknown>
      ).catch(() => {});
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
