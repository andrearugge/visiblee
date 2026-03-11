declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export function pageview(gaId: string, url: string) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('config', gaId, { page_path: url });
}

export function sendGAEvent(
  name: string,
  params?: Record<string, string | number | boolean>,
) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params);
}
