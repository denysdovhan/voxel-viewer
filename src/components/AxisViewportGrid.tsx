import { PLANE_COLORS } from '../constants';
import type {
  LoadedVolume,
  SliceImage,
  Vec3,
  ViewerSlices,
  VolumeCursor,
} from '../types';
import { VolumeAxis } from '../types';
import { SliceCanvas, SliceCanvasFit } from './SliceCanvas';
import { ViewportFrame } from './ViewportFrame';

interface AxisViewportGridProps {
  cursor: { x: number; y: number; z: number } | null;
  dimensions: Vec3;
  mprZoom: number;
  selectedAxis?: VolumeAxis;
  slices: ViewerSlices;
  volume: LoadedVolume | null;
  compact?: boolean;
  onSelectAxis: (
    axis: VolumeAxis,
  ) => (point: { xRatio: number; yRatio: number }) => void;
  onSelectedAxisChange?: (axis: VolumeAxis) => void;
  onZoomChange: (zoom: number) => void;
}

interface AxisViewportDefinition {
  axis: VolumeAxis;
  badge: string;
  color: string;
  label: string;
  orientation: string;
  image: SliceImage | null;
  status: string;
  crosshairPoint?: { x: number; y: number };
  crosshairSpace?: [number, number];
  crosshairColors: { vertical: string; horizontal: string };
}

interface AxisViewportPaneProps {
  axisSelector?: React.ReactNode;
  definition: AxisViewportDefinition;
  compact: boolean;
  mprZoom: number;
  onSelect: (point: { xRatio: number; yRatio: number }) => void;
  onZoomChange: (zoom: number) => void;
}

function AxisViewportPane({
  axisSelector,
  compact,
  definition,
  mprZoom,
  onSelect,
  onZoomChange,
}: AxisViewportPaneProps) {
  const subtitleLabelClass =
    'inline-flex items-center gap-1.5 text-[11px] text-slate-400';
  const axisBadgeClass =
    'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-[1px]';
  const titleClass = 'font-semibold';

  return (
    <ViewportFrame
      title={
        <span className={titleClass} style={{ color: definition.color }}>
          {definition.label}
        </span>
      }
      subtitle={
        <span className={subtitleLabelClass}>
          <span
            className={axisBadgeClass}
            style={{
              color: definition.color,
              borderColor: `${definition.color}55`,
              backgroundColor: `${definition.color}22`,
            }}
          >
            {definition.badge}
          </span>
          {definition.orientation}
        </span>
      }
      status={definition.status}
      statusStyle={{
        color: definition.color,
        borderColor: `${definition.color}40`,
        backgroundColor: `${definition.color}14`,
      }}
      actions={compact ? axisSelector : undefined}
    >
      <SliceCanvas
        image={definition.image}
        crosshairPoint={definition.crosshairPoint}
        crosshairSpace={definition.crosshairSpace}
        crosshairColors={definition.crosshairColors}
        fit={compact ? SliceCanvasFit.Contain : SliceCanvasFit.Cover}
        zoom={mprZoom}
        onZoomChange={onZoomChange}
        onSelect={onSelect}
      />
    </ViewportFrame>
  );
}

function resolveAxisDefinitions(
  cursor: VolumeCursor | null,
  dimensions: Vec3,
  slices: ViewerSlices,
  volume: LoadedVolume | null,
): Record<VolumeAxis, AxisViewportDefinition> {
  return {
    [VolumeAxis.Coronal]: {
      axis: VolumeAxis.Coronal,
      badge: 'XZ',
      color: PLANE_COLORS.coronal,
      label: 'Coronal',
      orientation: 'Frontal · superior at top',
      image: slices.coronal,
      status: cursor
        ? `Y ${cursor.y + 1}/${Math.max(1, dimensions[1])}`
        : 'No volume',
      crosshairPoint: cursor
        ? { x: cursor.x, y: dimensions[2] - 1 - cursor.z }
        : undefined,
      crosshairSpace: volume ? [dimensions[0], dimensions[2]] : undefined,
      crosshairColors: {
        vertical: PLANE_COLORS.sagittal,
        horizontal: PLANE_COLORS.axial,
      },
    },
    [VolumeAxis.Sagittal]: {
      axis: VolumeAxis.Sagittal,
      badge: 'YZ',
      color: PLANE_COLORS.sagittal,
      label: 'Sagittal',
      orientation: 'Lateral · superior at top',
      image: slices.sagittal,
      status: cursor
        ? `X ${cursor.x + 1}/${Math.max(1, dimensions[0])}`
        : 'No volume',
      crosshairPoint: cursor
        ? { x: cursor.y, y: dimensions[2] - 1 - cursor.z }
        : undefined,
      crosshairSpace: volume ? [dimensions[1], dimensions[2]] : undefined,
      crosshairColors: {
        vertical: PLANE_COLORS.coronal,
        horizontal: PLANE_COLORS.axial,
      },
    },
    [VolumeAxis.Axial]: {
      axis: VolumeAxis.Axial,
      badge: 'XY',
      color: PLANE_COLORS.axial,
      label: 'Axial',
      orientation: 'Occlusal',
      image: slices.axial,
      status: cursor
        ? `Z ${cursor.z + 1}/${Math.max(1, dimensions[2])}`
        : 'No volume',
      crosshairPoint: cursor ? { x: cursor.x, y: cursor.y } : undefined,
      crosshairSpace: volume ? [dimensions[0], dimensions[1]] : undefined,
      crosshairColors: {
        vertical: PLANE_COLORS.sagittal,
        horizontal: PLANE_COLORS.coronal,
      },
    },
  };
}

export function AxisViewportGrid({
  compact = false,
  cursor,
  dimensions,
  mprZoom,
  selectedAxis = VolumeAxis.Coronal,
  slices,
  volume,
  onSelectAxis,
  onSelectedAxisChange,
  onZoomChange,
}: AxisViewportGridProps) {
  const axisSelector = (
    <label className="pointer-events-auto">
      <span className="sr-only">Select axis view</span>
      <select
        className="rounded border border-slate-700/80 bg-slate-950/75 px-2 py-1 text-[11px] font-medium text-slate-200 outline-none transition focus:border-sky-500"
        value={selectedAxis}
        onChange={(event) =>
          onSelectedAxisChange?.(event.target.value as VolumeAxis)
        }
      >
        <option value={VolumeAxis.Coronal}>Coronal</option>
        <option value={VolumeAxis.Sagittal}>Sagittal</option>
        <option value={VolumeAxis.Axial}>Axial</option>
      </select>
    </label>
  );
  const axisDefinitions = resolveAxisDefinitions(
    cursor,
    dimensions,
    slices,
    volume,
  );
  const axes = [VolumeAxis.Coronal, VolumeAxis.Sagittal, VolumeAxis.Axial];

  if (compact) {
    return (
      <div className="min-h-0 min-w-0 bg-slate-800">
        <AxisViewportPane
          compact
          definition={axisDefinitions[selectedAxis]}
          axisSelector={axisSelector}
          mprZoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(selectedAxis)}
        />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 min-w-0 grid-cols-3 gap-px bg-slate-800">
      {axes.map((axis) => (
        <AxisViewportPane
          key={axis}
          compact={false}
          definition={axisDefinitions[axis]}
          mprZoom={mprZoom}
          onZoomChange={onZoomChange}
          onSelect={onSelectAxis(axis)}
        />
      ))}
    </div>
  );
}
