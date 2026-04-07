# React-i18next I18n

## Summary

Add app-wide localization with `react-i18next`, JSON locale files, browser-language auto-detect, and `localStorage` persistence. Ship `en` and `uk`, and add a homescreen toggle that switches language immediately.

## Key Changes

- Add i18n bootstrap with `i18next` + `react-i18next`.
  - Configure resources from JSON files under `src/i18n/locales/`.
  - Detection order:
    1. stored locale in `localStorage`
    2. browser language
    3. fallback `en`
  - Persist any resolved/manual locale back to `localStorage`.
  - Initialize once at app start, before rendering routes.
- Wire the provider at the app root.
  - Wrap `BrowserRouter` in `src/App.tsx` with `I18nextProvider`.
  - Keep basename/base-path logic unchanged.
- Localize all current UI copy.
  - Homescreen, folder picker, loading fallback, import status, viewer sidebar, 3D controls, axis labels, and error text.
  - Move disclaimer text and progress strings out of hardcoded constants into locale resources.
  - Replace raw `ImportStage` enum output with localized labels.
- Add a homescreen language toggle.
  - Place it in the import page hero/header.
  - Show `EN` and `UK`.
  - Active locale is visually selected.
  - Changing it updates the whole app immediately.
- Keep the viewer on the same locale.
  - No second toggle in the viewer for this pass.
  - User can return to import and switch there if needed.

## Public Interfaces / Types

- Add locale resource shape and translation keys for:
  - `common`
  - `importPage`
  - `folderPicker`
  - `importStatus`
  - `viewerPage`
  - `viewerSidebar`
  - `axisViewport`
  - `volumeViewport3d`
  - `errors`
- Add a small locale helper for:
  - resolving the active locale
  - reading/writing `localStorage`
  - exposing a typed `t()` wrapper where it reduces repetition
- Stop exporting plain English UI strings from constants where they belong in translated resources.

## Test Plan

- Verify startup locale resolution:
  - saved locale wins over browser language
  - browser `uk*` selects Ukrainian
  - everything else falls back to English
- Verify homescreen toggle:
  - switching locale updates all visible import-page text immediately
  - selection persists after refresh
- Verify localized runtime strings:
  - scanning/loading/error status text
  - viewer labels and control labels
  - loading fallback and unsupported states
- Regression checks:
  - folder picking still works
  - router/base-path behavior unchanged
  - viewer layout and compact mode unchanged apart from copy
- Run:
  - `npm run build`
  - `npm run format:check`
  - `npm run lint`

## Assumptions

- First release ships only `en` and `uk`.
- JSON resources are sufficient; no ICU/plural tooling is needed yet.
- Locale choice is app-wide, not route-based.
- The plan text itself cannot be written into `.agents/log` until execution mode is available.
