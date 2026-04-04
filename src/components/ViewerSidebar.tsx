import {
  ArrowLeft,
  Box,
  Contrast,
  Crosshair,
  FolderInput,
  SlidersHorizontal,
  SunMedium,
} from 'lucide-react';
import { formatSpacing } from '../app/helpers';
import { DISCLAIMER_TEXT } from '../constants';
import type {
  ImportIssue,
  ImportProgress,
  LoadedVolume,
  RangeBounds,
  SliceWindowLevel,
  Vec3,
  VolumeCursor,
} from '../types';
import { Button } from './Button';
import { ImportStatus, ImportStatusStage } from './ImportStatus';
import { Notice } from './Notice';
import { RangeField } from './RangeField';

interface ViewerSidebarProps {
  cursor: VolumeCursor | null;
  dimensions: Vec3;
  downsampled3D: boolean;
  issue: ImportIssue | null;
  levelBounds: RangeBounds;
  progress: ImportProgress;
  sourceLabel: string;
  spacing: Vec3;
  volume: LoadedVolume | null;
  windowBounds: RangeBounds;
  windowLevelDraft: SliceWindowLevel;
  onBackToImport: () => void;
  onLevelChange: (value: number) => void;
  onLevelCommit: (value: number) => void;
  onOpenDirectory: () => void;
  onWindowChange: (value: number) => void;
  onWindowCommit: (value: number) => void;
}

export function ViewerSidebar({
  cursor,
  dimensions,
  downsampled3D,
  issue,
  levelBounds,
  progress,
  sourceLabel,
  spacing,
  volume,
  windowBounds,
  windowLevelDraft,
  onBackToImport,
  onLevelChange,
  onLevelCommit,
  onOpenDirectory,
  onWindowChange,
  onWindowCommit,
}: ViewerSidebarProps) {
  const sectionLabelClass =
    'inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-slate-500';

  return (
    <aside className="grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] overflow-hidden">
      <section className="min-w-0 rounded border border-slate-800 bg-slate-950/80 p-2.5">
        <div className={sectionLabelClass}>
          <Box className="h-3.5 w-3.5" aria-hidden="true" />
          Study
        </div>
        <div
          className="mt-1 truncate text-sm font-semibold text-slate-100"
          title={volume?.meta.scanId}
        >
          {volume?.meta.scanId}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {volume?.meta.formatLabel}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {dimensions.join(' x ')} voxels
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {formatSpacing(spacing)} mm
        </div>
        <div
          className="mt-1 truncate text-xs text-slate-600"
          title={sourceLabel}
        >
          {sourceLabel}
        </div>
      </section>

      <section className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-2.5">
        <div className={sectionLabelClass}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Display
        </div>
        <div className="mt-2.5">
          <RangeField
            label={
              <span className="inline-flex items-center gap-1.5">
                <Contrast className="h-3.5 w-3.5" aria-hidden="true" />
                Window
              </span>
            }
            min={windowBounds.min}
            max={windowBounds.max}
            value={windowLevelDraft.window}
            onChange={onWindowChange}
            onCommit={onWindowCommit}
            hint="Contrast span. Smaller window = more contrast."
          />
        </div>

        <div className="mt-2.5">
          <RangeField
            label={
              <span className="inline-flex items-center gap-1.5">
                <SunMedium className="h-3.5 w-3.5" aria-hidden="true" />
                Level
              </span>
            }
            min={levelBounds.min}
            max={levelBounds.max}
            value={windowLevelDraft.level}
            onChange={onLevelChange}
            onCommit={onLevelCommit}
            hint="Brightness bias. Higher level favors denser tissue."
          />
        </div>
      </section>

      <div className="min-h-0 min-w-0">
        <ImportStatus
          progress={progress}
          issue={issue}
          stage={ImportStatusStage.Viewer}
        />
      </div>

      <section className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-2.5">
        <div className={sectionLabelClass}>
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          Navigation
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Cursor{' '}
          {cursor ? `${cursor.x + 1}, ${cursor.y + 1}, ${cursor.z + 1}` : 'n/a'}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Drag inside any 2D pane to scrub linked slices.
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Wheel or pinch to zoom; when zoomed, scrubbing keeps the crosshair
          centered when possible.
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Coronal and sagittal views are flipped so superior anatomy stays at
          the top.
        </div>
        <div className="mt-2 text-xs text-slate-400">3D using full volume.</div>
        <div className="mt-1 text-xs text-slate-500">
          {downsampled3D
            ? 'Downsampled from full volume to fit GPU texture limits.'
            : 'Native full-volume resolution.'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Colored planes in 3D match the current coronal, sagittal, and axial
          slices.
        </div>
      </section>

      <section className="min-w-0 rounded border border-slate-800 bg-slate-950/70 p-2.5">
        <div className="grid grid-cols-1 gap-2">
          <Button variant="primary" block onClick={onOpenDirectory}>
            <FolderInput className="h-4 w-4" aria-hidden="true" />
            Open folder
          </Button>
          <Button variant="ghost" block onClick={onBackToImport}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to import
          </Button>
        </div>
        <Notice className="mt-3" compact>
          {DISCLAIMER_TEXT}
        </Notice>
      </section>
    </aside>
  );
}
