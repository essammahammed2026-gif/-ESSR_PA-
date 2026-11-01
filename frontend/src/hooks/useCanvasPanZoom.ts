"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export interface UseCanvasPanZoomOptions {
  minScale?: number;
  maxScale?: number;
  zoomSensitivity?: number;
  initialScale?: number;
  initialPosition?: { x: number; y: number };
}

/**
 * Universal canvas pan and cursor-centric zoom engine.
 * - Attaches a non-passive wheel listener preventing accidental browser window zoom.
 * - Smooth RAF-throttled pointer drag panning.
 * - Zoom controls: zoomIn, zoomOut, resetZoom, setTransform.
 */
export function useCanvasPanZoom(options: UseCanvasPanZoomOptions = {}) {
  const {
    minScale = 0.1,
    maxScale = 15,
    zoomSensitivity = 0.002,
    initialScale = 1,
    initialPosition = { x: 0, y: 0 },
  } = options;

  const [scale, setScale] = useState<number>(initialScale);
  const [position, setPosition] = useState<{ x: number; y: number }>(initialPosition);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isPanMode, setIsPanMode] = useState<boolean>(true);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // Wheel zoom with cursor-centering & non-passive listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * zoomSensitivity;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      setScale((prevScale) => {
        const newScale = Math.min(Math.max(minScale, prevScale + prevScale * delta), maxScale);
        const ratio = newScale / prevScale;
        const mouseX = clientX - rect.left - rect.width / 2;
        const mouseY = clientY - rect.top - rect.height / 2;

        setPosition((prevPos) => ({
          x: mouseX - (mouseX - prevPos.x) * ratio,
          y: mouseY - (mouseY - prevPos.y) * ratio,
        }));

        return newScale;
      });
    };

    canvas.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleNativeWheel);
  }, [minScale, maxScale, zoomSensitivity]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag with left click (button 0) or middle click (button 1)
    if (e.button !== 0 && e.button !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      setPosition({
        x: clientX - dragStartRef.current.x,
        y: clientY - dragStartRef.current.y,
      });
      rafIdRef.current = null;
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoomIn = useCallback((factor = 1.25) => {
    setScale((prev) => Math.min(maxScale, prev * factor));
  }, [maxScale]);

  const zoomOut = useCallback((factor = 0.8) => {
    setScale((prev) => Math.max(minScale, prev * factor));
  }, [minScale]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const setTransform = useCallback((newScale: number, newPosition: { x: number; y: number }) => {
    setScale(Math.min(Math.max(minScale, newScale), maxScale));
    setPosition(newPosition);
  }, [minScale, maxScale]);

  return {
    scale,
    setScale,
    position,
    setPosition,
    isDragging,
    isPanMode,
    setIsPanMode,
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    zoomIn,
    zoomOut,
    resetZoom,
    setTransform,
  };
}
