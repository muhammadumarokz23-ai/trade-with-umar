import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';
export type BackgroundMode = 'picture' | 'animated3d' | 'solid';

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  backgroundMode: BackgroundMode;
  setBackgroundMode: (mode: BackgroundMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
  backgroundMode: 'picture',
  setBackgroundMode: () => {},
});

const THEME_STORAGE_KEY = 'umar_with_trade_theme';
const BG_STORAGE_KEY = 'umar_with_trade_bg_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  const [backgroundMode, setBackgroundModeState] = useState<BackgroundMode>(() => {
    try {
      const saved = localStorage.getItem(BG_STORAGE_KEY);
      if (saved === 'picture' || saved === 'animated3d' || saved === 'solid') {
        return saved;
      }
      return 'picture';
    } catch {
      return 'picture';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light');
      root.classList.remove('theme-dark');
    } else {
      root.classList.add('theme-dark');
      root.classList.remove('theme-light');
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(BG_STORAGE_KEY, backgroundMode);
    } catch {
      // Ignore storage errors
    }
  }, [backgroundMode]);

  const toggleTheme = () => setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const setBackgroundMode = (mode: BackgroundMode) => setBackgroundModeState(mode);

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, setTheme, backgroundMode, setBackgroundMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
