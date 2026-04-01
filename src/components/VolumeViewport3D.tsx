import { useEffect, useRef, useState } from 'react';
import type { PreparedVolumeFor3D, VolumeCursor } from '../types';
import { createThreePreview, type ThreePreviewInstance } from '../lib/volume/three-preview';

interface VolumeViewport3DProps {
  volume: PreparedVolumeFor3D | null;
  cursor?: VolumeCursor | null;
  className?: string;
  onDownsampledChange?: (downsampled: boolean) => void;
}

export function VolumeViewport3D({
  volume,
  cursor = null,
  className,
  onDownsampledChange,
}: VolumeViewport3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ThreePreviewInstance | null>(null);
  const cursorRef = useRef<VolumeCursor | null>(cursor);
  const [error, setError] = useState<string | null>(null);
  const [planesVisible, setPlanesVisible] = useState(true);

  useEffect(() => {
    cursorRef.current = cursor;
    instanceRef.current?.focusCursor(cursor);
  }, [cursor]);

  useEffect(() => {
    instanceRef.current?.setPlanesVisible(planesVisible);
  }, [planesVisible]);

  useEffect(() => {
    onDownsampledChange?.(Boolean(volume?.downsampled));
  }, [onDownsampledChange, volume?.downsampled]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !volume) {
      setError(null);
      return undefined;
    }

    let cleanup: () => void = () => {};
    let cancelled = false;
    let mounted = false;
    let frame = 0;
    let retryTimer = 0;
    let retryCount = 0;
    let resizeObserver: ResizeObserver | null = null;
    setError(null);

    const scheduleRetry = () => {
      if (cancelled || mounted || retryCount >= 4) return;
      retryCount += 1;
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        mount();
        if (!mounted) scheduleRetry();
      }, 120 * retryCount);
    };

    const mount = () => {
      if (cancelled || mounted) return;
      if (host.clientWidth < 32 || host.clientHeight < 32) return;
      mounted = true;
      resizeObserver?.disconnect();
      resizeObserver = null;

      void createThreePreview(host, volume)
        .then((instance) => {
          if (cancelled) {
            instance.dispose();
            return;
          }

          instanceRef.current = instance;
          instance.focusCursor(cursorRef.current);
          instance.setPlanesVisible(planesVisible);
          cleanup = instance.dispose;
        })
        .catch((renderError: unknown) => {
          if (cancelled) return;
          mounted = false;
          if (retryCount < 4) {
            scheduleRetry();
            return;
          }
          setError(renderError instanceof Error ? renderError.message : '3D preview failed');
        });
    };

    frame = window.requestAnimationFrame(() => {
      mount();
      if (mounted || cancelled) return;

      resizeObserver = new ResizeObserver(() => {
        mount();
      });
      resizeObserver.observe(host);
      scheduleRetry();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
      resizeObserver?.disconnect();
      instanceRef.current = null;
      cleanup();
    };
  }, [volume]);

  return (
    <div className={['relative h-full min-h-0 overflow-hidden bg-black', className ?? ''].join(' ').trim()}>
      <div
        ref={hostRef}
        className="absolute inset-0 h-full min-h-0 overflow-hidden"
      />
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="pointer-events-auto absolute bottom-2 right-2 flex items-center justify-end gap-1">
          <button
            type="button"
            className="rounded border border-slate-700/80 bg-slate-950/75 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-900"
            onClick={() => setPlanesVisible((current) => !current)}
          >
            {planesVisible ? 'Hide planes' : 'Show planes'}
          </button>
        </div>
      </div>
      {error ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 px-4 text-center text-xs text-slate-400">
          {error}
        </div>
      ) : null}
    </div>
  );
}
