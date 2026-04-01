import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { SliceImage } from '../types';

interface SliceCanvasProps {
  image: SliceImage | null;
  crosshairPoint?: { x: number; y: number };
  crosshairSpace?: [number, number];
  crosshair?: boolean;
  crosshairColors?: { vertical: string; horizontal: string };
  label?: string;
  className?: string;
  stage?: 'import' | 'viewer';
  fit?: 'contain' | 'cover';
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

const FALLBACK_RECT: Rect = {
  left: 0,
  top: 0,
  width: 1,
  height: 1,
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const TOUCH_TAP_SLOP = 10;
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

function normalizeWheelDelta(event: WheelEvent<HTMLDivElement>, surfaceHeight: number): number {
  if (event.deltaMode === DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === DOM_DELTA_PAGE) return event.deltaY * surfaceHeight;
  return event.deltaY;
}

export function SliceCanvas({
  image,
  crosshairPoint,
  crosshairSpace,
  crosshair = true,
  crosshairColors,
  label,
  className,
  stage = 'viewer',
  fit = 'contain',
  displayAspect = 1,
  zoom = 1,
  onZoomChange,
  onSelect,
}: SliceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 1, height: 1 });
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
  const tapRef = useRef<{ pointerId: number; originX: number; originY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = image?.width ?? 1;
    const height = image?.height ?? 1;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (image) {
      ctx.putImageData(
        new ImageData(new Uint8ClampedArray(image.data), image.width, image.height),
        0,
        0,
      );
    }
  }, [image]);

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
    const scale = fit === 'cover'
      ? Math.max(surfaceSize.width / displayWidth, surfaceSize.height / displayHeight)
      : Math.min(surfaceSize.width / displayWidth, surfaceSize.height / displayHeight);

    const width = displayWidth * scale;
    const height = displayHeight * scale;

    return {
      left: (surfaceSize.width - width) / 2,
      top: (surfaceSize.height - height) / 2,
      width,
        height,
    };
  }, [displayAspect, fit, image, surfaceSize.height, surfaceSize.width]);

  const [cursorWidth = image?.width ?? 1, cursorHeight = image?.height ?? 1] = crosshairSpace ?? [];
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
    const anchorX = baseImageRect.left + anchorXRatio * baseImageRect.width;
    const anchorY = baseImageRect.top + anchorYRatio * baseImageRect.height;

    return {
      left: anchorX - anchorXRatio * width,
      top: anchorY - anchorYRatio * height,
      width,
      height,
    };
  }, [anchorXRatio, anchorYRatio, baseImageRect.height, baseImageRect.left, baseImageRect.top, baseImageRect.width, image, zoom]);

  const x = imageRect.left + anchorXRatio * imageRect.width;
  const y = imageRect.top + anchorYRatio * imageRect.height;

  const toSelectionPoint = (localX: number, localY: number) => ({
    xRatio: clamp((localX - imageRect.left) / Math.max(1, imageRect.width), 0, 1),
    yRatio: clamp((localY - imageRect.top) / Math.max(1, imageRect.height), 0, 1),
  });

  const selectAtPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!onSelect || !image) return;

    const rect = event.currentTarget.getBoundingClientRect();
    onSelect(toSelectionPoint(event.clientX - rect.left, event.clientY - rect.top));
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!image) return;

    if (event.pointerType === 'touch') {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);

      if (touchPointsRef.current.size >= 2 && onZoomChange) {
        pinchRef.current = {
          startDistance: getPointerDistance([...touchPointsRef.current.values()]),
          startZoom: zoom,
        };
        tapRef.current = null;
        return;
      }

      tapRef.current = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        moved: false,
      };
      return;
    }

    if (event.button !== 0) return;
    selectAtPointer(event);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;

    const touchPoint = touchPointsRef.current.get(event.pointerId);
    if (!touchPoint) return;

    touchPoint.x = event.clientX;
    touchPoint.y = event.clientY;

    if (tapRef.current?.pointerId === event.pointerId) {
      const distance = Math.hypot(
        event.clientX - tapRef.current.originX,
        event.clientY - tapRef.current.originY,
      );
      if (distance > TOUCH_TAP_SLOP) {
        tapRef.current.moved = true;
      }
    }

    const pinch = pinchRef.current;
    if (!pinch || touchPointsRef.current.size < 2 || !onZoomChange || pinch.startDistance <= 0) {
      return;
    }

    event.preventDefault();
    const nextZoom = clamp(
      pinch.startZoom * (getPointerDistance([...touchPointsRef.current.values()]) / pinch.startDistance),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    onZoomChange(nextZoom);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      const activeTouchCount = touchPointsRef.current.size;
      if (
        tapRef.current?.pointerId === event.pointerId &&
        !tapRef.current.moved &&
        activeTouchCount === 1
      ) {
        selectAtPointer(event);
      }

      touchPointsRef.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (touchPointsRef.current.size < 2) {
        pinchRef.current = null;
      } else if (onZoomChange) {
        pinchRef.current = {
          startDistance: getPointerDistance([...touchPointsRef.current.values()]),
          startZoom: zoom,
        };
      }

      if (touchPointsRef.current.size === 0) {
        tapRef.current = null;
      } else if (tapRef.current?.pointerId === event.pointerId) {
        tapRef.current = null;
      }
      return;
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!onZoomChange || !image) return;

    event.preventDefault();
    const scale = Math.exp(-normalizeWheelDelta(event, surfaceSize.height) * 0.0015);
    onZoomChange(clamp(zoom * scale, MIN_ZOOM, MAX_ZOOM));
  };

  return (
    <div className={['h-full min-h-0', className ?? ''].join(' ').trim()} data-stage={stage}>
      <div
        ref={surfaceRef}
        className={[
          'relative h-full min-h-0 overflow-hidden bg-black',
          stage === 'viewer' ? 'w-full' : 'min-h-[220px]',
          onSelect ? 'cursor-crosshair' : '',
        ].join(' ').trim()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onWheel={handleWheel}
        style={{ touchAction: onZoomChange ? 'none' : undefined }}
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
          <div className="pointer-events-none absolute left-3 top-12 rounded bg-slate-950/45 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-300 backdrop-blur-[1px]">
            {label}
          </div>
        ) : null}
        {crosshair ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <span
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${x}px`,
                backgroundColor: crosshairColors?.vertical ?? '#7dd3fc',
                opacity: 0.78,
              }}
            />
            <span
              className="absolute left-0 right-0 h-px"
              style={{
                top: `${y}px`,
                backgroundColor: crosshairColors?.horizontal ?? '#7dd3fc',
                opacity: 0.78,
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
