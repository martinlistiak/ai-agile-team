import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'system' | 'dark';
type ResolvedThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getStoredTheme(): ThemeMode {
  const saved = localStorage.getItem('theme');
  return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
}

function getSystemPreference(): ResolvedThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemPreference);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      setSystemMode(event.matches ? 'dark' : 'light');
    };

    setSystemMode(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const resolvedMode = useMemo<ResolvedThemeMode>(
    () => (mode === 'system' ? systemMode : mode),
    [mode, systemMode],
  );

  useEffect(() => {
    localStorage.setItem('theme', mode);
    document.documentElement.classList.toggle('dark', resolvedMode === 'dark');
  }, [mode, resolvedMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
