"use client";

import { getApiUrl } from "@/lib/api";
import type {
  BleedMode,
  BleedType,
  FitMode,
  PlacedPreviewBox,
  PlacedPreviewSheet,
} from "@/types/prepress";

export interface SheetCanvasPosition {
  x: number;
  y: number;
}

export interface SheetCanvasProps {
  sheet: PlacedPreviewSheet;
  margin: number;
  drawBorder: boolean;
  borderColor: string;
  cropMarks: boolean;
  regMarks: boolean;
  showPageOverlay: boolean;
  scale: number;
  position: SheetCanvasPosition;
  isDragging: boolean;
}

interface BoxLayout {
  hasBleed: boolean;
  bleedMm: number;
  isOutsideBleed: boolean;
  contentW: number;
  contentH: number;
  totalDeg: number;
  isSwapped: boolean;
  thumbUrl: string;
  markOffset: number;
  markW: number;
  markH: number;
}

function resolveBoxLayout(box: PlacedPreviewBox): BoxLayout {
  const hasBleed: boolean =
    box.bleed_mode !== undefined && box.bleed_mode !== "none" && (box.bleed_mm ?? 0) > 0;
  const bleedMm: number = hasBleed ? (box.bleed_mm ?? 0) : 0;
  const isOutsideBleed: boolean = box.bleed_type === "outside";
  const contentW: number = hasBleed ? Math.max(1, box.w - bleedMm * 2) : box.w;
  const contentH: number = hasBleed ? Math.max(1, box.h - bleedMm * 2) : box.h;

  const packerDeg: number = box.rotated ? 90 : 0;
  const userDeg: number =
    box.page_rotation === "cw" ? 90 : box.page_rotation === "ccw" ? 270 : 0;
  const totalDeg: number = (packerDeg + userDeg) % 360;
  const isSwapped: boolean = totalDeg === 90 || totalDeg === 270;

  const thumbUrl: string = box.thumb
    ? getApiUrl(box.thumb.startsWith("/") ? box.thumb : `/temp_uploads/${box.thumb}`)
    : "";

  const markOffset: number = hasBleed && isOutsideBleed ? bleedMm : 0;
  const markW: number = box.w - markOffset * 2;
  const markH: number = box.h - markOffset * 2;

  return {
    hasBleed,
    bleedMm,
    isOutsideBleed,
    contentW,
    contentH,
    totalDeg,
    isSwapped,
    thumbUrl,
    markOffset,
    markW,
    markH,
  };
}

function getObjectFitClass(fitMode: FitMode | undefined): string {
  if (fitMode === "fit") return "object-contain";
  if (fitMode === "crop") return "object-cover";
  return "object-fill";
}

function getOuterBackground(box: PlacedPreviewBox, bleedMm: number): string {
  if (box.bleed_mode === "solid" && bleedMm > 0) return box.bleed_color || "#FFFFFF";
  if (box.fit_mode === "fit") return box.fill_color ?? "#ffffff";
  return "#f8fafc";
}

const REG_CORNERS: string[] = [
  "top-1.5 left-1.5",
  "top-1.5 right-1.5",
  "bottom-1.5 left-1.5",
  "bottom-1.5 right-1.5",
];

function RegCornerMarks(): React.JSX.Element {
  return (
    <>
      {REG_CORNERS.map((pos) => (
        <div
          key={pos}
          className={`absolute ${pos} w-3.5 h-3.5 pointer-events-none flex items-center justify-center`}
        >
          <div className="absolute w-2.5 h-2.5 rounded-full border border-black" />
          <div className="absolute w-3.5 h-[1px] bg-black" />
          <div className="absolute w-[1px] h-3.5 bg-black" />
        </div>
      ))}
    </>
  );
}

interface CropMarkOverlayProps {
  markOffset: number;
  markW: number;
  markH: number;
}

