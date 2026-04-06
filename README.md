<p align="center">
  <img src="./logo/voxel-viewer-logo.svg" alt="Voxel Viewer logo" width="220" />
</p>

<h1 align="center">Voxel Viewer</h1>

[![GitHub Build][gh-build-image]][gh-build-url]
[![GitHub Sponsors][gh-sponsors-image]][gh-sponsors-url]
[![Buy Me A Coffee][buymeacoffee-image]][buymeacoffee-url]
[![Twitter][twitter-image]][twitter-url]

> [!NOTE]
> Web-based viewer for CBCT (Cone Beam Computed Tomography) volumes and scan folders (supports Sirona GALILEOS, DICOM, OneVolume)

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

## Install & Offline

- Installable as a browser-native PWA in Chromium-based browsers.
- After the first online load, the app shell stays available offline.
- Scan data is not persisted for offline reuse; reopen the local study folder
  when you launch the app again.

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

<!-- References -->

[gh-build-image]: https://img.shields.io/github/actions/workflow/status/denysdovhan/voxel-viewer/validate.yml?branch=main&style=flat-square
[gh-build-url]: https://github.com/denysdovhan/voxel-viewer/actions/workflows/validate.yml
[gh-sponsors-image]: https://img.shields.io/github/sponsors/denysdovhan?style=flat-square
[gh-sponsors-url]: https://github.com/sponsors/denysdovhan
[buymeacoffee-image]: https://img.shields.io/badge/support-buymeacoffee-222222.svg?style=flat-square
[buymeacoffee-url]: https://buymeacoffee.com/denysdovhan
[twitter-image]: https://img.shields.io/badge/follow-%40denysdovhan-000000.svg?style=flat-square
[twitter-url]: https://x.com/denysdovhan
