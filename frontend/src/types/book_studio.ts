/**
 * Strictly typed definitions for Book Studio state, intake presets, and processing options.
 */

export type BookIntakeMode = "single_page" | "spread" | "dual_pass" | "digital";

export interface CropBox {
  x1: number; // 0.0 to 1.0 (relative left)
  y1: number; // 0.0 to 1.0 (relative top)
  x2: number; // 0.0 to 1.0 (relative right)
  y2: number; // 0.0 to 1.0 (relative bottom)
}

export interface BookStudioPage {
  id: string;
  source: string;
  doc_idx: number;
  half: "full" | "left" | "right" | string;
  split_pos: number;
  rotation: number;
  label: string;
  crop_box?: CropBox;
  spread_crop_box?: CropBox;
  page_crop_box?: CropBox;
  is_spread?: boolean;
  parent_page_id?: string;
  parent_spread_width_mm?: number;
  parent_spread_height_mm?: number;
  width_mm?: number;
  height_mm?: number;
  orig_width_mm?: number;
  orig_height_mm?: number;
}

export interface CropModuleConfig {
  enabled: boolean;
  mode: "spread" | "single";
  cropBox: CropBox;
  splitPos: number; // 0.0 to 1.0 relative to cropBox (default 0.50)
  scope: ModulePageScope;
}

export type ModulePageScopeMode = "all" | "range" | "odds" | "evens";

export interface ModulePageScope {
  mode: ModulePageScopeMode;
  customRange: string;
}

export interface DeskewModuleConfig {
  enabled: boolean;
  mode: "auto" | "manual";
  angle: number;
  maxAngle: number;
  ignoreBorders: boolean;
  showGrid: boolean;
  scope: ModulePageScope;
}

export interface BleedModuleConfig {
  enabled: boolean;
  bleedMm: number;
  showCropMarks: boolean;
  exportDpi: number;
  scope: ModulePageScope;
}

export interface RestorationModuleConfig {
  enabled: boolean;
  cleanBorders: boolean;
  borderMarginPx: number;
  borderThreshold: number;
  enhanceColors: boolean;
  saturation: number;
  contrast: number;
  sharpen: boolean;
  scope: ModulePageScope;
}

export interface BookProcessSettings {
  bleedMm: number;
  showCropMarks: boolean;
  exportDpi: number;
  cleanBorders: boolean;
  borderMarginPx: number;
  borderThreshold: number;
  enhanceColors: boolean;
  saturation: number;
  contrast: number;
  deskew: boolean;
  sharpen: boolean;
  deskewModule?: DeskewModuleConfig;
  bleedModule?: BleedModuleConfig;
  restorationModule?: RestorationModuleConfig;
}
