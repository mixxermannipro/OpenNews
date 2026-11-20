import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Globe,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Download,
  X,
} from 'lucide-react';
import type { AppLanguage, FeedHealth, NewsCategory, NewsSource } from '../types/news';
import { APP_LANGUAGES, useI18n } from '../lib/i18n';
import { STARTER_PACKS, type StarterPack } from '../lib/catalog';
import { searchAndFilterSources, type SourceTypeFilter } from '../lib/sourceSearch';
import { discoverNativeFeeds, publicHttpUrl } from '../lib/nativeFeed';
import { exportOpml, importOpml } from '../lib/opml';
import { SourceIcon } from './SourceIcon';

const CUSTOM_CATEGORIES: Array<Exclude<NewsCategory, 'Alle' | 'Für dich'>> = [
  'Politik',
  'Wirtschaft',
  'Technologie',
  'Wissenschaft',
  'Europa',
  'Gesellschaft',
  'Kultur',
  'Sport',
];

export interface SourcesManagerProps {
  sources: NewsSource[];
  feedHealth: Record<string, FeedHealth>;
  onToggleSource: (sourceId: string) => void;
  onSetSourceSubscriptions: (ids: string[], subscribed: boolean) => void;
  onAddCustomSource: (source: NewsSource) => void;
  onUpdateSource: (sourceId: string, updates: Partial<NewsSource>) => void;
  onRemoveCustomSource: (sourceId: string) => void;
  onImportSources: (sources: NewsSource[]) => void;
  onAdvancedSources: () => void;
}

