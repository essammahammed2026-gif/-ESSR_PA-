"use client";

export interface Sheet {
  name: string;
  width: number;
  height: number;
  unit: string;
}

export interface Roll {
  name: string;
  width: number;
  unit: string;
}

export interface BookTrim {
  name: string;
  width: number;
  height: number;
  unit: string;
}

export interface AppSettingsData {
  sheets: Sheet[];
  rolls: Roll[];
  book_trims?: BookTrim[];
  imposing: {
    default_sheet_unit: string;
    default_margin: number;
    default_gap: number;
    default_bleed: number;
    crop_marks: boolean;
    draw_border: boolean;
    auto_rotate_sheet: boolean;
    uniform_orientation: boolean;
  };
  contour: {
    default_dpi: number;
    default_threshold: number;
    default_offset: number;
    default_stroke_color: string;
    default_stroke_width: number;
    default_smoothing: number;
    keep_holes: boolean;
  };
  flipbook: {
    default_dpi: number;
    default_direction: string;
    default_binding: string;
    default_texture: string;
    sound_enabled: boolean;
    eco_mode: boolean;
  };
  book_studio: {
    history_limit: number;
    shortcuts: Record<string, string>;
  };
}

export type SettingsTab = "general" | "sheets" | "imposing" | "contour" | "flipbook" | "shortcuts" | "storage" | "appearance";

export interface StorageItem {
  key: string;
  label: string;
  description: string;
  path: string;
  display_path: string;
  category: "cache" | "scratch" | "build" | "deliverables" | "user_data" | "backups" | "runtime";
  safety_level: "safe" | "build" | "deliverables" | "protected";
  size_bytes: number;
  size_human: string;
  count: number;
}

export interface StorageCategoryStats {
  count: number;
  size_bytes: number;
  size_human: string;
}

export interface StorageBreakdown {
  uploaded: StorageCategoryStats;
  archived: StorageCategoryStats;
  pending: StorageCategoryStats;
  in_progress: StorageCategoryStats;
  trash: StorageCategoryStats;
  cache: StorageCategoryStats;
  build: StorageCategoryStats;
}

export interface StorageStatus {
  items: StorageItem[];
  total_bytes: number;
  total_human: string;
  safe_cleanable_bytes: number;
  safe_cleanable_human: string;
  build_cleanable_bytes: number;
  build_cleanable_human: string;
  total_runtime_bytes: number;
  total_runtime_human: string;
  trash_count: number;
  breakdown?: StorageBreakdown;
}

export const DEFAULT_SETTINGS: AppSettingsData = {
  sheets: [],
  rolls: [],
  book_trims: [
    { name: "A4", width: 210.0, height: 297.0, unit: "mm" },
    { name: "A5", width: 148.0, height: 210.0, unit: "mm" },
    { name: "B5 (JIS)", width: 182.0, height: 257.0, unit: "mm" },
    { name: "US Trade (6\" × 9\")", width: 152.4, height: 228.6, unit: "mm" },
    { name: "US Digest (5.5\" × 8.5\")", width: 139.7, height: 215.9, unit: "mm" },
    { name: "Pocket Book (4.25\" × 6.87\")", width: 108.0, height: 174.5, unit: "mm" },
    { name: "Royal (6.14\" × 9.21\")", width: 156.0, height: 234.0, unit: "mm" },
    { name: "Square Large (8.25\" × 8.25\")", width: 210.0, height: 210.0, unit: "mm" },
  ],
  imposing: {
    default_sheet_unit: "mm",
    default_margin: 10,
    default_gap: 5,
    default_bleed: 2,
    crop_marks: false,
    draw_border: false,
    auto_rotate_sheet: true,
    uniform_orientation: true,
  },
  contour: {
    default_dpi: 300,
    default_threshold: 20,
    default_offset: 0,
    default_stroke_color: "#FF00FF",
    default_stroke_width: 1.0,
    default_smoothing: 2.0,
    keep_holes: false,
  },
  flipbook: {
    default_dpi: 101,
    default_direction: "Left to Right (LTR)",
    default_binding: "Soft Cover (Paperback)",
    default_texture: "Dark Mode",
    sound_enabled: false,
    eco_mode: false,
  },
  book_studio: {
    history_limit: 50,
    shortcuts: {
      undo: "ctrl+z",
      redo: "ctrl+y",
      restore_original: "ctrl+shift+r",
      prev_page: "[",
      next_page: "]",
      toggle_original: "o",
      rotate: "r",
      zoom_in: "=",
      zoom_out: "-",
      zoom_reset: "ctrl+0",
      pan: "h",
    },
  },
};
