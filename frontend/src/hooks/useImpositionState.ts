import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";
import { ImposingItem, ImposingPage } from "@/types/prepress";

export function useImpositionState() {
  const [jobMode, setJobMode] = useState<"book" | "gang">("book");
  const [selectedBookIdx, setSelectedBookIdx] = useState(0);
  const [items, setItems] = useState<ImposingItem[]>([]);
  const [pages, setPages] = useState<ImposingPage[]>([]);
  const [mode, setMode] = useState<"Sheet" | "Roll">("Sheet");
  const [unit, setUnit] = useState("mm");
  
  const [sheetW, setSheetW] = useState(320);
  const [sheetH, setSheetH] = useState(450);
  const [sheetPreset, setSheetPreset] = useState("320,450");
  
  const [margin, setMargin] = useState(10.0);
  const [gap, setGap] = useState(5.0);
  const [drawBorder, setDrawBorder] = useState(false);
  const [borderColor, setBorderColor] = useState("#000000");
  const [cropMarks, setCropMarks] = useState(true);
  const [regMarks, setRegMarks] = useState(false);
  const [rows, setRows] = useState<number | null>(null);
  const [cols, setCols] = useState<number | null>(null);
  const [align, setAlign] = useState("Center");
  const [autoRotateSheet, setAutoRotateSheet] = useState(true);
  const [uniformOrientation, setUniformOrientation] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [dbSheets, setDbSheets] = useState<{name: string; width: number; height: number}[]>([]);
  const [dbRolls, setDbRolls] = useState<{name: string; width: number}[]>([]);

  const reorderPages = useCallback((fromIndex: number, toIndex: number) => {
    setPages((prev) => {
      if (fromIndex < 0 || fromIndex >= prev.length || toIndex < 0 || toIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const rotatePage = useCallback((id: string, dir: "cw" | "ccw") => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const delta = dir === "cw" ? 90 : -90;
        const newRot = ((p.rotation + delta + 360) % 360) as 0 | 90 | 180 | 270;
        return { ...p, rotation: newRot };
      })
    );
  }, []);

  const toggleDeletePage = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        return { ...p, is_deleted: !p.is_deleted };
      })
    );
  }, []);

  const duplicatePage = useCallback((id: string) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const target = prev[idx];
      const clone: ImposingPage = {
        ...target,
        id: `${target.file_id}_copy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        display_page_num: (target.display_page_num || target.original_page_num + 1),
      };
      const copy = [...prev];
      copy.splice(idx + 1, 0, clone);
      return copy;
    });
  }, []);

  const clearAllPages = useCallback(() => {
    setPages([]);
    setItems([]);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/settings`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sheets) {
          setDbSheets(data.sheets);
          setSheetW(prev => prev > 0 ? prev : (data.sheets[0]?.width || 320));
          setSheetH(prev => prev > 0 ? prev : (data.sheets[0]?.height || 450));
          setSheetPreset(prev => prev ? prev : (data.sheets[0] ? `${data.sheets[0].width},${data.sheets[0].height}` : "320,450"));
        }
        if (data.rolls) setDbRolls(data.rolls);
        if (data.imposing) {
          if (data.imposing.default_sheet_unit) setUnit(data.imposing.default_sheet_unit);
          if (data.imposing.default_margin !== undefined) setMargin(data.imposing.default_margin);
          if (data.imposing.default_gap !== undefined) setGap(data.imposing.default_gap);
          if (data.imposing.crop_marks !== undefined) setCropMarks(data.imposing.crop_marks);
          if (data.imposing.draw_border !== undefined) setDrawBorder(data.imposing.draw_border);
          if (data.imposing.auto_rotate_sheet !== undefined) setAutoRotateSheet(data.imposing.auto_rotate_sheet);
          if (data.imposing.uniform_orientation !== undefined) setUniformOrientation(data.imposing.uniform_orientation);
        }
      })
      .catch(() => {});
  }, []);

  return {
    jobMode, setJobMode,
    selectedBookIdx, setSelectedBookIdx,
    items, setItems,
    pages, setPages,
    reorderPages,
    rotatePage,
    toggleDeletePage,
    duplicatePage,
    clearAllPages,
    mode, setMode,
    unit, setUnit,
    sheetW, setSheetW,
    sheetH, setSheetH,
    sheetPreset, setSheetPreset,
    margin, setMargin,
    gap, setGap,
    drawBorder, setDrawBorder,
    borderColor, setBorderColor,
    cropMarks, setCropMarks,
    regMarks, setRegMarks,
    rows, setRows,
    cols, setCols,
    align, setAlign,
    autoRotateSheet, setAutoRotateSheet,
    uniformOrientation, setUniformOrientation,
    showAdvanced, setShowAdvanced,
    dbSheets, dbRolls
  };
}
