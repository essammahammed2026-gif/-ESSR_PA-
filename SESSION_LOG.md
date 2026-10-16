# Session Log

## Date: 2026-10-16

### 1. Context & Objective
- **Problem**: Document processing pipeline silent failure after performing a standard crop followed by a "cut line" split. Subsequent cropping or splitting operations reported success in logs/journal but did not modify the file or document state.
- **Rules Followed**: Strict TypeScript (no `any`), thin routers / pure engines, live iteration refactoring in-stride, fast inner-loop validation (`py_compile`, `npx tsc --noEmit`), zero-retention storage cleaner, user-only git commit authority.

### 2. Root Cause Analysis
1. **Cut Line Residual State**: On split commit in `useBookSplitOps.ts`, `cropModule.splitLines` was never reset. Consequently, `hasCutLines` in `CropSplitPanel.tsx` remained `true`, routing any subsequent user clicks to `splitSpread()` instead of `applyCrop()`.
2. **Empty Parent Candidate Set**: In `useBookSplitOps.ts`, `parentIds` fell back to `pages.filter((p) => !p.parent_page_id)` when targeting all pages. After an initial split, *all* active pages have `parent_page_id` set, causing `parentIds` to collapse to `[]` and `anchorId` to `undefined`.
3. **HTTP 422 Rejection**: Backend `SplitSpreadRequest` and `CropPageRequest` required `page_id: str`. When passed `undefined`, FastAPI rejected with 422 Unprocessable Entity, which `apiFetch` silently aborted.
4. **Hierarchical Lineage Disconnect**: On iterative sub-splits of already-split pages, `book_scan_engine.py` assigned `parent_page_id` to the root grandparent spread ID rather than the immediate slice being sliced. The frontend's `newIds` tracking filtered by `parentSet.has(p.parent_page_id)` where `parentSet` held the slice ID, resulting in an empty `newIds` set and breaking multi-cut chaining.
5. **Dimension Compounding**: `book_scan_engine.py` line 1065 evaluated `width_mm or orig_width_mm` for sub-splits, multiplying already-cropped dimensions by `pcb_frac_w` a second time.

### 3. Modifications
- [`frontend/src/types/book_studio.ts`](frontend/src/types/book_studio.ts): Added `immediate_parent_id?: string` to `BookStudioPage`.
- [`frontend/src/hooks/useBookSplitOps.ts`](frontend/src/hooks/useBookSplitOps.ts):
  - Reset `splitLines: []` on split commit, crop apply, and spread revert.
  - Resolved `parentIds` fallback to `pages.map((p) => p.id)`.
  - Added safe fallback for `anchorId`.
  - Enhanced `newIds` filtering to match against either `parent_page_id` or `immediate_parent_id`.
  - Consolidated sub-slice target lookup using `Set`.
- [`backend/engines/schemas.py`](backend/engines/schemas.py): Made `page_id: Optional[str] = None` in `SplitSpreadRequest` and `CropPageRequest`.
- [`backend/book_scan_api.py`](backend/book_scan_api.py): Added fallback resolution for `target_id` when `req.page_id` is omitted in `split_spread` and `crop_page`.
- [`backend/engines/book_scan_engine.py`](backend/engines/book_scan_engine.py):
  - Corrected dimension priority to `orig_width_mm or width_mm`.
  - Added `immediate_parent_id: p["id"]` on sub-splits.
- [`CHANGELOG.md`](CHANGELOG.md): Documented pipeline bugfix under `[Unreleased]`.

### 4. Verification
- Backend syntax verification: `python -m py_compile main.py book_scan_api.py engines/*.py` (0 errors).
- Frontend type checking: `npx tsc --noEmit` (0 errors).
- Automated test script `test_crop_split_pipeline.py`: Successfully verified Initial Crop -> Cut-line Split -> Subsequent Crop -> Subsequent Split.
- Cleaned runtime storage: `backend/temp_uploads/` clean.
