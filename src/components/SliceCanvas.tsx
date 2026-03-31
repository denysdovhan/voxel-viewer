import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { SliceImage } from '../types';

interface SliceCanvasProps {
  image: SliceImage | null;
  crosshairPoint?: { x: number; y: number };
  crosshairSpace?: [number, number];
  crosshair?: boolean;
  label?: string;
  className?: string;
  stage?: 'import' | 'viewer';
  fit?: 'contain' | 'cover';
  displayAspect?: number;
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

export function SliceCanvas({
  image,
  crosshairPoint,
  crosshairSpace,
  crosshair = true,
  label,
  className,
  stage = 'viewer',
  fit = 'contain',
  displayAspect = 1,
  onSelect,
}: SliceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: 1, height: 1 });

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

  const imageRect = useMemo<Rect>(() => {
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
  const x = crosshairPoint
    ? imageRect.left + (crosshairPoint.x / Math.max(1, cursorWidth - 1)) * imageRect.width
    : surfaceSize.width / 2;
  const y = crosshairPoint
    ? imageRect.top + (crosshairPoint.y / Math.max(1, cursorHeight - 1)) * imageRect.height
    : surfaceSize.height / 2;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!onSelect || !image) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const xRatio = Math.min(1, Math.max(0, (localX - imageRect.left) / Math.max(1, imageRect.width)));
    const yRatio = Math.min(1, Math.max(0, (localY - imageRect.top) / Math.max(1, imageRect.height)));
    onSelect({ xRatio, yRatio });
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
              className="absolute top-0 bottom-0 w-px bg-sky-300/70"
              style={{ left: `${x}px` }}
            />
            <span
              className="absolute left-0 right-0 h-px bg-sky-300/70"
              style={{ top: `${y}px` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
