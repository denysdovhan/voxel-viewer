import type {
  BoxGeometry,
  Data3DTexture,
  DataTexture,
  Material,
  Mesh,
  ShaderMaterial,
  Texture,
} from 'three';
import type { PreparedVolumeFor3D } from '../../../types';
import type {
  ThreeModule,
  VolumeShaderModule,
  VolumeShaderUniforms,
} from '../types';

export function buildTexture(
  three: ThreeModule,
  volume: PreparedVolumeFor3D,
): Data3DTexture {
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

export function buildColormap(three: ThreeModule): DataTexture {
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    const luminance = Math.round(18 + t * 237);
    const alpha = Math.round(10 + t * 245);
    const offset = i * 4;
    data[offset] = luminance;
    data[offset + 1] = luminance;
    data[offset + 2] = luminance;
    data[offset + 3] = alpha;
  }

  const texture = new three.DataTexture(data, 256, 1, three.RGBAFormat);
  texture.minFilter = three.LinearFilter;
  texture.magFilter = three.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function buildMaterial(
  three: ThreeModule,
  volumeShader: VolumeShaderModule,
  volume: PreparedVolumeFor3D,
  texture: Data3DTexture,
  colormap: Texture,
): ShaderMaterial {
  const shader = volumeShader.VolumeRenderShader1;
  const uniforms = three.UniformsUtils.clone(
    shader.uniforms,
  ) as VolumeShaderUniforms;
  const scalarRange = Math.max(
    1,
    volume.scalarRange[1] - volume.scalarRange[0],
  );
  const normalizedThreshold = three.MathUtils.clamp(
    (volume.threshold - volume.scalarRange[0]) / scalarRange,
    0.02,
    0.98,
  );

  uniforms.u_data.value = texture;
  uniforms.u_size.value.set(
    volume.dimensions[0],
    volume.dimensions[1],
    volume.dimensions[2],
  );
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

export function buildVolumeMesh(
  three: ThreeModule,
  volume: PreparedVolumeFor3D,
  material: Material,
): Mesh<BoxGeometry, Material> {
  const geometry: BoxGeometry = new three.BoxGeometry(
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
