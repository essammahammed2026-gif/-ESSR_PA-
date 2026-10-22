# Flint Unified Design System ("Obsidian Studio" & "Daylight Paper")

> **Authority:** This document defines the unified visual language, semantic surface tokens, typography hierarchy, and interaction patterns for **Flint Studio**. All studios (**Home**, **Book Studio**, **Imposing Studio**, **Contour Studio**, **Flipbook Studio**, and **Settings**) inherit from this single source of truth so UI enhancements never require duplicate component libraries or bloated CSS.

---

## 1. Dual-Theme Semantic Architecture

Flint supports two precision-calibrated prepress themes managed by [`AppearanceContext.tsx`](../frontend/src/context/AppearanceContext.tsx) and [`globals.css`](../frontend/src/app/globals.css):

1. **Obsidian Studio (`data-theme="dark"`, Default)**
   - Engineered for low-glare prepress inspection where color cast on artwork must be zero.
   - Deep slate-carbon surfaces with subtle 1px structural borders and high-contrast tabular readouts.
2. **Daylight Paper (`data-theme="light"`)**
   - Engineered for daytime print-shop environments and proofing white-paper documents.
   - Warm alabaster and crisp paper-white cards with slate ink typography.

### Semantic CSS Variables (`globals.css`)

| Token | Obsidian Studio (`dark`) | Daylight Paper (`light`) | Usage |
| :--- | :--- | :--- | :--- |
| `--surface-app` | `#0E1117` | `#E8EDF4` | Outer window background & main shell |
| `--surface-panel` | `#141923` | `#FFFFFF` | Left Deck, Right Controls, Sidebar, Popovers |
| `--surface-card` | `#181D27` | `#F8FAFC` | Module cards, Collapsible tool sections |
| `--surface-inset` | `#11151E` | `#E2E8F0` | Segmented pill tracks, input wells, code badges |
| `--surface-canvas` | `#090C12` | `#CBD5E1` | Interactive artwork/page viewport backdrop |
| `--surface-selected` | `#1E2638` | `var(--app-accent-15)` | Selected thumbnail card or active list row |
| `--border-subtle` | `#242C3D` | `#CBD5E1` | Standard 1px structural dividers & card borders |
| `--border-strong` | `#333E54` | `#94A3B8` | Active module borders, hovered inputs, popovers |
| `--text-primary` | `#F1F5F9` | `#0F172A` | Headings, active labels, primary controls |
| `--text-secondary` | `#94A3B8` | `#334155` | Secondary descriptions, inactive tabs |
| `--text-muted` | `#64748B` | `#475569` | Hints, keyboard shortcut badges, disabled states |

### Independent Per-Theme Accent Colors & Auto-Contrast Engine

Dark Mode and Light Mode each persist their own independent accent color in [`AppearanceContext.tsx`](../frontend/src/context/AppearanceContext.tsx) (`darkAccentColor` defaulting to `#F59E0B` Amber Gold; `lightAccentColor` defaulting to `#2563EB` Cobalt Blue, both customizable in **Settings → Appearance**):
- `--app-accent`: Primary solid accent fill for the active theme.
- `--app-accent-fg`: Automatically computed WCAG-contrasting text color (`#0F172A` on bright fills like Amber/Cyan, `#FFFFFF` on deeper fills like Cobalt/Indigo/Crimson) for solid CTA buttons and badges.
- `--app-accent-text`: Automatically luminance-calibrated shade of the accent color guaranteed to pass WCAG AA contrast when used as text or icons on `--surface-panel` / `--surface-card`.
- `--app-accent-15`: `14–16%` alpha tint for active pill backgrounds and subtle status badges.
- `--app-accent-30`: `32–35%` alpha tint for active borders and focus rings.

---

## 2. Layout & Spatial Hierarchy

1. **Unified 3-Slot Studio Shell ([`StudioLayout.tsx`](../frontend/src/components/layout/StudioLayout.tsx))**:
   - **Top Header Bar:** Breadcrumb navigation (`Home / Studio / Active Job`), view mode toggles, global length unit selector (`mm`, `cm`, `in`, `px`), and the primary Export split-button/dropdown.
   - **Left Panel (`w-[280px]`–`w-[300px]`):** Intake configuration & visual Page/Asset Deck with 2-column thumbnail grid or compact list view, multi-select (`Ctrl+Click`, `Shift+Click`, `Select ▾`), and status dots.
   - **Center Viewport (`flex-1`):** Unconstrained interactive canvas with a top-center **Dimension Notch**, a top **Workspace Toolbar** (Deck step, History Journal, Quick Canvas Tools, Compare toggle, Rotate), and a bottom-center floating **Zoom & Pan HUD Pill**.
   - **Right Panel (`w-[300px]`–`w-[310px]`):** Layer-Stack processing modules and studio handoff links.

2. **Layer-Stack vs. Focused Module Pattern**:
   - **Layer Stack (Toggle Switches):** Multiple processing modules (`Crop & Split`, `Deskew`, `Cleanup & Masking`, `Color & Tone`, `Bleed`) can be enabled simultaneously—just like non-destructive adjustment layers. Enabling or focusing one module never disables another module's effect.
   - **Focused Module (`1`–`5` or Click):** The focused module displays a subtle accent border ring and receives context-sensitive action hotkeys (`A` for Detect Page, `Shift+A` for Detect All, `Enter` for Apply).
   - **Direct Canvas Tool Hotkeys:** Tools that operate on the canvas (`S` Straighten Line, `M` Erase Box, `C` Crop Overlay, `X` Cut Line, `G` Grid, `I` Eyedropper, `H` Pan, `O` Compare) can be triggered at any time with a single keystroke and automatically enable their parent module if needed.

---

## 3. Guidelines for Migrating Other Studios (Imposing, Contour, Flipbook)

When updating **Imposing Studio**, **Contour Studio**, or **Flipbook Studio** in future sessions:
1. **Use Semantic Surface Tokens:** Prefer `bg-[var(--surface-panel)]`, `bg-[var(--surface-card)]`, `bg-[var(--surface-inset)]`, and `border-[var(--border-subtle)]` (or rely on the automatic light-mode remapping rules in `globals.css`).
2. **Use `ModuleProgressBar` for Long Tasks:** Import `ModuleProgressBar` from `src/components/book-studio/modules/PageScopeSelector.tsx` (or promote to `src/components/shared/`) whenever a module runs batch detection, nesting, or vectorization.
3. **Preserve Single Responsibility:** Keep all API calls inside `src/lib/api.ts`, unit math inside `src/lib/units.ts`, and studio state consolidated in each studio's primary hook (`useBookModules.ts`, `useImpositionStudio.ts`).
