import {
	type PointerEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
	type WheelEvent,
} from "react";
import type { SliceImage } from "../types";
import { Badge } from "./Badge";

interface SliceCanvasProps {
	image: SliceImage | null;
	crosshairPoint?: { x: number; y: number };
	crosshairSpace?: [number, number];
	crosshair?: boolean;
	crosshairColors?: { vertical: string; horizontal: string };
	label?: string;
	className?: string;
	stage?: "import" | "viewer";
	fit?: "contain" | "cover";
	displayAspect?: number;
	zoom?: number;
	onZoomChange?: (nextZoom: number) => void;
	onSelect?: (point: { xRatio: number; yRatio: number }) => void;
}

interface Rect {
	left: number;
	top: number;
	width: number;
	height: number;
}

type ScrubPointerType = "mouse" | "touch";
type ScrubCursor =
	| "crosshair"
	| "ew-resize"
	| "ns-resize"
	| "nesw-resize"
	| "nwse-resize";

interface ScrubState {
	active: boolean;
	pointerId: number | null;
	pointerType: ScrubPointerType | null;
	lastX: number;
	lastY: number;
	currentX: number;
	currentY: number;
	maxX: number;
	maxY: number;
	voxelPerPixelX: number;
	voxelPerPixelY: number;
	pendingX: number;
	pendingY: number;
}

