import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { ImposingItem } from "@/types/prepress";

export function useImpositionState() {
  const [jobMode, setJobMode] = useState<"book" | "gang">("book");
  const [selectedBookIdx, setSelectedBookIdx] = useState(0);
  const [items, setItems] = useState<ImposingItem[]>([]);
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
  const [align, setAlign] = useState("Center");
  const [autoRotateSheet, setAutoRotateSheet] = useState(true);
  const [uniformOrientation, setUniformOrientation] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [dbSheets, setDbSheets] = useState<{name: string; width: number; height: number}[]>([]);
  const [dbRolls, setDbRolls] = useState<{name: string; width: number}[]>([]);

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
    align, setAlign,
    autoRotateSheet, setAutoRotateSheet,
    uniformOrientation, setUniformOrientation,
    showAdvanced, setShowAdvanced,
    dbSheets, dbRolls
  };
}
