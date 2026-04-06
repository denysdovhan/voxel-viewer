import { useEffect, useState } from 'react';

export const COMPACT_VIEWER_MEDIA_QUERY = '(max-width: 767px)';

export function isCompactViewerLayout() {
  return window.matchMedia(COMPACT_VIEWER_MEDIA_QUERY).matches;
}

export function useCompactViewerLayout() {
  const [compact, setCompact] = useState(() => isCompactViewerLayout());

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_VIEWER_MEDIA_QUERY);
    const handleChange = () => setCompact(mediaQuery.matches);
    handleChange();

    if ('addEventListener' in mediaQuery) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener: (listener: () => void) => void;
      removeListener: (listener: () => void) => void;
    };
    legacyMediaQuery.addListener(handleChange);
    return () => legacyMediaQuery.removeListener(handleChange);
  }, []);

  return compact;
}
