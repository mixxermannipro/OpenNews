import { Capacitor } from '@capacitor/core';
import { isDiagnostic, type Diagnostic } from './diagnosticEvents';

const key = 'opennews_diagnostics';
const consentKey = 'opennews_diagnostics_enabled';
const reportKey = 'opennews_diagnostics_reports';
export function reportsEnabled(): boolean {
  try { return localStorage.getItem(reportKey) === '1'; } catch { return false; }
}

export function setReportsEnabled(enabled: boolean) {
  if (enabled) localStorage.setItem(reportKey, '1');
  else localStorage.removeItem(reportKey);
}

export function diagnosticsEnabled(): boolean {
  try { return localStorage.getItem(consentKey) === '1'; } catch { return false; }
}

export function setDiagnosticsEnabled(enabled: boolean) {
  if (enabled) localStorage.setItem(consentKey, '1');
  else {
    localStorage.removeItem(consentKey);
    localStorage.removeItem(key);
    localStorage.removeItem(reportKey);
  }
}

export function getDiagnostics(): { event: Diagnostic; hour: number }[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(data) ? data.filter(row => row && isDiagnostic(row.event) && Number.isFinite(row.hour))
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
    if (reportsEnabled() && !Capacitor.isNativePlatform()) {
      void fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        body: JSON.stringify({ event }),
      }).catch(() => {});
    }
  } catch {
    // Diagnostics must not interfere with the app.
  }
}

export function installDiagnostics() {
  window.addEventListener('error', () => recordDiagnostic('app-error'));
  window.addEventListener('unhandledrejection', () => recordDiagnostic('unhandled-promise'));
}
