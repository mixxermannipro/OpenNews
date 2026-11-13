import React, { useState } from 'react';
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
  Link2,
  Loader2,
  Moon,
  Pencil,
  Plus,
  Radio,
  Rss,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  AIProviderConfig,
  AIProviderId,
  FormatPreferences,
  NewsCategory,
  NewsSource,
  NotificationSettings,
  SourceApiKeys,
  ThemeMode,
} from '../types/news';
import { AI_PROVIDERS, testAIConnection } from '../lib/aiClient';
import { PWAInstallButton } from './PWAInstallButton';

interface SettingsModalProps {
  initialSection?: 'sources' | 'ai' | 'app';
  sources: NewsSource[];
  formatPrefs: FormatPreferences;
  sourceKeys: SourceApiKeys;
  aiConfig: AIProviderConfig;
  theme: ThemeMode;
  notifications: NotificationSettings;
  onToggleSource: (sourceId: string) => void;
  onAddCustomSource: (source: NewsSource) => void;
  onUpdateSource: (sourceId: string, updates: Partial<NewsSource>) => void;
  onRemoveCustomSource: (sourceId: string) => void;
  onUpdateFormatPrefs: (prefs: FormatPreferences) => void;
  onUpdateSourceKeys: (keys: SourceApiKeys) => void;
  onUpdateAIConfig: (config: AIProviderConfig) => void;
  onToggleTheme: () => void;
  onUpdateNotifications: (next: NotificationSettings) => void;
  onSendTestNotification: () => void;
  onResetAlgorithm: () => void;
  onClose: () => void;
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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialSection = 'sources',
  sources,
  formatPrefs,
  sourceKeys,
  aiConfig,
  theme,
  notifications,
  onToggleSource,
  onAddCustomSource,
  onUpdateSource,
  onRemoveCustomSource,
  onUpdateFormatPrefs,
  onUpdateSourceKeys,
  onUpdateAIConfig,
  onToggleTheme,
  onUpdateNotifications,
  onSendTestNotification,
  onResetAlgorithm,
  onClose,
}) => {
  const [section, setSection] = useState<'sources' | 'ai' | 'app'>(initialSection);
  const [feedSearch, setFeedSearch] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveredFeeds, setDiscoveredFeeds] = useState<Array<{ name: string; url: string; format: 'rss' | 'atom' | 'json' }>>([]);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    url: string;
    category: Exclude<NewsCategory, 'Alle' | 'Für dich'>;
    format: NewsSource['format'];
  }>({ name: '', url: '', category: 'Politik', format: 'rss' });

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customCategory, setCustomCategory] = useState<Exclude<NewsCategory, 'Alle' | 'Für dich'>>('Politik');
  const [customError, setCustomError] = useState<string | null>(null);

  const [editingKeyTarget, setEditingKeyTarget] = useState<keyof SourceApiKeys | null>(null);
  const [tempSourceKey, setTempSourceKey] = useState('');

  const [showAIKey, setShowAIKey] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingAI, setTestingAI] = useState(false);

  const activeProviderMeta = AI_PROVIDERS.find((p) => p.id === aiConfig.provider) || AI_PROVIDERS[0];

  const handleAddFeed = (e: React.FormEvent) => {
    e.preventDefault();
    const url = customUrl.trim();
    const name = customName.trim();
    if (!name || !url) {
      setCustomError('Bitte Name und gültige Feed-URL angeben.');
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setCustomError('Nur http:// oder https:// URLs werden unterstützt.');
        return;
      }
    } catch {
      setCustomError('Bitte eine vollständige URL inklusive https:// eingeben.');
      return;
    }

    const format = url.endsWith('.json') || url.includes('jsonfeed') ? 'json' : url.includes('atom') ? 'atom' : 'rss';
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

  const handleToggleNotificationPermission = async () => {
    if (!notifications.enabled && typeof Notification !== 'undefined') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'denied') {
          onUpdateNotifications({ ...notifications, enabled: false });
          return;
        }
      } catch {
        // Fallback to in-app notifications
      }
    }
    onUpdateNotifications({ ...notifications, enabled: !notifications.enabled });
  };

  const handleDiscoverFeeds = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = feedSearch.trim();
    if (!q) return;
    setDiscovering(true);
    try {
      const resp = await fetch(`/api/feeds/discover?q=${encodeURIComponent(q)}`);
      if (resp.ok) {
        const data = (await resp.json()) as {
          discovered?: Array<{ name: string; url: string; format: 'rss' | 'atom' | 'json' }>;
        };
        setDiscoveredFeeds(Array.isArray(data.discovered) ? data.discovered : []);
      }
    } catch {
      setDiscoveredFeeds([]);
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
    if (!editDraft.name.trim() || !editDraft.url.trim()) return;
    onUpdateSource(sourceId, {
      name: editDraft.name.trim(),
      url: editDraft.url.trim(),
      category: editDraft.category,
      format: editDraft.format,
      shortCode: editDraft.name.trim().slice(0, 3).toUpperCase(),
    });
    setEditingFeedId(null);
  };

  const normalizedFeedQuery = feedSearch.trim().toLowerCase();
  const filteredSources = sources.filter((s) => {
    if (!normalizedFeedQuery) return true;
    return (
      s.name.toLowerCase().includes(normalizedFeedQuery) ||
      s.url.toLowerCase().includes(normalizedFeedQuery) ||
      s.category.toLowerCase().includes(normalizedFeedQuery) ||
      s.description.toLowerCase().includes(normalizedFeedQuery)
    );
  });

  const selectedSources = filteredSources.filter((s) => s.subscribed);
  const recommendedSources = filteredSources.filter((s) => !s.subscribed && s.recommended);
  const otherSources = filteredSources.filter((s) => !s.subscribed && !s.recommended);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quellen, KI und Einstellungen"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-[94dvh] sm:h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-[#F2F3F7] dark:bg-[#0B0D12] shadow-2xl ring-1 ring-white/10"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between gap-4 border-b border-black/5 px-5 py-4 dark:border-white/10 sm:px-7">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Quellen &amp; Integrationen
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verwalte deine News-Quellen, KI-Modelle &amp; App-Einstellungen
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Einstellungen schließen"
            className="liquid-glass flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-700 dark:text-slate-200 transition hover:scale-105"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="px-5 pt-4 sm:px-7">
          <div className="liquid-glass-subtle grid grid-cols-3 rounded-2xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setSection('sources')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
                section === 'sources'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Quellen &amp; Feeds
            </button>
            <button
              type="button"
              onClick={() => setSection('ai')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
                section === 'ai'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              KI &amp; API-Key
            </button>
            <button
              type="button"
              onClick={() => setSection('app')}
              className={`min-h-[40px] rounded-xl text-xs font-semibold transition ${
                section === 'app'
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              App &amp; Datenschutz
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 sm:px-7">
          {section === 'sources' && (
            <>
              {/* Öffentliche Quellen (Screenshot 1) */}
              <div className="liquid-glass rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-200/70 dark:bg-white/10">
                    <Layers className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Öffentliche Quellen
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Offene und frei nutzbare News-Quellen
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-black/5 dark:divide-white/10">
                  {[
                    {
                      key: 'rssAtom' as const,
                      label: 'RSS / Atom',
                      desc: 'News-Feeds im Standardformat',
                      icon: <Rss className="h-4 w-4 text-amber-500" />,
                    },
                    {
                      key: 'jsonFeed' as const,
                      label: 'JSON Feed',
                      desc: 'Moderne, strukturierte Feeds',
                      icon: <span className="text-xs font-bold text-indigo-400">{'{}'}</span>,
                    },
                    {
                      key: 'openData' as const,
                      label: 'Open Data',
                      desc: 'Öffentliche Datenquellen (z. B. EU, Bund, NASA)',
                      icon: <Database className="h-4 w-4 text-blue-500" />,
                    },
                    {
                      key: 'podcasts' as const,
                      label: 'Podcasts & Video',
                      desc: 'News- und Hintergrundformate als Audio/Video',
                      icon: <Radio className="h-4 w-4 text-purple-500" />,
                    },
                  ].map((item) => {
                    const enabled = formatPrefs[item.key];
                    return (
                      <div key={item.key} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200/70 dark:bg-white/10">
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
                            enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
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

              {/* Add Custom RSS URL */}
              <form onSubmit={handleAddFeed} className="liquid-glass rounded-3xl p-5 space-y-3.5">
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
                    className="rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.org/rss.xml"
                    aria-label="URL des eigenen Feeds"
                    className="sm:col-span-2 rounded-xl border border-black/10 bg-white/70 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <select
                    value={customCategory}
                    onChange={(e) =>
                      setCustomCategory(e.target.value as Exclude<NewsCategory, 'Alle' | 'Für dich'>)
                    }
                    aria-label="Kategorie für eigenen Feed"
                    className="min-h-[42px] rounded-xl border border-black/10 bg-white/70 px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#151822] dark:text-slate-100"
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
                {customError && <p className="text-xs text-rose-500">{customError}</p>}
              </form>

              {/* RSS-Feed-Manager: Suche & Live-Discovery */}
              <div className="liquid-glass rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      RSS-Feed-Manager &amp; Suche
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Durchsuche Agenturen oder gib eine Website-Domain ein (z. B. netzpolitik.org)
                    </p>
                  </div>
                </div>

                <form onSubmit={handleDiscoverFeeds} className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[210px]">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={feedSearch}
                      onChange={(e) => setFeedSearch(e.target.value)}
                      placeholder="Feed, Thema oder Domain suchen (z. B. tagesschau, faz.net)…"
                      aria-label="RSS-Feeds durchsuchen"
                      className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={discovering || !feedSearch.trim()}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                    Web-Feed finden
                  </button>
                </form>

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

              {/* Meine ausgewählten Feeds (mit Bearbeiten-Funktion) */}
              <div className="liquid-glass rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Meine ausgewählten Feeds ({selectedSources.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Aktive Nachrichtenquellen in deinem Feed — jederzeit bearbeitbar
                    </p>
                  </div>
                </div>

                {selectedSources.length === 0 ? (
                  <p className="py-3 text-xs text-slate-500 dark:text-slate-400">
                    Keine passenden aktiven Feeds gefunden. Wähle unten empfohlene Feeds aus.
                  </p>
                ) : (
                  <div className="divide-y divide-black/5 dark:divide-white/10">
                    {selectedSources.map((src) => {
                      const isEditing = editingFeedId === src.id;
                      return (
                        <div key={src.id} className="py-3 space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                                style={{ backgroundColor: src.accentColor }}
                              >
                                {src.shortCode}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                  {src.name}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  {src.category} · {src.format.toUpperCase()} · {src.url}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => (isEditing ? setEditingFeedId(null) : startEditingSource(src))}
                                aria-label={`${src.name} bearbeiten`}
                                className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {src.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => onRemoveCustomSource(src.id)}
                                  aria-label={`${src.name} löschen`}
                                  className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-rose-500 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onToggleSource(src.id)}
                                aria-pressed={true}
                                className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
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
                <div className="liquid-glass rounded-3xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Empfohlene Feeds ({recommendedSources.length})
                    </h3>
                  </div>

                  <div className="divide-y divide-black/5 dark:divide-white/10">
                    {recommendedSources.map((src) => (
                      <div key={src.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                            style={{ backgroundColor: src.accentColor }}
                          >
                            {src.shortCode}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {src.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {src.category} · {src.description}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleSource(src.id)}
                          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-blue-600 px-3.5 text-xs font-semibold text-white transition hover:bg-blue-500"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Abonnieren
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weitere verfügbare Agenturen */}
              {otherSources.length > 0 && (
                <div className="liquid-glass rounded-3xl p-5 space-y-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Weitere Quellen ({otherSources.length})
                  </h3>
                  <div className="divide-y divide-black/5 dark:divide-white/10">
                    {otherSources.map((src) => (
                      <div key={src.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                            style={{ backgroundColor: src.accentColor }}
                          >
                            {src.shortCode}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {src.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {src.category} · {src.description}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleSource(src.id)}
                          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-slate-200/80 px-3.5 text-xs font-semibold text-slate-800 dark:bg-white/10 dark:text-slate-100"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Folgen
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optionale API-Schlüssel (Screenshot 1) */}
              <div className="liquid-glass rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-200/70 dark:bg-white/10">
                    <Link2 className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Optionale API-Schlüssel
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Verbinde zusätzliche, redaktionelle Quellen
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-black/5 dark:divide-white/10">
                  {[
                    { key: 'guardian' as const, name: 'The Guardian', desc: 'Aktuelle Nachrichten & Analysen', code: 'G', color: '#1E3A8A' },
                    { key: 'nasa' as const, name: 'NASA', desc: 'Wissenschaft, Raumfahrt & Forschung', code: 'NASA', color: '#2563EB' },
                    { key: 'youtube' as const, name: 'YouTube', desc: 'Videos & offizielle Kanäle', code: 'YT', color: '#DC2626' },
                    { key: 'bundestag' as const, name: 'Bundestag DIP', desc: 'Drucksachen, Debatten & Termine', code: 'DIP', color: '#334155' },
                  ].map((item) => {
                    const hasKey = Boolean(sourceKeys[item.key]);
                    const isEditing = editingKeyTarget === item.key;
                    return (
                      <div key={item.key} className="py-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                              style={{ backgroundColor: item.color }}
                            >
                              {item.code}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.desc}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingKeyTarget(isEditing ? null : item.key);
                              setTempSourceKey(sourceKeys[item.key] || '');
                            }}
                            className="liquid-glass-subtle min-h-[38px] shrink-0 rounded-full px-3.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                          >
                            {hasKey ? 'Key bearbeiten' : '+ API-Key hinzufügen'}
                          </button>
                        </div>

                        {isEditing && (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="password"
                              value={tempSourceKey}
                              onChange={(e) => setTempSourceKey(e.target.value)}
                              placeholder={`${item.name} API-Key`}
                              className="flex-1 rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateSourceKeys({ ...sourceKeys, [item.key]: tempSourceKey.trim() || undefined });
                                setEditingKeyTarget(null);
                              }}
                              className="min-h-[36px] rounded-xl bg-blue-600 px-3.5 text-xs font-semibold text-white"
                            >
                              Speichern
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="rounded-2xl bg-slate-200/60 p-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-400">
                  Private API-Keys sind optional. Die App funktioniert auch ohne sie vollständig mit öffentlichen RSS-, Atom- und JSON-Quellen.
                </p>
              </div>
            </>
          )}

          {section === 'ai' && (
            <div className="liquid-glass rounded-3xl p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Eigener KI-Anbieter (BYOK)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dein API-Key bleibt lokal auf deinem Smartphone
                  </p>
                </div>
              </div>

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
                    {AI_PROVIDERS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {activeProviderMeta.docsHint}
                  </p>
                </div>

                <div>
                  <label htmlFor="ai-model" className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Modell auswählen
                  </label>
                  <select
                    id="ai-model"
                    value={aiConfig.model}
                    onChange={(e) => onUpdateAIConfig({ ...aiConfig, model: e.target.value })}
                    className="w-full min-h-[44px] rounded-2xl border border-black/10 bg-white/80 px-3.5 text-sm font-medium text-slate-900 dark:border-white/10 dark:bg-[#151822] dark:text-white"
                  >
                    {activeProviderMeta.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
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
                    <KeyRound className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400" />
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
                    {
                      key: 'includeContext' as const,
                      label: 'Hintergrund & Einordnung anzeigen',
                    },
                    {
                      key: 'includePerspectives' as const,
                      label: 'Perspektiven & Kritische Fragen anzeigen',
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
                        onClick={() =>
                          onUpdateAIConfig({ ...aiConfig, [opt.key]: !aiConfig[opt.key] })
                        }
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                          aiConfig[opt.key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
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
            </div>
          )}

          {section === 'app' && (
            <>
              {/* Theme & Notifications */}
              <div className="liquid-glass rounded-3xl p-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Darstellung &amp; Benachrichtigungen
                </h3>

                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="h-5 w-5 text-blue-400" />
                    ) : (
                      <Sun className="h-5 w-5 text-amber-500" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Dark Mode (Standard)
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {theme === 'dark' ? 'Dunkles Apple-Design aktiv' : 'Helles Design aktiv'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={theme === 'dark'}
                    aria-label="Dark Mode umschalten"
                    onClick={onToggleTheme}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                      theme === 'dark' ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="border-t border-black/5 pt-4 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          Eilmeldungen &amp; Benachrichtigungen
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Lokale Alerts für neue Top-Meldungen deiner Quellen
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifications.enabled}
                      aria-label="Benachrichtigungen umschalten"
                      onClick={handleToggleNotificationPermission}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                        notifications.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                          notifications.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {notifications.enabled && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Benachrichtigungen aktiv für abonnierte Agenturen
                      </span>
                      <button
                        type="button"
                        onClick={onSendTestNotification}
                        className="liquid-glass-subtle min-h-[38px] rounded-full px-3.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
                      >
                        Test-Meldung senden
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Smartphone Installation */}
              <div className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Android &amp; iOS App
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Direkt als PWA installieren oder über Capacitor als native APK/IPA bauen.
                  </p>
                </div>
                <PWAInstallButton />
              </div>

              {/* Datenschutz (Screenshot 1 bottom card) */}
              <div className="liquid-glass rounded-3xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Datenschutz
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="liquid-glass-subtle rounded-2xl p-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Alles lokal gespeichert
                    </p>
                    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Deine Abos, Likes, API-Keys und Lesezeichen bleiben ausschließlich auf deinem Gerät.
                    </p>
                  </div>
                  <div className="liquid-glass-subtle rounded-2xl p-4 space-y-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Keine Pflicht-Cloud
                    </p>
                    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                      Keine erzwungene Kontoerstellung, kein Tracking und keine Cloud-Synchronisation.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onResetAlgorithm}
                  className="text-xs font-semibold text-rose-500 hover:underline"
                >
                  Lokalen Like-Algorithmus zurücksetzen
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
