# Phase 2 Plan: 3D Quality And Plane Controls

## Scope

Panorama is no longer the primary target.

This phase focuses on improving the 3D viewer:

- fix slice-plane geometry so all planes span the full volume bounds
- add overlay controls for plane visibility
- remove the amber/yellow tint and use neutral white volume shading
- raise 3D preview fidelity as far as practical without breaking responsiveness
- show a local 3D loading state when the renderer takes noticeable time to appear

## Root Causes Investigated

- the violet plane did not fill the volume because the YZ plane geometry used swapped world axes incorrectly after rotation
- the 3D viewport had no explicit local loading state; async renderer creation could look blank before mount completed
- the yellow appearance came from the custom 1D colormap, not from the volume data
- 3D resolution was capped by a conservative texture-edge budget

## Constraints

- preserve the currently visible Three.js renderer path
- avoid breaking the working cursor-linked slice overlays
- keep import responsiveness acceptable
- validate with `npm run build`
