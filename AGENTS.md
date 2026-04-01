# Agents Rules

## Stack

- package manager: `npm`
- app shell: React 19 + TypeScript 5 + Vite 7
- styling: Tailwind CSS 4
- compression: `fflate`
- 3D: Three.js
- UI perf helpers: `lodash` debounce

## Project Workflow

This project is a static, local-first GALILEOS viewer.

Current runtime flow:

1. User selects a local scan folder.
2. `src/lib/import/*` parses GALILEOS metadata and slice naming.
3. `src/workers/volume.worker.ts` inflates gzip slices and prepares the 3D volume off the main thread.
4. `src/App.tsx` renders the current viewer shell and linked MPR navigation.
5. `src/lib/volume/index.ts` provides MPR extraction and 3D preparation helpers.
6. `src/lib/volume/three-preview.ts` provides the current working 3D renderer.

## Working Areas

- `src/App.tsx`
  - import flow, viewer layout, linked cursor, window/level controls, stage transitions
- `src/workers/volume.worker.ts`
  - background slice inflation and 3D preparation
- `src/lib/import/*`
  - folder scanning, GALILEOS metadata parsing, worker bridge
- `src/lib/volume/index.ts`
  - MPR extraction and 3D preparation helpers
- `src/lib/volume/three-preview.ts`
  - current visible Three.js renderer and 3D interaction

## Data References

- `xray/`
  - sample GALILEOS studies used for local validation
- `original-software/`
  - reference material for reverse-engineering original GALILEOS behavior
- external reference used in this thread:
  - `Nashev/GalileosVoxelViewer`
  - useful for voxel loading and axis interpretation

## Technical Decisions

- use `npm`, not Bun
- keep heavy slice inflation off the main thread
- keep coronal and sagittal views superior-at-top
- keep window/level sliders on draft state plus debounced commit
- keep the currently visible Three.js renderer path unless the user explicitly asks to replace it
- do not reintroduce local persistence yet; treat it as a separate future feature
- the redundant folder-input UI path has been removed and should stay removed unless the user asks for it back
- 3D is now the primary enhancement track

## Iteration Workflow

- when starting work on any area, search `.agents/log` for relevant history first so prior implementation context and rejected approaches are understood before editing
- step 3 is active: MPR zoom and scrub navigation
- keep phase-1 summary in `.agents/log/1-3d-viewer.md`
- keep phase-2 notes in `.agents/log/2-3d-quality-and-plane-controls.md`
- keep phase-3 notes in `.agents/log/3-mpr-zoom-and-scrub-navigation.md`
- inspect `xray/` and `original-software/` before changing reconstruction logic
- prefer minimal diffs and preserve already-working rendering paths
- validate each meaningful code pass with `npm run build`

## Browser Verification

- Use Chrome MCP for verification when possible, if it's not available, ask user to check their setup, for example, ensure they have this package available (it may be unavailable under VPN)
- if using Chrome MCP, ask the user to load the xray folder first and wait for confirmation before inspecting the viewer
- if Chrome MCP is unavailable, fall back to code inspection plus `npm run build`
