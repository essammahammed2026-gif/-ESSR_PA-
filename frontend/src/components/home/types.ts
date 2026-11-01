"use client";

export interface StudioOption {
  studio: string;
  name: string;
  badge: string;
  reason: string;
  primary: boolean;
}

export interface PageGroup {
  pages: string;
  dimensions: string;
  standard_name: string;
  count: number;
}

export interface LowDpiImage {
  page: number;
  dpi: number;
  dimensions: string;
  status: string;
}

export interface PrepressReport {
  overall_status: "pass" | "warning";
  summary: {
    page_count: number;
    primary_size: string;
    color_profile: string;
    total_images: number;
    low_dpi_count: number;
    has_bleed: boolean;
    bleed_mm: number;
  };
  checks: {
    geometry: {
      status: "pass" | "warning";
      is_uniform: boolean;
      page_groups: PageGroup[];
      details: string;
    };
    dpi: {
      status: "pass" | "warning";
      total_images: number;
      low_dpi_count: number;
      low_dpi_pages: number[];
      low_dpi_images: LowDpiImage[];
      details: string;
    };
    bleed: {
      status: "pass" | "warning";
      has_bleed: boolean;
      bleed_mm: number;
      pages_missing_bleed: number[];
      details: string;
    };
    colorspace: {
      status: "pass" | "warning";
      primary: string;
      has_rgb: boolean;
      rgb_pages: number[];
      spot_colors: string[];
      details: string;
    };
  };
}

export interface UniversalAnalysis {
  filename: string;
  extension: string;
  size_bytes: number;
  page_count: number;
  width_mm: number;
  height_mm: number;
  aspect_ratio: number;
  color_space: string;
  has_transparency: boolean;
  is_multi_page: boolean;
  suggested_studios: StudioOption[];
  warnings: string[];
  thumbnail_url?: string;
  file_id: string;
  file_path: string;
  report?: PrepressReport;
}

// Database-backed dashboard models

export interface CustomTag {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export type TagDisplayMode = "both" | "icon" | "name";

export type ProjectTag = string;

export interface SessionNote {
  id: string;
  text: string;
  created_at: number;
  updated_at: number;
}

export type DateFilterPreset = "all" | "today" | "week" | "month" | "custom";

export interface SessionSummary {
  id: string;
  studio_type: string;
  title: string;
  original_filename?: string;
  tag: ProjectTag;
  status: "active" | "archived" | "completed" | "trash";
  trash_reason?: "deleted" | "file_not_found" | string | null;
  session_dir?: string;
  intake_mode?: string;
  notes?: string;
  total_pages: number;
  width_mm: number;
  height_mm: number;
  file_size?: number;
  file_size_bytes?: number;
  created_at: number;
  updated_at: number;
  thumbnail_url?: string | null;
  lock?: {
    workstation_id: string;
    operator_name: string;
    lease_expires_at: number;
    is_locked: boolean;
    remaining_seconds: number;
  } | null;
}

export interface UploadedAsset {
  file_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  page_count: number;
  width_mm: number;
  height_mm: number;
  uploaded_at: number;
}

export interface ExportJobSummary {
  jobId: string;
  session_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: string;
  progress: number;
  message: string;
  currentPage: number;
  totalPages: number;
  filename?: string | null;
  outputFilePath?: string | null;
  fileSizeBytes?: number | null;
  error?: string | null;
  created_at: number;
  updated_at: number;
}

export interface WorkshopTelemetry {
  total_active_sessions: number;
  total_archived_sessions: number;
  sessions_by_studio: Record<string, number>;
  processing_exports: number;
  total_exports: number;
  storage: {
    root: string;
    originals?: { bytes: number; files: number };
    sessions: { bytes: number; files: number };
    cache: { bytes: number; files: number };
    exports: { bytes: number; files: number };
    total_bytes: number;
  };
}

export interface StorageSettingsConfig {
  export_retention_days: number;
  auto_clean_temp_hours: number;
}
