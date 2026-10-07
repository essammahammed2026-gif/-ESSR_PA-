/**
 * Strictly typed definitions for Prepress API payloads and responses.
 * Enforces consistency across Tauri webview, Next.js UI, and FastAPI backend.
 */

export type PrepressUnit = "mm" | "cm" | "in" | "pt";

export type FitMode = "stretch" | "fit" | "crop";

export type PageRotation = "none" | "cw" | "ccw";

export type BleedMode = "none" | "solid" | "mirror";

export type BleedType = "inside" | "outside";

export type ImpositionWorkflowMode = "book" | "gang";

export type SheetOrientation = "portrait" | "landscape";

/**
 * Item specification sent to backend imposition endpoints (/api/imposing/preview, /api/imposing/export)
 */
export interface ImposingItem {
  file_id: string;
  name: string;
  w: number;
  h: number;
  copies: number;
  ratio?: number;
  locked?: boolean;
  keep_aspect?: boolean;
  fill_color?: string;
  original_w?: number;
  original_h?: number;
  page_count?: number;
  page_range?: string;
  is_book?: boolean;
  page_num?: number;
  fit_mode?: FitMode;
  page_rotation?: PageRotation;
  bleed_mode?: BleedMode;
  bleed_mm?: number;
  bleed_color?: string;
  bleed_type?: BleedType;
}

/**
 * Individual page specification for fine-grained page-level imposition
 */
export interface ImposingPage {
  id: string;
  file_id: string;
  name?: string;
  original_page_num: number;
  display_page_num?: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  is_deleted: boolean;
  thumb_url: string;
}

/**
 * Metadata for a single page returned by upload and inspect endpoints
 */
export interface ImposingPageMeta {
  page_num: number;
  width_mm: number;
  height_mm: number;
  aspect_ratio?: number;
  thumb_url: string;
}

/**
 * Response returned from /api/imposing/upload and /api/imposing/pages/{file_id}
 */
export interface ImposingUploadResponse {
  success: boolean;
  file_id: string;
  name: string;
  w: number;
  h: number;
  page_count: number;
  is_book: boolean;
  thumb: string;
  pages: ImposingPageMeta[];
}

/**
 * Prepress margin and gutter parameters
 */
export interface PrepressMargins {
  margin_top: number;
  margin_bottom: number;
  margin_left: number;
  margin_right: number;
  gap_x: number;
  gap_y: number;
}

/**
 * Sheet geometry and layout specifications
 */
export interface SheetGeometrySpec extends PrepressMargins {
  mode: "sheet" | "roll";
  sheet_w: number;
  sheet_h: number;
  roll_w?: number;
  allow_rotation: boolean;
  align_vertical?: "top" | "center" | "bottom";
  align_horizontal?: "left" | "center" | "right";
  show_crop_marks?: boolean;
  crop_mark_length_mm?: number;
  crop_mark_offset_mm?: number;
  stroke_width_pt?: number;
}

/**
 * Imposed placed box within a press sheet
 */
export interface PlacedPreviewBox {
  x: number;
  y: number;
  w: number;
  h: number;
  thumb?: string;
  rotated?: boolean;
  keep_aspect?: boolean;
  fill_color?: string;
  file_id?: string;
  page_num?: number;
  page_label?: string;
  fit_mode?: FitMode;
  page_rotation?: PageRotation;
  bleed_mode?: BleedMode;
  bleed_mm?: number;
  bleed_color?: string;
  bleed_type?: BleedType;
}

/**
 * Rendered preview press sheet containing nested boxes
 */
export interface PlacedPreviewSheet {
  w: number;
  h: number;
  boxes: PlacedPreviewBox[];
}

/**
 * Statistical summary of layout efficiency and sheet usage
 */
export interface ImpositionStats {
  pages: number;
  total_length_m?: number;
  avg_efficiency: number;
}

/**
 * Response payload from imposition preview calculation
 */
export interface ImpositionPreviewResponse {
  success: boolean;
  error?: string;
  preview_pages: PlacedPreviewSheet[];
  stats: ImpositionStats;
}

/**
 * Technical asset preflight & inspection metrics
 */
export interface UniversalAssetInspection {
  file_id: string;
  file_name: string;
  file_ext: string;
  file_size_bytes: number;
  is_pdf: boolean;
  page_count: number;
  width_mm: number;
  height_mm: number;
  aspect_ratio: number;
  color_space: string;
  has_alpha: boolean;
  embedded_images_count: number;
  preview_url: string;
  recommendations: {
    target_studio: "imposing" | "contour" | "book-studio" | "flipbook" | "preflight";
    reason: string;
  }[];
}
