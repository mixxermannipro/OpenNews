import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';
import { diagnosticsEnabled, getDiagnostics, reportsEnabled, setDiagnosticsEnabled, setReportsEnabled } from '../lib/diagnostics';

export function DiagnosticsSettings() {
  const [enabled, setEnabled] = useState(diagnosticsEnabled);
  const [remoteAvailable, setRemoteAvailable] = useState(false);
  const [reporting, setReporting] = useState(reportsEnabled);
  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const controller = new AbortController();
    void fetch('/api/diagnostics', { signal: controller.signal, credentials: 'omit' })
      .then(response => response.ok && response.json())
      .then(data => { if (!controller.signal.aborted) setRemoteAvailable(data?.enabled === true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const [status, setStatus] = useState('');
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(getDiagnostics(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'opennews-diagnose.json';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3">
        <input type="checkbox" checked={enabled} onChange={event => {
          try {
            setDiagnosticsEnabled(event.currentTarget.checked);
            setEnabled(event.currentTarget.checked);
            setStatus('');
            if (!event.currentTarget.checked) setReporting(false);
          } catch {
            setStatus('Die Einstellung konnte nicht gespeichert werden.');
          }
        }} />
        Fehlerdiagnose lokal speichern
      </label>
      <p>Speichert Fehlerarten und Stunden auf diesem Gerät. Du kannst den Bericht herunterladen und selbst weitergeben.</p>
      {enabled && <button type="button" className="choice-pill" onClick={download}>Diagnose exportieren</button>}
      {enabled && remoteAvailable && <label className="flex items-center gap-3">
        <input type="checkbox" checked={reporting} onChange={event => {
          try {
            setReportsEnabled(event.currentTarget.checked);
            setReporting(event.currentTarget.checked);
            setStatus('');
          } catch {
            setStatus('Die Einstellung konnte nicht gespeichert werden.');
          }
        }} />
        Fehlerarten freiwillig an den OpenNews-Betreiber melden
      </label>}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
