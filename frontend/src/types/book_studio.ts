/**
 * Strictly typed definitions for Book Studio state, intake presets, and processing options.
 */

export type BookIntakeMode = "single_page" | "spread" | "dual_pass" | "digital";

export interface BookStudioPage {
  id: string;
  source: string;
  doc_idx: number;
  half: "full" | "left" | "right" | string;
  split_pos: number;
  rotation: number;
  label: string;
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
}
