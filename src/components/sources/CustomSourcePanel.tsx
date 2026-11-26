import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Download, Globe, Layers, Loader2, Plus, Search, Upload } from 'lucide-react';
import type { NewsCategory, NewsSource } from '../../types/news';
import { useI18n } from '../../lib/i18n';
import { discoverNativeFeeds, publicHttpUrl } from '../../lib/nativeFeed';
import { exportOpml, importOpml } from '../../lib/opml';

const CUSTOM_CATEGORIES: ReadonlyArray<Exclude<NewsCategory, 'Alle' | 'Für dich'>> = [
  'Politik',
  'Wirtschaft',
  'Technologie',
  'Wissenschaft',
  'Europa',
  'Gesellschaft',
  'Kultur',
  'Sport',
];

interface CustomSourcePanelProps {
  sources: NewsSource[];
  discoverRequest?: { query: string; seq: number } | null;
  onAddCustomSource: (source: NewsSource) => void;
  onImportSources: (sources: NewsSource[]) => void;
  onAdvancedSources: () => void;
}

export const CustomSourcePanel: React.FC<CustomSourcePanelProps> = ({
  sources,
  discoverRequest,
  onAddCustomSource,
  onImportSources,
  onAdvancedSources,
}) => {
  const { lang, t, categoryLabel } = useI18n();
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

  useEffect(() => {
    if (!discoverRequest?.query) return;
    setWebsite(discoverRequest.query);
    void runDiscover(discoverRequest.query);
  }, [discoverRequest]);

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

  return (
    <div className="motion-panel-in space-y-3.5">
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
    </div>
  );
};
