import { useState } from 'react';
import { NewsPush } from '../lib/newsPush';
import { DailyBriefing, type DailyBriefingSettings as Settings } from '../lib/dailyBriefing';

export function DailyBriefingSettings({ settings, onChange }: { settings: Settings; onChange: (value: Settings) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const save = async (next: Settings) => {
    setBusy(true);
    setPermissionDenied(false);
    try {
      if (next.enabled && !settings.enabled && !(await NewsPush.requestAccess()).allowed) {
        setPermissionDenied(true);
        setStatus('Erlaube Benachrichtigungen in den Android-Einstellungen.');
        return;
      }
      await DailyBriefing.configure(next);
      onChange(next);
      setStatus(next.enabled ? 'Der Tagesüberblick ist geplant.' : 'Der Tagesüberblick ist abbestellt.');
    } catch {
      setStatus('Die Erinnerung konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="liquid-glass space-y-3 rounded-[26px] p-5">
    <h2 className="font-semibold">Täglicher Überblick</h2>
    <p className="text-sm">Android erinnert dich ungefähr zur gewählten Ortszeit. Die Benachrichtigung verwendet die letzte geladene Schlagzeile.</p>
    <label className="flex items-center gap-3 text-sm">
      <input type="checkbox" checked={settings.enabled} disabled={busy}
        onChange={event => void save({ ...settings, enabled: event.target.checked })} />
      Tägliche Erinnerung
    </label>
    <label className="flex items-center gap-3 text-sm">
      Uhrzeit
      <input className="preference-input" type="time" value={settings.time} disabled={busy}
        onChange={event => { if (event.target.value) void save({ ...settings, time: event.target.value }); }} />
    </label>
    <p role="status" className="text-sm">{status}</p>
    {permissionDenied && <button className="choice-pill" type="button" onClick={() => {
      void NewsPush.openSettings().catch(() => setStatus('Öffne die Benachrichtigungen in den Android-Einstellungen.'));
    }}>Android-Einstellungen öffnen</button>}
  </section>;
}
