import { ChevronRight, ExternalLink, Pause, Play, Radio, Star } from 'lucide-react';
import { safeHref } from '../lib/contentIdentity';
import { useI18n } from '../lib/i18n';
import type { MediaExtraCopy } from '../lib/mediaCopy';
import type { RadioFilterGroup, RadioStation } from '../lib/radioCatalog';
import { ViewStatus } from './ViewStatus';

const RADIO_GROUPS: readonly RadioFilterGroup[] = [
  'all',
  'news',
  'music',
  'dach',
  'international',
  'favorites',
];

function groupLabel(copy: MediaExtraCopy, group: RadioFilterGroup): string {
  switch (group) {
    case 'news': return copy.radioNews;
    case 'music': return copy.radioMusic;
    case 'dach': return copy.radioDach;
    case 'international': return copy.radioInternational;
    case 'favorites': return copy.radioFavorites;
    default: return copy.radioAll;
  }
}

export function RadioHub({
  copy,
  radioGroup,
  onSelectGroup,
  visibleStations,
  radioFavorites,
  radioFavoritesSet,
  hasSearchQuery,
  activeAudioUrl,
  onClearSearch,
  onTriggerStation,
  onToggleFavorite,
}: {
  copy: MediaExtraCopy;
  radioGroup: RadioFilterGroup;
  onSelectGroup: (group: RadioFilterGroup) => void;
  visibleStations: RadioStation[];
  radioFavorites: string[];
  radioFavoritesSet: Set<string>;
  hasSearchQuery: boolean;
  activeAudioUrl?: string;
  onClearSearch: () => void;
  onTriggerStation: (station: RadioStation) => void;
  onToggleFavorite?: (stationId: string) => void;
}) {
  const { t } = useI18n();

  return (
    <section aria-labelledby="media-radio-heading" className="screen-entry space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
            <Radio className="h-3 w-3" aria-hidden="true" />
            {copy.liveBadge}
          </span>
          <h2 id="media-radio-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
            {copy.liveRadioHeading}
          </h2>
        </div>
        <p className="text-sm text-[var(--muted)]">{copy.liveRadioSubtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={copy.liveRadioHeading}>
        {RADIO_GROUPS.map((groupKey) => (
          <button
            key={groupKey}
            type="button"
            aria-pressed={radioGroup === groupKey}
            onClick={() => onSelectGroup(groupKey)}
            className={`choice-pill ${
              radioGroup === groupKey ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : ''
            }`}
          >
            {groupLabel(copy, groupKey)}
            {groupKey === 'favorites' && radioFavorites.length > 0 && (
              <span className="ml-1 text-[11px] opacity-75 tabular-nums">{radioFavorites.length}</span>
            )}
          </button>
        ))}
      </div>

      {visibleStations.length === 0 ? (
        <ViewStatus
          title={radioGroup === 'favorites' && !hasSearchQuery ? copy.radioEmptyFavorites : copy.radioSearchEmpty}
          action={
            hasSearchQuery ? (
              <button type="button" className="choice-pill" onClick={onClearSearch}>
                {copy.clearSearch}
              </button>
            ) : radioGroup !== 'all' ? (
              <button type="button" className="choice-pill" onClick={() => onSelectGroup('all')}>
                {copy.radioAllStations}
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStations.map((station) => {
            const isPlaying = activeAudioUrl === station.streamUrl;
            const isFav = radioFavoritesSet.has(station.id);
            const stationHref = safeHref(station.homepageUrl);
            return (
              <li
                key={station.id}
                data-radio-id={station.id}
                className={`settings-group media-audio-card flex flex-col justify-between gap-3 p-3.5 transition-colors ${
                  isPlaying ? 'ring-1 ring-[var(--accent)]/60' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onTriggerStation(station)}
                    aria-label={`${isPlaying ? t('mediaClipsPause') : t('mediaClipsPlay')}: ${station.name}`}
                    className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-xs font-extrabold tracking-tight text-white shadow-sm transition active:scale-95"
                    style={{ backgroundColor: station.accentColor }}
                  >
                    <span>{station.shortCode}</span>
                  </button>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[var(--control)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                        {station.region}
                      </span>
                      {station.category === 'music' && (
                        <span className="rounded bg-[var(--control)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                          {copy.radioMusic}
                        </span>
                      )}
                      {isPlaying && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9.5px] font-extrabold text-white">
                          {copy.liveBadge}
                        </span>
                      )}
                    </div>
                    <h3 className="truncate text-[15px] font-bold text-[var(--ink)]">{station.name}</h3>
                    <p className="line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{station.subtitle}</p>
                  </div>
                  {onToggleFavorite && (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(station.id)}
                      aria-label={isFav ? copy.radioFavoriteRemove : copy.radioFavoriteAdd}
                      aria-pressed={isFav}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition hover:bg-[var(--control)] ${
                        isFav ? 'text-amber-500' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <Star size={16} fill={isFav ? 'currentColor' : 'none'} aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[var(--line)]/70 pt-2">
                  <button
                    type="button"
                    onClick={() => onTriggerStation(station)}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${
                      isPlaying
                        ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                        : 'bg-[var(--control)] text-[var(--ink)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]'
                    }`}
                  >
                    {isPlaying ? <Pause size={13} fill="currentColor" aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
                    <span>{isPlaying ? t('mediaNowPlaying') : copy.liveBadge}</span>
                  </button>
                  {stationHref && (
                    <a
                      href={stationHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      <span>{copy.openOriginal}</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function RadioQuickStrip({
  copy,
  stations,
  activeAudioUrl,
  onTriggerStation,
  onShowAll,
}: {
  copy: MediaExtraCopy;
  stations: RadioStation[];
  activeAudioUrl?: string;
  onTriggerStation: (station: RadioStation) => void;
  onShowAll: () => void;
}) {
  return (
    <section aria-labelledby="media-radio-quick-heading" className="screen-entry space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-white">
            {copy.liveBadge}
          </span>
          <h2 id="media-radio-quick-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
            {copy.liveRadioHeading}
          </h2>
        </div>
        <button
          type="button"
          className="choice-pill inline-flex items-center gap-1"
          onClick={onShowAll}
        >
          {copy.radioAllStations}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <ul className="media-shorts-shelf -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {stations.map((station) => {
          const isPlaying = activeAudioUrl === station.streamUrl;
          return (
            <li key={station.id} className="w-[15rem] shrink-0">
              <button
                type="button"
                onClick={() => onTriggerStation(station)}
                className={`settings-group article-card-interactive flex w-full items-center gap-3 p-3 text-left ${
                  isPlaying ? 'ring-1 ring-[var(--accent)]/60' : ''
                }`}
              >
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[11px] font-extrabold text-white shadow-sm"
                  style={{ backgroundColor: station.accentColor }}
                >
                  {station.shortCode}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--ink)]">{station.name}</p>
                  <p className="truncate text-[11px] text-[var(--muted)]">
                    {isPlaying ? copy.radioPlaying : `${station.region} · ${copy.liveBadge}`}
                  </p>
                </div>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  isPlaying ? 'bg-[var(--accent)] text-[var(--accent-ink)]' : 'bg-[var(--control)] text-[var(--ink)]'
                }`}>
                  {isPlaying ? <Pause size={13} fill="currentColor" aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
