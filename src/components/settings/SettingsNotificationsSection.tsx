import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Bell } from 'lucide-react';
import type { NewsCategory, NotificationSettings } from '../../types/news';
import { NewsPush } from '../../lib/newsPush';
import { TopicChoices } from '../Preferences';

interface SettingsNotificationsSectionProps {
  notifications: NotificationSettings;
  pushStatus: string;
  pushPermissionDenied: boolean;
  requestingPushPermission: boolean;
  onUpdateNotifications: (next: NotificationSettings) => void;
  onSendTestNotification: () => void;
}

export const SettingsNotificationsSection: React.FC<SettingsNotificationsSectionProps> = ({
  notifications,
  pushStatus,
  pushPermissionDenied,
  requestingPushPermission,
  onUpdateNotifications,
  onSendTestNotification,
}) => {
  const [androidSettingsUnavailable, setAndroidSettingsUnavailable] = useState(false);

  return (
    <div className="liquid-glass rounded-[26px] p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-emerald-500" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Eilmeldungen &amp; Benachrichtigungen
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {Capacitor.getPlatform() === 'android'
                ? 'Meldungen aus unterstützten Quellen auch bei geschlossener App.'
                : 'Im Browser erscheinen Hinweise nur beim Aktualisieren in der geöffneten App.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={notifications.enabled}
          aria-label="Benachrichtigungen umschalten"
          disabled={requestingPushPermission}
          onClick={() => onUpdateNotifications({ ...notifications, enabled: !notifications.enabled })}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            notifications.enabled ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-[var(--control)] ring-1 ring-inset ring-[var(--line)]'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              notifications.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {(pushStatus || (pushPermissionDenied && androidSettingsUnavailable)) && (
        <p role="status" className="text-sm">
          {pushPermissionDenied && androidSettingsUnavailable
            ? 'Öffne in Android die App-Infos für OpenNews und wähle Benachrichtigungen.'
            : pushStatus}
        </p>
      )}
      {pushPermissionDenied && (
        <button
          type="button"
          className="choice-pill"
          onClick={() => {
            setAndroidSettingsUnavailable(false);
            void NewsPush.openSettings().catch(() => setAndroidSettingsUnavailable(true));
          }}
        >
          Android-Einstellungen öffnen
        </button>
      )}
      {notifications.enabled && (
        <div className="space-y-4 border-t border-[var(--line)] pt-3">
          <label className="preference-row px-0">
            Nur als Eilmeldung markierte Artikel
            <input
              type="checkbox"
              checked={notifications.breakingOnly}
              onChange={event => onUpdateNotifications({ ...notifications, breakingOnly: event.target.checked })}
            />
          </label>
          {!notifications.breakingOnly && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Themen für Hinweise</p>
              <p className="text-sm text-[var(--muted)]">Ohne Auswahl sind alle Themen aktiv.</p>
              <TopicChoices
                topics={notifications.topics as NewsCategory[]}
                onChange={topics => onUpdateNotifications({ ...notifications, topics })}
              />
            </div>
          )}
          <fieldset className="flex flex-wrap items-center gap-3">
            <legend className="mb-2 text-sm font-semibold">Zeitfenster</legend>
            <label className="flex items-center gap-2">
              Von{' '}
              <input
                type="time"
                className="preference-input"
                value={notifications.from ?? '00:00'}
                onChange={event => onUpdateNotifications({ ...notifications, from: event.target.value || undefined })}
              />
            </label>
            <label className="flex items-center gap-2">
              Bis{' '}
              <input
                type="time"
                className="preference-input"
                value={notifications.until ?? '23:59'}
                onChange={event => onUpdateNotifications({ ...notifications, until: event.target.value || undefined })}
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateNotifications({ ...notifications, from: '00:00', until: '23:59' })}
                className={`choice-pill text-xs ${(notifications.from ?? '00:00') === '00:00' && (notifications.until ?? '23:59') === '23:59' ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : ''}`}
              >
                Rund um die Uhr
              </button>
              <button
                type="button"
                onClick={() => onUpdateNotifications({ ...notifications, from: '07:00', until: '22:00' })}
                className={`choice-pill text-xs ${notifications.from === '07:00' && notifications.until === '22:00' ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : ''}`}
              >
                Tagsüber (07–22)
              </button>
            </div>
          </fieldset>
          {Capacitor.getPlatform() === 'android' && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Hintergrund-Prüfung (ohne Server)</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Hintergrund-Prüfintervall">
                {([30, 60] as const).map(mins => (
                  <button
                    key={mins}
                    type="button"
                    aria-pressed={(notifications.intervalMinutes ?? 30) === mins}
                    onClick={() => onUpdateNotifications({ ...notifications, intervalMinutes: mins })}
                    className={`choice-pill text-xs ${(notifications.intervalMinutes ?? 30) === mins ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : ''}`}
                  >
                    Alle {mins} Min.
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onSendTestNotification} className="choice-pill">Lokale Test-Meldung anzeigen</button>
            {Capacitor.getPlatform() === 'android' && (
              <button
                type="button"
                onClick={() => { void NewsPush.openSettings().catch(() => setAndroidSettingsUnavailable(true)); }}
                className="choice-pill"
              >
                Kanäle &amp; Töne anpassen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
