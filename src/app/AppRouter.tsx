import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { APP_ROUTES } from '../constants';
import { useViewerApp } from './useViewerApp';

const ImportPage = lazy(() => import('../pages/ImportPage'));
const ViewerPage = lazy(() => import('../pages/ViewerPage'));

function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="rounded border border-slate-800 bg-slate-950/90 px-4 py-3 text-sm text-slate-400">
        Loading viewer shell...
      </div>
    </main>
  );
}

export function AppRouter() {
  const location = useLocation();
  const app = useViewerApp();
  const targetPath = app.volume ? APP_ROUTES.viewer : APP_ROUTES.import;

  if (location.pathname !== targetPath) {
    return <Navigate to={targetPath} replace />;
  }

  const ActivePage = app.volume ? ViewerPage : ImportPage;

  return (
    <Suspense fallback={<RouteFallback />}>
      <ActivePage app={app} />
    </Suspense>
  );
}
