import type {
  PreparedVolumeFor3D,
  ReadonlyVec3,
  Vec3,
  VolumeCursor,
} from '../../../types';
import type { ThreeModule } from '../types';

export function resolveAxisScale(
  spacing: PreparedVolumeFor3D['spacing'],
): Vec3 {
  const positive = spacing.filter((value) => value > 0);
  const minSpacing = positive.length > 0 ? Math.min(...positive) : 1;
  return [
    Math.max(0.5, spacing[0] / minSpacing),
    Math.max(0.5, spacing[1] / minSpacing),
    Math.max(0.5, spacing[2] / minSpacing),
  ];
}

export function applyDistanceLimits(
  camera: { far: number; updateProjectionMatrix: () => void },
  controls: { minDistance: number; maxDistance: number },
  worldSize: ReadonlyVec3,
  target: { x: number; y: number; z: number },
): void {
  const minDistance = resolveMinimumCameraDistance(worldSize, target);
  controls.minDistance = minDistance;
  controls.maxDistance = Math.max(minDistance * 12, Math.max(...worldSize) * 9);
  const maxVisibleDistance = controls.maxDistance + minDistance;
  camera.far = Math.max(maxVisibleDistance * 1.1, Math.max(...worldSize) * 8);
  camera.updateProjectionMatrix();
}

function resolveMinimumCameraDistance(
  worldSize: ReadonlyVec3,
  target: { x: number; y: number; z: number },
): number {
  const corners = [
    [0, 0, 0],
    [worldSize[0], 0, 0],
    [0, worldSize[1], 0],
    [0, 0, worldSize[2]],
    [worldSize[0], worldSize[1], 0],
    [worldSize[0], 0, worldSize[2]],
    [0, worldSize[1], worldSize[2]],
    [worldSize[0], worldSize[1], worldSize[2]],
  ] as const;

  let furthestCornerDistance = 1;
  for (const [x, y, z] of corners) {
    const dx = x - target.x;
    const dy = y - target.y;
    const dz = z - target.z;
    furthestCornerDistance = Math.max(
      furthestCornerDistance,
      Math.hypot(dx, dy, dz),
    );
  }

  return furthestCornerDistance * 1.02;
}

function clampRatio(offset: number, size: number): number {
  if (size <= 1) return 0;
  return Math.min(1, Math.max(0, offset / (size - 1)));
}

export function cursorToWorldTarget(
  three: ThreeModule,
  volume: PreparedVolumeFor3D,
  axisScale: ReadonlyVec3,
  cursor: VolumeCursor,
) {
  const ratioX = clampRatio(
    cursor.x - volume.origin[0],
    volume.sourceDimensions[0],
  );
  const ratioY = clampRatio(
    cursor.y - volume.origin[1],
    volume.sourceDimensions[1],
  );
  const ratioZ = clampRatio(
    cursor.z - volume.origin[2],
    volume.sourceDimensions[2],
  );
  const localX = ratioX * Math.max(1, volume.dimensions[0] - 1);
  const localY = ratioY * Math.max(1, volume.dimensions[1] - 1);
  const localZ = ratioZ * Math.max(1, volume.dimensions[2] - 1);

  return new three.Vector3(
    localX * axisScale[0],
    localY * axisScale[1],
    localZ * axisScale[2],
  );
}
