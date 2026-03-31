import { useEffect, useRef, useState } from 'react';
import type { PreparedVolumeFor3D } from '../types';
import { createThreePreview } from '../lib/volume/three-preview';

interface VolumeViewport3DProps {
  volume: PreparedVolumeFor3D | null;
  className?: string;
  onDownsampledChange?: (downsampled: boolean) => void;
}

export function VolumeViewport3D({ volume, className, onDownsampledChange }: VolumeViewport3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    void createThreePreview(host, volume)
      .then((instance) => {
        if (cancelled) {
          instance.dispose();
          return;
        }

        cleanup = instance.dispose;
      })
      .catch((renderError: unknown) => {
        if (cancelled) return;
        setError(renderError instanceof Error ? renderError.message : '3D preview failed');
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [volume]);

  return (
    <div className={['h-full min-h-0', className ?? ''].join(' ').trim()}>
      <div
        ref={hostRef}
        className="relative h-full min-h-0 overflow-hidden bg-black"
      >
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 px-4 text-center text-xs text-slate-400">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
