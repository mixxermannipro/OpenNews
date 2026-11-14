export type Diagnostic = 'app-error' | 'unhandled-promise' | 'feed-failed' | 'storage-failed';
const key = 'opennews_diagnostics';
const consentKey = 'opennews_diagnostics_enabled';
const allowed = new Set<Diagnostic>(['app-error', 'unhandled-promise', 'feed-failed', 'storage-failed']);

export function diagnosticsEnabled(): boolean {
  try { return localStorage.getItem(consentKey) === '1'; } catch { return false; }
}

export function setDiagnosticsEnabled(enabled: boolean) {
  if (enabled) localStorage.setItem(consentKey, '1');
  else {
    localStorage.removeItem(consentKey);
    localStorage.removeItem(key);
  }
}

export function getDiagnostics(): { event: Diagnostic; hour: number }[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(data) ? data.filter(row => row && allowed.has(row.event) && Number.isFinite(row.hour))
      .map(({ event, hour }) => ({ event, hour })).slice(-50) : [];
  } catch {
    return [];
  }
}

export function recordDiagnostic(event: Diagnostic) {
  if (!diagnosticsEnabled()) return;
  try {
    const hour = Math.floor(Date.now() / 3_600_000);
    const rows = getDiagnostics();
    if (rows.some(row => row.event === event && row.hour === hour)) return;
    localStorage.setItem(key, JSON.stringify([...rows.filter(row => hour - row.hour < 168), { event, hour }].slice(-50)));
  } catch {
    // Diagnostics must not interfere with the app.
  }
}

export function installDiagnostics() {
  window.addEventListener('error', () => recordDiagnostic('app-error'));
  window.addEventListener('unhandledrejection', () => recordDiagnostic('unhandled-promise'));
}
