/**
 * Strictly typed definitions for Book Studio state, intake presets, and processing options.
 */

export type BookIntakeMode = "single_page" | "spread" | "dual_pass";
export type MultiFileStrategy = "duplex" | "sequential";

export interface CropBox {
  x1: number; // 0.0 to 1.0 (relative left)
  y1: number; // 0.0 to 1.0 (relative top)
  x2: number; // 0.0 to 1.0 (relative right)
  y2: number; // 0.0 to 1.0 (relative bottom)
}

export type SplitDirection = "vertical" | "horizontal";

/** A single cut line: position (0–1, relative to the crop box) + cut axis. */
export interface SplitLine {
  pos: number;
  direction: SplitDirection;
}

/**
 * Shared base page for all studio decks (fix.md Phase 2.6).
 * Both BookStudioPage and ImposingPage (see types/prepress.ts) extend this.
 */
export interface BasePage {
  id: string;
  rotation: number;
  thumb_url?: string;
  is_deleted?: boolean;
}

export interface BookStudioPage extends BasePage {
  source: string;
  doc_idx: number;
  half: "full" | "left" | "right" | string;
  split_pos: number;
  slice_box?: CropBox;
  split_direction?: "vertical" | "horizontal";
  split_lines?: number[];
  label: string;
  crop_box?: CropBox;
  spread_crop_box?: CropBox;
  page_crop_box?: CropBox;
  is_spread?: boolean;
  parent_page_id?: string;
  immediate_parent_id?: string;
  parent_spread_width_mm?: number;
  parent_spread_height_mm?: number;
  width_mm?: number;
  height_mm?: number;
  orig_width_mm?: number;
  orig_height_mm?: number;
  color_space?: string;
  dpi?: number;
  rev?: number; // mutation counter: busts cached thumbnails after in-place crop/rotate
}

export interface CropModuleConfig {
  enabled: boolean;
  splitLines: SplitLine[]; // empty = crop only; each line has its own cut axis
  cropBox: CropBox;
  splitPos: number; // legacy mirror of splitLines[0]?.pos (default 0.50)
  target: CropTarget;
}

export type CropTargetBase = "all" | "current" | "range";
export type CropParity = "both" | "odds" | "evens";

/** Which pages a crop/split action applies to. Default: all pages, both parities. */
export interface CropTarget {
  base: CropTargetBase;
  customRange: string;
  parity: CropParity;
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
  gridColor: string;
  scope: ModulePageScope;
}

export interface BleedEntry {
  id: string;
  bleedMm: number;
  mode: "mirror" | "solid";
  solidColor?: string;
  placement: "outside" | "inside";
  showCropMarks: boolean;
}

export interface BleedModuleConfig {
  enabled: boolean;
  bleedMm: number;
  mode: "mirror" | "solid";
  solidColor: string;
  placement: "outside" | "inside";
  showCropMarks: boolean;
  exportDpi: number;
  scope: ModulePageScope;
  appliedBleeds: BleedEntry[];
}

export type CleanupColorMode = "color" | "grayscale" | "bw";

export interface RestorationModuleConfig {
  enabled: boolean;
  cleanBorders: boolean;
  borderMarginPx: number;
  borderThreshold: number;
  enhanceColors: boolean;
  saturation: number;
  contrast: number;
  colorMode: CleanupColorMode;
  bwThreshold: number;
  whitenBg: boolean;
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

/** Options for backend deskew-angle detection. */
export interface DetectAngleOpts {
  maxAngle: number;
  ignoreBorders: boolean;
}

/** Result payload from the backend crop/spine detection endpoint. */
export interface DetectCropResult {
  crop_box: CropBox;
  split_pos: number;
  confidence: number;
}

/** Module-derived render options for the thumbnail URL builder. */
export interface ThumbnailRenderOpts {
  deskewEnabled: boolean;
  deskewScope: ModulePageScope;
  deskewMode: string;
  deskewAngle: number;
  deskewMaxAngle: number;
  deskewIgnoreBorders: boolean;
  restorationEnabled: boolean;
  restorationScope: ModulePageScope;
  cleanBorders: boolean;
  borderMarginPx: number;
  borderThreshold: number;
  enhanceColors: boolean;
  saturation: number;
  contrast: number;
  colorMode: CleanupColorMode;
  bwThreshold: number;
  whitenBg: boolean;
  bleedEnabled: boolean;
  bleedScope: ModulePageScope;
  bleedMm: number;
  bleedMode: "mirror" | "solid";
  bleedColor: string;
  bleedPlacement: "outside" | "inside";
  showCropMarks: boolean;
}

export interface ExportJobProgress {
  jobId: string | null;
  status: "idle" | "pending" | "processing" | "success" | "failed";
  progress: number;
  stage: string;
  message: string;
  totalPages: number;
  currentPage: number;
  fileSizeBytes: number | null;
  error: string | null;
}
