import type {
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { PLANE_COLORS } from '../../../constants';
import type { CursorPlaneSet, ThreeModule } from '../types';

const CURSOR_PLANE_OVERSCAN = 1.2;

function buildIntersectionGeometry(
  three: ThreeModule,
  start: readonly [number, number, number],
  end: readonly [number, number, number],
): BufferGeometry {
  const geometry = new three.BufferGeometry();
  geometry.setFromPoints([
    new three.Vector3(...start),
    new three.Vector3(...end),
  ]);
  return geometry;
}

export function buildCursorPlanes(
  three: ThreeModule,
  worldSize: readonly [number, number, number],
  center: Vector3,
): CursorPlaneSet {
  const root: Group = new three.Group();
  const materials: MeshBasicMaterial[] = [
    new three.MeshBasicMaterial({
      color: PLANE_COLORS.axial,
      transparent: true,
      opacity: 0.11,
      side: three.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
    new three.MeshBasicMaterial({
      color: PLANE_COLORS.coronal,
      transparent: true,
      opacity: 0.1,
      side: three.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
    new three.MeshBasicMaterial({
      color: PLANE_COLORS.sagittal,
      transparent: true,
      opacity: 0.1,
      side: three.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  ];
  const lineMaterials: LineBasicMaterial[] = [
    new three.LineBasicMaterial({
      color: PLANE_COLORS.axial,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    }),
    new three.LineBasicMaterial({
      color: PLANE_COLORS.coronal,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    }),
    new three.LineBasicMaterial({
      color: PLANE_COLORS.sagittal,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    }),
  ];
  const intersectionMaterials: LineBasicMaterial[] = [
    new three.LineBasicMaterial({
      color: PLANE_COLORS.sagittal,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
    new three.LineBasicMaterial({
      color: PLANE_COLORS.coronal,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
    new three.LineBasicMaterial({
      color: PLANE_COLORS.axial,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    }),
  ];

  const xyGeometry: PlaneGeometry = new three.PlaneGeometry(
    worldSize[0] * CURSOR_PLANE_OVERSCAN,
    worldSize[1] * CURSOR_PLANE_OVERSCAN,
  );
  const xzGeometry: PlaneGeometry = new three.PlaneGeometry(
    worldSize[0] * CURSOR_PLANE_OVERSCAN,
    worldSize[2] * CURSOR_PLANE_OVERSCAN,
  );
  const yzGeometry: PlaneGeometry = new three.PlaneGeometry(
    worldSize[2] * CURSOR_PLANE_OVERSCAN,
    worldSize[1] * CURSOR_PLANE_OVERSCAN,
  );

  const xyPlane: Mesh<PlaneGeometry, MeshBasicMaterial> = new three.Mesh(
    xyGeometry,
    materials[0],
  );
  const xzPlane: Mesh<PlaneGeometry, MeshBasicMaterial> = new three.Mesh(
    xzGeometry,
    materials[1],
  );
  const yzPlane: Mesh<PlaneGeometry, MeshBasicMaterial> = new three.Mesh(
    yzGeometry,
    materials[2],
  );
  xzPlane.rotation.x = Math.PI / 2;
  yzPlane.rotation.y = Math.PI / 2;

  const xyEdges: LineSegments = new three.LineSegments(
    new three.EdgesGeometry(xyGeometry),
    lineMaterials[0],
  );
  const xzEdges: LineSegments = new three.LineSegments(
    new three.EdgesGeometry(xzGeometry),
    lineMaterials[1],
  );
  const yzEdges: LineSegments = new three.LineSegments(
    new three.EdgesGeometry(yzGeometry),
    lineMaterials[2],
  );
  xzEdges.rotation.x = Math.PI / 2;
  yzEdges.rotation.y = Math.PI / 2;

  const xIntersection: Line = new three.Line(
    buildIntersectionGeometry(
      three,
      [-worldSize[0] * CURSOR_PLANE_OVERSCAN * 0.5, 0, 0],
      [worldSize[0] * CURSOR_PLANE_OVERSCAN * 0.5, 0, 0],
    ),
    intersectionMaterials[0],
  );
  const yIntersection: Line = new three.Line(
    buildIntersectionGeometry(
      three,
      [0, -worldSize[1] * CURSOR_PLANE_OVERSCAN * 0.5, 0],
      [0, worldSize[1] * CURSOR_PLANE_OVERSCAN * 0.5, 0],
    ),
    intersectionMaterials[1],
  );
  const zIntersection: Line = new three.Line(
    buildIntersectionGeometry(
      three,
      [0, 0, -worldSize[2] * CURSOR_PLANE_OVERSCAN * 0.5],
      [0, 0, worldSize[2] * CURSOR_PLANE_OVERSCAN * 0.5],
    ),
    intersectionMaterials[2],
  );

  for (const object of [
    xyPlane,
    xzPlane,
    yzPlane,
    xyEdges,
    xzEdges,
    yzEdges,
    xIntersection,
    yIntersection,
    zIntersection,
  ]) {
    object.renderOrder = 4;
    root.add(object);
  }

  const update = (target: Vector3) => {
    xyPlane.position.set(center.x, center.y, target.z);
    xzPlane.position.set(center.x, target.y, center.z);
    yzPlane.position.set(target.x, center.y, center.z);
    xyEdges.position.copy(xyPlane.position);
    xzEdges.position.copy(xzPlane.position);
    yzEdges.position.copy(yzPlane.position);
    xIntersection.position.set(center.x, target.y, target.z);
    yIntersection.position.set(target.x, center.y, target.z);
    zIntersection.position.set(target.x, target.y, center.z);
  };

  const dispose = () => {
    xyGeometry.dispose();
    xzGeometry.dispose();
    yzGeometry.dispose();
    xyEdges.geometry.dispose();
    xzEdges.geometry.dispose();
    yzEdges.geometry.dispose();
    xIntersection.geometry.dispose();
    yIntersection.geometry.dispose();
    zIntersection.geometry.dispose();
    for (const material of [
      ...materials,
      ...lineMaterials,
      ...intersectionMaterials,
    ]) {
      material.dispose();
    }
  };

  return { root, update, dispose };
}
