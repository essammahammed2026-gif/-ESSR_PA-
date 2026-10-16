"use client";

export type LengthUnit = "mm" | "cm" | "pixels" | "inches";

export interface UnitOption {
  value: LengthUnit;
  label: string;
  suffix: string;
  short: string;
}

export const UNIT_OPTIONS: UnitOption[] = [
  { value: "mm", label: "mm", suffix: "mm", short: "mm" },
  { value: "cm", label: "cm", suffix: "cm", short: "cm" },
  { value: "pixels", label: "pixels", suffix: "px", short: "px" },
  { value: "inches", label: "inches", suffix: "in", short: "in" },
];

const MM_PER_INCH = 25.4;
const PX_PER_INCH = 96; // Standard CSS screen pixels (96 DPI)

/**
 * Converts a value in millimeters to the target unit.
 */
export function mmToUnit(valMm: number, unit: LengthUnit | string): number {
  if (!Number.isFinite(valMm)) return 0;
  switch (unit) {
    case "cm":
      return Math.round((valMm / 10) * 100) / 100;
    case "in":
    case "inches":
      return Math.round((valMm / MM_PER_INCH) * 1000) / 1000;
    case "px":
    case "pixels":
      return Math.round((valMm / MM_PER_INCH) * PX_PER_INCH * 10) / 10;
    case "mm":
    default:
      return Math.round(valMm * 10) / 10;
  }
}

/**
 * Converts a value in the target unit back to millimeters.
 */
export function unitToMm(valInUnit: number, unit: LengthUnit | string): number {
  if (!Number.isFinite(valInUnit)) return 0;
  switch (unit) {
    case "cm":
      return valInUnit * 10;
    case "in":
    case "inches":
      return valInUnit * MM_PER_INCH;
    case "px":
    case "pixels":
      return (valInUnit / PX_PER_INCH) * MM_PER_INCH;
    case "mm":
    default:
      return valInUnit;
  }
}

/**
 * Formats a value in millimeters into a readable string with unit suffix.
 */
export function formatMmInUnit(valMm: number, unit: LengthUnit | string): string {
  const converted = mmToUnit(valMm, unit);
  const opt = UNIT_OPTIONS.find((o) => o.value === unit);
  return `${converted} ${opt?.label ?? unit}`;
}

const STORAGE_KEY = "essr_selected_unit";

export function getStoredUnit(defaultUnit: LengthUnit = "mm"): LengthUnit {
  if (typeof window === "undefined") return defaultUnit;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as LengthUnit | null;
    if (stored && ["mm", "cm", "pixels", "inches"].includes(stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return defaultUnit;
}

export function setStoredUnit(unit: LengthUnit): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // ignore
  }
}
