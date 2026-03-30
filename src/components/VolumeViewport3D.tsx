import { useEffect, useRef } from 'react';
import type { PreparedVolumeFor3D } from '../types';
import { createThreePreview } from '../lib/volume/three-preview';

interface VolumeViewport3DProps {
  volume: PreparedVolumeFor3D | null;
  className?: string;
  onDownsampledChange?: (downsampled: boolean) => void;
}

export function VolumeViewport3D({ volume, className, onDownsampledChange }: VolumeViewport3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onDownsampledChange?.(Boolean(volume?.downsampled));
  }, [onDownsampledChange, volume?.downsampled]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !volume) {
      return undefined;
    }

    let cleanup: () => void = () => {};
    let cancelled = false;

    void createThreePreview(host, volume).then((instance) => {
      if (cancelled) {
        instance.dispose();
        return;
      }

      cleanup = instance.dispose;
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
      />
    </div>
  );
}
