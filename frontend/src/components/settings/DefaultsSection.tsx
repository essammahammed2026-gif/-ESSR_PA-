"use client";

import type { AppSettingsData } from "./types";

interface DefaultsSectionProps {
  settings: AppSettingsData;
  onSettingsChange: (settings: AppSettingsData) => void;
  activeTab: "imposing" | "contour" | "flipbook";
}

export default function DefaultsSection({ settings, onSettingsChange, activeTab }: DefaultsSectionProps) {
  const updateImposing = (patch: Partial<AppSettingsData["imposing"]>) => {
    onSettingsChange({ ...settings, imposing: { ...settings.imposing, ...patch } });
  };
  const updateContour = (patch: Partial<AppSettingsData["contour"]>) => {
    onSettingsChange({ ...settings, contour: { ...settings.contour, ...patch } });
  };
  const updateFlipbook = (patch: Partial<AppSettingsData["flipbook"]>) => {
    onSettingsChange({ ...settings, flipbook: { ...settings.flipbook, ...patch } });
  };

  if (activeTab === "imposing") {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold">Imposing Studio Preferences</h2>
        <p className="text-xs text-gray-500 -mt-3">Initial parameters applied to new imposition projects.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium block mb-1">Default Unit</label>
            <select
              value={settings.imposing.default_sheet_unit}
              onChange={(e) => updateImposing({ default_sheet_unit: e.target.value })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="mm">Millimeters (mm)</option>
              <option value="cm">Centimeters (cm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Margin (mm)</label>
            <input
              type="number"
              value={settings.imposing.default_margin}
              onChange={(e) => updateImposing({ default_margin: parseFloat(e.target.value) || 0 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Artwork Gap (mm)</label>
            <input
              type="number"
              value={settings.imposing.default_gap}
              onChange={(e) => updateImposing({ default_gap: parseFloat(e.target.value) || 0 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Bleed Allowance (mm)</label>
            <input
              type="number"
              value={settings.imposing.default_bleed}
              onChange={(e) => updateImposing({ default_bleed: parseFloat(e.target.value) || 0 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="pt-4 border-t dark:border-gray-700 space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.imposing.crop_marks}
              onChange={(e) => updateImposing({ crop_marks: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Enable Crop / Corner Cut Marks by Default</span>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.imposing.draw_border}
              onChange={(e) => updateImposing({ draw_border: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Draw Outer Diecut / Bleed Border Lines by Default</span>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.imposing.uniform_orientation}
              onChange={(e) => updateImposing({ uniform_orientation: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Enforce Same Orientation for Polar / Guillotine Cutting by Default</span>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.imposing.auto_rotate_sheet}
              onChange={(e) => updateImposing({ auto_rotate_sheet: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Auto-Rotate Sheet Orientation for Maximum Yield</span>
          </label>
        </div>
      </div>
    );
  }

  if (activeTab === "contour") {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold">Contour Cut Preferences</h2>
        <p className="text-xs text-gray-500 -mt-3">Default parameters for sticker cutline generation and Bézier tracing.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium block mb-1">Default Processing DPI</label>
            <select
              value={settings.contour.default_dpi}
              onChange={(e) => updateContour({ default_dpi: parseInt(e.target.value) || 300 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            >
              <option value="150">150 DPI (Fast preview)</option>
              <option value="300">300 DPI (High Precision Print)</option>
              <option value="600">600 DPI (Ultra Sharp Cutting)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Threshold (0-255)</label>
            <input
              type="number"
              min="1"
              max="254"
              value={settings.contour.default_threshold}
              onChange={(e) => updateContour({ default_threshold: parseInt(e.target.value) || 20 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Cut Offset (mm)</label>
            <input
              type="number"
              step="0.5"
              value={settings.contour.default_offset}
              onChange={(e) => updateContour({ default_offset: parseFloat(e.target.value) || 0 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Cut Stroke Color</label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.contour.default_stroke_color}
                onChange={(e) => updateContour({ default_stroke_color: e.target.value })}
                className="w-10 h-10 border rounded-lg p-0.5 cursor-pointer dark:bg-gray-900 dark:border-gray-700"
              />
              <input
                type="text"
                value={settings.contour.default_stroke_color}
                onChange={(e) => updateContour({ default_stroke_color: e.target.value })}
                className="flex-1 text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Default Smoothing Factor</label>
            <input
              type="number"
              step="0.5"
              value={settings.contour.default_smoothing}
              onChange={(e) => updateContour({ default_smoothing: parseFloat(e.target.value) || 2.0 })}
              className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="pt-4 border-t dark:border-gray-700">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.contour.keep_holes}
              onChange={(e) => updateContour({ keep_holes: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm">Retain Inner Holes & Cutouts by Default</span>
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm space-y-5">
      <h2 className="text-base font-bold">Flipbook Studio Preferences</h2>
      <p className="text-xs text-gray-500 -mt-3">Default view, binding style, and rendering resolution.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-sm font-medium block mb-1">Default Reading Direction</label>
          <select
            value={settings.flipbook.default_direction}
            onChange={(e) => updateFlipbook({ default_direction: e.target.value })}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          >
            <option value="Left to Right (LTR)">Left to Right (LTR)</option>
            <option value="Right to Left (RTL - Arabic/Hebrew)">Right to Left (RTL)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Default Binding Style</label>
          <select
            value={settings.flipbook.default_binding}
            onChange={(e) => updateFlipbook({ default_binding: e.target.value })}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          >
            <option value="Soft Cover (Paperback)">Soft Cover (Paperback)</option>
            <option value="Hardcover Book">Hardcover Book</option>
            <option value="Magazine / Saddle-Stitch">Magazine / Saddle-Stitch</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Default Background Texture</label>
          <select
            value={settings.flipbook.default_texture}
            onChange={(e) => updateFlipbook({ default_texture: e.target.value })}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          >
            <option value="Dark Mode">Dark Mode (Neutral)</option>
            <option value="Wood Desk">Wood Desk</option>
            <option value="Marble">Marble</option>
            <option value="White Clean">White Clean</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">Rasterization DPI</label>
          <input
            type="number"
            value={settings.flipbook.default_dpi}
            onChange={(e) => updateFlipbook({ default_dpi: parseInt(e.target.value) || 101 })}
            className="w-full text-sm border p-2 rounded-lg dark:bg-gray-900 dark:border-gray-700"
          />
        </div>
      </div>

      <div className="pt-4 border-t dark:border-gray-700 space-y-3">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.flipbook.sound_enabled}
            onChange={(e) => updateFlipbook({ sound_enabled: e.target.checked })}
            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm">Page Flipping Audio Enabled by Default</span>
        </label>

        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.flipbook.eco_mode}
            onChange={(e) => updateFlipbook({ eco_mode: e.target.checked })}
            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm">Eco Mode (Lower memory consumption on large catalogs)</span>
        </label>
      </div>
    </div>
  );
}
