import type {
	Data3DTexture,
	Group,
	IUniform,
	Texture,
	Vector2,
	Vector3,
} from "three";

export type ThreeModule = typeof import("three");
export type TrackballControlsModule =
	typeof import("three/addons/controls/TrackballControls.js");
export type VolumeShaderModule =
	typeof import("three/addons/shaders/VolumeShader.js");

export type VolumeShaderUniforms = Record<string, IUniform> & {
	u_size: IUniform<Vector3>;
	u_renderstyle: IUniform<number>;
	u_renderthreshold: IUniform<number>;
	u_clim: IUniform<Vector2>;
	u_data: IUniform<Data3DTexture>;
	u_cmdata: IUniform<Texture>;
};

export interface ThreePreviewInstance {
	dispose: () => void;
	focusCursor: (cursor: import("../../types").VolumeCursor | null) => void;
	setPlanesVisible: (visible: boolean) => void;
}

export interface CursorPlaneSet {
	root: Group;
	update: (target: Vector3) => void;
	dispose: () => void;
}
