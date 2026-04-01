import type {
	BoxGeometry,
	BufferGeometry,
	Data3DTexture,
	DataTexture,
	Group,
	Line,
	LineBasicMaterial,
	LineSegments,
	Material,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	ShaderMaterial,
	Texture,
	Vector3,
} from "three";
import { PLANE_COLORS } from "../../constants";
import type { PreparedVolumeFor3D, VolumeCursor } from "../../types";
import type {
	CursorPlaneSet,
	ThreeModule,
	ThreePreviewInstance,
	TrackballControlsModule,
	VolumeShaderModule,
	VolumeShaderUniforms,
} from "./types";

export type { ThreePreviewInstance } from "./types";

const CURSOR_PLANE_OVERSCAN = 1.2;

export async function createThreePreview(
	host: HTMLDivElement,
	volume: PreparedVolumeFor3D,
): Promise<ThreePreviewInstance> {
	const [three, trackballControls, volumeShader] = await Promise.all([
		import("three"),
		import("three/addons/controls/TrackballControls.js"),
		import("three/addons/shaders/VolumeShader.js"),
	]);

	return buildPreview(three, trackballControls, volumeShader, host, volume);
}

function buildPreview(
	three: ThreeModule,
	trackballControls: TrackballControlsModule,
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
		powerPreference: "high-performance",
	});
	renderer.domElement.style.display = "block";
	renderer.domElement.style.width = "100%";
	renderer.domElement.style.height = "100%";
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
	renderer.setSize(
		Math.max(1, host.clientWidth),
		Math.max(1, host.clientHeight),
		false,
	);
	renderer.outputColorSpace = three.SRGBColorSpace;
	renderer.setClearColor(0x050b13, 1);
	host.appendChild(renderer.domElement);

	const camera = new three.PerspectiveCamera(
		12,
		Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
		0.1,
		500,
	);

	const controls = new trackballControls.TrackballControls(
		camera,
		renderer.domElement,
	);
	controls.rotateSpeed = 0.95;
	controls.zoomSpeed = 1.05;
	controls.panSpeed = 0.3;
	controls.dynamicDampingFactor = 0.18;
	controls.staticMoving = false;
	controls.noPan = true;
	controls.minDistance = 1.2;
	controls.maxDistance = 10;

	const texture = buildTexture(three, volume);
	const colormap = buildColormap(three);
	const material = buildMaterial(
		three,
		volumeShader,
		volume,
		texture,
		colormap,
	);
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
	const cursorPlanes = buildCursorPlanes(three, worldSize, center);
	scene.add(cursorPlanes.root);
	camera.near = Math.max(0.1, maxWorldEdge / 2048);

	const initialTarget = center.clone();
	const initialOffset = new three.Vector3(
		maxWorldEdge * 0.68,
		-maxWorldEdge * 2.9,
		maxWorldEdge * 4.25,
	);
	let currentTarget = initialTarget.clone();
	camera.position.copy(initialTarget.clone().add(initialOffset));
	camera.lookAt(currentTarget);
	applyDistanceLimits(camera, controls, worldSize, currentTarget);
	controls.target.copy(currentTarget);
	cursorPlanes.update(currentTarget);
	controls.update();

	let frame = 0;
	const resizeObserver = new ResizeObserver(() => {
		const width = Math.max(1, host.clientWidth);
		const height = Math.max(1, host.clientHeight);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		renderer.setSize(width, height, false);
		controls.handleResize();
	});
	resizeObserver.observe(host);
	controls.handleResize();

	const render = () => {
		frame = window.requestAnimationFrame(render);
		controls.update();
		renderer.render(scene, camera);
	};
	render();

	return {
		focusCursor(cursor) {
			if (!cursor) {
				currentTarget = initialTarget.clone();
				cursorPlanes.update(currentTarget);
				return;
			}

			const target = cursorToWorldTarget(three, volume, axisScale, cursor);
			currentTarget = target;
			applyDistanceLimits(camera, controls, worldSize, currentTarget);
			controls.target.copy(currentTarget);
			cursorPlanes.update(currentTarget);
			camera.lookAt(currentTarget);
			controls.update();
		},
		setPlanesVisible(visible) {
			cursorPlanes.root.visible = visible;
		},
		dispose() {
			window.cancelAnimationFrame(frame);
			resizeObserver.disconnect();
			controls.dispose();
			mesh.geometry.dispose();
			material.dispose();
			cursorPlanes.dispose();
			texture.dispose();
			colormap.dispose();
			renderer.dispose();
			host.replaceChildren();
		},
	};
}

function buildCursorPlanes(
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

function applyDistanceLimits(
	camera: { far: number; updateProjectionMatrix: () => void },
	controls: { minDistance: number; maxDistance: number },
	worldSize: readonly [number, number, number],
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
	worldSize: readonly [number, number, number],
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

function cursorToWorldTarget(
	three: ThreeModule,
	volume: PreparedVolumeFor3D,
	axisScale: readonly [number, number, number],
	cursor: VolumeCursor,
): Vector3 {
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

function clampRatio(offset: number, size: number): number {
	if (size <= 1) return 0;
	return Math.min(1, Math.max(0, offset / (size - 1)));
}

function buildTexture(
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

function buildColormap(three: ThreeModule): DataTexture {
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

function buildMaterial(
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

function buildVolumeMesh(
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

function resolveAxisScale(
	spacing: PreparedVolumeFor3D["spacing"],
): [number, number, number] {
	const positive = spacing.filter((value) => value > 0);
	const minSpacing = positive.length > 0 ? Math.min(...positive) : 1;
	return [
		Math.max(0.5, spacing[0] / minSpacing),
		Math.max(0.5, spacing[1] / minSpacing),
		Math.max(0.5, spacing[2] / minSpacing),
	];
}
