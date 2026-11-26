import React from 'react';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../../lib/featureFlags';

const FEATURE_FLAG_ITEMS: ReadonlyArray<readonly [keyof FeatureFlags, string]> = [
  ['dailyBriefing', 'Tagesüberblick & Erinnerung'],
  ['liveRadio', 'Live-Nachrichtenradio'],
  ['clips', 'Hochformat-Clips'],
  ['weeklyReview', 'KI-Wochenrückblick'],
  ['cloudTts', 'Cloud-Vorlesestimmen (TTS)'],
  ['pushMonitor', 'Hintergrund-Benachrichtigungen'],
  ['androidAuto', 'Android Auto'],
];

export const SettingsFeatureFlagsCard: React.FC<{
  featureFlags?: FeatureFlags;
  onUpdateFeatureFlags: (next: FeatureFlags) => void;
}> = ({ featureFlags = DEFAULT_FEATURE_FLAGS, onUpdateFeatureFlags }) => (
  <div className="liquid-glass rounded-[26px] p-5 space-y-3">
    <div>
      <h2 className="text-sm font-semibold text-[var(--ink)]">Optionale Module (v0.2)</h2>
      <p className="text-xs text-[var(--muted)]">
        Kernfunktionen wie Quellen, Feed, Reader, Widget und Sicherung bleiben immer aktiv. Zusatzmodule lassen sich hier ein- oder ausschalten.
      </p>
    </div>
    <div className="divide-y divide-[var(--line)]">
      {FEATURE_FLAG_ITEMS.map(([key, label]) => (
        <label key={key} className="preference-row px-0">
          <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
          <input
            type="checkbox"
            checked={featureFlags[key]}
            onChange={e => onUpdateFeatureFlags({ ...featureFlags, [key]: e.target.checked })}
          />
        </label>
      ))}
    </div>
  </div>
);
