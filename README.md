<!-- markdownlint-disable first-line-h1 -->
<!-- markdownlint-disable no-inline-html -->
<p align="center">
  <img src="./logos/voxel-viewer-logo.svg" alt="Voxel Viewer logo" width="220" />
</p>

<h1 align="center">Voxel Viewer</h1>
<!-- markdownlint-enable no-inline-html -->

[![GitHub Build][gh-build-image]][gh-build-url]
[![GitHub Sponsors][gh-sponsors-image]][gh-sponsors-url]
[![Buy Me A Coffee][buymeacoffee-image]][buymeacoffee-url]
[![Twitter][twitter-image]][twitter-url]

> [!NOTE]
> Web-based viewer for [CBCT (Cone Beam Computed Tomography)][cbct-wiki] volumes and scan folders (supports Sirona GALILEOS, DICOM, OneVolume)

## Problem

When I visit my dentist, they often send me 3D renderings of my dental scans to my email. The problem is these scans are usually in a format that can only be opened with specific software, usually only for Windows PCs.

I wanted to be able to view these scans on my Mac, or on my phone/tablet in the browser.

Dental and maxillofacial CT exports often arrive as vendor-specific folder
structures. I used [Codex](https://github.com/openai/codex) to reverse-engineer these formats and build a simple web-based viewer for them.

**Voxel Viewer** solves that by opening supported study folders directly in the
browser, parsing them locally, building the volume off the main thread, and
rendering linked MPR slices alongside a 3D preview.

## Features

> [!WARNING]
> This app is a side-project build for fun and learning. This is not a medical-grade software, and it should not be used for diagnostic purposes.

I built this project over a weekend to view my dental scans. So far it supports the following features:

- 📁 **Open scan folders** directly in the browser (File System Access API)
- 🗃️ **Supports popular MRP fomats** (Sirona GALILEOS, OneVolume, DICOM)
  - `GALILEOS` folders with `*_vol_0` and `*_vol_0_###`
  - `OneVolume` exports with native `CT_0.vol`
  - `DICOM` slice folders with `.dcm` files
- 🧊 **3 axial slices** (axial, sagittal, coronal) with linked crosshairs
- 🦷 **Renders 3D model** with intersecting plains
- 📱 **PWA-ready**, so you can install it on your phone or tablet

## Usage

| App                                 | Repository                           |
|:-----------------------------------:|:------------------------------------:|
| [📱 denysdovhan.com/voxel-viewer][app] | [👨‍💻 denysdovhan/voxel-viewer][app-repo] |
| [![QR code for app][app-qr-image]][app] | [![QR code for repository][app-repo-qr-image]][app-repo] |

## Sponsorship

Your generosity will help me maintain and develop more projects like this one.

- 💖 [Sponsor on GitHub][gh-sponsors-url]
- ☕️ [Buy Me A Coffee][buymeacoffee-url]
- Bitcoin: `bc1q7lfx6de8jrqt8mcds974l6nrsguhd6u30c6sg8`
- Ethereum: `0x6aF39C917359897ae6969Ad682C14110afe1a0a1`

## Tech Overview

Overall, this is a web-based app built with the following technologies:

- **React, TypeScript** - main framework and language
- **Vite** - build tool
- **Tailwind** - styling
- **Three.js** - 3D rendering
- **Web Workers** - background processing
- **`fflate`** - compression, unzipping

## Contributing

Clone the repository, install dependencies, and start the development server:

```bash
npm install
npm run dev
```

## License

[MIT](./LICENSE) © [Denys Dovhan][denysdovhan]

<!-- References -->

[app]: https://denysdovhan.com/voxel-viewer
[app-repo]: https://github.com/denysdovhan/voxel-viewer
[app-qr-image]: https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https%3A%2F%2Fdenysdovhan.com%2Fvoxel-viewer
[app-repo-qr-image]: https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=https%3A%2F%2Fgithub.com%2Fdenysdovhan%2Fvoxel-viewer
[denysdovhan]: https://denysdovhan.com
[cbct-wiki]: https://en.wikipedia.org/wiki/Cone_beam_computed_tomography

<!-- Badges -->

[gh-build-image]: https://img.shields.io/github/actions/workflow/status/denysdovhan/voxel-viewer/validate.yml?branch=main&style=flat-square
[gh-build-url]: https://github.com/denysdovhan/voxel-viewer/actions/workflows/validate.yml
[gh-sponsors-image]: https://img.shields.io/github/sponsors/denysdovhan?style=flat-square
[gh-sponsors-url]: https://github.com/sponsors/denysdovhan
[buymeacoffee-image]: https://img.shields.io/badge/support-buymeacoffee-222222.svg?style=flat-square
[buymeacoffee-url]: https://buymeacoffee.com/denysdovhan
[twitter-image]: https://img.shields.io/badge/follow-%40denysdovhan-000000.svg?style=flat-square
[twitter-url]: https://x.com/denysdovhan
