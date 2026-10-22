"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type AppTheme = "dark" | "light";
export type UiScale = "compact" | "default" | "relaxed";

export interface AppearanceContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  /** The active theme's accent color */
  accentColor: string;
  /** Sets the accent color for the currently active theme */
  setAccentColor: (color: string) => void;
  /** Dark theme's independent accent color */
  darkAccentColor: string;
  setDarkAccentColor: (color: string) => void;
  /** Light theme's independent accent color */
  lightAccentColor: string;
  setLightAccentColor: (color: string) => void;
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
  resetAppearance: () => void;
}

const DEFAULT_THEME: AppTheme = "dark";
export const DEFAULT_DARK_ACCENT = "#F59E0B"; // Amber Gold for Dark Theme
export const DEFAULT_LIGHT_ACCENT = "#2563EB"; // Cobalt Blue for Light Theme ("Daylight Paper")
const DEFAULT_UI_SCALE: UiScale = "compact";

const THEME_STORAGE_KEY = "essr_theme";
const LEGACY_ACCENT_STORAGE_KEY = "essr_accent_color";
const DARK_ACCENT_STORAGE_KEY = "essr_accent_color_dark";
const LIGHT_ACCENT_STORAGE_KEY = "essr_accent_color_light";
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

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Relative luminance per WCAG 2.1 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Computes a high-contrast text/icon variant of the accent color:
 * - In Light Mode, bright accents (like Amber #F59E0B or Cyan #06B6D4) are darkened so text on white/light surfaces passes WCAG AA.
 * - In Dark Mode, very dark accents (like Navy or Deep Purple) are lightened so text on dark slate surfaces stays crisp.
 */
function getReadableAccentTextHex(rgb: { r: number; g: number; b: number }, activeTheme: AppTheme): string {
  const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
  if (activeTheme === "light") {
    if (lum > 0.28) {
      // Scale down brightness proportionally to guarantee strong contrast on white (#FFFFFF) / light slate (#F8FAFC)
      const factor = lum > 0.5 ? 0.58 : 0.72;
      return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
    }
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  } else {
    if (lum < 0.14) {
      // Lighten very dark accents for dark theme readability
      const mix = 0.35;
      return rgbToHex(
        rgb.r + (255 - rgb.r) * mix,
        rgb.g + (255 - rgb.g) * mix,
        rgb.b + (255 - rgb.b) * mix
      );
    }
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);
  const [darkAccentColor, setDarkAccentState] = useState<string>(DEFAULT_DARK_ACCENT);
  const [lightAccentColor, setLightAccentState] = useState<string>(DEFAULT_LIGHT_ACCENT);
  const [uiScale, setUiScaleState] = useState<UiScale>(DEFAULT_UI_SCALE);

  const activeAccent = theme === "light" ? lightAccentColor : darkAccentColor;

  // Apply CSS variables to root for the active theme + accent
  const applyAccentVariables = useCallback((hex: string, activeTheme: AppTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--app-accent", hex);

    const rgb = hexToRgb(hex);
    if (rgb) {
      const lum = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
      // Solid button foreground: dark ink on bright fills (Amber/Cyan/Emerald), pure white on deeper fills (Blue/Purple/Rose)
      const fg = lum > 0.36 ? "#0F172A" : "#FFFFFF";
      const textHex = getReadableAccentTextHex(rgb, activeTheme);

      root.style.setProperty("--app-accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty("--app-accent-fg", fg);
      root.style.setProperty("--app-accent-text", textHex);
      root.style.setProperty("--app-accent-15", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${activeTheme === "light" ? "0.14" : "0.16"})`);
      root.style.setProperty("--app-accent-30", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${activeTheme === "light" ? "0.35" : "0.32"})`);
      root.style.setProperty("--app-accent-50", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
      root.style.setProperty("--app-accent-glow", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
    }
  }, []);

  const applyTheme = useCallback((nextTheme: AppTheme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
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
      const resolvedTheme: AppTheme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : DEFAULT_THEME;
      setThemeState(resolvedTheme);
      applyTheme(resolvedTheme);

      const legacyAccent = localStorage.getItem(LEGACY_ACCENT_STORAGE_KEY);
      const storedDark = localStorage.getItem(DARK_ACCENT_STORAGE_KEY) || legacyAccent;
      const storedLight = localStorage.getItem(LIGHT_ACCENT_STORAGE_KEY);

      const validDark = storedDark && /^#[0-9A-Fa-f]{3,8}$/.test(storedDark) ? storedDark : DEFAULT_DARK_ACCENT;
      const validLight = storedLight && /^#[0-9A-Fa-f]{3,8}$/.test(storedLight) ? storedLight : DEFAULT_LIGHT_ACCENT;

      setDarkAccentState(validDark);
      setLightAccentState(validLight);
      applyAccentVariables(resolvedTheme === "light" ? validLight : validDark, resolvedTheme);

      const storedScale = localStorage.getItem(UI_SCALE_STORAGE_KEY) as UiScale | null;
      if (storedScale === "compact" || storedScale === "default" || storedScale === "relaxed") {
        setUiScaleState(storedScale);
        applyScale(storedScale);
      } else {
        applyScale(DEFAULT_UI_SCALE);
      }
    } catch {
      applyTheme(DEFAULT_THEME);
      applyAccentVariables(DEFAULT_DARK_ACCENT, DEFAULT_THEME);
      applyScale(DEFAULT_UI_SCALE);
    }
  }, [applyAccentVariables, applyScale, applyTheme]);

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    const nextAccent = nextTheme === "light" ? lightAccentColor : darkAccentColor;
    applyAccentVariables(nextAccent, nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore
    }
  };

  const setDarkAccentColor = (nextColor: string) => {
    setDarkAccentState(nextColor);
    if (theme === "dark") {
      applyAccentVariables(nextColor, "dark");
    }
    try {
      localStorage.setItem(DARK_ACCENT_STORAGE_KEY, nextColor);
      localStorage.setItem(LEGACY_ACCENT_STORAGE_KEY, nextColor);
    } catch {
      // ignore
    }
  };

  const setLightAccentColor = (nextColor: string) => {
    setLightAccentState(nextColor);
    if (theme === "light") {
      applyAccentVariables(nextColor, "light");
    }
    try {
      localStorage.setItem(LIGHT_ACCENT_STORAGE_KEY, nextColor);
    } catch {
      // ignore
    }
  };

  const setAccentColor = (nextColor: string) => {
    if (theme === "light") {
      setLightAccentColor(nextColor);
    } else {
      setDarkAccentColor(nextColor);
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
    setDarkAccentState(DEFAULT_DARK_ACCENT);
    setLightAccentState(DEFAULT_LIGHT_ACCENT);
    try {
      localStorage.setItem(DARK_ACCENT_STORAGE_KEY, DEFAULT_DARK_ACCENT);
      localStorage.setItem(LIGHT_ACCENT_STORAGE_KEY, DEFAULT_LIGHT_ACCENT);
      localStorage.setItem(LEGACY_ACCENT_STORAGE_KEY, DEFAULT_DARK_ACCENT);
    } catch {
      // ignore
    }
    applyAccentVariables(theme === "light" ? DEFAULT_LIGHT_ACCENT : DEFAULT_DARK_ACCENT, theme);
  };

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        setTheme,
        accentColor: activeAccent,
        setAccentColor,
        darkAccentColor,
        setDarkAccentColor,
        lightAccentColor,
        setLightAccentColor,
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
      accentColor: DEFAULT_DARK_ACCENT,
      setAccentColor: () => {},
      darkAccentColor: DEFAULT_DARK_ACCENT,
      setDarkAccentColor: () => {},
      lightAccentColor: DEFAULT_LIGHT_ACCENT,
      setLightAccentColor: () => {},
      uiScale: DEFAULT_UI_SCALE,
      setUiScale: () => {},
      resetAppearance: () => {},
    };
  }
  return ctx;
}
