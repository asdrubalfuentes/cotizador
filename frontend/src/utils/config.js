export function getConfig() {
  const fallback = { API_BASE: '', FRONTEND_URL: '' };
  if (typeof window === 'undefined') return fallback;
  const cfg = window.__APP_CONFIG__ || fallback;
  // Normaliza API_BASE: '' o absoluto termina sin slash
  const api = (cfg.API_BASE || '').replace(/\/$/, '');
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