const FALLBACK_RECT: Rect = {
	left: 0,
	top: 0,
	width: 1,
	height: 1,
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function getPointerDistance(points: Array<{ x: number; y: number }>): number {
	if (points.length < 2) return 0;
	const [first, second] = points;
	return Math.hypot(second.x - first.x, second.y - first.y);
}

function normalizeWheelDelta(
	event: WheelEvent<HTMLDivElement>,
	surfaceHeight: number,
): number {
	if (event.deltaMode === DOM_DELTA_LINE) return event.deltaY * 16;
	if (event.deltaMode === DOM_DELTA_PAGE) return event.deltaY * surfaceHeight;
	return event.deltaY;
}

function clampCoveredOffset(
	offset: number,
	contentSize: number,
	viewportSize: number,
): number {
	if (contentSize <= viewportSize) {
		return (viewportSize - contentSize) / 2;
	}

	return clamp(offset, viewportSize - contentSize, 0);
}

function resolveScrubCursor(deltaX: number, deltaY: number): ScrubCursor {
	const absX = Math.abs(deltaX);
	const absY = Math.abs(deltaY);

	if (absX < 2 && absY < 2) return "crosshair";
	if (absX >= absY * 1.5) return "ew-resize";
	if (absY >= absX * 1.5) return "ns-resize";
	return deltaX * deltaY >= 0 ? "nwse-resize" : "nesw-resize";
}

export function SliceCanvas({
	image,
	crosshairPoint,
	crosshairSpace,
	crosshair = true,
	crosshairColors,
	label,
	className,
	stage = "viewer",
	fit = "contain",
	displayAspect = 1,
	zoom = 1,
	onZoomChange,
	onSelect,
}: SliceCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const surfaceRef = useRef<HTMLDivElement | null>(null);
	const [surfaceSize, setSurfaceSize] = useState({ width: 1, height: 1 });
	const [scrubCursor, setScrubCursor] = useState<ScrubCursor>("crosshair");
	const imageDataRef = useRef<ImageData | null>(null);
	const dragRef = useRef<ScrubState>({
		active: false,
		pointerId: null,
		pointerType: null,
		lastX: 0,
		lastY: 0,
		currentX: 0,
		currentY: 0,
		maxX: 1,
		maxY: 1,
		voxelPerPixelX: 0,
		voxelPerPixelY: 0,
		pendingX: 0,
		pendingY: 0,
	});
	const rafRef = useRef<number | null>(null);
	const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
	const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(
		null,
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const width = image?.width ?? 1;
		const height = image?.height ?? 1;
		canvas.width = width;
		canvas.height = height;
		ctx.clearRect(0, 0, width, height);

		if (image) {
			const imageData = imageDataRef.current;
			const canReuseImageData =
				imageData &&
				imageData.width === image.width &&
				imageData.height === image.height;

			if (canReuseImageData) {
				imageData.data.set(image.data);
				ctx.putImageData(imageData, 0, 0);
			} else {
				const nextImageData = new ImageData(image.width, image.height);
				nextImageData.data.set(image.data);
				imageDataRef.current = nextImageData;
				ctx.putImageData(nextImageData, 0, 0);
			}
		}
	}, [image]);

	useEffect(() => {
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		const surface = surfaceRef.current;
		if (!surface) return;

		const updateSize = () => {
			setSurfaceSize({
				width: Math.max(1, surface.clientWidth),
				height: Math.max(1, surface.clientHeight),
			});
		};

		updateSize();
		const observer = new ResizeObserver(updateSize);
		observer.observe(surface);
		return () => observer.disconnect();
	}, []);

	const baseImageRect = useMemo<Rect>(() => {
		if (!image) return FALLBACK_RECT;

		const displayWidth = image.width * Math.max(0.1, displayAspect);
		const displayHeight = image.height;
		const scale =
			fit === "cover"
				? Math.max(
						surfaceSize.width / displayWidth,
						surfaceSize.height / displayHeight,
					)
				: Math.min(
						surfaceSize.width / displayWidth,
						surfaceSize.height / displayHeight,
					);

		const width = displayWidth * scale;
		const height = displayHeight * scale;

		return {
			left: (surfaceSize.width - width) / 2,
			top: (surfaceSize.height - height) / 2,
			width,
			height,
		};
	}, [displayAspect, fit, image, surfaceSize.height, surfaceSize.width]);

	const [cursorWidth = image?.width ?? 1, cursorHeight = image?.height ?? 1] =
		crosshairSpace ?? [];
	const anchorXRatio = crosshairPoint
		? crosshairPoint.x / Math.max(1, cursorWidth - 1)
		: 0.5;
	const anchorYRatio = crosshairPoint
		? crosshairPoint.y / Math.max(1, cursorHeight - 1)
		: 0.5;

	const imageRect = useMemo<Rect>(() => {
		if (!image) return FALLBACK_RECT;

		const width = baseImageRect.width * zoom;
		const height = baseImageRect.height * zoom;
		const desiredLeft = surfaceSize.width / 2 - anchorXRatio * width;
		const desiredTop = surfaceSize.height / 2 - anchorYRatio * height;

		return {
			left: clampCoveredOffset(desiredLeft, width, surfaceSize.width),
			top: clampCoveredOffset(desiredTop, height, surfaceSize.height),
			width,
			height,
		};
	}, [
		anchorXRatio,
		anchorYRatio,
		baseImageRect.height,
		baseImageRect.width,
		image,
		surfaceSize.height,
		surfaceSize.width,
		zoom,
	]);

	const x = imageRect.left + anchorXRatio * imageRect.width;
	const y = imageRect.top + anchorYRatio * imageRect.height;

	const toSelectionPoint = (localX: number, localY: number) => ({
		xRatio: clamp(
			(localX - imageRect.left) / Math.max(1, imageRect.width),
			0,
			1,
		),
		yRatio: clamp(
			(localY - imageRect.top) / Math.max(1, imageRect.height),
			0,
			1,
		),
	});

	const cancelScrubFrame = () => {
		if (rafRef.current === null) return;

		cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
	};

	const emitScrubSelection = () => {
		if (!onSelect || !image) return;

		const { currentX, currentY, maxX, maxY } = dragRef.current;
		onSelect({
			xRatio: maxX > 0 ? currentX / maxX : 0,
			yRatio: maxY > 0 ? currentY / maxY : 0,
		});
	};

	const scheduleScrubFrame = () => {
		if (rafRef.current !== null) return;

		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null;

			if (!dragRef.current.active || !onSelect || !image) return;

			const stepX =
				dragRef.current.pendingX >= 1
					? 1
					: dragRef.current.pendingX <= -1
						? -1
						: 0;
			const stepY =
				dragRef.current.pendingY >= 1
					? 1
					: dragRef.current.pendingY <= -1
						? -1
						: 0;

			if (stepX === 0 && stepY === 0) return;

			dragRef.current.pendingX -= stepX;
			dragRef.current.pendingY -= stepY;
			dragRef.current.currentX = clamp(
				dragRef.current.currentX + stepX,
				0,
				dragRef.current.maxX,
			);
			dragRef.current.currentY = clamp(
				dragRef.current.currentY + stepY,
				0,
				dragRef.current.maxY,
			);
			emitScrubSelection();

			if (
				Math.abs(dragRef.current.pendingX) >= 1 ||
				Math.abs(dragRef.current.pendingY) >= 1
			) {
				scheduleScrubFrame();
			}
		});
	};

	const pointFromEvent = (event: PointerEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top,
		};
	};

	const updateScrubCursor = (
		pointerType: ScrubPointerType | null,
		deltaX: number,
		deltaY: number,
	) => {
		if (pointerType !== "mouse") return;

		const nextCursor = resolveScrubCursor(deltaX, deltaY);
		setScrubCursor((current) =>
			current === nextCursor ? current : nextCursor,
		);
	};

	const startScrub = (
		pointerId: number,
		pointerType: ScrubPointerType,
		origin: { x: number; y: number },
		selection: { xRatio: number; yRatio: number },
	) => {
		const maxX = Math.max(0, cursorWidth - 1);
		const maxY = Math.max(0, cursorHeight - 1);
		const centered = zoom > MIN_ZOOM;
		const effectiveWidth = Math.max(
			1,
			centered ? Math.max(imageRect.width, maxX || 1) : imageRect.width,
		);
		const effectiveHeight = Math.max(
			1,
			centered ? Math.max(imageRect.height, maxY || 1) : imageRect.height,
		);

		dragRef.current.active = true;
		dragRef.current.pointerId = pointerId;
		dragRef.current.pointerType = pointerType;
		dragRef.current.lastX = origin.x;
		dragRef.current.lastY = origin.y;
		dragRef.current.currentX = clamp(
			Math.round(selection.xRatio * maxX),
			0,
			maxX,
		);
		dragRef.current.currentY = clamp(
			Math.round(selection.yRatio * maxY),
			0,
			maxY,
		);
		dragRef.current.maxX = maxX;
		dragRef.current.maxY = maxY;
		dragRef.current.voxelPerPixelX = maxX > 0 ? maxX / effectiveWidth : 0;
		dragRef.current.voxelPerPixelY = maxY > 0 ? maxY / effectiveHeight : 0;
		dragRef.current.pendingX = 0;
		dragRef.current.pendingY = 0;
		setScrubCursor("crosshair");
	};

	const stopScrub = () => {
		dragRef.current.active = false;
		dragRef.current.pointerId = null;
		dragRef.current.pointerType = null;
		dragRef.current.pendingX = 0;
		dragRef.current.pendingY = 0;
		cancelScrubFrame();
		setScrubCursor("crosshair");
	};

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (!image) return;

		if (event.pointerType === "mouse") {
			if (event.button !== 0 || !onSelect) return;

			event.currentTarget.setPointerCapture(event.pointerId);
			const point = pointFromEvent(event);
			const selection = toSelectionPoint(point.x, point.y);
			startScrub(event.pointerId, "mouse", point, selection);
			emitScrubSelection();
			return;
		}

		if (event.pointerType === "touch") {
			touchPointsRef.current.set(event.pointerId, {
				x: event.clientX,
				y: event.clientY,
			});
			event.currentTarget.setPointerCapture(event.pointerId);

			if (touchPointsRef.current.size >= 2 && onZoomChange) {
				stopScrub();
				pinchRef.current = {
					startDistance: getPointerDistance([
						...touchPointsRef.current.values(),
					]),
					startZoom: zoom,
				};
				return;
			}

			if (onSelect) {
				const point = pointFromEvent(event);
				const selection = toSelectionPoint(point.x, point.y);
				startScrub(event.pointerId, "touch", point, selection);
				emitScrubSelection();
			}
			return;
		}
	};

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "mouse") {
			if (
				!dragRef.current.active ||
				dragRef.current.pointerId !== event.pointerId ||
				!onSelect
			) {
				return;
			}

			event.preventDefault();
			const point = pointFromEvent(event);
			updateScrubCursor(
				"mouse",
				point.x - dragRef.current.lastX,
				point.y - dragRef.current.lastY,
			);
			dragRef.current.pendingX +=
				(point.x - dragRef.current.lastX) * dragRef.current.voxelPerPixelX;
			dragRef.current.pendingY +=
				(point.y - dragRef.current.lastY) * dragRef.current.voxelPerPixelY;
			dragRef.current.lastX = point.x;
			dragRef.current.lastY = point.y;
			scheduleScrubFrame();
			return;
		}

		if (event.pointerType !== "touch") return;

		const touchPoint = touchPointsRef.current.get(event.pointerId);
		if (!touchPoint) return;

		touchPoint.x = event.clientX;
		touchPoint.y = event.clientY;

		if (
			dragRef.current.active &&
			dragRef.current.pointerId === event.pointerId &&
			dragRef.current.pointerType === "touch" &&
			onSelect
		) {
			event.preventDefault();
			const point = pointFromEvent(event);
			updateScrubCursor(
				"touch",
				point.x - dragRef.current.lastX,
				point.y - dragRef.current.lastY,
			);
			dragRef.current.pendingX +=
				(point.x - dragRef.current.lastX) * dragRef.current.voxelPerPixelX;
			dragRef.current.pendingY +=
				(point.y - dragRef.current.lastY) * dragRef.current.voxelPerPixelY;
			dragRef.current.lastX = point.x;
			dragRef.current.lastY = point.y;
			scheduleScrubFrame();
			return;
		}

		const pinch = pinchRef.current;
		if (
			!pinch ||
			touchPointsRef.current.size < 2 ||
			!onZoomChange ||
			pinch.startDistance <= 0
		) {
			return;
		}

		event.preventDefault();
		const nextZoom = clamp(
			pinch.startZoom *
				(getPointerDistance([...touchPointsRef.current.values()]) /
					pinch.startDistance),
			MIN_ZOOM,
			MAX_ZOOM,
		);
		onZoomChange(nextZoom);
	};

	const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
		if (event.pointerType === "mouse") {
			if (
				dragRef.current.active &&
				dragRef.current.pointerId === event.pointerId
			) {
				if (
					Math.abs(dragRef.current.pendingX) >= 1 ||
					Math.abs(dragRef.current.pendingY) >= 1
				) {
					scheduleScrubFrame();
				}
				stopScrub();
			}
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}
			return;
		}

		if (event.pointerType === "touch") {
			const wasScrubbing =
				dragRef.current.active && dragRef.current.pointerId === event.pointerId;
			if (wasScrubbing) {
				if (
					Math.abs(dragRef.current.pendingX) >= 1 ||
					Math.abs(dragRef.current.pendingY) >= 1
				) {
					scheduleScrubFrame();
				}
				stopScrub();
			}

			touchPointsRef.current.delete(event.pointerId);
			if (event.currentTarget.hasPointerCapture(event.pointerId)) {
				event.currentTarget.releasePointerCapture(event.pointerId);
			}

			if (touchPointsRef.current.size < 2) {
				pinchRef.current = null;
			} else if (onZoomChange) {
				pinchRef.current = {
					startDistance: getPointerDistance([
						...touchPointsRef.current.values(),
					]),
					startZoom: zoom,
				};
			}
			return;
		}
	};

	const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
		if (
			dragRef.current.active &&
			dragRef.current.pointerId === event.pointerId
		) {
			stopScrub();
		}

		if (event.pointerType === "touch") {
			touchPointsRef.current.delete(event.pointerId);
			if (touchPointsRef.current.size < 2) {
				pinchRef.current = null;
			}
		}

		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
		if (!onZoomChange || !image) return;

		event.preventDefault();
		const scale = Math.exp(
			-normalizeWheelDelta(event, surfaceSize.height) * 0.0015,
		);
		onZoomChange(clamp(zoom * scale, MIN_ZOOM, MAX_ZOOM));
	};

	return (
		<div
			className={["h-full min-h-0", className ?? ""].join(" ").trim()}
			data-stage={stage}
		>
			<div
				ref={surfaceRef}
				className={[
					"relative h-full min-h-0 overflow-hidden bg-black",
					stage === "viewer" ? "w-full" : "min-h-[220px]",
				]
					.join(" ")
					.trim()}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerEnd}
				onPointerCancel={handlePointerCancel}
				onWheel={handleWheel}
				style={{
					cursor: onSelect ? scrubCursor : undefined,
					touchAction: onZoomChange ? "none" : undefined,
				}}
			>
				<canvas
					ref={canvasRef}
					className="absolute block [image-rendering:pixelated]"
					style={{
						left: `${imageRect.left}px`,
						top: `${imageRect.top}px`,
						width: `${imageRect.width}px`,
						height: `${imageRect.height}px`,
					}}
				/>
				{label ? (
					<Badge
						variant="overlay"
						className="pointer-events-none absolute left-3 top-12"
					>
						{label}
					</Badge>
				) : null}
				{crosshair ? (
					<div
						className="pointer-events-none absolute inset-0"
						aria-hidden="true"
					>
						<span
							className="absolute top-0 bottom-0 w-px"
							style={{
								left: `${x}px`,
								backgroundColor: crosshairColors?.vertical ?? "#7dd3fc",
								opacity: 0.78,
							}}
						/>
						<span
							className="absolute left-0 right-0 h-px"
							style={{
								top: `${y}px`,
								backgroundColor: crosshairColors?.horizontal ?? "#7dd3fc",
								opacity: 0.78,
							}}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
