export function getConfig() {
  // Fallback seguro: no forzar origen externo por defecto para evitar Mixed Content
  const fallback = { API_BASE: '', FRONTEND_URL: '' };
  if (typeof window === 'undefined') return fallback;
  const cfg = window.__APP_CONFIG__ || fallback;
  // Normaliza API_BASE: '' o absoluto termina sin slash
  const api = (cfg.API_BASE || '').replace(/\/$/, '');
  // Advertir si se detecta mezcla de contenido inseguro
  try {
    if (window.location && window.location.protocol === 'https:' && api.startsWith('http:')) {
      // eslint-disable-next-line no-console
      console.warn('[config] API_BASE usa http en una página https. El navegador bloqueará las llamadas (Mixed Content). Use https.');
    }
  } catch (_) {/* noop */}
  return { ...cfg, API_BASE: api };
}

export function apiUrl(path) {
  const { API_BASE } = getConfig();
  if (!API_BASE) return path; // relativo al mismo host
  return API_BASE + (path.startsWith('/') ? path : '/' + path);
}

export function eventsUrl() {
  return apiUrl('/api/events');
}

export function wsUrl(path = '/ws') {
  const { API_BASE } = getConfig();
  try {
    if (API_BASE) {
      const u = new URL(API_BASE);
      const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${proto}//${u.host}${path}`;
    }
  } catch (_) { /* ignore */ }
  if (typeof window !== 'undefined' && window.location) {
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}${path}`;
  }
  // Fallback genérico
  return path;
}
