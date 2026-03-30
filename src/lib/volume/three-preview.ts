import type { PreparedVolumeFor3D } from '../../types';

type ThreeModule = any;
type OrbitControlsModule = any;
type MarchingCubesModule = any;

const SURFACE_MAX_VERTICES = 120_000;
const SURFACE_SCALE = 116;

export interface ThreePreviewInstance {
  dispose: () => void;
}

export async function createThreePreview(
  host: HTMLDivElement,
  volume: PreparedVolumeFor3D,
): Promise<ThreePreviewInstance> {
  const [three, orbitControls, marchingCubes] = await Promise.all([
    // @ts-expect-error three ships JS entrypoints here in this workspace
    import('three'),
    // @ts-expect-error three ships JS entrypoints here in this workspace
    import('three/examples/jsm/controls/OrbitControls.js'),
    // @ts-expect-error three ships JS entrypoints here in this workspace
    import('three/examples/jsm/objects/MarchingCubes.js'),
  ]);

  return buildPreview(three, orbitControls, marchingCubes, host, volume);
}

function buildPreview(
  three: ThreeModule,
  orbitControls: OrbitControlsModule,
  marchingCubes: MarchingCubesModule,
  host: HTMLDivElement,
  volume: PreparedVolumeFor3D,
): ThreePreviewInstance {
  host.replaceChildren();

  const scene = new three.Scene();
  scene.background = new three.Color(0x071018);

  const camera = new three.PerspectiveCamera(38, 1, 0.1, 3000);
  const renderer = new three.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
  renderer.outputColorSpace = three.SRGBColorSpace;
  renderer.setClearColor(0x071018, 1);
  host.appendChild(renderer.domElement);

  const controls = new orbitControls.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.panSpeed = 0.6;

  const previewObject = buildPreviewObject(three, marchingCubes, volume);
  scene.add(previewObject);

  const ambient = new three.HemisphereLight(0xe7edf7, 0x071018, 1.25);
  const key = new three.DirectionalLight(0xffffff, 1.3);
  key.position.set(1.6, 2.2, 1.4);
  const fill = new three.DirectionalLight(0x9db9d6, 0.45);
  fill.position.set(-1.4, 0.9, -1.2);
  scene.add(ambient);
  scene.add(key);
  scene.add(fill);

  const box = new three.Box3().setFromObject(previewObject);
  const center = box.getCenter(new three.Vector3());
  const size = box.getSize(new three.Vector3());
  const radius = Math.max(size.x, size.y, size.z) || 1;
  camera.near = Math.max(0.1, radius / 250);
  camera.far = radius * 12;
  camera.position.set(center.x + radius * 1.3, center.y + radius * 0.8, center.z + radius * 1.6);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.minDistance = radius * 0.8;
  controls.maxDistance = radius * 4.5;
  controls.update();

  let frame = 0;
  const resizeObserver = new ResizeObserver(() => {
    const width = host.clientWidth || 1;
    const height = host.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });
  resizeObserver.observe(host);

  const render = () => {
    frame = window.requestAnimationFrame(render);
    controls.update();
    renderer.render(scene, camera);
  };
  render();

  return {
    dispose() {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      controls.dispose();
      previewObject.traverse((object: unknown) => {
        const mesh = object as {
          geometry?: { dispose?: () => void };
          material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
        };
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((entry) => entry.dispose?.());
        } else {
          mesh.material?.dispose?.();
        }
      });
      renderer.dispose();
      host.replaceChildren();
    },
  };
}

function buildPreviewObject(
  three: ThreeModule,
  marchingCubes: MarchingCubesModule,
  volume: PreparedVolumeFor3D,
) {
  const group = new three.Group();
  const surface = buildIsoSurface(three, marchingCubes, volume);
  const box = new three.Box3().setFromObject(surface);

  if (!box.isEmpty()) {
    group.add(surface);
    return group;
  }

  surface.geometry?.dispose?.();
  surface.material?.dispose?.();
  group.add(buildFallbackPointCloud(three, volume));
  return group;
}

