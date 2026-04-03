import type { ViewerApp } from '../app/useViewerApp';
import { AxisViewportGrid } from '../components/AxisViewportGrid';
import { ViewerSidebar } from '../components/ViewerSidebar';
import { ViewportFrame } from '../components/ViewportFrame';
import { VolumeViewport3D } from '../components/VolumeViewport3D';
import { cn } from '../utils/cn';

interface ViewerPageProps {
  app: ViewerApp;
}

export default function ViewerPage({ app }: ViewerPageProps) {
  if (!app.volume) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="rounded border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-400">
          Preparing viewer...
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="h-full overflow-hidden bg-slate-800">
        <div
          className={cn(
            'grid h-full gap-px',
            app.sidebarVisible
              ? 'grid-cols-[minmax(0,1fr)_minmax(288px,22vw)]'
              : 'grid-cols-1',
          )}
        >
          <section className="min-h-0 min-w-0">
            <div
              className={cn(
                'grid h-full min-h-0 min-w-0 gap-px bg-slate-800',
                app.axisViewsVisible
                  ? 'grid-rows-[1.22fr_0.95fr]'
                  : 'grid-rows-1',
              )}
            >
              <div className="grid min-h-0 min-w-0 grid-cols-1 gap-px bg-slate-800">
                <ViewportFrame
                  title="3D"
                  subtitle="Main navigation volume"
                  status={
                    app.prepared3D
                      ? app.prepared3D.downsampled
                        ? 'Downsampled'
                        : 'Native'
                      : 'Preparing'
                  }
                >
                  <VolumeViewport3D
                    volume={app.prepared3D}
                    cursor={app.cursor}
                    axisViewsVisible={app.axisViewsVisible}
                    onAxisViewsVisibleChange={app.setAxisViewsVisible}
                    sidebarVisible={app.sidebarVisible}
                    onSidebarVisibleChange={app.setSidebarVisible}
                    onDownsampledChange={app.setDownsampled3D}
                  />
                </ViewportFrame>
              </div>

              {app.axisViewsVisible ? (
                <AxisViewportGrid
                  volume={app.volume}
                  cursor={app.cursor}
                  dimensions={app.dimensions}
                  slices={app.slices}
                  mprZoom={app.mprZoom}
                  onZoomChange={app.setMprZoom}
                  onSelectAxis={app.updateCursor}
                />
              ) : null}
            </div>
          </section>

          {app.sidebarVisible ? (
            <ViewerSidebar
              volume={app.volume}
              sourceLabel={app.sourceLabel}
              dimensions={app.dimensions}
              spacing={app.spacing}
              windowBounds={app.windowBounds}
              levelBounds={app.levelBounds}
              windowLevelDraft={app.windowLevelDraft}
              progress={app.progress}
              issue={app.issue}
              cursor={app.cursor}
              downsampled3D={app.downsampled3D}
              onWindowChange={app.handleWindowChange}
              onWindowCommit={app.handleWindowCommit}
              onLevelChange={app.handleLevelChange}
              onLevelCommit={app.handleLevelCommit}
              onOpenDirectory={() => void app.openDirectory()}
              onBackToImport={app.resetViewer}
            />
          ) : null}
        </div>
      </div>
    </main>
  );
}
