import debounce from "lodash/debounce";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import {
	Button,
	FolderPicker,
	ImportStatus,
	Notice,
	RangeField,
	SliceCanvas,
	ViewportFrame,
	VolumeViewport3D,
} from "./components";
import { PLANE_COLORS } from "./constants";
import { loadVolumeFromFolder } from "./lib/import/load-volume";
import { fromDirectoryHandle } from "./lib/import/scan-folder";
import {
	clamp,
	extractAxialImage,
	extractCoronalImage,
	extractSagittalImage,
} from "./lib/volume";
import type {
	ImportIssue,
	ImportProgress,
	LoadedVolume,
	PreparedVolumeFor3D,
	ScanFolderSource,
	SliceImage,
	SliceWindowLevel,
	VolumeCursor,
} from "./types";

const IDLE_PROGRESS: ImportProgress = {
	stage: "idle",
	detail: "Select a GALILEOS folder to begin",
	completed: 0,
	total: 1,
};

const EMPTY_SLICES: {
	axial: SliceImage | null;
	coronal: SliceImage | null;
	sagittal: SliceImage | null;
} = {
	axial: null,
	coronal: null,
	sagittal: null,
};

const DEFAULT_WINDOW_LEVEL: SliceWindowLevel = {
	window: 3200,
	level: 1600,
};

const WINDOW_MIN = 256;
const WINDOW_MAX = 4095;
const LEVEL_MIN = 0;
const LEVEL_MAX = 4095;
const DEFAULT_MPR_ZOOM = 1;

type DirectoryPickerWindow = Window & {
	showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
};

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}

function isBusy(progress: ImportProgress): boolean {
	return !["idle", "ready", "error"].includes(progress.stage);
}

function makeImportIssue(error: unknown): ImportIssue {
	if (error && typeof error === "object") {
		const value = error as {
			code?: unknown;
			name?: unknown;
			message?: unknown;
		};
		if (typeof value.message === "string") {
			return {
				code:
					typeof value.code === "string"
						? value.code
						: typeof value.name === "string"
							? value.name
							: "E_IMPORT",
				message: value.message,
			};
		}
	}

	return {
		code: "E_IMPORT",
		message: "Failed to load the selected scan folder.",
	};
}

function createCenterCursor(volume: LoadedVolume): VolumeCursor {
	const [x, y, z] = volume.meta.dimensions;
	return {
		x: Math.floor(x / 2),
		y: Math.floor(y / 2),
		z: Math.floor(z / 2),
	};
}

function formatSpacing(spacing: [number, number, number]): string {
	return spacing.map((value) => value.toFixed(2)).join(" x ");
}

