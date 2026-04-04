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
  const subtitleLabelClass =
    'inline-flex items-center gap-1.5 text-[11px] text-slate-400';
  const axisBadgeClass =
    'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-[1px]';
  const titleClass = 'font-semibold';

  return (
    <div className="grid min-h-0 min-w-0 grid-cols-3 gap-px bg-slate-800">
      <ViewportFrame
        title={
          <span className={titleClass} style={{ color: PLANE_COLORS.coronal }}>
            Coronal
          </span>
        }
        subtitle={
          <span className={subtitleLabelClass}>
            <span
              className={axisBadgeClass}
              style={{
                color: PLANE_COLORS.coronal,
                borderColor: `${PLANE_COLORS.coronal}55`,
                backgroundColor: `${PLANE_COLORS.coronal}22`,
              }}
            >
              XZ
            </span>
            Frontal · superior at top
          </span>
        }
        status={
          cursor
            ? `Y ${cursor.y + 1}/${Math.max(1, dimensions[1])}`
            : 'No volume'
        }
        statusStyle={{
          color: PLANE_COLORS.coronal,
          borderColor: `${PLANE_COLORS.coronal}40`,
          backgroundColor: `${PLANE_COLORS.coronal}14`,
        }}
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
          fit={SliceCanvasFit.Cover}
          zoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(VolumeAxis.Coronal)}
        />
      </ViewportFrame>

      <ViewportFrame
        title={
          <span className={titleClass} style={{ color: PLANE_COLORS.sagittal }}>
            Sagittal
          </span>
        }
        subtitle={
          <span className={subtitleLabelClass}>
            <span
              className={axisBadgeClass}
              style={{
                color: PLANE_COLORS.sagittal,
                borderColor: `${PLANE_COLORS.sagittal}55`,
                backgroundColor: `${PLANE_COLORS.sagittal}22`,
              }}
            >
              YZ
            </span>
            Lateral · superior at top
          </span>
        }
        status={
          cursor
            ? `X ${cursor.x + 1}/${Math.max(1, dimensions[0])}`
            : 'No volume'
        }
        statusStyle={{
          color: PLANE_COLORS.sagittal,
          borderColor: `${PLANE_COLORS.sagittal}40`,
          backgroundColor: `${PLANE_COLORS.sagittal}14`,
        }}
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
          fit={SliceCanvasFit.Cover}
          zoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(VolumeAxis.Sagittal)}
        />
      </ViewportFrame>

      <ViewportFrame
        title={
          <span className={titleClass} style={{ color: PLANE_COLORS.axial }}>
            Axial
          </span>
        }
        subtitle={
          <span className={subtitleLabelClass}>
            <span
              className={axisBadgeClass}
              style={{
                color: PLANE_COLORS.axial,
                borderColor: `${PLANE_COLORS.axial}55`,
                backgroundColor: `${PLANE_COLORS.axial}22`,
              }}
            >
              XY
            </span>
            Occlusal
          </span>
        }
        status={
          cursor
            ? `Z ${cursor.z + 1}/${Math.max(1, dimensions[2])}`
            : 'No volume'
        }
        statusStyle={{
          color: PLANE_COLORS.axial,
          borderColor: `${PLANE_COLORS.axial}40`,
          backgroundColor: `${PLANE_COLORS.axial}14`,
        }}
      >
        <SliceCanvas
          image={slices.axial}
          crosshairPoint={cursor ? { x: cursor.x, y: cursor.y } : undefined}
          crosshairSpace={volume ? [dimensions[0], dimensions[1]] : undefined}
          crosshairColors={{
            vertical: PLANE_COLORS.sagittal,
            horizontal: PLANE_COLORS.coronal,
          }}
          fit={SliceCanvasFit.Cover}
          zoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(VolumeAxis.Axial)}
        />
      </ViewportFrame>
    </div>
  );
}
