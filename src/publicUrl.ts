/**
 * The base URL phones / external clients should use to reach this app.
 *
 * Defaults to whatever URL the current page is loaded from. Set
 * `VITE_PUBLIC_BASE_URL` (e.g. via `.env.local`) to override — useful when
 * the TV uses one URL (localhost / LAN IP) but phones need a different
 * one (an ngrok tunnel, a real domain).
 */
export function publicBaseUrl(): string {
  const override = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  const o = override?.trim().replace(/\/$/, '');
  if (o) return o;
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function joinUrl(): string {
  return `${publicBaseUrl()}/join`;
}
