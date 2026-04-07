import { Box, PanelRightClose } from 'lucide-react';
import type { ViewerApp } from '../app/useViewerApp';
import { useCompactViewerLayout } from '../app/viewer-layout';
import { AxisViewportGrid } from '../components/AxisViewportGrid';
import { Button } from '../components/Button';
import { ViewerSidebar } from '../components/ViewerSidebar';
import { ViewportFrame } from '../components/ViewportFrame';
import { VolumeViewport3D } from '../components/VolumeViewport3D';
import { useTranslation } from '../i18n';
import { cn } from '../utils/cn';

interface ViewerPageProps {
  app: ViewerApp;
}

export default function ViewerPage({ app }: ViewerPageProps) {
  const compactLayout = useCompactViewerLayout();
  const { t } = useTranslation();

  if (!app.volume) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="rounded border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-400">
          {t('viewerPage.loading')}
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="relative h-full overflow-hidden bg-slate-800">
        <div
          className={cn(
            'grid h-full gap-px',
            compactLayout
              ? 'grid-cols-1'
              : app.sidebarVisible
                ? 'grid-cols-[minmax(0,1fr)_minmax(288px,22vw)]'
                : 'grid-cols-1',
          )}
        >
          <section className="min-h-0 min-w-0">
            <div
              className={cn(
                'grid h-full min-h-0 min-w-0 gap-px bg-slate-800',
                app.axisViewsVisible
                  ? compactLayout
                    ? 'grid-rows-[minmax(0,1.1fr)_minmax(260px,0.9fr)]'
                    : 'grid-rows-[1.22fr_0.95fr]'
                  : 'grid-rows-1',
              )}
            >
              <div className="grid min-h-0 min-w-0 grid-cols-1 gap-px bg-slate-800">
                <ViewportFrame
                  title={
                    <span className="inline-flex items-center gap-1.5">
                      <Box
                        className="h-4 w-4 text-slate-400"
                        aria-hidden="true"
                      />
                      3D
                    </span>
                  }
                  subtitle={t('viewerPage.mainNavigationVolume')}
                  status={
                    app.prepared3D
                      ? app.prepared3D.downsampled
                        ? t('viewerPage.downsampledStatus')
                        : t('viewerPage.nativeStatus')
                      : t('viewerPage.preparingStatus')
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
                  compact={compactLayout}
                  volume={app.volume}
                  cursor={app.cursor}
                  dimensions={app.dimensions}
                  slices={app.slices}
                  mprZoom={app.mprZoom}
                  selectedAxis={app.selectedAxis}
                  onZoomChange={app.setMprZoom}
                  onSelectedAxisChange={app.setSelectedAxis}
                  onSelectAxis={app.updateCursor}
                />
              ) : null}
            </div>
          </section>

          {!compactLayout && app.sidebarVisible ? (
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

        {compactLayout && app.sidebarVisible ? (
          <div className="absolute inset-0 z-40 flex justify-end">
            <button
              type="button"
              aria-label={t('viewerPage.closeStudyPanel')}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px]"
              onClick={() => app.setSidebarVisible(false)}
            />
            <div className="relative flex h-full w-[min(24rem,92vw)] flex-col border-l border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {t('viewerPage.studyPanel')}
                </div>
                <Button
                  variant="overlay"
                  size="sm"
                  onClick={() => app.setSidebarVisible(false)}
                >
                  <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('common.hide')}
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto bg-slate-800 p-px">
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
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
