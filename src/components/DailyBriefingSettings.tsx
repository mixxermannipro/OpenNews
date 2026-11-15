import { useEffect, useState } from 'react';
import { NewsPush } from '../lib/newsPush';
import { DailyBriefing, type DailyBriefingSettings as Settings } from '../lib/dailyBriefing';

export function DailyBriefingSettings({ settings, onChange }: { settings: Settings; onChange: (value: Settings) => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!settings.enabled) return;
    let active = true;
    const check = () => {
      if (document.hidden) return;
      void NewsPush.checkAccess().then(({ allowed }) => {
        if (!active) return;
        setPermissionDenied(!allowed);
        if (!allowed) setStatus('');
      }).catch(() => {});
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', check);
    };
  }, [settings.enabled]);

  const save = async (next: Settings) => {
    setBusy(true);
    setPermissionDenied(false);
    try {
      if (next.enabled) {
        const access = await (settings.enabled ? NewsPush.checkAccess() : NewsPush.requestAccess());
        if (!access.allowed) {
          setPermissionDenied(true);
          setStatus('');
          return;
        }
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
    <p role="status" className="text-sm">{permissionDenied
      ? status || 'Erlaube Benachrichtigungen in den Android-Einstellungen.'
      : status}</p>
    {permissionDenied && <button className="choice-pill" type="button" onClick={() => {
      void NewsPush.openSettings().catch(() => setStatus('Öffne die Benachrichtigungen in den Android-Einstellungen.'));
    }}>Android-Einstellungen öffnen</button>}
  </section>;
}
