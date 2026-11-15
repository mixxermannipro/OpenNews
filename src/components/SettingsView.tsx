import { DailyBriefingSettings } from './DailyBriefingSettings';
import type { DailyBriefingSettings as BriefingSettings } from '../lib/dailyBriefing';
import { localAIAvailable } from '../lib/localAI';
import { resolveSummaryStyle, SUMMARY_STYLES } from '../lib/summaryStyles';
import { Capacitor } from '@capacitor/core';
import { discoverNativeFeeds, publicHttpUrl } from '../lib/nativeFeed';
import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Check,
  Database,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Rss,
  Search,
  Sparkles,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import type {
  AIProviderConfig,
  AIProviderId,
  FeedHealth,
  FormatPreferences,
  NewsCategory,
  NewsSource,
  NotificationSettings,
} from '../types/news';
import { AI_PROVIDERS, testAIConnection } from '../lib/aiClient';
import { TopicChoices } from './Preferences';
import { exportOpml, importOpml } from '../lib/opml';
import { SourceIcon } from './SourceIcon';
import { NewsPush } from '../lib/newsPush';

export type SettingsSectionTab = 'overview' | 'feeds' | 'ai' | 'app';

interface SettingsViewProps {
  feedHealth: Record<string, FeedHealth>;
  initialSection?: SettingsSectionTab;
  sources: NewsSource[];
  formatPrefs: FormatPreferences;
  aiConfig: AIProviderConfig;
  notifications: NotificationSettings;
  briefingSettings: BriefingSettings;
  onBriefingSettings: (value: BriefingSettings) => void;
  pushStatus: string;
  pushPermissionDenied: boolean;
  requestingPushPermission: boolean;
  onImportSources: (sources: NewsSource[]) => void;
  onToggleSource: (sourceId: string) => void;
  onAddCustomSource: (source: NewsSource) => void;
  onUpdateSource: (sourceId: string, updates: Partial<NewsSource>) => void;
  onRemoveCustomSource: (sourceId: string) => void;
  onUpdateFormatPrefs: (prefs: FormatPreferences) => void;
  onUpdateAIConfig: (config: AIProviderConfig) => void;
  onUpdateNotifications: (next: NotificationSettings) => void;
  onSendTestNotification: () => void;
  onResetAlgorithm: () => void;
  onBackHome: () => void;
  onAdvancedSources: () => void;
}

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