export const SourcesManager: React.FC<SourcesManagerProps> = ({
  sources,
  feedHealth,
  onToggleSource,
  onSetSourceSubscriptions,
  onAddCustomSource,
  onUpdateSource,
  onRemoveCustomSource,
  onImportSources,
  onAdvancedSources,
}) => {
  const { lang, locale, t, categoryLabel } = useI18n();

  const [query, setQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState<'all' | AppLanguage>('all');
  const [selectedCategory, setSelectedCategory] = useState<'all' | Exclude<NewsCategory, 'Alle' | 'Für dich'>>('all');
  const [sourceType, setSourceType] = useState<SourceTypeFilter>('all');
  const [onlySelected, setOnlySelected] = useState(false);

  const [showCustomPanel, setShowCustomPanel] = useState(false);
  const [website, setWebsite] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState('');
  const [discoveredFeeds, setDiscoveredFeeds] = useState<
    Array<{ name: string; url: string; format: 'rss' | 'atom' | 'json' }>
  >([]);

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customCategory, setCustomCategory] =
    useState<Exclude<NewsCategory, 'Alle' | 'Für dich'>>('Politik');
  const [customError, setCustomError] = useState<string | null>(null);
  const [transferStatus, setTransferStatus] = useState('');

  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    url: string;
    category: Exclude<NewsCategory, 'Alle' | 'Für dich'>;
    format: NewsSource['format'];
  }>({ name: '', url: '', category: 'Politik', format: 'rss' });

  const totalSelectedCount = useMemo(
    () => sources.reduce((count, src) => count + (src.subscribed ? 1 : 0), 0),
    [sources],
  );

  const languageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sources.length };
    for (const src of sources) {
      counts[src.language] = (counts[src.language] ?? 0) + 1;
    }
    return counts;
  }, [sources]);

  const filteredSources = useMemo(
    () =>
      searchAndFilterSources(sources, {
        query,
        language: selectedLang,
        category: selectedCategory,
        type: sourceType,
        onlySubscribed: onlySelected,
        locale,
      }),
    [sources, query, selectedLang, selectedCategory, sourceType, onlySelected, locale],
  );

  const orderedPacks = useMemo(() => {
    return [...STARTER_PACKS].sort((a, b) => {
      const aMatch = a.language === lang ? 0 : a.language === 'all' ? 1 : 2;
      const bMatch = b.language === lang ? 0 : b.language === 'all' ? 1 : 2;
      return aMatch - bMatch;
    });
  }, [lang]);

  const subscribedIds = useMemo(
    () => new Set(sources.filter(s => s.subscribed).map(s => s.id)),
    [sources],
  );

  const hasActiveFilters = Boolean(
    query.trim() || selectedLang !== 'all' || selectedCategory !== 'all' || sourceType !== 'all' || onlySelected,
  );

  const resetFilters = () => {
    setQuery('');
    setSelectedLang('all');
    setSelectedCategory('all');
    setSourceType('all');
    setOnlySelected(false);
  };

  const handleTogglePack = (pack: StarterPack) => {
    const allActive = pack.sourceIds.every(id => subscribedIds.has(id));
    onSetSourceSubscriptions([...pack.sourceIds], !allActive);
  };

  const runDiscover = async (rawAddress: string) => {
    const q = rawAddress.trim();
    if (!q) return;
    setDiscovering(true);
    setDiscoveryStatus('');
    setDiscoveredFeeds([]);
    try {
      let found: typeof discoveredFeeds;
      if (Capacitor.isNativePlatform()) {
        found = await discoverNativeFeeds(q);
      } else {
        const resp = await fetch(`/api/feeds/discover?q=${encodeURIComponent(q)}`);
        if (!resp.ok) throw new Error('Feed discovery failed');
        const data = await resp.json();
        found = Array.isArray(data.discovered) ? data.discovered : [];
      }
      setDiscoveredFeeds(found);
      if (!found.length) setDiscoveryStatus(t('sourcesDiscoverEmpty'));
    } catch {
      setDiscoveryStatus(t('sourcesDiscoverError'));
    } finally {
      setDiscovering(false);
    }
  };

  const handleDiscoverSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runDiscover(website);
  };

  const handleAddFeed = (event: React.FormEvent) => {
    event.preventDefault();
    const url = publicHttpUrl(customUrl.trim());
    const name = customName.trim();
    if (!name || !url) {
      setCustomError(t('sourcesCustomUrlError'));
      return;
    }
    if (sources.some(source => publicHttpUrl(source.url) === url)) {
      setCustomError(t('sourcesCustomDupError'));
      return;
    }

    const format =
      url.endsWith('.json') || url.includes('jsonfeed')
        ? 'json'
        : url.includes('atom')
          ? 'atom'
          : 'rss';

    onAddCustomSource({
      id: `custom-${Date.now()}`,
      name,
      url,
      format,
      category: customCategory,
      description: t('sourcesCustomDesc'),
      language: lang,
      subscribed: true,
      accentColor: '#3B82F6',
      shortCode: name.slice(0, 3).toUpperCase(),
      isCustom: true,
    });
    setCustomName('');
    setCustomUrl('');
    setCustomError(null);
  };

  const startEditingSource = (src: NewsSource) => {
    setEditingFeedId(src.id);
    setEditDraft({
      name: src.name,
      url: src.url,
      category: src.category,
      format: src.format,
    });
  };

  const saveEditedSource = (sourceId: string) => {
    const url = publicHttpUrl(editDraft.url.trim());
    if (
      !editDraft.name.trim() ||
      !url ||
      sources.some(source => source.id !== sourceId && publicHttpUrl(source.url) === url)
    ) {
      return;
    }
    onUpdateSource(sourceId, {
      name: editDraft.name.trim(),
      url,
      category: editDraft.category,
      format: editDraft.format,
      shortCode: editDraft.name.trim().slice(0, 3).toUpperCase(),
    });
    setEditingFeedId(null);
  };

  const formatHealthText = (source: NewsSource): string | null => {
    const health = feedHealth[source.id];
    if (!health || health.url !== source.url) {
      return source.subscribed ? null : null;
    }
    if (!source.subscribed && health.consecutiveFailures >= 5) {
      return t('sourcesHealthPaused');
    }
    if (!health.ok) {
      return t('sourcesHealthFailed', { count: health.consecutiveFailures });
    }
    return health.count
      ? t('sourcesHealthArticles', { count: health.count })
      : t('sourcesHealthReachable');
  };

  const unselectedVisibleIds = useMemo(
    () => filteredSources.filter(s => !s.subscribed).map(s => s.id),
    [filteredSources],
  );

  return (
    <div className="space-y-5">
      {/* Search + Quick Actions Bar */}
      <div className="settings-group space-y-3.5 p-4 sm:p-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden="true"
          />
          <input
            id="source-search"
            type="search"
            value={query}
            placeholder={t('sourcesSearchPlaceholder')}
            aria-label={t('sourcesSearchAria')}
            onChange={event => setQuery(event.target.value)}
            className={`preference-input discover-search-input w-full rounded-full text-sm text-[var(--ink)] placeholder:text-[var(--muted)] ${query ? 'discover-search-input-clear' : ''}`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('clear')}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Language Filter Bar */}
        <div
          role="group"
          aria-label={t('profileLanguage')}
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5"
        >
          <button
            type="button"
            className="choice-pill shrink-0 whitespace-nowrap text-xs"
            aria-pressed={selectedLang === 'all'}
            onClick={() => setSelectedLang('all')}
          >
            {t('sourcesLangAll')}
            <span className="ml-1.5 opacity-70 tabular-nums">{languageCounts.all ?? 0}</span>
          </button>
          {APP_LANGUAGES.map(item => (
            <button
              key={item.code}
              type="button"
              className="choice-pill shrink-0 whitespace-nowrap text-xs"
              aria-pressed={selectedLang === item.code}
              onClick={() => setSelectedLang(selectedLang === item.code ? 'all' : item.code)}
            >
              {item.label}
              <span className="ml-1.5 opacity-70 tabular-nums">{languageCounts[item.code] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Type + Selected + Category Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto" role="group" aria-label={t('sourcesTitle')}>
            <button
              type="button"
              className="choice-pill shrink-0 whitespace-nowrap text-xs"
              aria-pressed={onlySelected}
              onClick={() => setOnlySelected(prev => !prev)}
            >
              <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
              {t('sourcesFilterSelected')}
              <span className="ml-1.5 tabular-nums opacity-75">{totalSelectedCount}</span>
            </button>
            {(['all', 'news', 'podcast', 'custom'] as const).map(type => (
              <button
                key={type}
                type="button"
                className="choice-pill shrink-0 whitespace-nowrap text-xs"
                aria-pressed={!onlySelected && sourceType === type}
                onClick={() => {
                  setOnlySelected(false);
                  setSourceType(type);
                }}
              >
                {{
                  all: t('sourcesFilterAll'),
                  news: t('sourcesFilterNews'),
                  podcast: t('sourcesFilterMedia'),
                  custom: t('sourcesFilterCustom'),
                }[type]}
              </button>
            ))}
          </div>

          <select
            value={selectedCategory}
            onChange={event =>
              setSelectedCategory(event.target.value as 'all' | Exclude<NewsCategory, 'Alle' | 'Für dich'>)
            }
            aria-label={t('sourcesCatAll')}
            className="preference-input min-h-[44px] rounded-full px-3.5 text-xs font-semibold"
          >
            <option value="all">{t('sourcesCatAll')}</option>
            {CUSTOM_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        {/* Status & Bulk Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <p role="status" className="text-xs font-medium text-[var(--muted)] tabular-nums">
            <strong className="font-semibold text-[var(--ink)]">
              {t('sourcesSelectedCounter', { count: totalSelectedCount })}
            </strong>
            <span aria-hidden="true"> · </span>
            <span>{t('sourcesResultCounter', { shown: filteredSources.length, total: sources.length })}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {hasActiveFilters && unselectedVisibleIds.length > 0 && unselectedVisibleIds.length <= 25 && (
              <button
                type="button"
                className="choice-pill text-xs"
                onClick={() => onSetSourceSubscriptions(unselectedVisibleIds, true)}
              >
                {t('sourcesSelectVisible')} ({unselectedVisibleIds.length})
              </button>
            )}
            {totalSelectedCount > 0 && (
              <button
                type="button"
                className="choice-pill text-xs"
                onClick={() =>
                  onSetSourceSubscriptions(
                    sources.filter(s => s.subscribed).map(s => s.id),
                    false,
                  )
                }
              >
                {t('sourcesDeselectAll')}
              </button>
            )}
            <button
              type="button"
              className="choice-pill inline-flex items-center gap-1.5 text-xs"
              aria-expanded={showCustomPanel}
              onClick={() => setShowCustomPanel(prev => !prev)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('sourcesAddCustomBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Custom Source / Website Discovery / OPML Panel */}
      <AnimatePresence initial={false}>
        {showCustomPanel && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3.5"
          >
            {/* Website Auto-Discovery */}
            <div className="settings-group space-y-3.5 p-4 sm:p-5">
              <div>
                <h2 className="text-base font-bold text-[var(--ink)]">{t('sourcesDiscoverTitle')}</h2>
                <p className="text-xs text-[var(--muted)]">{t('sourcesDiscoverDesc')}</p>
              </div>
              <form onSubmit={handleDiscoverSubmit} className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Globe
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={website}
                    onChange={event => setWebsite(event.target.value)}
                    placeholder="lemonde.fr, bbc.com, heise.de"
                    aria-label={t('sourcesDiscoverTitle')}
                    className="preference-input discover-search-input w-full text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={discovering || !website.trim()}
                  className="primary-action min-h-[44px] px-5 text-xs disabled:opacity-50"
                >
                  {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {t('sourcesDiscoverBtn')}
                </button>
              </form>

              {discoveryStatus && (
                <p role="status" className="text-xs font-medium text-[var(--muted)]">
                  {discoveryStatus}
                </p>
              )}

              {discoveredFeeds.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--control)] p-3.5">
                  <p className="text-xs font-semibold text-[var(--accent)]">{t('sourcesDiscoverFound')}</p>
                  {discoveredFeeds.map(df => {
                    const alreadyAdded = sources.some(s => s.url === df.url);
                    return (
                      <div key={df.url} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[var(--ink)]">{df.name}</p>
                          <p className="truncate text-[var(--muted)]">{df.url}</p>
                        </div>
                        <button
                          type="button"
                          disabled={alreadyAdded}
                          onClick={() =>
                            onAddCustomSource({
                              id: `discovered-${Date.now()}`,
                              name: df.name,
                              url: df.url,
                              format: df.format,
                              category: 'Politik',
                              description: t('sourcesCustomDesc'),
                              language: lang,
                              subscribed: true,
                              accentColor: '#3B82F6',
                              shortCode: df.name.slice(0, 3).toUpperCase(),
                              isCustom: true,
                            })
                          }
                          className="choice-pill shrink-0 text-xs disabled:opacity-50"
                        >
                          {alreadyAdded ? t('sourcesAdded') : `+ ${t('sourcesAddBtn')}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Direct Custom RSS / Atom / JSON Feed */}
            <form onSubmit={handleAddFeed} className="settings-group space-y-3.5 p-4 sm:p-5">
              <h3 className="text-base font-bold text-[var(--ink)]">{t('sourcesCustomTitle')}</h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <input
                  type="text"
                  value={customName}
                  onChange={event => setCustomName(event.target.value)}
                  placeholder={t('sourcesCustomNamePlaceholder')}
                  aria-label={t('sourcesCustomNamePlaceholder')}
                  className="preference-input rounded-2xl text-sm"
                />
                <input
                  type="url"
                  value={customUrl}
                  onChange={event => setCustomUrl(event.target.value)}
                  placeholder="https://example.org/rss.xml"
                  aria-label="Feed URL"
                  className="preference-input rounded-2xl text-sm sm:col-span-2"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <select
                  value={customCategory}
                  onChange={event =>
                    setCustomCategory(event.target.value as Exclude<NewsCategory, 'Alle' | 'Für dich'>)
                  }
                  aria-label={t('sourcesCatAll')}
                  className="preference-input min-h-[44px] rounded-full px-3.5 text-xs font-semibold"
                >
                  {CUSTOM_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {categoryLabel(c)}
                    </option>
                  ))}
                </select>
                <button type="submit" className="primary-action min-h-[44px] px-5 text-xs">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t('sourcesAddBtn')}
                </button>
              </div>
              {customError && <p className="text-xs font-medium text-rose-500">{customError}</p>}
            </form>

            {/* OPML Import/Export & Feed Formats */}
            <div className="settings-group space-y-3 p-4 sm:p-5">
              <h3 className="text-sm font-bold text-[var(--ink)]">{t('sourcesImportExportTitle')}</h3>
              <div className="flex flex-wrap gap-2">
                <label className="choice-pill inline-flex cursor-pointer items-center gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('sourcesOpmlImport')}
                  <input
                    type="file"
                    accept=".opml,.xml"
                    className="sr-only"
                    onChange={async event => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      try {
                        const imported = importOpml(await file.text());
                        onImportSources(imported);
                        setTransferStatus(`${imported.length}`);
                      } catch (error) {
                        setTransferStatus(error instanceof Error ? error.message : 'Error');
                      } finally {
                        input.value = '';
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="choice-pill inline-flex items-center gap-1.5 text-xs"
                  onClick={async () => {
                    const file = new File([exportOpml(sources)], 'OpenNews.opml', { type: 'text/x-opml' });
                    if (navigator.canShare?.({ files: [file] })) {
                      try {
                        await navigator.share({ files: [file] });
                      } catch {
                        /* Share sheet closed */
                      }
                      return;
                    }
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(file);
                    link.href = url;
                    link.download = file.name;
                    document.body.append(link);
                    link.click();
                    link.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('sourcesOpmlExport')}
                </button>
                <button
                  type="button"
                  className="choice-pill inline-flex items-center gap-1.5 text-xs"
                  onClick={onAdvancedSources}
                >
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('sourcesFormats')}
                </button>
              </div>
              {transferStatus && <p role="status" className="text-xs text-[var(--muted)]">{transferStatus}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Curated 1-Tap Starter Packs */}
      {!hasActiveFilters && (
        <section aria-label={t('sourcesStarterPacks')} className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            <h2 className="text-sm font-bold tracking-tight text-[var(--ink)]">{t('sourcesStarterPacks')}</h2>
          </div>
          <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
            {orderedPacks.map(pack => {
              const activeCount = pack.sourceIds.filter(id => subscribedIds.has(id)).length;
              const allActive = activeCount === pack.sourceIds.length;
              return (
                <button
                  key={pack.id}
                  type="button"
                  aria-pressed={allActive}
                  onClick={() => handleTogglePack(pack)}
                  className="source-pack-card article-card-interactive flex w-[232px] shrink-0 flex-col justify-between gap-2.5 rounded-[var(--card-radius)] border p-3.5 text-left"
                  data-selected={allActive || undefined}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[var(--ink)]">{pack.label}</span>
                      <span
                        className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-colors ${
                          allActive
                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                            : 'bg-[var(--control)] text-[var(--muted)]'
                        }`}
                      >
                        {allActive ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : `${activeCount}/${pack.sourceIds.length}`}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-snug text-[var(--muted)]">{pack.subtitle}</p>
                  </div>
                  <span className="text-xs font-semibold text-[var(--accent)]">
                    {allActive ? t('sourcesStarterApplied') : `+ ${t('sourcesStarterApply')}`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Sources Directory Grid */}
      {filteredSources.length === 0 ? (
        <div className="view-status space-y-3">
          <p className="view-status-title">{t('sourcesEmptyTitle')}</p>
          <p className="view-status-detail mx-auto max-w-md">{t('sourcesEmptyDesc')}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {hasActiveFilters && (
              <button type="button" className="choice-pill inline-flex items-center gap-1.5" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                {t('sourcesResetFilters')}
              </button>
            )}
            {query.trim() && (
              <button
                type="button"
                className="primary-action min-h-[44px] px-5 text-xs"
                onClick={() => {
                  setShowCustomPanel(true);
                  setWebsite(query.trim());
                  void runDiscover(query.trim());
                }}
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t('sourcesTryWebDiscover', { query: query.trim() })}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {filteredSources.map(src => {
            const isEditing = editingFeedId === src.id;
            const healthText = formatHealthText(src);
            return (
              <div
                key={src.id}
                data-selected={src.subscribed || undefined}
                className="source-card flex flex-col justify-between gap-2.5 rounded-[var(--card-radius)] border p-3.5"
              >
                <div className="flex items-start gap-3">
                  {/* Main 1-tap toggle area */}
                  <button
                    type="button"
                    onClick={() => onToggleSource(src.id)}
                    aria-pressed={src.subscribed}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-xl"
                  >
                    <SourceIcon source={src} size="h-10 w-10 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-[15px] font-bold tracking-[-0.015em] text-[var(--ink)]">
                          {src.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-[var(--muted)] truncate">
                        {src.region ? `${src.region} · ` : ''}
                        {src.language.toUpperCase()} · {categoryLabel(src.category)}
                        {src.format === 'podcast' ? ' · Media' : ''}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                        {src.description}
                      </p>
                      {healthText && (
                        <p className="mt-1 text-[11px] font-medium text-[var(--muted)] tabular-nums">
                          {healthText}
                        </p>
                      )}
                    </div>
                  </button>

                  {/* Oversized Tactile Toggle Pill */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => onToggleSource(src.id)}
                      aria-pressed={src.subscribed}
                      aria-label={src.subscribed ? `${src.name}: ${t('sourcesSelectedAction')}` : `${src.name}: ${t('sourcesSelectAction')}`}
                      className="source-toggle-btn reaction-btn inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                      data-active={src.subscribed || undefined}
                    >
                      {src.subscribed ? (
                        <>
                          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                          <span className="hidden sm:inline">{t('sourcesSelectedAction')}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden="true" />
                          <span className="hidden sm:inline">{t('sourcesSelectAction')}</span>
                        </>
                      )}
                    </button>

                    {(src.subscribed || src.isCustom) && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => (isEditing ? setEditingFeedId(null) : startEditingSource(src))}
                          aria-label={`${src.name} ${t('sourcesEdit')}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--control)] hover:text-[var(--ink)]"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {src.isCustom && (
                          <button
                            type="button"
                            onClick={() => onRemoveCustomSource(src.id)}
                            aria-label={`${src.name} ${t('sourcesDelete')}`}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--line)] bg-[var(--control)] p-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={editDraft.name}
                      onChange={event => setEditDraft({ ...editDraft, name: event.target.value })}
                      aria-label={t('sourcesEdit')}
                      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--ink)]"
                    />
                    <input
                      type="url"
                      value={editDraft.url}
                      onChange={event => setEditDraft({ ...editDraft, url: event.target.value })}
                      aria-label="URL"
                      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--ink)]"
                    />
                    <select
                      value={editDraft.category}
                      onChange={event =>
                        setEditDraft({
                          ...editDraft,
                          category: event.target.value as Exclude<NewsCategory, 'Alle' | 'Für dich'>,
                        })
                      }
                      aria-label={t('sourcesCatAll')}
                      className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs text-[var(--ink)]"
                    >
                      {CUSTOM_CATEGORIES.map(c => (
                        <option key={c} value={c}>
                          {categoryLabel(c)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingFeedId(null)}
                        className="min-h-[44px] rounded-xl px-3 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEditedSource(src.id)}
                        className="primary-action min-h-[44px] px-4 text-xs"
                      >
                        {t('saveChanges')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
