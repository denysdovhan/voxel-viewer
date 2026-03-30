# Static Web Viewer For GALILEOS Folders

## Summary
Build option 1 as a static, local-first web app that can be hosted on any static host and opens a user-selected local scan folder in the browser. The app will target Chromium browsers on macOS first because directory access depends on `showDirectoryPicker()` in a secure context; the intended access modes are `https://...` hosting and `http://localhost`, not `file://`. Source basis: MDN documents `showDirectoryPicker()` as secure-context-only and not baseline across major browsers, and confirms File System API access is available in Web Workers. See [MDN `showDirectoryPicker()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) and [MDN File System API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API).

Use `React + TypeScript + Vite` for the shell, `vtk.js` for 3D/MPR rendering, and `fflate` in a Web Worker for gzip inflation. The app remains reference-only, not diagnostic/treatment-planning software.

## Key Changes
- App architecture:
  - Pure static frontend build with no backend, no database, no upload service.
  - Deployable to GitHub Pages, Netlify, Vercel static export, S3/Cloudflare Pages, or any HTTPS static host.
  - All parsing and rendering happen client-side.
- Local folder import:
  - Primary import path: `window.showDirectoryPicker()` behind a user click.
  - Fallback import path: `<input type="file" webkitdirectory multiple>` for browsers that expose folder selection that way.
  - If neither directory path is available, show a hard stop message that Chromium desktop is required for folder-based loading.
  - Import logic will scan the selected directory for:
    - one `*.gwg` file
    - one `*_vol_0` gzip XML header
    - `*_vol_0_000...N` gzip slice files
    - optional `*_proj_0` panorama XML
- Internal interfaces:
  - `ScanFolderSource`: abstraction over `FileSystemDirectoryHandle` and `FileList`
  - `ParsedVolumeMeta`: dimensions, voxel spacing, scalar range, slice count, scan id
  - `LoadedVolume`: `Uint16Array` or transferred `ArrayBuffer` plus metadata
  - `PanoramaMeta`: parsed `PositionX`, `PositionY`, `CurveType`, `ThicknessScale`, `ProjSizeX/Y`, voxel sizes
- Data pipeline:
  - Enumerate files from the chosen folder source.
  - Parse the XML embedded in `*_vol_0` to get `512 x 512 x 512`, `0.16 mm`, `0..4095`, and slice count.
  - Inflate each gzip slice in a worker into a preallocated contiguous volume buffer.
  - Parse `*_proj_0` and generate a default panoramic reconstruction from the volume plus metadata.
  - Transfer the assembled volume to the render layer once complete.
- Viewer UI:
  - Static single-page app with:
    - axial view
    - coronal view
    - sagittal view
    - 3D volume view
    - read-only panoramic view
  - Shared crosshair and linked navigation across the 3 orthogonal panes.
  - Bone-oriented window/level presets and a minimal opacity preset for 3D.
  - Loading progress, parse errors, unsupported-browser state, and “reference only” disclaimer always visible.
- Performance decisions:
  - Keep full-resolution volume for MPR.
  - If full `512^3` 3D rendering is too heavy, downsample only the 3D texture to `256^3`.
  - Use workers so decompression never blocks the main thread.
  - Optionally cache parsed metadata and the selected directory handle in IndexedDB when the browser allows it; do not require this for v1.
- Panorama behavior:
  - v1 pano is auto-generated and read-only.
  - Seed the curve from `*_proj_0`; refine from axial intensity structure if needed.
  - No editable curve, measurements, annotations, or implant planning in v1.

## Test Plan
- Import and parsing:
  - Open the sample folder from a hosted HTTPS build.
  - Open the sample folder from localhost during development.
  - Confirm both `showDirectoryPicker()` and fallback folder input reach the same parser contract.
  - Fail clearly on missing `*_vol_0`, missing slices, duplicate series, or corrupt gzip data.
- Rendering:
  - Verify the sample volume renders in axial/coronal/sagittal panes with synchronized crosshair.
  - Verify the 3D pane renders on supported hardware and falls back to downsampled mode when needed.
  - Verify the pano pane renders a visible jaw arch from the sample data.
- Browser/platform:
  - Chromium on macOS is the primary supported path and must pass end-to-end.
  - Non-supporting browsers must show a clear unsupported/fallback message rather than partially failing.
- Static hosting:
  - Production build must work with no server-side code and no special headers beyond standard HTTPS hosting.
  - App must not require direct filesystem access before a user gesture.

## Assumptions
- The app must be hostable as a static site and must read scans from a user-selected local folder in-browser.
- Supported primary browser for v1 is Chromium desktop on macOS.
- v1 is reference-only and explicitly not for diagnosis or treatment planning.
- v1 supports this GALILEOS folder format directly; DICOM support is out of scope.
- v1 includes 3 orthogonal views, 3D rendering, and one auto-generated read-only panoramic view.
- v1 excludes exact Sirona workflow matching, implant tools, measurements, auth, sharing, and backend processing.
