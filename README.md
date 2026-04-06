<p align="center">
  <img src="./logo/voxel-viewer-logo.svg" alt="Voxel Viewer logo" width="220" />
</p>

<h1 align="center">Voxel Viewer</h1>


> [!NOTE]
> A local-first web viewer for CBCT study folders and voxel volumes.

## Problem

Dental and maxillofacial CT exports often arrive as vendor-specific folder
structures that are awkward to inspect outside proprietary desktop software.
That makes quick review, debugging, and format comparison harder than it
should be.

Voxel Viewer solves that by opening supported study folders directly in the
browser, parsing them locally, building the volume off the main thread, and
rendering linked MPR slices alongside a 3D preview.

## Deployed App

[denysdovhan.com/voxel-viewer](https://denysdovhan.com/voxel-viewer/)

Repository: [github.com/denysdovhan/voxel-viewer](https://github.com/denysdovhan/voxel-viewer)

## Supported Inputs

- `GALILEOS` folders with `*_vol_0` and `*_vol_0_###`
- `OneVolume` exports with native `CT_0.vol`
- `DICOM` slice folders with `.dcm` files

## Tech Overview

- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- Three.js
- Web Workers
- `fflate`
- `lodash` debounce

## Local Development

```bash
npm install
npm run dev
```

Use a Chromium-based desktop browser so the app can open scan folders via the
File System Access API.

## License

[MIT](./LICENSE) © [Denys Dovhan](https://denysdovhan.com)
