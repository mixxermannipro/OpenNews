import { useCallback, useEffect, useMemo } from 'react';
import { clipSourceIds, DEFAULT_SOURCES, legacyCatalogUrls } from '../lib/catalog';
import { applyEditionSources, type AppPreferences } from '../lib/preferences';
import type { FeedHealth, FormatPreferences, NewsSource } from '../types/news';
import { useLocalStorage } from './useLocalStorage';

export function useSources() {
  const [storedSources, setSources] = useLocalStorage<NewsSource[]>('opennews_sources', DEFAULT_SOURCES);
  const [formatPrefs, setFormatPrefs] = useLocalStorage<FormatPreferences>('opennews_formats', {
    rssAtom: true,
    jsonFeed: true,
    openData: true,
    podcasts: false,
  });
  const [feedHealth, setFeedHealth] = useLocalStorage<Record<string, FeedHealth>>('opennews_feed_health', {});

  const sources = useMemo(() => {
    const saved = new Map(storedSources.map(source => [source.id, source]));
    return [
      ...storedSources.filter(source => source.isCustom),
      ...DEFAULT_SOURCES.map(source => {
        const previous = saved.get(source.id);
        if (!previous) return source;
        const url = previous.url === legacyCatalogUrls[source.id] ? source.url : previous.url;
        return {
          ...source,
          ...previous,
          region: previous.region ?? source.region,
          tags: previous.tags ?? source.tags,
          url,
          format: url === source.url && source.id === 'hackernews' ? source.format : previous.format,
        };
      }),
    ];
  }, [storedSources]);

  const enabledFormats = useMemo(() => new Set<string>([
    ...(formatPrefs.rssAtom ? ['rss', 'atom'] : []),
    ...(formatPrefs.jsonFeed ? ['json'] : []),
    ...(formatPrefs.openData ? ['opendata'] : []),
    ...(formatPrefs.podcasts ? ['podcast'] : []),
  ]), [formatPrefs]);

  const activeSources = useMemo(
    () => sources.filter(s => s.subscribed && (enabledFormats.has(s.format) || s.isCustom || clipSourceIds.has(s.id))),
    [sources, enabledFormats],
  );

  useEffect(() => {
    if (!sources.some(source => source.subscribed && feedHealth[source.id]?.url === source.url && feedHealth[source.id].consecutiveFailures >= 5)) return;
    setSources(previous => previous.map(source => source.subscribed && feedHealth[source.id]?.url === source.url
      && feedHealth[source.id].consecutiveFailures >= 5 ? { ...source, subscribed: false } : source));
  }, [sources, feedHealth, setSources]);

  const applySourcePreset = useCallback((edition: AppPreferences['edition']) => {
    setSources(prev => applyEditionSources(prev, edition));
  }, [setSources]);

  const updateSource = useCallback((sourceId: string, updates: Partial<NewsSource>) => {
    setSources(prev => prev.map(s => (s.id === sourceId ? { ...s, ...updates } : s)));
  }, [setSources]);

  const toggleSubscribe = useCallback((sourceId: string) => {
    setSources(prev => {
      const source = prev.find(item => item.id === sourceId);
      if (source?.format === 'podcast' && !source.subscribed) {
        setFormatPrefs(previous => previous.podcasts ? previous : { ...previous, podcasts: true });
      }
      if (source && !source.subscribed) {
        setFeedHealth(previous => {
          if (!previous[sourceId]) return previous;
          const next = { ...previous };
          delete next[sourceId];
          return next;
        });
      }
      return prev.map(s => (s.id === sourceId ? { ...s, subscribed: !s.subscribed } : s));
    });
  }, [setFeedHealth, setFormatPrefs, setSources]);

  const setSourceSubscriptions = useCallback((ids: readonly string[], subscribed: boolean) => {
    const targetIds = new Set(ids);
    if (!targetIds.size) return;
    setSources(prev => {
      if (subscribed && prev.some(item => targetIds.has(item.id) && item.format === 'podcast')) {
        setFormatPrefs(previous => previous.podcasts ? previous : { ...previous, podcasts: true });
      }
      if (subscribed) {
        setFeedHealth(previous => {
          let changed = false;
          const next = { ...previous };
          for (const id of targetIds) {
            if (next[id]) {
              delete next[id];
              changed = true;
            }
          }
          return changed ? next : previous;
        });
      }
      return prev.map(item => (targetIds.has(item.id) ? { ...item, subscribed } : item));
    });
  }, [setFeedHealth, setFormatPrefs, setSources]);

  return {
    sources,
    setSources,
    activeSources,
    formatPrefs,
    setFormatPrefs,
    feedHealth,
    setFeedHealth,
    applySourcePreset,
    updateSource,
    toggleSubscribe,
    setSourceSubscriptions,
  };
}