function SourceHealth({ source, health }: { source: NewsSource; health?: FeedHealth }) {
  if (!health || health.url !== source.url) return source.subscribed ? <p className="text-xs">Noch nicht geprüft</p> : null;
  const status = !source.subscribed && health.consecutiveFailures >= 5 ? 'Nach fünf Fehlern pausiert'
    : !health.ok ? `Abruf fehlgeschlagen (${health.consecutiveFailures} in Folge)`
    : health.count ? `${health.count} Artikel` : 'Erreichbar · 0 Artikel';
  return <p className="text-xs">{status}{health.lastSuccess ? ` · Letzter Erfolg: ${new Date(health.lastSuccess).toLocaleString('de-DE')}` : ''}</p>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  feedHealth,
  initialSection = 'overview',
  sources,
  formatPrefs,
  aiConfig,
  notifications,
  briefingSettings,
  onBriefingSettings,
  pushStatus,
  pushPermissionDenied,
  requestingPushPermission,
  onImportSources,
  onToggleSource,
  onAddCustomSource,
  onUpdateSource,
  onRemoveCustomSource,
  onUpdateFormatPrefs,
  onUpdateAIConfig,
  onUpdateNotifications,
  onSendTestNotification,
  onResetAlgorithm,
  onBackHome,
  onAdvancedSources,
}) => {
  const section = initialSection;
  const [androidSettingsUnavailable, setAndroidSettingsUnavailable] = useState(false);
  const [transferStatus, setTransferStatus] = useState('');
  const [showAISetup, setShowAISetup] = useState(Boolean(aiConfig.apiKey) || aiConfig.provider === 'device');
  const [feedSearch, setFeedSearch] = useState('');
  const [website, setWebsite] = useState('');
  const [discoveryStatus, setDiscoveryStatus] = useState('');
  const [sourceType, setSourceType] = useState<'all' | 'news' | 'podcast' | 'custom'>('all');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<
    Array<{ name: string; url: string; format: 'rss' | 'atom' | 'json' }>
  >([]);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    url: string;
    category: Exclude<NewsCategory, 'Alle' | 'Für dich'>;
    format: NewsSource['format'];
  }>({ name: '', url: '', category: 'Politik', format: 'rss' });

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customCategory, setCustomCategory] =
    useState<Exclude<NewsCategory, 'Alle' | 'Für dich'>>('Politik');
  const [customError, setCustomError] = useState<string | null>(null);


  const [showAIKey, setShowAIKey] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingAI, setTestingAI] = useState(false);

  const [deviceAvailable, setDeviceAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void localAIAvailable().then(value => { if (active) setDeviceAvailable(value); });
    return () => { active = false; };
  }, []);
  const activeProviderMeta =
    AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];

  const handleAddFeed = (e: React.FormEvent) => {
    e.preventDefault();
    const url = publicHttpUrl(customUrl.trim());
    const name = customName.trim();
    if (!name || !url) {
      setCustomError('Bitte einen Namen und eine öffentliche Feed-Adresse mit https:// oder http:// eingeben.');
      return;
    }
    if (sources.some(source => publicHttpUrl(source.url) === url)) {
      setCustomError('Diese Feed-Adresse ist bereits vorhanden.');
      return;
    }

    const format =
      url.endsWith('.json') || url.includes('jsonfeed')
        ? 'json'
        : url.includes('atom')
          ? 'atom'
          : 'rss';
    const shortCode = name.slice(0, 3).toUpperCase();
    onAddCustomSource({
      id: `custom-${Date.now()}`,
      name,
      url,
      format,
      category: customCategory,
      description: 'Benutzerdefinierter Feed',
      language: 'de',
      subscribed: true,
      accentColor: '#3B82F6',
      shortCode,
      isCustom: true,
    });
    setCustomName('');
    setCustomUrl('');
    setCustomError(null);
  };

  const handleProviderChange = (providerId: AIProviderId) => {
    const meta = AI_PROVIDERS.find((p) => p.id === providerId);
    onUpdateAIConfig({
      ...aiConfig,
      provider: providerId,
      apiKey: '',
      model: meta?.models[0]?.id || '',
    });
    setAiTestStatus(null);
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setAiTestStatus(null);
    const res = await testAIConnection(aiConfig);
    setAiTestStatus(res);
    setTestingAI(false);
  };

  const handleDiscoverFeeds = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = website.trim();
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
      if (!found.length) setDiscoveryStatus('Auf dieser Website wurde kein Feed gefunden.');
    } catch {
      setDiscoveryStatus('Die Website konnte nicht geladen werden.');
    } finally {
      setDiscovering(false);
    }
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
    if (!editDraft.name.trim() || !url
      || sources.some(source => source.id !== sourceId && publicHttpUrl(source.url) === url)) return;
    onUpdateSource(sourceId, {
      name: editDraft.name.trim(),
      url,
      category: editDraft.category,
      format: editDraft.format,
      shortCode: editDraft.name.trim().slice(0, 3).toUpperCase(),
    });
    setEditingFeedId(null);
  };

  const normalizedFeedQuery = feedSearch.trim().toLowerCase();
  const filteredSources = sources.filter((s) => {
    if (sourceType === 'custom' && !s.isCustom) return false;
    if (sourceType === 'podcast' && s.format !== 'podcast') return false;
    if (sourceType === 'news' && s.format === 'podcast') return false;
    if (!normalizedFeedQuery) return true;
    return (
      s.name.toLowerCase().includes(normalizedFeedQuery) ||
      s.url.toLowerCase().includes(normalizedFeedQuery) ||
      s.category.toLowerCase().includes(normalizedFeedQuery) ||
      s.description.toLowerCase().includes(normalizedFeedQuery)
    );
  }).sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base', numeric: true }));

  const selectedSources = filteredSources.filter((s) => s.subscribed);
  const recommendedSources = filteredSources.filter((s) => !s.subscribed && s.recommended);
  const otherSources = filteredSources.filter((s) => !s.subscribed && !s.recommended);

  return (
    <section key={section} className="screen-entry settings-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="screen-title">
            {{ overview: 'Quellenoptionen', feeds: 'Quellen', ai: 'KI & Personalisierung', app: 'Benachrichtigungen' }[section]}
          </h1>
        </div>

        <button
          type="button"
          onClick={onBackHome}
          aria-label="Zurück"
          className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </div>

      {section === 'overview' && (
        <div className="space-y-4">
          {/* Card 1: Öffentliche Quellen */}
          <div className="liquid-glass rounded-[26px] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="liquid-glass-subtle flex h-10 w-10 items-center justify-center rounded-full">
                <Layers className="h-4 w-4 text-slate-700 dark:text-slate-200" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Öffentliche Quellen
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Offene und frei nutzbare News-Quellen
                </p>
              </div>
            </div>

            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
              {[
                {
                  key: 'rssAtom' as const,
                  label: 'RSS/Atom',
                  desc: 'News-Feeds im Standardformat',
                  iconBg: 'bg-amber-500/15 text-amber-500',
                  icon: <Rss className="h-4 w-4" />,
                },
                {
                  key: 'jsonFeed' as const,
                  label: 'JSON Feed',
                  desc: 'Moderne, strukturierte Feeds',
                  iconBg: 'bg-indigo-500/15 text-indigo-500',
                  icon: <span className="text-xs font-bold">{'{}'}</span>,
                },
                {
                  key: 'openData' as const,
                  label: 'Open Data',
                  desc: 'Öffentliche Datenquellen (z. B. EU, Bund, Länder)',
                  iconBg: 'bg-blue-500/15 text-blue-500',
                  icon: <Database className="h-4 w-4" />,
                },
                {
                  key: 'podcasts' as const,
                  label: 'Podcasts',
                  desc: 'News- und Hintergrundformate als Audio',
                  iconBg: 'bg-purple-500/15 text-purple-500',
                  icon: <Radio className="h-4 w-4" />,
                },
              ].map((item) => {
                const enabled = formatPrefs[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${item.label} umschalten`}
                      onClick={() =>
                        onUpdateFormatPrefs({ ...formatPrefs, [item.key]: !enabled })
                      }
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                        enabled ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* SECTION 2: FEED-MANAGER */}
      {section === 'feeds' && (
        <div className="space-y-4">
          <div className="settings-group space-y-3 p-4">
            <label className="block text-sm font-semibold" htmlFor="source-search">Quellen durchsuchen</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden />
              <input id="source-search" type="search" value={feedSearch} placeholder="Name, Thema oder Adresse"
                onChange={event => setFeedSearch(event.target.value)}
                className="liquid-glass-subtle min-h-[44px] w-full rounded-xl pl-10 pr-3 text-sm" />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quellen filtern">
              {(['all', 'news', 'podcast', 'custom'] as const).map(type => (
                <button type="button" key={type} className="choice-pill" aria-pressed={sourceType === type}
                  onClick={() => setSourceType(type)}>
                  {{ all: 'Alle', news: 'Nachrichten', podcast: 'Video & Audio', custom: 'Eigene' }[type]}
                </button>
              ))}
            </div>
            <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
              {filteredSources.length === 0 ? 'Keine passenden Quellen gefunden.' : `${filteredSources.length} Quellen · ${selectedSources.length} abonniert`}
            </p>
          </div>
          <details className="settings-group p-4">
            <summary className="cursor-pointer font-semibold">Eigene Quelle hinzufügen</summary>
            <div className="mt-4 space-y-3">
          {/* Feed Search & Auto-Discovery */}
          <div className="liquid-glass rounded-[26px] p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Feed einer Website finden
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gib die Adresse der Website ein.
              </p>
            </div>

            <form onSubmit={handleDiscoverFeeds} className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[210px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="z. B. netzpolitik.org"
                  aria-label="Website-Adresse"
                  className="liquid-glass-subtle w-full min-h-[44px] rounded-2xl pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                />
              </div>
              <button
                type="submit"
                disabled={discovering || !website.trim()}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[#2C2F36] px-4 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                Web-Feed finden
              </button>
            </form>

            {discoveryStatus && <p role="status" className="text-sm">{discoveryStatus}</p>}
            {discoveredFeeds.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-blue-500/10 p-3.5">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Gefundene RSS-/Atom-Feeds auf dieser Website:
                </p>
                {discoveredFeeds.map((df) => {
                  const alreadyAdded = sources.some((s) => s.url === df.url);
                  return (
                    <div key={df.url} className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{df.name}</p>
                        <p className="text-slate-500 dark:text-slate-400 truncate">{df.url}</p>
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
                            description: 'Über Feed-Suche gefunden',
                            language: 'de',
                            subscribed: true,
                            accentColor: '#3B82F6',
                            shortCode: df.name.slice(0, 3).toUpperCase(),
                            isCustom: true,
                          })
                        }
                        className="shrink-0 min-h-[36px] rounded-full bg-blue-600 px-3.5 font-semibold text-white disabled:opacity-50"
                      >
                        {alreadyAdded ? 'Hinzugefügt' : '+ Hinzufügen'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add Custom RSS URL */}
          <form onSubmit={handleAddFeed} className="liquid-glass rounded-[26px] p-5 space-y-3.5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Eigenen RSS-, Atom- oder JSON-Feed hinzufügen
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Name (z. B. Netzpolitik)"
                aria-label="Name des eigenen Feeds"
                className="liquid-glass-subtle rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.org/rss.xml"
                aria-label="URL des eigenen Feeds"
                className="liquid-glass-subtle sm:col-span-2 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={customCategory}
                onChange={(e) =>
                  setCustomCategory(e.target.value as Exclude<NewsCategory, 'Alle' | 'Für dich'>)
                }
                aria-label="Kategorie für eigenen Feed"
                className="liquid-glass-subtle min-h-[42px] rounded-xl px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 dark:bg-[#161922]"
              >
                {CUSTOM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                Feed hinzufügen
              </button>
            </div>
            {customError && <p className="text-xs font-medium text-rose-500">{customError}</p>}
          </form>

          {/* Meine ausgewählten Feeds */}
            </div>
          </details>
          <div className="liquid-glass rounded-[26px] p-5 space-y-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Abonniert ({selectedSources.length})
              </h3>
            </div>

            {selectedSources.length === 0 ? (
              <p className="py-3 text-xs text-slate-500 dark:text-slate-400">
                Keine abonnierten Quellen in dieser Auswahl.
              </p>
            ) : (
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {selectedSources.map((src) => {
                  const isEditing = editingFeedId === src.id;
                  return (
                    <div key={src.id} className="py-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <SourceIcon source={src} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                              {src.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {src.category} · {src.format.toUpperCase()} · {src.language.toUpperCase()}
                            </p>
                            <SourceHealth source={src} health={feedHealth[src.id]} />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => (isEditing ? setEditingFeedId(null) : startEditingSource(src))}
                            aria-label={`${src.name} bearbeiten`}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {src.isCustom && (
                            <button
                              type="button"
                              onClick={() => onRemoveCustomSource(src.id)}
                              aria-label={`${src.name} löschen`}
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onToggleSource(src.id)}
                            aria-pressed={true}
                            aria-label={`${src.name} abbestellen`}
                            className="inline-flex min-h-[44px] items-center gap-1 rounded-full bg-[#34C759]/15 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Aktiv
                          </button>
                        </div>
                      </div>

                      {isEditing && (
                        <div className="grid grid-cols-1 gap-2 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04] sm:grid-cols-2">
                          <input
                            type="text"
                            value={editDraft.name}
                            onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                            aria-label="Feed-Name bearbeiten"
                            placeholder="Name"
                            className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                          />
                          <input
                            type="url"
                            value={editDraft.url}
                            onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                            aria-label="Feed-URL bearbeiten"
                            placeholder="https://..."
                            className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                          />
                          <select
                            value={editDraft.category}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                category: e.target.value as Exclude<NewsCategory, 'Alle' | 'Für dich'>,
                              })
                            }
                            aria-label="Feed-Kategorie bearbeiten"
                            className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                          >
                            {CUSTOM_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingFeedId(null)}
                              className="min-h-[36px] rounded-xl px-3 text-xs font-medium text-slate-500"
                            >
                              Abbrechen
                            </button>
                            <button
                              type="button"
                              onClick={() => saveEditedSource(src.id)}
                              className="min-h-[36px] rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white"
                            >
                              Änderungen speichern
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

          {/* Empfohlene Feeds */}
          {recommendedSources.length > 0 && (
            <details open={feedSearch.trim() || sourceType !== 'all' ? true : undefined} className="settings-group p-4 space-y-3">
              <summary className="cursor-pointer font-semibold">
                <Sparkles aria-hidden className="mr-2 inline h-4 w-4 text-blue-500" />
                Empfohlene Feeds ({recommendedSources.length})
              </summary>

              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {recommendedSources.map((src) => (
                  <div key={src.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <SourceIcon source={src} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                          {src.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {src.category} · {src.format.toUpperCase()} · {src.language.toUpperCase()}
                        </p>
                        <SourceHealth source={src} health={feedHealth[src.id]} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleSource(src.id)}
                      aria-label={`${src.name} abonnieren`}
                      className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Abonnieren
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Weitere verfügbare Quellen */}
          {otherSources.length > 0 && (
            <details open={feedSearch.trim() || sourceType !== 'all' ? true : undefined} className="settings-group p-4 space-y-3">
              <summary className="cursor-pointer font-semibold">
                Weitere Quellen ({otherSources.length})
              </summary>
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.08]">
                {otherSources.map((src) => (
                  <div key={src.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <SourceIcon source={src} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                          {src.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {src.category} · {src.format.toUpperCase()} · {src.language.toUpperCase()}
                        </p>
                        <SourceHealth source={src} health={feedHealth[src.id]} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleSource(src.id)}
                      className="liquid-glass-subtle inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Folgen
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
          <details className="settings-group p-4 space-y-3">
            <summary className="cursor-pointer font-semibold">Import, Export und weitere Einstellungen</summary>
            <div className="flex flex-wrap gap-2">
              <label className="choice-pill cursor-pointer">OPML importieren
                <input type="file" accept=".opml,.xml" className="sr-only" onChange={async event => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file) return;
                  try {
                    const imported = importOpml(await file.text());
                    onImportSources(imported);
                    setTransferStatus(imported.length ? `${imported.length} Quellen übernommen.` : 'Keine gültigen Quellen gefunden.');
                  } catch (error) {
                    setTransferStatus(error instanceof Error ? error.message : 'Import fehlgeschlagen.');
                  } finally { input.value = ''; }
                }} />
              </label>
              <button type="button" className="choice-pill" onClick={async () => {
                const file = new File([exportOpml(sources)], 'OpenNews.opml', { type: 'text/x-opml' });
                if (navigator.canShare?.({ files: [file] })) {
                  try { await navigator.share({ files: [file] }); } catch { /* Share sheet closed */ }
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
              }}>OPML exportieren</button>
              <button type="button" className="choice-pill" onClick={onAdvancedSources}>Feed-Formate</button>
            </div>
            {transferStatus && <p role="status">{transferStatus}</p>}
          </details>
        </div>
      )}

      {/* SECTION 3: KI & API-KEY */}
      {section === 'ai' && (
        <section className="settings-group space-y-3 p-4" aria-labelledby="personalization-heading">
          <h2 id="personalization-heading" className="font-semibold">Lokale Empfehlungen</h2>
          <p className="text-sm text-[var(--muted)]">
            Gelernte Gewichte halbieren sich alle 21 Tage. Beim Zurücksetzen bleiben Lesezeichen, Reaktionen und Verlauf erhalten.
          </p>
          <button type="button" className="choice-pill" onClick={onResetAlgorithm}>Algorithmus zurücksetzen</button>
        </section>
      )}
      {section === 'ai' && (
        <div className="liquid-glass rounded-[26px] p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Eigener KI-Anbieter (BYOK)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dein API-Key bleibt lokal auf deinem Smartphone
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300">Empfohlen: lokale Zusammenfassungen ohne API-Schlüssel.</p>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            Standardstil für KI-Zusammenfassungen
            <select className="preference-input" value={resolveSummaryStyle(aiConfig.summaryStyle)}
              onChange={event => onUpdateAIConfig({ ...aiConfig, summaryStyle: resolveSummaryStyle(event.target.value) })}>
              {Object.entries(SUMMARY_STYLES).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}
            </select>
          </label>
          {!deviceAvailable && <p className="text-sm">Gemini Nano ist hier derzeit nicht verfügbar.</p>}
          {!showAISetup && <button className="choice-pill" type="button" onClick={() => setShowAISetup(true)}>KI-Anbieter verbinden</button>}
          {showAISetup && <>
          <div className="space-y-4">
            <div>
              <label htmlFor="ai-provider" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                KI-Anbieter auswählen
              </label>
              <select
                id="ai-provider"
                value={aiConfig.provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
                className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 px-3.5 text-sm font-medium text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
              >
                {AI_PROVIDERS.filter(provider => provider.id !== 'device' || deviceAvailable || aiConfig.provider === 'device').map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {activeProviderMeta.docsHint}
              </p>
            </div>

            {aiConfig.provider !== 'device' && <>
            <div className="space-y-2">
              <label htmlFor="ai-model" className="block text-sm font-medium">Modell-ID</label>
              <input
                id="ai-model"
                value={aiConfig.model}
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => {
                  onUpdateAIConfig({ ...aiConfig, model: e.target.value });
                  setAiTestStatus(null);
                }}
                className="preference-input w-full"
              />
              <div className="flex flex-wrap gap-2" aria-label="Modellvorschläge">
                {activeProviderMeta.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    aria-pressed={aiConfig.model === model.id}
                    className="choice-pill"
                    onClick={() => {
                      onUpdateAIConfig({ ...aiConfig, model: model.id });
                      setAiTestStatus(null);
                    }}
                  >
                    {model.label}
                  </button>
                ))}
              </div>
            </div>

            {aiConfig.provider === 'custom' && (
              <div>
                <label htmlFor="ai-endpoint" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Custom Chat-Completions Endpunkt
                </label>
                <input
                  id="ai-endpoint"
                  type="url"
                  value={aiConfig.customEndpoint || ''}
                  onChange={(e) =>
                    onUpdateAIConfig({ ...aiConfig, customEndpoint: e.target.value })
                  }
                  placeholder="https://openrouter.ai/api/v1/chat/completions"
                  className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 px-3.5 text-sm text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                />
              </div>
            )}

            <div>
              <label htmlFor="ai-apikey" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                API-Key einfügen
              </label>
              <div className="relative flex items-center">
                <KeyRound className="pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-slate-400" />
                <input
                  id="ai-apikey"
                  type={showAIKey ? 'text' : 'password'}
                  value={aiConfig.apiKey}
                  onChange={(e) => onUpdateAIConfig({ ...aiConfig, apiKey: e.target.value })}
                  placeholder={activeProviderMeta.keyPlaceholder}
                  className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 pl-10 pr-12 text-sm text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowAIKey((s) => !s)}
                  aria-label={showAIKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
                  className="absolute right-2 flex min-h-[38px] min-w-[38px] items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  {showAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            </>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestAI}
                disabled={testingAI}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-blue-600 px-5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
              >
                {testingAI ? 'Teste Verbindung…' : 'KI-Verbindung testen'}
              </button>
              {aiTestStatus && (
                <span
                  className={`text-xs font-semibold ${
                    aiTestStatus.ok ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {aiTestStatus.message}
                </span>
              )}
            </div>

            <div className="divide-y divide-black/5 border-t border-black/5 pt-3 dark:divide-white/10 dark:border-white/10">
              {[
                {
                  key: 'autoSummarize' as const,
                  label: 'Automatische KI-Zusammenfassung im Reader',
                },
              ].map((opt) => (
                <div key={opt.key} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {opt.label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiConfig[opt.key]}
                    aria-label={opt.label}
                    onClick={() =>
                      onUpdateAIConfig({ ...aiConfig, [opt.key]: !aiConfig[opt.key] })
                    }
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                      aiConfig[opt.key] ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        aiConfig[opt.key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </>}
        </div>
      )}

      {section === 'app' && (
        <div className="space-y-4">
          {Capacitor.getPlatform() === 'android' && <DailyBriefingSettings settings={briefingSettings} onChange={onBriefingSettings} />}
          <div className="liquid-glass rounded-[26px] p-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-emerald-500" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Eilmeldungen &amp; Benachrichtigungen
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {Capacitor.getPlatform() === 'android' ? 'Meldungen aus unterstützten Quellen auch bei geschlossener App.'
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
                  notifications.enabled ? 'bg-[#34C759]' : 'bg-slate-300 dark:bg-slate-700'
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
              <p role="status" className="text-sm">{pushPermissionDenied && androidSettingsUnavailable
                ? 'Öffne in Android die App-Infos für OpenNews und wähle Benachrichtigungen.'
                : pushStatus}</p>
            )}
            {pushPermissionDenied && <button type="button" className="choice-pill"
              onClick={() => {
                setAndroidSettingsUnavailable(false);
                void NewsPush.openSettings().catch(() => setAndroidSettingsUnavailable(true));
              }}>
              Android-Einstellungen öffnen
            </button>}
            {notifications.enabled && (
              <div className="space-y-4 border-t border-black/10 pt-3 dark:border-white/10">
                <label className="preference-row px-0">
                  Nur als Eilmeldung markierte Artikel
                  <input type="checkbox" checked={notifications.breakingOnly}
                    onChange={event => onUpdateNotifications({ ...notifications, breakingOnly: event.target.checked })} />
                </label>
                {!notifications.breakingOnly && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Themen für Hinweise</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Ohne Auswahl sind alle Themen aktiv.</p>
                    <TopicChoices topics={notifications.topics as NewsCategory[]}
                      onChange={topics => onUpdateNotifications({ ...notifications, topics })} />
                  </div>
                )}
                <fieldset className="flex flex-wrap gap-3">
                  <legend className="mb-2 text-sm font-semibold">Zeitfenster</legend>
                  <label className="flex items-center gap-2">Von <input type="time" className="preference-input"
                    value={notifications.from ?? '00:00'} onChange={event => onUpdateNotifications({ ...notifications, from: event.target.value || undefined })} /></label>
                  <label className="flex items-center gap-2">Bis <input type="time" className="preference-input"
                    value={notifications.until ?? '23:59'} onChange={event => onUpdateNotifications({ ...notifications, until: event.target.value || undefined })} /></label>
                </fieldset>
                <button type="button" onClick={onSendTestNotification} className="choice-pill">Lokale Test-Meldung anzeigen</button>
              </div>
            )}
          </div>

        </div>
      )}
    </section>
  );
};
