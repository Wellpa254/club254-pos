/** The only place the offline service worker is registered. Never runs in dev, iframes, or with ?sw=off. */
export function swBlocked(_hostname: string, search: string, inIframe: boolean, prod: boolean) {
  return !prod || inIframe || new URLSearchParams(search).get("sw") === "off";
}

export async function setupServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  let inIframe = true;
  try { inIframe = window.self !== window.top; } catch { /* cross-origin frame */ }
  if (swBlocked(window.location.hostname, window.location.search, inIframe, import.meta.env.PROD)) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js") || r.waiting?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()));
    return;
  }
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
