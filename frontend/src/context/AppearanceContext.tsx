"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AppTheme = "dark" | "light";
export type UiScale = "compact" | "default" | "relaxed";

export interface AppearanceContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
  resetAppearance: () => void;
}

const DEFAULT_THEME: AppTheme = "dark";
const DEFAULT_ACCENT = "#F59E0B"; // Amber gold
const DEFAULT_UI_SCALE: UiScale = "compact";
const THEME_STORAGE_KEY = "essr_theme";
const ACCENT_STORAGE_KEY = "essr_accent_color";
const UI_SCALE_STORAGE_KEY = "essr_ui_scale";

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT);
  const [uiScale, setUiScaleState] = useState<UiScale>(DEFAULT_UI_SCALE);

  // Apply CSS variables to root
  const applyAccentVariables = useCallback((hex: string) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--app-accent", hex);

    const rgb = hexToRgb(hex);
    if (rgb) {
      root.style.setProperty("--app-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty("--app-accent-15", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`);
      root.style.setProperty("--app-accent-30", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
      root.style.setProperty("--app-accent-50", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
      root.style.setProperty("--app-accent-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
    }
  }, []);

  const applyScale = useCallback((scale: UiScale) => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-ui-scale", scale);
  }, []);

  // Initialize from localStorage
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
      if (storedTheme === "dark" || storedTheme === "light") {
        setThemeState(storedTheme);
      }
      const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (storedAccent && /^#[0-9A-Fa-f]{3,8}$/.test(storedAccent)) {
        setAccentColorState(storedAccent);
        applyAccentVariables(storedAccent);
      } else {
        applyAccentVariables(DEFAULT_ACCENT);
      }
      const storedScale = localStorage.getItem(UI_SCALE_STORAGE_KEY) as UiScale | null;
      if (storedScale === "compact" || storedScale === "default" || storedScale === "relaxed") {
        setUiScaleState(storedScale);
        applyScale(storedScale);
      } else {
        applyScale(DEFAULT_UI_SCALE);
      }
    } catch {
      applyAccentVariables(DEFAULT_ACCENT);
      applyScale(DEFAULT_UI_SCALE);
    }
  }, [applyAccentVariables, applyScale]);

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }
  };

  const setAccentColor = (nextColor: string) => {
    setAccentColorState(nextColor);
    applyAccentVariables(nextColor);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, nextColor);
    } catch {
      // ignore
    }
  };

  const setUiScale = (nextScale: UiScale) => {
    setUiScaleState(nextScale);
    applyScale(nextScale);
    try {
      localStorage.setItem(UI_SCALE_STORAGE_KEY, nextScale);
    } catch {
      // ignore
    }
  };

  const resetAppearance = () => {
    setTheme(DEFAULT_THEME);
    setAccentColor(DEFAULT_ACCENT);
    setUiScale(DEFAULT_UI_SCALE);
  };

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        setTheme,
        accentColor,
        setAccentColor,
        uiScale,
        setUiScale,
        resetAppearance,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextType {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      accentColor: DEFAULT_ACCENT,
      setAccentColor: () => {},
      uiScale: DEFAULT_UI_SCALE,
      setUiScale: () => {},
      resetAppearance: () => {},
    };
  }
  return ctx;
}
