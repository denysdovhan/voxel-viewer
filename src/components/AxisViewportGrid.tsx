import { PLANE_COLORS } from '../constants';
import type { LoadedVolume, Vec3, ViewerSlices } from '../types';
import { VolumeAxis } from '../types';
import { SliceCanvas, SliceCanvasFit } from './SliceCanvas';
import { ViewportFrame } from './ViewportFrame';

interface AxisViewportGridProps {
  cursor: { x: number; y: number; z: number } | null;
  dimensions: Vec3;
  mprZoom: number;
  slices: ViewerSlices;
  volume: LoadedVolume | null;
  onSelectAxis: (
    axis: VolumeAxis,
  ) => (point: { xRatio: number; yRatio: number }) => void;
  onZoomChange: (zoom: number) => void;
}

export function AxisViewportGrid({
  cursor,
  dimensions,
  mprZoom,
  slices,
  volume,
  onSelectAxis,
  onZoomChange,
}: AxisViewportGridProps) {
  return (
    <div className="grid min-h-0 min-w-0 grid-cols-3 gap-px bg-slate-800">
      <ViewportFrame
        title="Coronal"
        subtitle="Frontal · superior at top"
        status={
          cursor
            ? `Y ${cursor.y + 1}/${Math.max(1, dimensions[1])}`
            : 'No volume'
        }
      >
        <SliceCanvas
          image={slices.coronal}
          crosshairPoint={
            cursor
              ? { x: cursor.x, y: dimensions[2] - 1 - cursor.z }
              : undefined
          }
          crosshairSpace={volume ? [dimensions[0], dimensions[2]] : undefined}
          crosshairColors={{
            vertical: PLANE_COLORS.sagittal,
            horizontal: PLANE_COLORS.axial,
          }}
          label="XZ"
          fit={SliceCanvasFit.Cover}
          zoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(VolumeAxis.Coronal)}
        />
      </ViewportFrame>

      <ViewportFrame
        title="Sagittal"
        subtitle="Lateral · superior at top"
        status={
          cursor
            ? `X ${cursor.x + 1}/${Math.max(1, dimensions[0])}`
            : 'No volume'
        }
      >
        <SliceCanvas
          image={slices.sagittal}
          crosshairPoint={
            cursor
              ? { x: cursor.y, y: dimensions[2] - 1 - cursor.z }
              : undefined
          }
          crosshairSpace={volume ? [dimensions[1], dimensions[2]] : undefined}
          crosshairColors={{
            vertical: PLANE_COLORS.coronal,
            horizontal: PLANE_COLORS.axial,
          }}
          label="YZ"
          fit={SliceCanvasFit.Cover}
          zoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(VolumeAxis.Sagittal)}
        />
      </ViewportFrame>

      <ViewportFrame
        title="Axial"
        subtitle="Occlusal"
        status={
          cursor
            ? `Z ${cursor.z + 1}/${Math.max(1, dimensions[2])}`
            : 'No volume'
        }
      >
        <SliceCanvas
          image={slices.axial}
          crosshairPoint={cursor ? { x: cursor.x, y: cursor.y } : undefined}
          crosshairSpace={volume ? [dimensions[0], dimensions[1]] : undefined}
          crosshairColors={{
            vertical: PLANE_COLORS.sagittal,
            horizontal: PLANE_COLORS.coronal,
          }}
          label="XY"
          fit={SliceCanvasFit.Cover}
          zoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(VolumeAxis.Axial)}
        />
      </ViewportFrame>
    </div>
  );
}
