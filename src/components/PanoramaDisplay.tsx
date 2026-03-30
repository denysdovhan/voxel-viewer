import type { PanoramaImage } from '../types';
import { SliceCanvas } from './SliceCanvas';

interface PanoramaDisplayProps {
  panorama: PanoramaImage | null;
  className?: string;
  stage?: 'import' | 'viewer';
}

export function PanoramaDisplay({ panorama, className, stage = 'viewer' }: PanoramaDisplayProps) {
  const label = panorama
    ? panorama.mode === 'metadata-seeded'
      ? 'Metadata-seeded curve'
      : panorama.mode === 'volume-derived'
        ? 'Volume-derived curve'
        : 'Fallback curve'
    : 'Panorama pending';

  return (
    <div className={['h-full min-h-0', className ?? ''].join(' ').trim()} data-stage={stage}>
      <SliceCanvas
        image={panorama ? { width: panorama.width, height: panorama.height, data: panorama.data } : null}
        crosshair={false}
        label={label}
        stage={stage}
        fit="contain"
      />
    </div>
  );
}
