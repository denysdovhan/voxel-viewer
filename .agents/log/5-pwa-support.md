# PWA Readiness for Voxel Viewer

## Summary

Make the app a standard installable PWA using Vite’s PWA plugin, generated app icons from the existing `logo/` assets, and an offline-capable service worker that caches the built app shell. Scope is limited to offline app availability, not persistence of previously opened scan data. Install stays browser-native only.

## Key Changes

- Add `vite-plugin-pwa` and wire it into [vite.config.ts](/Users/denysd/Projects/Repos/voxel-viewer/vite.config.ts) with a production service worker.
- Configure a web app manifest with:
  - `name`: `Voxel Viewer`
  - `short_name`: `Voxel`
  - `display`: `standalone`
  - `start_url` and `scope` derived from the existing Vite base path so GitHub Pages still works under `/voxel-viewer/`
  - app `theme_color` / `background_color` aligned to the existing dark UI
  - icon entries for standard and maskable variants
- Register the service worker from [src/main.tsx](/Users/denysd/Projects/Repos/voxel-viewer/src/main.tsx) using the plugin’s client helper with automatic update behavior that does not require custom UI.
- Add favicon and platform icons to the app shell:
  - favicon for browsers
  - Apple touch icon
  - 192px and 512px PWA icons
  - at least one `purpose: maskable` icon
- Generate icon assets from the existing `logo/voxel-viewer-logo.svg` or highest-resolution PNG in `logo/`.
  - Use the existing mark centered inside a padded square
  - Use a solid dark slate background for maskable/install surfaces so the transparent logo does not crop badly
  - Reuse the same source art for favicon, but simplify/export at small sizes for clarity
- Update [index.html](/Users/denysd/Projects/Repos/voxel-viewer/index.html) metadata:
  - favicon link
  - apple touch icon link
  - theme color
  - manifest link if not injected automatically by the plugin
- Offline behavior:
  - precache the built HTML/CSS/JS/worker chunks, manifest, and icon assets
  - enable SPA navigation fallback to `index.html` so `/` and `/viewer` still boot offline
  - do not add runtime caching for remote APIs, since the app does not depend on them
  - do not attempt to cache imported scan folders across launches
- Add brief README notes describing:
  - installability expectations
  - offline scope and limitation that users reopen local folders when needed

## Public Interfaces / Types

- No viewer-state or import-flow API changes.
- New platform-facing artifacts only:
  - `manifest.webmanifest`
  - service worker registration
  - favicon / touch icon / PWA icon assets

## Test Plan

- `npm run build` passes with the PWA plugin enabled.
- Built output contains manifest, service worker, favicon, touch icon, and PWA icons.
- App loads from the GitHub Pages base path and still routes correctly between `/` and `/viewer`.
- In Chrome, the site meets installability requirements and shows browser-native install availability.
- After first online load, reload with network disabled:
  - app shell opens offline
  - direct navigation to the viewer route still resolves to the app shell
  - opening a new scan folder still works when the browser supports local folder access
- Verify favicon appears in the browser tab and installed-app icon looks correct on dark/light launcher surfaces.

## Assumptions

- Offline means “the app itself works offline,” not “previously opened scan data is retained offline between launches.”
- Install UI will not be added inside the app; browser-native install behavior is sufficient.
- A dependency addition is acceptable for `vite-plugin-pwa`.
- Icon generation can be done from the existing `logo/` assets without requesting new artwork.
