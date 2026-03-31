import type { PreparedVolumeFor3D } from '../../types';

type ThreeModule = any;
type OrbitControlsModule = any;
type VolumeShaderModule = any;

export interface ThreePreviewInstance {
  dispose: () => void;
}

export async function createThreePreview(
  host: HTMLDivElement,
  volume: PreparedVolumeFor3D,
): Promise<ThreePreviewInstance> {
  const [three, orbitControls, volumeShader] = await Promise.all([
    // @ts-expect-error three ships JS entrypoints here in this workspace
    import('three'),
    // @ts-expect-error three ships JS entrypoints here in this workspace
    import('three/examples/jsm/controls/OrbitControls.js'),
    // @ts-expect-error three ships JS entrypoints here in this workspace
    import('three/examples/jsm/shaders/VolumeShader.js'),
  ]);

  return buildPreview(three, orbitControls, volumeShader, host, volume);
}

function buildPreview(
  three: ThreeModule,
  orbitControls: OrbitControlsModule,
  volumeShader: VolumeShaderModule,
  host: HTMLDivElement,
  volume: PreparedVolumeFor3D,
): ThreePreviewInstance {
  host.replaceChildren();

  const scene = new three.Scene();
  scene.background = new three.Color(0x050b13);

  const renderer = new three.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false);
  renderer.outputColorSpace = three.SRGBColorSpace;
  renderer.setClearColor(0x050b13, 1);
  host.appendChild(renderer.domElement);

  const camera = new three.PerspectiveCamera(
    38,
    Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
    0.1,
    500,
  );

  const controls = new orbitControls.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.5;
  controls.minDistance = 1.2;
  controls.maxDistance = 10;

  const texture = buildTexture(three, volume);
  const colormap = buildColormap(three);
  const material = buildMaterial(three, volumeShader, volume, texture, colormap);
  const mesh = buildVolumeMesh(three, volume, material);
  scene.add(mesh);

  const axisScale = resolveAxisScale(volume.spacing);
  mesh.scale.set(axisScale[0], axisScale[1], axisScale[2]);

  const worldSize = [
    Math.max(1, volume.dimensions[0] - 1) * axisScale[0],
    Math.max(1, volume.dimensions[1] - 1) * axisScale[1],
    Math.max(1, volume.dimensions[2] - 1) * axisScale[2],
  ] as const;
  const maxWorldEdge = Math.max(...worldSize) || 1;

  const center = new three.Vector3(
    ((volume.dimensions[0] - 1) / 2) * axisScale[0],
    ((volume.dimensions[1] - 1) / 2) * axisScale[1],
    ((volume.dimensions[2] - 1) / 2) * axisScale[2],
  );
  camera.near = Math.max(0.1, maxWorldEdge / 2048);
  camera.far = maxWorldEdge * 8;
  camera.updateProjectionMatrix();
  camera.position.set(
    center.x + maxWorldEdge * 0.18,
    center.y - maxWorldEdge * 1.05,
    center.z + maxWorldEdge * 1.35,
  );
  camera.lookAt(center);
  controls.minDistance = maxWorldEdge * 0.25;
  controls.maxDistance = maxWorldEdge * 4.5;
  controls.target.copy(center);
  controls.update();

  let frame = 0;
  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
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
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
      colormap.dispose();
      renderer.dispose();
      host.replaceChildren();
    },
  };
}

function buildTexture(three: ThreeModule, volume: PreparedVolumeFor3D) {
  const texture = new three.Data3DTexture(
    volume.voxels,
    volume.dimensions[0],
    volume.dimensions[1],
    volume.dimensions[2],
  );
  texture.format = three.RedFormat;
  texture.type = three.UnsignedByteType;
  texture.minFilter = three.LinearFilter;
  texture.magFilter = three.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

function buildColormap(three: ThreeModule) {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const r = Math.round(46 + t * 192);
    const g = Math.round(34 + t * 180);
    const b = Math.round(22 + t * 122);
    const a = Math.round(24 + t * 231);
    const offset = i * 4;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = a;
  }

  const texture = new three.DataTexture(data, 256, 1, three.RGBAFormat);
  texture.minFilter = three.LinearFilter;
  texture.magFilter = three.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function buildMaterial(
  three: ThreeModule,
  volumeShader: VolumeShaderModule,
  volume: PreparedVolumeFor3D,
  texture: any,
  colormap: any,
) {
  const shader = volumeShader.VolumeRenderShader1;
  const uniforms = three.UniformsUtils.clone(shader.uniforms);
  const scalarRange = Math.max(1, volume.scalarRange[1] - volume.scalarRange[0]);
  const normalizedThreshold = three.MathUtils.clamp(
    (volume.threshold - volume.scalarRange[0]) / scalarRange,
    0.02,
    0.98,
  );
  uniforms.u_data.value = texture;
  uniforms.u_size.value.set(volume.dimensions[0], volume.dimensions[1], volume.dimensions[2]);
  uniforms.u_clim.value.set(0, 1);
  uniforms.u_renderstyle.value = 0;
  uniforms.u_renderthreshold.value = normalizedThreshold;
  uniforms.u_cmdata.value = colormap;

  return new three.ShaderMaterial({
    uniforms,
    vertexShader: shader.vertexShader,
    fragmentShader: shader.fragmentShader,
    side: three.BackSide,
    transparent: false,
  });
}

function buildVolumeMesh(three: ThreeModule, volume: PreparedVolumeFor3D, material: any) {
  const geometry = new three.BoxGeometry(
    Math.max(1, volume.dimensions[0] - 1),
    Math.max(1, volume.dimensions[1] - 1),
    Math.max(1, volume.dimensions[2] - 1),
  );
  geometry.translate(
    (volume.dimensions[0] - 1) / 2,
    (volume.dimensions[1] - 1) / 2,
    (volume.dimensions[2] - 1) / 2,
  );
  return new three.Mesh(geometry, material);
}

function resolveAxisScale(spacing: PreparedVolumeFor3D['spacing']): [number, number, number] {
  const positive = spacing.filter((value) => value > 0);
  const minSpacing = positive.length > 0 ? Math.min(...positive) : 1;
  return [
    Math.max(0.5, spacing[0] / minSpacing),
    Math.max(0.5, spacing[1] / minSpacing),
    Math.max(0.5, spacing[2] / minSpacing),
  ];
}
