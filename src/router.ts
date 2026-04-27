import { useEffect, useState } from 'react';

/**
 * Minimal client-side router. Returns the current pathname and re-renders
 * when it changes. Pair with `navigate()` for in-app links.
 *
 * Note: requires the host to serve `index.html` for unknown paths
 * (Vite dev/preview do this automatically; static hosts need a SPA fallback).
 */
export function useRoute(): string {
  const [path, setPath] = useState(
    typeof window === 'undefined' ? '/' : window.location.pathname,
  );
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    window.addEventListener('pingtour:navigate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('pingtour:navigate', handler);
    };
  }, []);
  return path;
}

export function navigate(path: string): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('pingtour:navigate'));
}
