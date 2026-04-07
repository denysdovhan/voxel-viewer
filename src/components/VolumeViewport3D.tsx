import {
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Ratio,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../i18n';
import {
  createThreePreview,
  type ThreePreviewInstance,
} from '../lib/volume/three-preview';
import type { PreparedVolumeFor3D, VolumeCursor } from '../types';
import { Button } from './Button';

interface VolumeViewport3DProps {
  volume: PreparedVolumeFor3D | null;
  cursor?: VolumeCursor | null;
  axisViewsVisible?: boolean;
  onAxisViewsVisibleChange?: (visible: boolean) => void;
  sidebarVisible?: boolean;
  onSidebarVisibleChange?: (visible: boolean) => void;
  onDownsampledChange?: (downsampled: boolean) => void;
}

export function VolumeViewport3D({
  volume,
  cursor = null,
  axisViewsVisible = true,
  onAxisViewsVisibleChange,
  sidebarVisible = true,
  onSidebarVisibleChange,
  onDownsampledChange,
}: VolumeViewport3DProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ThreePreviewInstance | null>(null);
  const cursorRef = useRef<VolumeCursor | null>(cursor);
  const [error, setError] = useState(false);
  const [planesVisible, setPlanesVisible] = useState(true);
  const planesVisibleRef = useRef(planesVisible);

  useEffect(() => {
    cursorRef.current = cursor;
    instanceRef.current?.focusCursor(cursor);
  }, [cursor]);

  useEffect(() => {
    planesVisibleRef.current = planesVisible;
    instanceRef.current?.setPlanesVisible(planesVisible);
  }, [planesVisible]);

  useEffect(() => {
    onDownsampledChange?.(Boolean(volume?.downsampled));
  }, [onDownsampledChange, volume?.downsampled]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !volume) {
      setError(false);
      return undefined;
    }

    let cleanup: () => void = () => {};
    let cancelled = false;
    let mounted = false;
    let frame = 0;
    let retryTimer = 0;
    let retryCount = 0;
    let resizeObserver: ResizeObserver | null = null;
    setError(false);

    const scheduleRetry = () => {
      if (cancelled || mounted || retryCount >= 4) return;
      retryCount += 1;
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => {
        mount();
        if (!mounted) scheduleRetry();
      }, 120 * retryCount);
    };

    const mount = () => {
      if (cancelled || mounted) return;
      if (host.clientWidth < 32 || host.clientHeight < 32) return;
      mounted = true;
      resizeObserver?.disconnect();
      resizeObserver = null;

      void createThreePreview(host, volume)
        .then((instance) => {
          if (cancelled) {
            instance.dispose();
            return;
          }

          instanceRef.current = instance;
          instance.focusCursor(cursorRef.current);
          instance.setPlanesVisible(planesVisibleRef.current);
          cleanup = instance.dispose;
        })
        .catch((_renderError: unknown) => {
          if (cancelled) return;
          mounted = false;
          if (retryCount < 4) {
            scheduleRetry();
            return;
          }
          setError(true);
        });
    };

    frame = window.requestAnimationFrame(() => {
      mount();
      if (mounted || cancelled) return;

      resizeObserver = new ResizeObserver(() => {
        mount();
      });
      resizeObserver.observe(host);
      scheduleRetry();
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retryTimer);
      resizeObserver?.disconnect();
      instanceRef.current = null;
      cleanup();
    };
  }, [volume]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-black">
      <div
        ref={hostRef}
        className="absolute inset-0 h-full min-h-0 overflow-hidden"
      />
      <div className="absolute inset-0 z-20 pointer-events-none">
        <div className="pointer-events-auto absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-center gap-1 sm:inset-x-auto sm:right-2 sm:justify-end">
          <Button
            variant="overlay"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={() => onAxisViewsVisibleChange?.(!axisViewsVisible)}
          >
            {axisViewsVisible ? (
              <PanelBottomClose className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <PanelBottomOpen className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="sm:hidden">
              {axisViewsVisible
                ? t('volumeViewport3d.hideAxisViewsShort')
                : t('volumeViewport3d.showAxisViewsShort')}
            </span>
            <span className="hidden sm:inline">
              {axisViewsVisible
                ? t('volumeViewport3d.hideAxisViewsLong')
                : t('volumeViewport3d.showAxisViewsLong')}
            </span>
          </Button>
          <Button
            variant="overlay"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={() => onSidebarVisibleChange?.(!sidebarVisible)}
          >
            {sidebarVisible ? (
              <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="sm:hidden">
              {sidebarVisible
                ? t('volumeViewport3d.hideSidebarShort')
                : t('volumeViewport3d.showSidebarShort')}
            </span>
            <span className="hidden sm:inline">
              {sidebarVisible
                ? t('volumeViewport3d.hideSidebarLong')
                : t('volumeViewport3d.showSidebarLong')}
            </span>
          </Button>
          <Button
            variant="overlay"
            size="sm"
            className="min-w-0 flex-1 sm:flex-none"
            onClick={() => setPlanesVisible((current) => !current)}
          >
            <Ratio className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sm:hidden">
              {planesVisible
                ? t('volumeViewport3d.hidePlanesShort')
                : t('volumeViewport3d.showPlanesShort')}
            </span>
            <span className="hidden sm:inline">
              {planesVisible
                ? t('volumeViewport3d.hidePlanesLong')
                : t('volumeViewport3d.showPlanesLong')}
            </span>
          </Button>
        </div>
      </div>
      {error ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 px-4 text-center text-xs text-slate-400">
          {t('volumeViewport3d.previewError')}
        </div>
      ) : null}
    </div>
  );
}
