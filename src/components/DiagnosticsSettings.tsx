import { useState } from 'react';
import { diagnosticsEnabled, getDiagnostics, setDiagnosticsEnabled } from '../lib/diagnostics';

export function DiagnosticsSettings() {
  const [enabled, setEnabled] = useState(diagnosticsEnabled);
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
          } catch {
            setStatus('Die Einstellung konnte nicht gespeichert werden.');
          }
        }} />
        Fehlerdiagnose lokal speichern
      </label>
      <p>Speichert Fehlerarten und Stunden auf diesem Gerät. Du kannst den Bericht herunterladen und selbst weitergeben.</p>
      {enabled && <button type="button" className="choice-pill" onClick={download}>Diagnose exportieren</button>}
      {status && <p role="status">{status}</p>}
    </div>
  );
}
