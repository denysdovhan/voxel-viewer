# OneVolume CT Support

## Outcome

- The viewer now supports three separate import paths:
  - GALILEOS compressed slice folders
  - OneVolume native `CT_0.vol` folders
  - DICOM slice folders
- OneVolume native `.vol` loading and standalone DICOM loading were both manually confirmed in-thread to work.
- The earlier hybrid OneVolume path was removed after native `.vol` MPR and 3D loading became reliable enough on their own.

## Final Architecture

- Import detection is adapter-based in `src/lib/import/adapters/`.
- Each format owns its own folder matcher, parser, and worker request builder:
  - `adapters/galileos/`
  - `adapters/dicom/`
  - `adapters/onevolume/`
- `src/lib/import/load-volume.ts` selects the first matching adapter and sends one stable worker request to `src/workers/volume.worker.ts`.
- The worker entrypoint stays small and delegates assembly to `src/workers/volume/assemble/*`.
- Shared worker concerns are split into:
  - `src/workers/volume/scalars.ts`
  - `src/workers/volume/progress.ts`
  - `src/workers/volume/types.ts`

## OneVolume Reverse-Engineering Notes

- `CT_0.vol` is parsed as:
  - 4-byte prefix
  - `JmVolumeVersion=1`
  - 4-byte XML length
  - XML payload
  - 36-byte `CArray3D` bounds block
  - raw signed voxel payload
- Native OneVolume voxels are stored as signed `int16`.
- `-32768` is treated as a sentinel/background value and excluded from scalar-range calculations.
- The decoded payload is scaled into viewer units using the embedded XML slope/intercept metadata.
- OneVolume metadata parsing also reads:
  - grid spacing from XML
  - initial window/level from `CtStatus.csv`
  - crop/origin hints from `Constants1100.xml`
- Final native decode path uses the parsed source dimensions and offsets to build the canonical viewer volume.

## DICOM Notes

- DICOM support was added as a first-class import format, not just a OneVolume fallback.
- The scan-time parser reads a bounded header slice and allows partial reads as long as the required geometry tags are present.
- Full pixel decoding still happens in the worker against the complete file buffer.
- DICOM slices are sorted by computed slice location and validated for consistent geometry/pixel format before assembly.

## UI / Import Guidance

- Homepage copy now documents supported formats explicitly.
- Folder examples are rendered as monospace UI code labels instead of literal backticks.
- Current guidance:
  - `GALILEOS`: select the folder containing `*_vol_0` and `*_vol_0_###`
  - `OneVolume CT`: select the `CT_*` folder containing `CT_0.vol`, or the export root if it contains that nested folder
  - `DICOM CT`: select the folder containing the `.dcm` slices, usually `DICOM/`
  - `Series_01/` is reference-only and is not imported

## Refactors Done During This Phase

- Import logic was reorganized from flat `parse-*` files into per-format adapter folders.
- `src/lib/volume/index.ts` was split into smaller modules:
  - `math.ts`
  - `voxels.ts`
  - `slices.ts`
  - `preview-3d.ts`
- `src/lib/volume/three-preview.ts` was split into `src/lib/volume/three-preview/*`.
- `src/workers/volume.worker.ts` was reduced to orchestration, with format-specific assembly moved into `src/workers/volume/assemble/*`.

## Validation

- Repeated `npm run build` validation was used throughout the implementation.
- In-thread manual validation confirmed:
  - standalone DICOM import works
  - standalone OneVolume `.vol` import works
  - MPR panes are no longer blank for the working OneVolume path

## Rejected / Removed Approaches

- Hybrid OneVolume loading (`.vol` for 3D plus DICOM for MPR) was tried temporarily, then removed.
- Treating the project as GALILEOS-only is now outdated.
- `Series_01/` was intentionally left unsupported as a direct import source.

## Follow-Up Considerations

- If more OneVolume samples appear, re-check the current native `.vol` assumptions against them before generalizing further.
- If DICOM quality/windowing needs improvement, tune that separately from the native OneVolume decoder.
