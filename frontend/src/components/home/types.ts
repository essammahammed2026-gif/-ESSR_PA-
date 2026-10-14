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