function buildIsoSurface(
  three: ThreeModule,
  marchingCubes: MarchingCubesModule,
  volume: PreparedVolumeFor3D,
) {
  const [width, height, depth] = volume.dimensions;
  const resolution = resolveMarchingResolution(width, height, depth);
  const material = new three.MeshStandardMaterial({
    color: 0xe0e5ec,
    roughness: 0.34,
    metalness: 0.04,
    transparent: true,
    opacity: 0.96,
    side: three.DoubleSide,
  });
  const surface = new marchingCubes.MarchingCubes(
    resolution,
    material,
    false,
    false,
    SURFACE_MAX_VERTICES,
  );
  surface.reset();

  const maxScalar = Math.max(volume.scalarRange[1], volume.threshold + 1);
  const range = Math.max(1, maxScalar - volume.threshold);

  for (let z = 0; z < resolution; z += 1) {
    const sourceZ = sampleIndex(resolution - 1 - z, resolution, depth);
    for (let y = 0; y < resolution; y += 1) {
      const sourceY = sampleIndex(y, resolution, height);
      for (let x = 0; x < resolution; x += 1) {
        const sourceX = sampleIndex(x, resolution, width);
        const sourceIndex = sourceZ * width * height + sourceY * width + sourceX;
        const value = volume.voxels[sourceIndex] ?? 0;
        const normalized = value <= volume.threshold ? 0 : ((value - volume.threshold) / range) * 100;
        surface.setCell(x, y, z, normalized);
      }
    }
  }

  surface.isolation = 14;
  surface.blur(0.35);
  surface.update();

  const maxEdge = Math.max(width, height, depth) || 1;
  surface.scale.set(
    (width / maxEdge) * SURFACE_SCALE,
    (height / maxEdge) * SURFACE_SCALE,
    (depth / maxEdge) * SURFACE_SCALE,
  );
  surface.rotation.x = -Math.PI / 2;
  surface.rotation.z = Math.PI;

  return surface;
}

function buildFallbackPointCloud(three: ThreeModule, volume: PreparedVolumeFor3D) {
  const [width, height, depth] = volume.dimensions;
  const maxEdge = Math.max(width, height, depth) || 1;
  const stride = Math.max(1, Math.floor(Math.cbrt((width * height * depth) / 110_000)));
  const positions: number[] = [];
  const colors: number[] = [];
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  const centerZ = (depth - 1) / 2;

  for (let z = 1; z < depth - 1; z += stride) {
    for (let y = 1; y < height - 1; y += stride) {
      for (let x = 1; x < width - 1; x += stride) {
        const index = z * width * height + y * width + x;
        const value = volume.voxels[index] ?? 0;
        if (value < volume.threshold) continue;

        if (
          (volume.voxels[index - 1] ?? 0) >= volume.threshold &&
          (volume.voxels[index + 1] ?? 0) >= volume.threshold &&
          (volume.voxels[index - width] ?? 0) >= volume.threshold &&
          (volume.voxels[index + width] ?? 0) >= volume.threshold &&
          (volume.voxels[index - width * height] ?? 0) >= volume.threshold &&
          (volume.voxels[index + width * height] ?? 0) >= volume.threshold
        ) {
          continue;
        }

        positions.push(
          ((x - centerX) / maxEdge) * SURFACE_SCALE,
          ((z - centerZ) / maxEdge) * SURFACE_SCALE,
          ((centerY - y) / maxEdge) * SURFACE_SCALE,
        );

        const intensity = Math.min(1, value / Math.max(1, volume.scalarRange[1]));
        const shade = 0.52 + intensity * 0.36;
        colors.push(shade, shade, Math.min(1, shade + 0.02));
      }
    }
  }

  const geometry = new three.BufferGeometry();
  geometry.setAttribute('position', new three.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new three.Float32BufferAttribute(colors, 3));

  const material = new three.PointsMaterial({
    size: 1.15,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  return new three.Points(geometry, material);
}

function resolveMarchingResolution(width: number, height: number, depth: number): number {
  const maxEdge = Math.max(width, height, depth);
  if (maxEdge <= 96) return 72;
  if (maxEdge <= 140) return 80;
  return 88;
}

function sampleIndex(index: number, outSize: number, inSize: number): number {
  if (outSize <= 1 || inSize <= 1) return 0;
  return Math.min(inSize - 1, Math.round((index / (outSize - 1)) * (inSize - 1)));
}
