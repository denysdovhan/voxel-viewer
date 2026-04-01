# Step 3 Summary: MPR Zoom And Scrub Navigation

## Scope

This step focused on the 2D MPR panes:

- shared zoom across coronal, sagittal, and axial
- mouse-wheel zoom
- touch pinch zoom
- zoom placement around the linked crosshair
- drag-based slice scrubbing in 2D panes

## Final State

The current implementation keeps these behaviors:

- one shared zoom level for all three 2D panes
- wheel zoom on desktop
- two-finger pinch zoom on touch devices
- zoom placement keeps the crosshair as close to center as possible, clamped to image bounds
- click or tap still repositions the crosshair
- drag inside a 2D pane scrubs linked slices live
- when zoomed, scrubbing keeps navigation centered around the current point of interest

## Important Interaction Decisions

- coronal and sagittal stay superior-at-top
- no free-pan mode was added
- no separate zoom reset button was added
- one-finger touch is reserved for selection/scrub
- two-finger touch is reserved for pinch zoom

## Performance Work That Stayed

- slice image caching in `src/lib/volume/index.ts` is keyed by axis slice index plus window/level, not full cursor
- cached slice images keep stable references when the underlying slice index does not change
- `src/components/SliceCanvas.tsx` avoids unnecessary canvas data cloning on draw
- cursor updates already bail out when rounded voxel coordinates do not change

## Approaches Tried And Rejected

- a dedicated 2D slice worker was attempted and then removed
  - it caused rendering regressions and was not kept
  - do not assume a slice worker exists for MPR rendering
- app-level queued scrub stepping was attempted and then reverted
  - it reduced skipped visible indices in some cases
  - but it kept moving after pointer release when many steps were queued
  - the user explicitly preferred immediate stop on release over queued catch-up behavior

## Current Limitation

- drag scrubbing can still feel like it skips some slice numbers under load
- this appears tied to UI/render pacing, not just raw pointer math
- any future fix must preserve immediate stop on release

## Guidance For Future Iterations

- before changing MPR interaction again, read this log and inspect the current `SliceCanvas` scrub flow
- do not reintroduce the removed 2D slice worker without a new design review
- do not reintroduce deferred scrub queues that continue after release unless the user explicitly asks for inertial or buffered behavior
- prefer minimal changes that preserve the current zoom, pinch, and crosshair-centered navigation model
- validate each meaningful pass with `npm run build`

## Relevant Files

- `src/App.tsx`
  - shared MPR zoom state, viewer wiring, linked cursor
- `src/components/SliceCanvas.tsx`
  - wheel zoom, pinch zoom, zoom placement, drag scrubbing
- `src/lib/volume/index.ts`
  - slice extraction and slice-image cache behavior
