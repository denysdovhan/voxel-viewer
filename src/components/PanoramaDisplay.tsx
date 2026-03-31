import type { PanoramaImage } from '../types';
import { SliceCanvas } from './SliceCanvas';

interface PanoramaDisplayProps {
  panorama: PanoramaImage | null;
  crosshairPoint?: { x: number; y: number };
  className?: string;
  stage?: 'import' | 'viewer';
  onSelect?: (point: { xRatio: number; yRatio: number }) => void;
}

export function PanoramaDisplay({
  panorama,
  crosshairPoint,
  className,
  stage = 'viewer',
  onSelect,
}: PanoramaDisplayProps) {
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
        crosshair={Boolean(panorama)}
        crosshairPoint={crosshairPoint}
        crosshairSpace={panorama ? [panorama.width, panorama.height] : undefined}
        displayAspect={panorama?.displayAspect}
        label={label}
        stage={stage}
        fit="contain"
        onSelect={onSelect}
      />
    </div>
  );
}
