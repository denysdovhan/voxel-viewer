# Step 1 Summary: 3D Viewer Direction

## Scope

This is still step 1.

The project direction changed during this step:

- panorama is no longer the primary feature target
- 3D is now treated as the more useful navigation surface
- future effort should focus on improving 3D quality, interaction, and reliability

## Final Product Decision From This Conversation

- 3D replaces panorama as the main alternative for scan navigation
- we should focus on better 3D instead of spending more time on panoramic reconstruction
- the idea of a true built-in panorama is abandoned for now
- reason: panorama is not available in the GALILEOS files by default; it must be reconstructed heuristically, and those reconstructions were not good enough

## Why Panorama Was Dropped

- `_proj_0` is seed/project metadata, not a ready-to-display panorama image
- multiple reconstruction attempts still produced outputs that:
  - looked like coronal/frontal projections
  - missed anterior or posterior teeth
  - clipped one side of the jaw in some studies
  - were slow enough to hurt import readiness
- reverse-engineering from `xray/`, `original-software/`, and the Pascal repo improved voxel understanding, but did not provide a reliable vendor-equivalent pano pipeline

## What Still Matters From The Panorama Investigation

- GALILEOS slices are gzip-compressed raw `Uint16` planes
- `*_vol_0` holds the important volume metadata
- `*_proj_0` should be treated as project/seed metadata only
- any future panorama work must be considered experimental, not core product flow

## 3D Direction

3D is now the main enhancement track.

Current goals:

- keep the current visible Three.js renderer path
- improve 3D resolution where feasible
- improve default camera placement
- improve navigation and interaction
- keep axial/coronal/sagittal plane overlays visible in 3D so users can understand what each 2D slice shows
- make 3D the primary large viewer instead of pano-first layout

## Current Technical Baseline

- stack:
  - React 19
  - TypeScript 5
  - Vite 7
  - Tailwind 4
  - Three.js
  - `fflate`
  - `lodash`
- import flow:
  - folder selection
  - metadata parsing in `src/lib/import/*`
  - slice inflation in `src/workers/volume.worker.ts`
  - 3D preparation in the worker hot path
- rendering flow:
  - `src/App.tsx` owns import state, layout, linked cursor, and controls
  - `src/lib/volume/index.ts` owns MPR extraction and 3D preparation helpers
  - `src/lib/volume/three-preview.ts` owns the working 3D renderer

## Rolled Back Or Deferred

- local persistence / restore flow
- redundant folder-input UI path
- unstable 3D experiments that broke visibility or controls
- panorama as a core readiness requirement

## Guidance For Future Iterations

- keep work under step 1 until the user explicitly advances
- do not spend iteration budget on panorama unless the user explicitly revives it
- preserve the currently visible 3D renderer and improve it incrementally
- treat 3D as the primary large viewer and navigation aid
- continue validating with `npm run build`
- if using Chrome MCP, ask the user to load the xray folder first

## Immediate Next Focus

- sharper and more informative 3D rendering
- better default framing and navigation in 3D
- stronger connection between 3D and linked orthogonal slices
- layout decisions that favor a large 3D viewer over panorama