export default function App() {
	const [progress, setProgress] = useState<ImportProgress>(IDLE_PROGRESS);
	const [issue, setIssue] = useState<ImportIssue | null>(null);
	const [sourceLabel, setSourceLabel] = useState("");
	const [volume, setVolume] = useState<LoadedVolume | null>(null);
	const [cursor, setCursor] = useState<VolumeCursor | null>(null);
	const [windowLevelDraft, setWindowLevelDraft] =
		useState<SliceWindowLevel>(DEFAULT_WINDOW_LEVEL);
	const [windowLevel, setWindowLevel] =
		useState<SliceWindowLevel>(DEFAULT_WINDOW_LEVEL);
	const [mprZoom, setMprZoom] = useState(DEFAULT_MPR_ZOOM);
	const [downsampled3D, setDownsampled3D] = useState(false);
	const [prepared3D, setPrepared3D] = useState<PreparedVolumeFor3D | null>(
		null,
	);
	const [axisViewsVisible, setAxisViewsVisible] = useState(true);
	const [sidebarVisible, setSidebarVisible] = useState(true);
	const directorySupported =
		typeof window !== "undefined" &&
		typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
	const busy = isBusy(progress);
	const stage = volume ? "viewer" : "import";
	const debouncedCommitWindowLevel = useMemo(
		() =>
			debounce((next: SliceWindowLevel) => {
				setWindowLevel(next);
			}, 96),
		[],
	);

	useEffect(
		() => () => debouncedCommitWindowLevel.cancel(),
		[debouncedCommitWindowLevel],
	);

	const resetViewer = useEffectEvent(() => {
		debouncedCommitWindowLevel.cancel();
		setIssue(null);
		setSourceLabel("");
		setVolume(null);
		setCursor(null);
		setWindowLevelDraft(DEFAULT_WINDOW_LEVEL);
		setWindowLevel(DEFAULT_WINDOW_LEVEL);
		setMprZoom(DEFAULT_MPR_ZOOM);
		setPrepared3D(null);
		setDownsampled3D(false);
		setAxisViewsVisible(true);
		setSidebarVisible(true);
		setProgress(IDLE_PROGRESS);
	});

	const loadSource = useEffectEvent(async (source: ScanFolderSource) => {
		resetViewer();
		setSourceLabel(source.label);
		setProgress({
			stage: "scanning",
			detail: `Scanning ${source.label}`,
			completed: 0,
			total: 1,
		});

		try {
			const loaded = await loadVolumeFromFolder(source, setProgress);
			setIssue(null);
			setVolume(loaded.volume);
			setPrepared3D(loaded.prepared3D);
			setCursor(createCenterCursor(loaded.volume));
			setWindowLevelDraft(DEFAULT_WINDOW_LEVEL);
			setWindowLevel(DEFAULT_WINDOW_LEVEL);
			setMprZoom(DEFAULT_MPR_ZOOM);
			setProgress({
				stage: "ready",
				detail: `Loaded ${loaded.meta.scanId}`,
				completed: loaded.meta.sliceCount,
				total: loaded.meta.sliceCount,
			});
		} catch (error) {
			if (isAbortError(error)) return;

			setIssue(makeImportIssue(error));
			setProgress({
				stage: "error",
				detail: "Import failed",
				completed: 0,
				total: 1,
			});
		}
	});

	const slices = useMemo(() => {
		if (!volume || !cursor) return EMPTY_SLICES;

		return {
			axial: extractAxialImage(volume, cursor, windowLevel),
			coronal: extractCoronalImage(volume, cursor, windowLevel),
			sagittal: extractSagittalImage(volume, cursor, windowLevel),
		};
	}, [cursor, volume, windowLevel]);

	const dimensions = volume?.meta.dimensions ?? [0, 0, 0];
	const spacing = volume?.meta.spacing ?? [0, 0, 0];

	const openDirectory = async () => {
		const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
		if (!picker) return;

		try {
			const handle = await picker();
			const source = await fromDirectoryHandle(handle);
			await loadSource(source);
		} catch (error) {
			if (!isAbortError(error)) {
				setIssue(makeImportIssue(error));
			}
		}
	};

	const updateCursor =
		(axis: "axial" | "coronal" | "sagittal") =>
		({ xRatio, yRatio }: { xRatio: number; yRatio: number }) => {
			if (!volume) return;

			setCursor((current) => {
				if (!current) return current;

				const [width, height, depth] = volume.meta.dimensions;
				if (axis === "axial") {
					const next = {
						x: clamp(Math.round(xRatio * (width - 1)), 0, width - 1),
						y: clamp(Math.round(yRatio * (height - 1)), 0, height - 1),
						z: current.z,
					};
					return next.x === current.x && next.y === current.y ? current : next;
				}

				if (axis === "coronal") {
					const next = {
						x: clamp(Math.round(xRatio * (width - 1)), 0, width - 1),
						y: current.y,
						z: clamp(Math.round((1 - yRatio) * (depth - 1)), 0, depth - 1),
					};
					return next.x === current.x && next.z === current.z ? current : next;
				}

				const next = {
					x: current.x,
					y: clamp(Math.round(xRatio * (height - 1)), 0, height - 1),
					z: clamp(Math.round((1 - yRatio) * (depth - 1)), 0, depth - 1),
				};
				return next.y === current.y && next.z === current.z ? current : next;
			});
		};

	const updateWindowLevelDraft = (next: SliceWindowLevel) => {
		setWindowLevelDraft(next);
		debouncedCommitWindowLevel(next);
	};

	const flushWindowLevelDraft = (next: SliceWindowLevel) => {
		debouncedCommitWindowLevel.cancel();
		setWindowLevelDraft(next);
		setWindowLevel(next);
	};

	const handleWindowChange = (value: number) => {
		updateWindowLevelDraft({
			...windowLevelDraft,
			window: value,
		});
	};

	const handleWindowCommit = (value: number) => {
		flushWindowLevelDraft({
			...windowLevelDraft,
			window: value,
		});
	};

	const handleLevelChange = (value: number) => {
		updateWindowLevelDraft({
			...windowLevelDraft,
			level: value,
		});
	};

	const handleLevelCommit = (value: number) => {
		flushWindowLevelDraft({
			...windowLevelDraft,
			level: value,
		});
	};

	return (
		<main className="h-screen overflow-hidden bg-slate-950 text-slate-100">
			{stage === "import" ? (
				busy ? (
					<div className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4 py-8">
						<div className="w-full space-y-4 rounded border border-slate-800 bg-slate-950/90 p-5 shadow-2xl">
							<div className="flex items-center gap-3">
								<span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
								<div>
									<div className="text-sm font-medium text-slate-100">
										Building viewer
									</div>
									<div className="text-xs text-slate-500">
										{sourceLabel || "Selected scan folder"}
									</div>
								</div>
							</div>
							<ImportStatus progress={progress} issue={issue} stage="import" />
							<Notice>
								Reference only. Not for diagnosis, treatment planning,
								measurements, or implant workflows.
							</Notice>
						</div>
					</div>
				) : (
					<div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-8">
						<div className="w-full space-y-3">
							<section className="rounded border border-slate-800 bg-slate-950/80 p-5">
								<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
									Local-first static viewer
								</p>
								<h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
									GALILEOS dental x-ray viewer
								</h1>
								<p className="mt-2 max-w-2xl text-sm text-slate-400">
									Import a local scan folder, parse it fully in-browser, and
									navigate with a larger 3D overview plus linked orthogonal
									views.
								</p>
							</section>

							<FolderPicker
								directorySupported={directorySupported}
								onPickDirectory={() => void openDirectory()}
								onReset={resetViewer}
								busy={busy}
								detail={
									sourceLabel
										? `Source: ${sourceLabel}`
										: "Chromium desktop over HTTPS or localhost recommended"
								}
								unsupportedHint="Use Chromium desktop for direct folder picking."
								stage="import"
							/>

							<ImportStatus progress={progress} issue={issue} stage="import" />

							<Notice>
								Reference only. Not for diagnosis, treatment planning,
								measurements, or implant workflows.
							</Notice>
						</div>
					</div>
				)
			) : (
				<div className="h-full overflow-hidden bg-slate-800">
					<div
						className={`grid h-full gap-px ${sidebarVisible ? "grid-cols-[minmax(0,1fr)_minmax(288px,22vw)]" : "grid-cols-1"}`}
					>
						<section className="min-h-0 min-w-0">
							<div
								className={`grid h-full min-h-0 min-w-0 gap-px bg-slate-800 ${axisViewsVisible ? "grid-rows-[1.22fr_0.95fr]" : "grid-rows-1"}`}
							>
								<div className="grid min-h-0 min-w-0 grid-cols-1 gap-px bg-slate-800">
									<ViewportFrame
										title="3D"
										subtitle="Main navigation volume"
										status={
											prepared3D
												? prepared3D.downsampled
													? "Downsampled"
													: "Native"
												: "Preparing"
										}
									>
										<VolumeViewport3D
											volume={prepared3D}
											cursor={cursor}
											axisViewsVisible={axisViewsVisible}
											onAxisViewsVisibleChange={setAxisViewsVisible}
											sidebarVisible={sidebarVisible}
											onSidebarVisibleChange={setSidebarVisible}
											onDownsampledChange={setDownsampled3D}
										/>
									</ViewportFrame>
								</div>

								{axisViewsVisible ? (
									<div className="grid min-h-0 min-w-0 grid-cols-3 gap-px bg-slate-800">
										<ViewportFrame
											title="Coronal"
											subtitle="Frontal · superior at top"
											status={
												cursor
													? `Y ${cursor.y + 1}/${Math.max(1, dimensions[1])}`
													: "No volume"
											}
										>
											<SliceCanvas
												image={slices.coronal}
												crosshairPoint={
													cursor
														? { x: cursor.x, y: dimensions[2] - 1 - cursor.z }
														: undefined
												}
												crosshairSpace={
													volume ? [dimensions[0], dimensions[2]] : undefined
												}
												crosshairColors={{
													vertical: PLANE_COLORS.sagittal,
													horizontal: PLANE_COLORS.axial,
												}}
												label="XZ"
												fit="cover"
												zoom={mprZoom}
												onZoomChange={setMprZoom}
												onSelect={updateCursor("coronal")}
												stage="viewer"
											/>
										</ViewportFrame>

										<ViewportFrame
											title="Sagittal"
											subtitle="Lateral · superior at top"
											status={
												cursor
													? `X ${cursor.x + 1}/${Math.max(1, dimensions[0])}`
													: "No volume"
											}
										>
											<SliceCanvas
												image={slices.sagittal}
												crosshairPoint={
													cursor
														? { x: cursor.y, y: dimensions[2] - 1 - cursor.z }
														: undefined
												}
												crosshairSpace={
													volume ? [dimensions[1], dimensions[2]] : undefined
												}
												crosshairColors={{
													vertical: PLANE_COLORS.coronal,
													horizontal: PLANE_COLORS.axial,
												}}
												label="YZ"
												fit="cover"
												zoom={mprZoom}
												onZoomChange={setMprZoom}
												onSelect={updateCursor("sagittal")}
												stage="viewer"
											/>
										</ViewportFrame>

										<ViewportFrame
											title="Axial"
											subtitle="Occlusal"
											status={
												cursor
													? `Z ${cursor.z + 1}/${Math.max(1, dimensions[2])}`
													: "No volume"
											}
										>
											<SliceCanvas
												image={slices.axial}
												crosshairPoint={
													cursor ? { x: cursor.x, y: cursor.y } : undefined
												}
												crosshairSpace={
													volume ? [dimensions[0], dimensions[1]] : undefined
												}
												crosshairColors={{
													vertical: PLANE_COLORS.sagittal,
													horizontal: PLANE_COLORS.coronal,
												}}
												label="XY"
												fit="cover"
												zoom={mprZoom}
												onZoomChange={setMprZoom}
												onSelect={updateCursor("axial")}
												stage="viewer"
											/>
										</ViewportFrame>
									</div>
								) : null}
							</div>
						</section>

						{sidebarVisible ? (
							<aside className="grid min-w-0 min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] overflow-hidden">
								<section className="min-w-0 rounded border border-slate-800 bg-slate-950/80 p-2.5">
									<div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
										Study
									</div>
									<div
										className="mt-1 truncate text-sm font-semibold text-slate-100"
										title={volume?.meta.scanId}
									>
										{volume?.meta.scanId}
									</div>
									<div className="mt-1 text-xs text-slate-500">
										{dimensions.join(" x ")} voxels
									</div>
									<div className="mt-1 text-xs text-slate-500">
										{formatSpacing(spacing)} mm
									</div>
									<div
										className="mt-1 truncate text-xs text-slate-600"
										title={sourceLabel}
									>
										{sourceLabel}
									</div>
								</section>

								<section className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-2.5">
									<div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
										Display
									</div>
									<div className="mt-2.5">
										<RangeField
											label="Window"
											min={WINDOW_MIN}
											max={WINDOW_MAX}
											value={windowLevelDraft.window}
											onChange={handleWindowChange}
											onCommit={handleWindowCommit}
											hint="Contrast span. Smaller window = more contrast."
										/>
									</div>

									<div className="mt-2.5">
										<RangeField
											label="Level"
											min={LEVEL_MIN}
											max={LEVEL_MAX}
											value={windowLevelDraft.level}
											onChange={handleLevelChange}
											onCommit={handleLevelCommit}
											hint="Brightness bias. Higher level favors denser tissue."
										/>
									</div>
								</section>

								<div className="min-h-0 min-w-0">
									<ImportStatus
										progress={progress}
										issue={issue}
										stage="viewer"
									/>
								</div>

								<section className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-2.5">
									<div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
										Navigation
									</div>
									<div className="mt-2 text-xs text-slate-400">
										Cursor{" "}
										{cursor
											? `${cursor.x + 1}, ${cursor.y + 1}, ${cursor.z + 1}`
											: "n/a"}
									</div>
									<div className="mt-1 text-xs text-slate-400">
										Drag inside any 2D pane to scrub linked slices.
									</div>
									<div className="mt-1 text-xs text-slate-500">
										Wheel or pinch to zoom; when zoomed, scrubbing keeps the
										crosshair centered when possible.
									</div>
									<div className="mt-1 text-xs text-slate-500">
										Coronal and sagittal views are flipped so superior anatomy
										stays at the top.
									</div>
									<div className="mt-2 text-xs text-slate-400">
										3D using full volume.
									</div>
									<div className="mt-1 text-xs text-slate-500">
										{downsampled3D
											? "Downsampled from full volume to fit GPU texture limits."
											: "Native full-volume resolution."}
									</div>
									<div className="mt-1 text-xs text-slate-500">
										Colored planes in 3D match the current coronal, sagittal,
										and axial slices.
									</div>
								</section>

								<section className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-2.5">
									<div className="grid grid-cols-1 gap-2">
										<Button
											variant="primary"
											block
											onClick={() => void openDirectory()}
										>
											Open folder
										</Button>
										<Button variant="ghost" block onClick={resetViewer}>
											Back to import
										</Button>
									</div>
									<Notice className="mt-3" compact>
										Reference only. Not for diagnosis, treatment planning,
										measurements, or implant workflows.
									</Notice>
								</section>
							</aside>
						) : null}
					</div>
				</div>
			)}
		</main>
	);
}