function CropMarkOverlay({ markOffset, markW, markH }: CropMarkOverlayProps): React.JSX.Element {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${markOffset}px`, top: `${markOffset}px`, width: `${markW}px`, height: `${markH}px` }}
    >
      <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", left: "-6px", top: "0" }} />
      <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", left: "0", top: "-6px" }} />
      <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", right: "-6px", top: "0" }} />
      <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", right: "0", top: "-6px" }} />
      <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", left: "-6px", bottom: "0" }} />
      <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", left: "0", bottom: "-6px" }} />
      <div className="absolute bg-slate-600" style={{ width: "5px", height: "1px", right: "-6px", bottom: "0" }} />
      <div className="absolute bg-slate-600" style={{ width: "1px", height: "5px", right: "0", bottom: "-6px" }} />
    </div>
  );
}

interface ImposedBoxProps {
  box: PlacedPreviewBox;
  drawBorder: boolean;
  borderColor: string;
  cropMarks: boolean;
  showPageOverlay: boolean;
}

function ImposedBox({ box, drawBorder, borderColor, cropMarks, showPageOverlay }: ImposedBoxProps): React.JSX.Element {
  const layout = resolveBoxLayout(box);
  const bleedMode: BleedMode | undefined = box.bleed_mode;
  const bleedType: BleedType | undefined = box.bleed_type;
  const fitMode: FitMode | undefined = box.fit_mode;
  const fillColor: string | undefined = box.fill_color;
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` }}
    >
      {cropMarks && (
        <CropMarkOverlay markOffset={layout.markOffset} markW={layout.markW} markH={layout.markH} />
      )}
      <div
        className={`absolute inset-0 shadow-sm flex items-center justify-center overflow-hidden pointer-events-auto ${fitMode === "fit" ? "" : "bg-slate-100"}`}
        style={{
          border: drawBorder ? `1px solid ${borderColor}` : "1px solid #cbd5e1",
          backgroundColor: getOuterBackground(box, layout.bleedMm),
          backgroundImage:
            bleedMode === "solid" && layout.bleedMm > 0
              ? `repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(16, 185, 129, 0.12) 3px, rgba(16, 185, 129, 0.12) 6px)`
              : undefined,
        }}
      >
        {bleedMode === "mirror" && layout.bleedMm > 0 && layout.thumbUrl && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={layout.thumbUrl}
              alt="bleed-mirror"
              className="absolute inset-0 w-full h-full object-cover filter blur-[0.5px]"
              style={{ transform: `rotate(${layout.totalDeg}deg) scale(1.08)` }}
            />
            <div className="absolute inset-0 bg-black/10 backdrop-brightness-95" />
          </div>
        )}
        <div
          className="relative flex items-center justify-center overflow-hidden z-[1]"
          style={{
            width: `${layout.contentW}px`,
            height: `${layout.contentH}px`,
            outline: layout.hasBleed
              ? bleedType === "outside"
                ? "1px dashed rgba(16, 185, 129, 0.95)"
                : "1px dashed rgba(245, 158, 11, 0.9)"
              : "none",
            backgroundColor: fitMode === "fit" ? fillColor || "#ffffff" : "#ffffff",
          }}
        >
          {layout.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={layout.thumbUrl}
              loading="lazy"
              decoding="async"
              className={getObjectFitClass(fitMode)}
              style={{
                width: layout.isSwapped ? `${layout.contentH}px` : "100%",
                height: layout.isSwapped ? `${layout.contentW}px` : "100%",
                transform: `rotate(${layout.totalDeg}deg)`,
              }}
              alt="thumb"
            />
          ) : (
            <span className="text-[8px] text-emerald-700 font-medium rotate-45 opacity-60">Item</span>
          )}
        </div>
        {showPageOverlay && (
          <>
            {(box.page_label || (box.page_num !== undefined && box.page_num > 0)) && (
              <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/60 text-emerald-300 text-[7px] font-mono font-medium rounded-xs pointer-events-none z-[2]">
                {box.page_label || `P.${box.page_num! + 1}`}
              </span>
            )}
            {layout.hasBleed && (
              <span className="absolute top-0.5 left-0.5 px-1 py-0.2 bg-emerald-950/80 text-emerald-300 text-[7px] font-mono rounded-xs pointer-events-none border border-emerald-700/50 z-[2]">
                +{layout.bleedMm}mm
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function SheetCanvas({
  sheet,
  margin,
  drawBorder,
  borderColor,
  cropMarks,
  regMarks,
  showPageOverlay,
  scale,
  position,
  isDragging,
}: SheetCanvasProps): React.JSX.Element {
  return (
    <div
      className="bg-white shadow-2xl relative"
      style={{
        width: `${sheet.w}px`,
        height: `${sheet.h}px`,
        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
        transformOrigin: "center center",
        transition: isDragging ? "none" : "transform 0.05s ease-out",
      }}
    >
      <div
        className="absolute border border-dashed border-red-400/60 pointer-events-none"
        style={{ top: `${margin}px`, left: `${margin}px`, right: `${margin}px`, bottom: `${margin}px` }}
      />
      {regMarks && <RegCornerMarks />}
      {sheet.boxes.map((box, i) => (
        <ImposedBox
          key={i}
          box={box}
          drawBorder={drawBorder}
          borderColor={borderColor}
          cropMarks={cropMarks}
          showPageOverlay={showPageOverlay}
        />
      ))}
    </div>
  );
}
