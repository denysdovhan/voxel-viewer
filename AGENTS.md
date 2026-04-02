# Agents Rules

## Stack

- package manager: `npm`
- app shell: React 19 + TypeScript 5 + Vite 7
- styling: Tailwind CSS 4
- compression: `fflate`
- 3D: Three.js
- UI perf helpers: `lodash` debounce

## Project Workflow

This project is a static, local-first dental CT viewer.

Current runtime flow:

1. User selects a local scan folder.
2. `src/lib/import/adapters/*` detects the folder layout and parses format-specific metadata.
3. `src/lib/import/load-volume.ts` builds one stable worker request for the selected format.
4. `src/workers/volume.worker.ts` delegates assembly to `src/workers/volume/*` and prepares the 3D volume off the main thread.
5. `src/app/useDentalViewerApp.ts` commits the loaded volume, cursor, window/level state, and viewer controls.
6. `src/app/AppRouter.tsx` syncs the current app state to `/` and `/viewer`.
7. `src/pages/ImportPage.tsx` and `src/pages/ViewerPage.tsx` render the current page shell.
8. `src/lib/volume/*` provides MPR extraction and 3D preparation helpers.
9. `src/lib/volume/three-preview/*` provides the current working Three.js renderer.

## Working Areas

- `src/App.tsx`
  - router host only
- `src/app/AppRouter.tsx`
  - URL synchronization between import and viewer state
- `src/app/useDentalViewerApp.ts`
  - import flow, linked cursor, window/level controls, stage transitions, viewer state
- `src/pages/ImportPage.tsx`
  - homepage/import screen, folder guidance copy, loading shell
- `src/pages/ViewerPage.tsx`
  - loaded viewer screen composition
- `src/components/AxisViewportGrid.tsx`
  - extracted coronal / sagittal / axial viewport layout
- `src/components/ViewerSidebar.tsx`
  - extracted study metadata, display controls, progress, and actions
- `src/lib/import/adapters/*`
  - per-format folder matching, metadata parsing, worker payload shaping
- `src/lib/import/load-volume.ts`
  - adapter selection and worker lifecycle
  - do not emit final-ready UI state from here; final readiness is owned by `useDentalViewerApp`
- `src/workers/volume.worker.ts`
  - worker entrypoint only; keep it thin
- `src/workers/volume/*`
  - format-specific assembly, histogram/scalar helpers, worker progress/error helpers
- `src/lib/volume/*`
  - MPR extraction, scalar math, voxel helpers, 3D preparation
- `src/lib/volume/three-preview/*`
  - Three.js renderer, camera logic, plane overlays, volume object setup

## Data References

- `ct/`
  - `ct/galileos` sample GALILEOS studies used for local validation
  - `ct/onevolume` sample OneVolume studies used for local validation
- `xray/`
  - legacy GALILEOS sample folders still referenced by older thread notes
- `xray-onevolume/`
  - reference OneVolume export used during reverse-engineering
- `original-software/`
  - reference material for vendor behavior and layout comparison

## Technical Decisions

- use `npm`, not Bun
- keep heavy slice inflation off the main thread
- keep one worker entrypoint, but split worker logic into smaller files under `src/workers/volume/*`
- keep import parsing grouped by format under `src/lib/import/adapters/<format>/`
- support three import formats:
  - GALILEOS folder with `*_vol_0` and `*_vol_0_###`
  - OneVolume native folder with `CT_0.vol`
  - DICOM slice folder with `.dcm` slices
- do not keep the earlier hybrid OneVolume path; native `.vol` and DICOM are separate loaders now
- keep coronal and sagittal views superior-at-top
- keep window/level sliders on draft state plus debounced commit
- keep the currently visible Three.js renderer path unless the user explicitly asks to replace it
- keep `volume` as the source of truth for whether the app is in import mode or viewer mode
- keep router syncing secondary to app state; do not reintroduce route-first gating for viewer visibility
- do not reintroduce local persistence yet; treat it as a separate future feature
- the redundant folder-input UI path has been removed and should stay removed unless the user asks for it back
- 3D is now the primary enhancement track
- on the homepage, format/folder examples should render as actual `<code>` UI, not backtick text
- `Series_01/` is reference-only and should not be treated as an import source

## Iteration Workflow

- when starting work on any area, search `.agents/log` for relevant history first so prior implementation context and rejected approaches are understood before editing
- inspect `ct/` before changing reconstruction logic
- inspect `xray-onevolume/` when changing OneVolume decoding logic
- prefer minimal diffs and preserve already-working rendering paths
- validate each meaningful code pass with `npm run build`
- when changing import docs or folder guidance, keep them aligned with actual adapter matching rules

## Browser Verification

- Use Chrome MCP for verification when possible, if it's not available, ask user to check their setup, for example, ensure they have this package available (it may be unavailable under VPN)
- if using Chrome MCP, ask the user to load the `ct` folder first and wait for confirmation before inspecting the viewer
- if Chrome MCP is unavailable, fall back to code inspection plus `npm run build`
