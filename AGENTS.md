# Agents Rules

## Project Workflow

This project is a static, local-first CBCT viewer and installable PWA.

Current runtime flow:

1. `src/App.tsx` mounts `BrowserRouter` with basename derived from the active Vite base path.
2. `src/app/AppRouter.tsx` creates the scan-folder picker, lazy-loads pages, and redirects between `/` and `/viewer` from app state.
3. `src/lib/import/source-picker/*` prefers `showDirectoryPicker`, then falls back to `webkitdirectory` upload when available.
4. `src/app/useViewerApp.ts` owns import lifecycle, progress/errors, window/level draft state, MPR zoom, selected axis, and sidebar visibility.
5. `src/lib/import/adapters/*` matches the selected folder layout and parses format-specific metadata.
6. `src/lib/import/load-volume.ts` parses metadata on the main thread, then posts one stable request to `src/workers/volume.worker.ts`.
7. `src/workers/volume/assemble/*` decodes voxels by format and returns histogram / scalar metadata.
8. `src/lib/volume/preview-3d.ts` prepares the 3D texture payload, including quantization, threshold estimation, and GPU-safe downsampling.
9. `src/pages/ViewerPage.tsx` renders the responsive viewer shell with `VolumeViewport3D`, `AxisViewportGrid`, and `ViewerSidebar`.
10. `src/sw.ts` caches the built app shell for offline/PWA use; scan folders are still reopened each session.

## Working Areas

```text
src/
├── App.tsx
├── app/
│   ├── AppRouter.tsx
│   ├── useViewerApp.ts          # main state owner; avoid pushing readiness/UI decisions down into loaders
│   └── viewer-layout.ts         # controls the compact viewer breakpoint: `max-width: 767px`
├── components/
│   ├── AxisViewportGrid.tsx
│   ├── SliceCanvas.tsx          # owns MPR interaction behavior: scrub, wheel zoom, pinch zoom
│   ├── ViewerSidebar.tsx        # owns window/level sliders and sidebar visibility behavior
│   └── VolumeViewport3D.tsx     # owns Three.js mount/retry behavior and viewport overlay controls
├── lib/
│   ├── import/                  # import orchestration logic
│   │   ├── adapters/            # format-specific data parsing; keep grouped by format
│   │   ├── source-picker/       # source picking capability fallback; keep `showDirectoryPicker` first
│   │   └── load-volume.ts       # orchestration-only; keep parsing and decoding logic out of the main thread
│   └── volume/                  # volume data handling and 3D preview prep
│       ├── three-preview/       # Three.js preparation and rendering logic
│       └── preview-3d.ts        # 3D preview logic
├── pages/                       # top-level route components
│   ├── ImportPage.tsx           # route for homepage and scan folder picking
│   └── ViewerPage.tsx           # route for the viewer
├── sw.ts                        # service worker entrypoint
└── workers/
    ├── volume.worker.ts         # thin worker entrypoint
    └── volume/                  # format-specific voxel decoding; keep all heavy lifting off the main thread
        ├── assemble/            # format-specific assembly logic
        └── scalars.ts           # shared scalar metadata extraction logic
```

## Data References

```text
ct/
├── galileos/
└── onevolume/
    ├── CT_20250225114353/
    ├── DICOM/
    └── Series_01/
```

- inspect `ct/` before changing import / reconstruction logic
- use `ct/onevolume/CT_20250225114353/` for native OneVolume validation
- use `ct/onevolume/DICOM/` for DICOM validation
- `ct/onevolume/Series_01/` is reference-only; do not treat it as an import source
- older notes mentioning `xray/`, `xray-onevolume/`, or `original-software/` are stale

## Technical Decisions

- keep routing and assets base-path-safe; router basename, service worker registration, manifest links, and GitHub Pages deploy all depend on `import.meta.env.BASE_URL` / `VITE_BASE_PATH`
- keep heavy voxel decode and 3D prep off the main thread
- keep one worker entrypoint, with format-specific assembly under `src/workers/volume/assemble/*`
- keep import parsing grouped by format under `src/lib/import/adapters/<format>/`
- support three import formats:
  - GALILEOS folder with exactly one `*_vol_0` header and contiguous `*_vol_0_###` slices
  - OneVolume export with exactly one `CT_0.vol`
  - DICOM slice folder with at least two `.dcm` files
- DICOM detection currently relies on `.dcm` extensions; if broadening support, update matcher, parser, and homepage copy together
- keep directory-handle picking as the first choice, but preserve the upload fallback for browsers without `showDirectoryPicker`; the current mobile fallback matters for Safari / iOS
- the upload fallback is gated for iOS Safari; current hint text assumes `webkitdirectory` support on iOS 18.4+
- keep `volume` as the source of truth for whether the app is in import mode or viewer mode; router syncing is secondary
- keep coronal and sagittal views superior-at-top
- keep window/level sliders on draft state plus debounced commit (`96ms`)
- compact viewer mode is not cosmetic: it switches to one MPR pane at a time and turns the sidebar into an overlay drawer
- 3D is the primary large viewport; preserve the current Three.js renderer path unless the user explicitly asks to replace it
- 3D preview prep currently quantizes to `Uint8Array`, estimates a threshold from histogram percentiles, and downsamples when any edge exceeds `512`; inspect both `src/lib/volume/preview-3d.ts` and `src/lib/volume/three-preview/*` before changing quality / perf tradeoffs
- current plane colors are shared between 2D crosshairs and 3D cursor planes via `PLANE_COLORS`
- offline support only covers the app shell; imported study data is not persisted across launches
- homepage format examples should remain real `<code>` UI, not backtick text
- `Series_01/` is reference-only and should not be treated as an import source

## Tooling And Deployment

```text
.github/
└── workflows/
    ├── deploy.yml
    └── validate.yml

public/
├── icons/
├── manifest.webmanifest
├── favicon.png
└── voxel-viewer-logo.svg
```

- deploy currently builds with `VITE_BASE_PATH=/voxel-viewer/`
- `vite.config.ts` treats `src/sw.ts` as a separate Rollup input and emits it as `dist/sw.js`; do not remove that input accidentally
- `public/manifest.webmanifest` and the icon set in `public/icons/` are part of the deployed installable app surface
- Biome currently includes `src/**`, root `*.json`, root `*.ts`, and root `*.tsx`
- changes in `public/`, `.github/`, Markdown, and nested config files are outside current automated Biome lint / format coverage, so review them manually

## Iteration Workflow

- when starting work on any area, search `.agents/log` for relevant history first so prior implementation context and rejected approaches are understood before editing
- inspect `ct/` before changing reconstruction logic
- inspect `ct/onevolume` before changing native OneVolume or DICOM decoding logic
- prefer minimal diffs and preserve already-working rendering paths
- validate each meaningful code pass with `npm run build`
- when touching lint / format / CI, also run `npm run format:check` and `npm run lint`
- when changing import docs or folder guidance, keep them aligned with actual adapter matching rules
- when touching Vite base path, router basename, service worker, manifest, or deploy workflow, verify non-root deployment assumptions still hold
- when changing responsive viewer layout, validate both desktop and compact (`<=767px`) behavior

## Browser Verification

- use Chrome MCP for verification when possible
- if using Chrome MCP, ask the user to load the relevant sample folder first:
  - `ct/galileos`
  - `ct/onevolume/CT_20250225114353`
  - `ct/onevolume/DICOM`
- if testing responsive behavior, verify both desktop width and compact width
- if testing PWA / offline or GitHub Pages base-path behavior, prefer a production build or the deployed site
- if Chrome MCP is unavailable, fall back to code inspection plus `npm run build`
