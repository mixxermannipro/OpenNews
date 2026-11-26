import {
  Bookmark,
  Check,
  ChevronRight,
  ExternalLink,
  FileText,
  Film,
  Headphones,
  Heart,
  Layers,
  Pause,
  Play,
  Plus,
  Radio,
  Search,
  Share2,
  Star,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { collectDistinctMedia, type PlayableMedia } from '../lib/articleMedia';
import { STARTER_PACKS } from '../lib/catalog';
import {
  buildClipsPlaylist,
  extractContinueListening,
  extractMediaChannels,
  filterMediaEntries,
  formatDurationLabel,
  selectMediaDiscoverySources,
  selectMediaStarterPacks,
  type MediaEntry,
  type MediaTabFilter,
} from '../lib/clipsEngine';
import { safeHref } from '../lib/contentIdentity';
import { useI18n } from '../lib/i18n';
import { getMediaCopy } from '../lib/mediaCopy';
import {
  buildRadioAudioTrack,
  filterRadioStations,
  RADIO_STATIONS,
  type RadioFilterGroup,
  type RadioStation,
} from '../lib/radioCatalog';
import type { AudioPositionEntry } from '../lib/readerExtras';
import { shareArticle } from '../lib/shareArticle';
import type { AIProviderConfig, NewsArticle, NewsSource } from '../types/news';
import { ArticleImage } from './ArticleImage';
import { ClipsFeed } from './ClipsFeed';
import { MediaPlayer } from './MediaPlayer';
import { formatAudioClock, type ActiveAudioTrack } from './MiniAudioPlayer';
import { SourceIcon } from './SourceIcon';
import { TranscriptSummary } from './TranscriptSummary';
import { ViewStatus } from './ViewStatus';

const FILTER_KEYS: MediaTabFilter[] = ['all', 'video', 'audio', 'radio', 'clips'];

function cleanSummaryPreview(article: NewsArticle): string {
  const raw = (article.summary || '').replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 18) return '';
  if (raw.toLowerCase() === article.title.trim().toLowerCase()) return '';
  return raw;
}

export function MediaView({
  aiConfig,
  articles,
  sources = [],
  hasActiveSources,
  loading,
  background,
  activeAudioUrl,
  audioPositions = {},
  radioFavorites = [],
  initialClipUrl,
  onClearInitialClip,
  onPlayAudio,
  onPlayRadio,
  onToggleRadioFavorite,
  onArticle,
  onSources,
  onToggleSubscribe,
  onApplyStarterPack,
  onLike,
  onSave,
  onEngaged,
  liked,
  saved,
}: {
  aiConfig: AIProviderConfig;
  articles: NewsArticle[];
  sources?: NewsSource[];
  hasActiveSources?: boolean;
  loading: boolean;
  background: boolean;
  activeAudioUrl?: string;
  audioPositions?: Record<string, AudioPositionEntry>;
  radioFavorites?: string[];
  initialClipUrl?: string;
  onClearInitialClip?: () => void;
  onPlayAudio?: (article: NewsArticle, media: PlayableMedia, queue?: ActiveAudioTrack[]) => void;
  onPlayRadio?: (track: ActiveAudioTrack) => void;
  onToggleRadioFavorite?: (stationId: string) => void;
  onArticle: (article: NewsArticle) => void;
  onSources: () => void;
  onToggleSubscribe?: (sourceId: string) => void;
  onApplyStarterPack?: (sourceIds: readonly string[]) => void;
  onLike: (article: NewsArticle) => void;
  onSave: (article: NewsArticle) => void;
  onEngaged: (article: NewsArticle, seconds: number) => void;
  liked: string[];
  saved: string[];
}) {
  const { lang, t, categoryLabel, formatRelative } = useI18n();
  const copy = getMediaCopy(lang);
  const [filter, setFilter] = useState<MediaTabFilter>(initialClipUrl ? 'clips' : 'all');
  const [radioGroup, setRadioGroup] = useState<RadioFilterGroup>('all');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [mediaQuery, setMediaQuery] = useState('');
  const [playingUrl, setPlayingUrl] = useState<string>();
  const [startClipUrl, setStartClipUrl] = useState<string | undefined>(initialClipUrl);
  const [shareFeedback, setShareFeedback] = useState('');
  const [videoLimit, setVideoLimit] = useState(12);
  const [audioLimit, setAudioLimit] = useState(12);
  const clipsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (initialClipUrl) {
      setStartClipUrl(initialClipUrl);
      setFilter('clips');
      onClearInitialClip?.();
    }
  }, [initialClipUrl, onClearInitialClip]);

  const allEntries = useMemo(() => collectDistinctMedia(articles), [articles]);
  const searchedEntries = useMemo(
    () => filterMediaEntries(allEntries, mediaQuery),
    [allEntries, mediaQuery],
  );

  // Tab-aware channel strip so switching to Audio only displays podcast channels
  const channels = useMemo(
    () => extractMediaChannels(searchedEntries, filter),
    [searchedEntries, filter],
  );

  // Auto-clear selected channel if it has no entries in the newly selected format tab
  useEffect(() => {
    if (selectedChannel && !channels.some(channel => channel.sourceId === selectedChannel)) {
      setSelectedChannel(null);
    }
  }, [channels, selectedChannel]);

  const filteredEntries = useMemo(
    () => (selectedChannel
      ? searchedEntries.filter(({ article }) => (article.sourceId || article.sourceName) === selectedChannel)
      : searchedEntries),
    [searchedEntries, selectedChannel],
  );

  const allClipsCount = useMemo(
    () => buildClipsPlaylist(searchedEntries, 'shorts', false).items.length,
    [searchedEntries],
  );
  const allVideoCount = useMemo(
    () => searchedEntries.filter(({ media }) => media.type !== 'audio' && !media.portrait).length,
    [searchedEntries],
  );
  const allAudioCount = useMemo(
    () => searchedEntries.filter(({ media }) => media.type === 'audio').length,
    [searchedEntries],
  );

  const clipsPreview = useMemo(() => buildClipsPlaylist(filteredEntries, 'shorts', false).items, [filteredEntries]);
  const clipsPlaylist = useMemo(() => buildClipsPlaylist(filteredEntries, 'shorts', true).items, [filteredEntries]);
  const videoItems = useMemo(
    () => filteredEntries.filter(({ media }) => media.type !== 'audio' && !media.portrait),
    [filteredEntries],
  );
  const audioItems = useMemo(
    () => filteredEntries.filter(({ media }) => media.type === 'audio'),
    [filteredEntries],
  );

  const continueListening = useMemo(
    () => extractContinueListening(filteredEntries, audioPositions, 6),
    [filteredEntries, audioPositions],
  );

  const subscribedIds = useMemo(
    () => new Set(sources.filter(source => source.subscribed).map(source => source.id)),
    [sources],
  );

  const contextualPacks = useMemo(() => {
    const packs = selectMediaStarterPacks(STARTER_PACKS, lang, filter);
    return packs.filter(pack => pack.sourceIds.some(id => !subscribedIds.has(id)));
  }, [lang, filter, subscribedIds]);

  const discoverChannels = useMemo(
    () => selectMediaDiscoverySources(sources, lang, filter, 6),
    [sources, lang, filter],
  );

  const filterLabels: Record<MediaTabFilter, string> = {
    all: t('mediaFilterAll'),
    video: t('mediaFilterVideo'),
    audio: t('mediaFilterAudio'),
    radio: copy.radioTab,
    clips: t('mediaFilterClips'),
  };

  const quickRadioStations = useMemo(
    () => filterRadioStations(RADIO_STATIONS, { language: lang, favoriteIds: radioFavorites }).slice(0, 8),
    [lang, radioFavorites],
  );

  const visibleRadioStations = useMemo(
    () => filterRadioStations(RADIO_STATIONS, {
      query: mediaQuery,
      group: radioGroup,
      language: lang,
      favoriteIds: radioFavorites,
    }),
    [mediaQuery, radioGroup, lang, radioFavorites],
  );

  const filterCounts: Record<MediaTabFilter, number> = {
    all: searchedEntries.length,
    video: allVideoCount,
    audio: allAudioCount,
    radio: RADIO_STATIONS.length,
    clips: allClipsCount,
  };

  const triggerRadioStation = (station: RadioStation) => {
    const track = buildRadioAudioTrack(station);
    if (onPlayRadio) {
      onPlayRadio(track);
      return;
    }
    if (onPlayAudio) {
      onPlayAudio(track.article, track.media);
    }
  };

  const handleShare = (article: NewsArticle, mediaUrl: string) => {
    setShareFeedback('');
    void shareArticle(article, article.linkIsFeed ? mediaUrl : article.link)
      .then(copied => {
        if (copied) {
          setShareFeedback(t('linkCopied'));
          window.setTimeout(() => setShareFeedback(''), 2400);
        }
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setShareFeedback(t('shareUnavailable'));
          window.setTimeout(() => setShareFeedback(''), 2400);
        }
      });
  };

  const openClipTheater = (url?: string) => {
    setPlayingUrl(undefined);
    setStartClipUrl(url);
    setFilter('clips');
  };

  const playAudioWithQueue = (article: NewsArticle, media: PlayableMedia) => {
    if (!onPlayAudio) {
      setPlayingUrl(playingUrl === media.url ? undefined : media.url);
      return;
    }
    const idx = audioItems.findIndex(item => item.media.url === media.url);
    const upcoming: ActiveAudioTrack[] = idx >= 0
      ? audioItems.slice(idx + 1, idx + 10).map(item => ({ article: item.article, media: item.media }))
      : audioItems
          .filter(item => item.media.url !== media.url)
          .slice(0, 8)
          .map(item => ({ article: item.article, media: item.media }));
    onPlayAudio(article, media, upcoming);
  };

  const activeVideoEntry = useMemo(
    () => videoItems.find(({ media }) => media.url === playingUrl),
    [videoItems, playingUrl],
  );

  const renderVideoCard = ({ article, media }: MediaEntry, featured = false) => {
    const isPlaying = playingUrl === media.url;
    const isLiked = liked.includes(article.id);
    const isSaved = saved.includes(article.id);
    const artwork = article.imageUrl;
    const durationText = formatDurationLabel(media.durationSec ?? article.durationSec);
    const summaryText = featured ? cleanSummaryPreview(article) : '';

    return (
      <li
        key={media.url}
        data-media-url={media.url}
        className={`media-video-card group flex flex-col overflow-hidden ${
          featured ? 'sm:col-span-2 lg:col-span-3 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4' : ''
        }`}
      >
        {featured && isPlaying && (
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--accent)]">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {t('mediaNowPlaying')}
            </span>
            <button
              type="button"
              onClick={() => setPlayingUrl(undefined)}
              aria-label={copy.closePlayer}
              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
            >
              <X size={15} aria-hidden="true" />
              <span>{t('close')}</span>
            </button>
          </div>
        )}

        <div className="relative aspect-video overflow-hidden rounded-[var(--card-radius)] bg-black">
          {isPlaying ? (
            <MediaPlayer
              media={media}
              title={article.title}
              poster={artwork}
              background={background}
              autoPlay
              onEngaged={seconds => onEngaged(article, seconds)}
            />
          ) : (
            <button
              type="button"
              aria-label={article.title}
              onClick={() => setPlayingUrl(media.url)}
              className="relative block h-full w-full text-white"
            >
              {artwork ? (
                <ArticleImage
                  src={artwork}
                  alt=""
                  sourceShortCode={article.sourceShortCode}
                  sourceColor={article.sourceColor}
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
              ) : (
                <span className="grid h-full w-full place-items-center bg-slate-900">
                  <Video size={40} className="text-white/60" aria-hidden="true" />
                </span>
              )}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
              />
              <span className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="grid size-13 place-items-center rounded-full border border-white/25 bg-black/65 backdrop-blur-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                  <Play size={22} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                </span>
              </span>
              {durationText && (
                <span className="pointer-events-none absolute right-2.5 bottom-2.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold tracking-tight text-white tabular-nums backdrop-blur-xs">
                  {durationText}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-1 flex-col justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="shrink-0 pt-0.5">
              <SourceIcon
                source={{
                  id: article.sourceId,
                  shortCode: article.sourceShortCode,
                  accentColor: article.sourceColor,
                }}
                size="h-8 w-8"
                rounded="rounded-full"
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <button
                type="button"
                onClick={() => onArticle(article)}
                className={`block text-left font-bold leading-snug text-[var(--ink)] transition-colors hover:text-[var(--accent)] [overflow-wrap:anywhere] ${
                  featured ? 'text-base sm:text-lg' : 'text-[15px] line-clamp-2'
                }`}
              >
                {article.title}
              </button>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[var(--muted)]">
                <span className="truncate font-medium text-[var(--ink)]/80">{article.sourceName}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 tabular-nums">{formatRelative(article.publishedAt)}</span>
                {isPlaying && media.type === 'youtube' && safeHref(article.link) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={safeHref(article.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium underline hover:text-[var(--ink)]"
                    >
                      {t('mediaWatchYoutube')}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
              {summaryText && (
                <p className="pt-1 text-sm leading-relaxed text-[var(--muted)] line-clamp-3">
                  {summaryText}
                </p>
              )}
            </div>
          </div>

          {isPlaying && <TranscriptSummary article={article} config={aiConfig} />}

          {/* Compact single-row editorial action bar (never wraps onto 2 rows) */}
          <div className="flex items-center justify-between gap-2 border-t border-[var(--line)]/70 pt-1.5">
            <button
              type="button"
              onClick={() => onArticle(article)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
            >
              <FileText size={14} aria-hidden="true" />
              <span>{t('mediaClipsArticle')}</span>
            </button>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={isLiked ? t('unlike') : t('like')}
                aria-pressed={isLiked}
                onClick={() => onLike(article)}
                className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-[var(--control)] ${
                  isLiked ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={isSaved ? t('unbookmark') : t('bookmark')}
                aria-pressed={isSaved}
                onClick={() => onSave(article)}
                className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-[var(--control)] ${
                  isSaved ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={t('share')}
                onClick={() => handleShare(article, media.url)}
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
              >
                <Share2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </li>
    );
  };

  const renderAudioCard = ({ article, media }: MediaEntry) => {
    const isPlayingPersistent = activeAudioUrl === media.url;
    const isPlayingInline = !onPlayAudio && playingUrl === media.url;
    const isPlaying = isPlayingPersistent || isPlayingInline;
    const isLiked = liked.includes(article.id);
    const isSaved = saved.includes(article.id);
    const artwork = article.imageUrl;
    const savedPos = audioPositions[media.url];
    const totalDuration = media.durationSec ?? article.durationSec ?? (savedPos?.duration || undefined);
    const durationText = formatDurationLabel(totalDuration);
    const summaryText = cleanSummaryPreview(article);
    const hasProgress = Boolean(savedPos && savedPos.seconds >= 10);
    const progressPct = hasProgress && totalDuration && totalDuration > 0
      ? Math.min(100, Math.round((savedPos!.seconds / totalDuration) * 100))
      : 0;

    return (
      <li
        key={media.url}
        data-media-url={media.url}
        className={`settings-group media-audio-card flex flex-col justify-between overflow-hidden p-3.5 transition-colors ${
          isPlaying ? 'ring-1 ring-[var(--accent)]/45' : ''
        }`}
      >
        <div className="flex items-start gap-3.5">
          <button
            type="button"
            aria-label={article.title}
            onClick={() => playAudioWithQueue(article, media)}
            className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-slate-900 text-white shadow-sm transition-transform active:scale-95"
          >
            {artwork ? (
              <ArticleImage
                src={artwork}
                alt=""
                sourceShortCode={article.sourceShortCode}
                sourceColor={article.sourceColor}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center">
                <Headphones size={26} aria-hidden="true" />
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/30 transition-colors hover:bg-black/40">
              {isPlaying ? (
                <span className="media-eq" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-black/70 backdrop-blur-sm">
                  <Play size={17} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                </span>
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span className="truncate font-semibold text-[var(--ink)]/85">{article.sourceName}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 tabular-nums">{formatRelative(article.publishedAt)}</span>
              {durationText && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="shrink-0 font-semibold text-[var(--ink)]/75 tabular-nums">{durationText}</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => onArticle(article)}
              className="block text-left text-[15px] font-bold leading-snug text-[var(--ink)] line-clamp-2 [overflow-wrap:anywhere] hover:text-[var(--accent)]"
            >
              {article.title}
            </button>
            {summaryText && (
              <p className="text-xs leading-relaxed text-[var(--muted)] line-clamp-2">
                {summaryText}
              </p>
            )}
            {hasProgress && !isPlaying && (
              <div className="pt-1 space-y-1">
                <p className="text-[11px] font-semibold text-[var(--accent)] tabular-nums">
                  {t('miniPlayerResume', { time: formatAudioClock(savedPos!.seconds) })}
                </p>
                {progressPct > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--control)]">
                    <div className="h-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Single-line clean audio footer */}
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--line)]/70 pt-1.5">
          <button
            type="button"
            onClick={() => playAudioWithQueue(article, media)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition hover:bg-[var(--control)] ${
              isPlaying ? 'text-[var(--accent)]' : 'text-[var(--ink)]'
            }`}
          >
            <Headphones size={14} aria-hidden="true" />
            <span>{isPlaying ? t('mediaNowPlaying') : hasProgress ? copy.resumeEpisode : t('readerListenInApp')}</span>
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={t('openArticle')}
              onClick={() => onArticle(article)}
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
            >
              <FileText size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={isLiked ? t('unlike') : t('like')}
              aria-pressed={isLiked}
              onClick={() => onLike(article)}
              className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-[var(--control)] ${
                isLiked ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={isSaved ? t('unbookmark') : t('bookmark')}
              aria-pressed={isSaved}
              onClick={() => onSave(article)}
              className={`grid h-9 w-9 place-items-center rounded-full transition hover:bg-[var(--control)] ${
                isSaved ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t('share')}
              onClick={() => handleShare(article, media.url)}
              className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] transition hover:bg-[var(--control)] hover:text-[var(--ink)]"
            >
              <Share2 size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isPlayingInline && (
          <div className="mt-3 border-t border-[var(--line)] pt-3">
            <MediaPlayer
              media={media}
              title={article.title}
              background={background}
              autoPlay
              onEngaged={seconds => onEngaged(article, seconds)}
            />
            <TranscriptSummary article={article} config={aiConfig} />
          </div>
        )}
      </li>
    );
  };

  const renderStarterPackGrid = (packs: readonly typeof STARTER_PACKS[number][]) => {
    if (!onApplyStarterPack || packs.length === 0) return null;
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map(pack => (
          <button
            key={pack.id}
            type="button"
            onClick={() => onApplyStarterPack(pack.sourceIds)}
            className="source-pack-card flex flex-col justify-between gap-2.5 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--panel)] p-4 text-left transition hover:border-[var(--accent)]/50"
          >
            <div className="space-y-1">
              <span className="block text-sm font-bold text-[var(--ink)]">
                {pack.label}
              </span>
              <span className="block text-xs leading-relaxed text-[var(--muted)]">
                {pack.subtitle}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t('sourcesStarterApply')}
            </span>
          </button>
        ))}
      </div>
    );
  };

  const hasAnyMedia = allEntries.length > 0;
  const hasSearchQuery = mediaQuery.trim().length > 0;
  const showClipsDialog = filter === 'clips' && clipsPlaylist.length > 0;
  const showEmptyClipsInline = filter === 'clips' && clipsPlaylist.length === 0;
  const showRadioHub = filter === 'radio';
  const showRadioQuickStrip = (filter === 'all' || filter === 'audio') && !hasSearchQuery;
  const showShortsShelf = (filter === 'all' || filter === 'video') && clipsPreview.length > 0;
  const showVideos = (filter === 'all' || filter === 'video') && videoItems.length > 0;
  const showAudio = (filter === 'all' || filter === 'audio') && audioItems.length > 0;
  const showContinueListening = (filter === 'all' || filter === 'audio') && continueListening.length > 0;
  const showSearchEmpty = !showRadioHub && hasAnyMedia && hasSearchQuery && filteredEntries.length === 0;
  const showFormatEmpty =
    !showRadioHub &&
    !showSearchEmpty &&
    filter !== 'clips' &&
    hasAnyMedia &&
    !showShortsShelf &&
    !showVideos &&
    !showAudio;

  return (
    <section aria-labelledby="media-heading" className="screen-entry space-y-6">
      <p role="status" className={shareFeedback ? 'text-sm font-medium text-[var(--accent)]' : 'sr-only'}>
        {shareFeedback}
      </p>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 id="media-heading" className="screen-title">
            {t('mediaTitle')}
          </h1>
          <p className="screen-subtitle">{t('mediaSubtitle')}</p>
        </div>
        {hasAnyMedia && (
          <button
            type="button"
            className="choice-pill inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            onClick={onSources}
          >
            <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{t('mediaManageSources')}</span>
            <span className="sm:hidden">{t('sourcesTitle')}</span>
          </button>
        )}
      </header>

      {/* Primary Segmented Switcher: All | Video | Audio | Clips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="segmented-control sliding-tabs media-tabs"
          role="group"
          aria-label={t('mediaTitle')}
          style={{ '--tab-count': FILTER_KEYS.length, '--tab-index': FILTER_KEYS.indexOf(filter) } as React.CSSProperties}
        >
          <span className="tab-track" aria-hidden="true">
            <span className="tab-selection" />
          </span>
          {FILTER_KEYS.map(key => {
            const count = filterCounts[key];
            return (
              <button
                key={key}
                ref={key === 'clips' ? clipsButtonRef : undefined}
                type="button"
                className="choice-pill whitespace-nowrap"
                aria-pressed={filter === key}
                onClick={() => {
                  if (key === 'clips') {
                    openClipTheater(undefined);
                  } else {
                    setFilter(key);
                    setPlayingUrl(undefined);
                  }
                }}
              >
                <span>{filterLabels[key]}</span>
                {(hasAnyMedia || key === 'radio') && key !== 'all' && count > 0 && (
                  <span className="ml-1 text-[11px] opacity-65 tabular-nums">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Inline Media Search */}
        {(hasAnyMedia || showRadioHub) && (
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={mediaQuery}
              onChange={(e) => setMediaQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="preference-input discover-search-input w-full rounded-full pr-10 text-sm"
            />
            {mediaQuery && (
              <button
                type="button"
                onClick={() => setMediaQuery('')}
                aria-label={t('clear')}
                className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab-Aware Channel Strip */}
      {channels.length > 1 && filter !== 'clips' && filter !== 'radio' && (
        <div
          role="region"
          aria-label={t('sourcesTitle')}
          className="media-stories-strip -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
        >
          <button
            type="button"
            aria-pressed={selectedChannel === null}
            onClick={() => {
              setSelectedChannel(null);
              setPlayingUrl(undefined);
            }}
            className="media-story-btn flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
          >
            <span
              className={`grid h-14 w-14 place-items-center rounded-full border-2 transition-transform active:scale-95 ${
                selectedChannel === null
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-ink)]'
                  : 'border-[var(--line)] bg-[var(--panel)] text-[var(--ink)]'
              }`}
            >
              {filter === 'audio' ? (
                <Headphones className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Film className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <span className="w-full truncate text-[11px] font-semibold text-[var(--ink)]">
              {t('mediaChannelsAll')}
            </span>
          </button>

          {channels.map(channel => {
            const active = selectedChannel === channel.sourceId;
            return (
              <button
                key={channel.sourceId}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setSelectedChannel(active ? null : channel.sourceId);
                  setPlayingUrl(undefined);
                }}
                className="media-story-btn flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full p-0.5 transition-transform active:scale-95 ${
                    active
                      ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--canvas)]'
                      : channel.hasClips && filter !== 'audio'
                        ? 'media-story-ring'
                        : 'ring-1 ring-[var(--line)]'
                  }`}
                >
                  <SourceIcon
                    source={{
                      id: channel.sourceId,
                      shortCode: channel.sourceShortCode,
                      accentColor: channel.sourceColor,
                    }}
                    size="h-12 w-12"
                    rounded="rounded-full"
                  />
                </span>
                <span
                  className={`w-full truncate text-[11px] ${
                    active ? 'font-bold text-[var(--ink)]' : 'font-medium text-[var(--muted)]'
                  }`}
                >
                  {channel.sourceName}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Full-Screen Clips Theater (only opens when playable video clips exist) */}
      {showClipsDialog && (
        <ClipsFeed
          entries={filteredEntries}
          initialUrl={startClipUrl}
          loading={loading}
          liked={liked}
          saved={saved}
          onClose={() => {
            setFilter('all');
            setStartClipUrl(undefined);
            clipsButtonRef.current?.focus({ preventScroll: true });
          }}
          onArticle={onArticle}
          onSources={onSources}
          onLike={onLike}
          onSave={onSave}
          onEngaged={onEngaged}
        />
      )}

      {/* Friendly Inline Empty State for Clips tab when no clips exist */}
      {showEmptyClipsInline && (
        loading ? (
          <ViewStatus title={t('mediaLoading')} />
        ) : (
          <div className="space-y-5 border-t border-[var(--line)] pt-5">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
                {copy.emptyClipsTitle}
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                {copy.emptyClipsHint}
              </p>
            </div>
            {renderStarterPackGrid(selectMediaStarterPacks(STARTER_PACKS, lang, 'clips'))}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="primary-action inline-flex items-center gap-2" onClick={onSources}>
                <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('mediaManageSources')}
              </button>
              {hasAnyMedia && (
                <button type="button" className="choice-pill" onClick={() => setFilter('all')}>
                  {t('mediaFilterAll')}
                </button>
              )}
            </div>
          </div>
        )
      )}

      {/* Global Empty State (no media sources subscribed yet) */}
      {!hasAnyMedia && filter !== 'clips' && filter !== 'radio' && (
        loading ? (
          <ViewStatus title={t('mediaLoading')} />
        ) : (
          <div className="space-y-5 border-t border-[var(--line)] pt-5">
            <div className="space-y-1.5">
              <h2 className="text-xl font-extrabold tracking-tight text-[var(--ink)]">
                {hasActiveSources === false ? t('mediaEmptyNoSources') : t('mediaEmpty')}
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
                {t('mediaStarterHint')}
              </p>
            </div>
            {renderStarterPackGrid(selectMediaStarterPacks(STARTER_PACKS, lang, filter))}
            <div className="pt-1">
              <button type="button" className="primary-action inline-flex items-center gap-2" onClick={onSources}>
                <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('mediaManageSources')}
              </button>
            </div>
          </div>
        )
      )}

      {/* Full Live Radio Hub */}
      {showRadioHub && (
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
            {(
              [
                ['all', copy.radioAll],
                ['dach', copy.radioDach],
                ['international', copy.radioInternational],
                ['favorites', copy.radioFavorites],
              ] as const
            ).map(([groupKey, label]) => (
              <button
                key={groupKey}
                type="button"
                aria-pressed={radioGroup === groupKey}
                onClick={() => setRadioGroup(groupKey)}
                className={`choice-pill ${
                  radioGroup === groupKey ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : ''
                }`}
              >
                {label}
                {groupKey === 'favorites' && radioFavorites.length > 0 && (
                  <span className="ml-1 text-[11px] opacity-75 tabular-nums">{radioFavorites.length}</span>
                )}
              </button>
            ))}
          </div>

          {visibleRadioStations.length === 0 ? (
            <ViewStatus
              title={radioGroup === 'favorites' && !hasSearchQuery ? copy.radioEmptyFavorites : copy.radioSearchEmpty}
              action={
                hasSearchQuery ? (
                  <button type="button" className="choice-pill" onClick={() => setMediaQuery('')}>
                    {copy.clearSearch}
                  </button>
                ) : radioGroup !== 'all' ? (
                  <button type="button" className="choice-pill" onClick={() => setRadioGroup('all')}>
                    {copy.radioAllStations}
                  </button>
                ) : undefined
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRadioStations.map((station) => {
                const isPlaying = activeAudioUrl === station.streamUrl;
                const isFav = radioFavorites.includes(station.id);
                return (
                  <li
                    key={station.id}
                    data-radio-id={station.id}
                    className={`settings-group flex flex-col justify-between gap-3 p-3.5 transition-colors ${
                      isPlaying ? 'ring-1 ring-[var(--accent)]/60' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => triggerRadioStation(station)}
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
                          {isPlaying && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[9.5px] font-extrabold text-white">
                              {copy.liveBadge}
                            </span>
                          )}
                        </div>
                        <h3 className="truncate text-[15px] font-bold text-[var(--ink)]">{station.name}</h3>
                        <p className="line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{station.subtitle}</p>
                      </div>
                      {onToggleRadioFavorite && (
                        <button
                          type="button"
                          onClick={() => onToggleRadioFavorite(station.id)}
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
                        onClick={() => triggerRadioStation(station)}
                        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition ${
                          isPlaying
                            ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                            : 'bg-[var(--control)] text-[var(--ink)] hover:bg-[var(--accent)] hover:text-[var(--accent-ink)]'
                        }`}
                      >
                        {isPlaying ? <Pause size={13} fill="currentColor" aria-hidden="true" /> : <Play size={13} fill="currentColor" aria-hidden="true" />}
                        <span>{isPlaying ? t('mediaNowPlaying') : copy.liveBadge}</span>
                      </button>
                      <a
                        href={station.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                      >
                        <span>{copy.openOriginal}</span>
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Search returned 0 matches */}
      {showSearchEmpty && (
        <ViewStatus
          title={copy.searchNoResults}
          action={
            <button
              type="button"
              className="choice-pill"
              onClick={() => {
                setMediaQuery('');
                setSelectedChannel(null);
              }}
            >
              {copy.clearSearch}
            </button>
          }
        />
      )}

      {/* Contextual Empty State when user switches to Audio or Videos and has 0 sources for THAT format */}
      {showFormatEmpty && (
        <div className="space-y-5 border-t border-[var(--line)] pt-5">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {filter === 'audio' ? copy.emptyAudioTitle : copy.emptyVideoTitle}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-[var(--muted)]">
              {filter === 'audio' ? copy.emptyAudioHint : copy.emptyVideoHint}
            </p>
          </div>
          {renderStarterPackGrid(selectMediaStarterPacks(STARTER_PACKS, lang, filter))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="primary-action inline-flex items-center gap-2"
              onClick={onSources}
            >
              <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t('mediaManageSources')}
            </button>
            <button
              type="button"
              className="choice-pill"
              onClick={() => {
                setSelectedChannel(null);
                setFilter('all');
              }}
            >
              {t('sourcesResetFilters')}
            </button>
          </div>
        </div>
      )}

      {/* Continue Listening Strip ("Weiterhören") */}
      {showContinueListening && (
        <section aria-labelledby="media-continue-heading" className="screen-entry space-y-3">
          <h2 id="media-continue-heading" className="text-lg font-bold tracking-tight text-[var(--ink)]">
            {copy.continueListening}
          </h2>
          <ul className="media-shorts-shelf -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {continueListening.map(({ entry: { article, media }, progressPct, remainingSec, seconds }) => {
              const isPlaying = activeAudioUrl === media.url;
              const remainingMin = Math.max(1, Math.ceil(remainingSec / 60));
              return (
                <li key={media.url} className="w-[17rem] shrink-0 sm:w-[19rem]">
                  <button
                    type="button"
                    onClick={() => playAudioWithQueue(article, media)}
                    className={`settings-group article-card-interactive flex w-full items-center gap-3 p-3 text-left ${
                      isPlaying ? 'ring-1 ring-[var(--accent)]/50' : ''
                    }`}
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-900 text-white">
                      {article.imageUrl ? (
                        <ArticleImage
                          src={article.imageUrl}
                          alt=""
                          sourceShortCode={article.sourceShortCode}
                          sourceColor={article.sourceColor}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="grid h-full w-full place-items-center">
                          <Headphones size={20} aria-hidden="true" />
                        </span>
                      )}
                      <span className="absolute inset-0 grid place-items-center bg-black/30">
                        <Play size={15} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-[11px] font-semibold text-[var(--muted)]">
                        {article.sourceName}
                      </p>
                      <p className="line-clamp-1 text-sm font-bold text-[var(--ink)]">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--control)]">
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="shrink-0 text-[10.5px] font-semibold text-[var(--accent)] tabular-nums">
                          {remainingSec > 0 ? copy.remainingMin(remainingMin) : formatAudioClock(seconds)}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 9:16 Vertical Shorts Preview Shelf */}
      {showShortsShelf && (
        <section aria-labelledby="clips-shelf-heading" className="screen-entry space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="clips-shelf-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {t('mediaShortClips')}
            </h2>
            <button
              type="button"
              className="choice-pill inline-flex items-center gap-1"
              onClick={() => openClipTheater(undefined)}
            >
              {t('mediaAllClips')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <ul className="media-shorts-shelf -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {clipsPreview.slice(0, 12).map(({ article, media }) => (
              <li key={media.url} className="w-[9.75rem] shrink-0 snap-start sm:w-[11.25rem]">
                <button
                  type="button"
                  aria-label={article.title}
                  onClick={() => openClipTheater(media.url)}
                  className="media-short-card group relative block aspect-[9/16] w-full overflow-hidden rounded-[var(--card-radius)] bg-slate-900 text-left text-white shadow-sm"
                >
                  <ArticleImage
                    src={article.imageUrl}
                    alt=""
                    sourceShortCode={article.sourceShortCode}
                    sourceColor={article.sourceColor}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/15"
                  />
                  <span className="absolute top-2.5 right-2.5 grid h-8 w-8 place-items-center rounded-full bg-black/55 backdrop-blur-sm transition-transform group-hover:scale-110">
                    <Play size={14} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 space-y-1 p-3">
                    <div className="flex items-center gap-1.5">
                      <SourceIcon
                        source={{
                          id: article.sourceId,
                          shortCode: article.sourceShortCode,
                          accentColor: article.sourceColor,
                        }}
                        size="h-5 w-5"
                        rounded="rounded-full"
                      />
                      <span className="truncate text-[11px] font-semibold text-white/90">
                        {article.sourceName}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs font-bold leading-snug text-white">
                      {article.title}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Widescreen Video Hub */}
      {showVideos && (
        <section aria-labelledby="media-video-heading" className="screen-entry space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="media-video-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {t('mediaVideoSection')}
            </h2>
            {filter === 'all' && videoItems.length > 6 && (
              <button
                type="button"
                className="choice-pill inline-flex items-center gap-1"
                onClick={() => {
                  setFilter('video');
                  setPlayingUrl(undefined);
                }}
              >
                {t('mediaAllVideo')}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeVideoEntry && renderVideoCard(activeVideoEntry, true)}
            {(filter === 'all' ? videoItems.slice(0, 6) : videoItems.slice(0, videoLimit))
              .filter(({ media }) => media.url !== activeVideoEntry?.media.url)
              .map(entry => renderVideoCard(entry, false))}
          </ul>

          {filter === 'video' && videoItems.length > videoLimit && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                className="choice-pill"
                onClick={() => setVideoLimit(n => n + 12)}
              >
                {copy.showMore} ({videoItems.length - videoLimit})
              </button>
            </div>
          )}
        </section>
      )}

      {/* Audio & Podcasts Hub */}
      {showAudio && (
        <section aria-labelledby="media-audio-heading" className="screen-entry space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="media-audio-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {t('mediaAudioSection')}
            </h2>
            {filter === 'all' && audioItems.length > 4 && (
              <button
                type="button"
                className="choice-pill inline-flex items-center gap-1"
                onClick={() => {
                  setFilter('audio');
                  setPlayingUrl(undefined);
                }}
              >
                {t('mediaAllAudio')}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <ul className="grid gap-3.5 md:grid-cols-2">
            {(filter === 'all' ? audioItems.slice(0, 4) : audioItems.slice(0, audioLimit)).map(entry => renderAudioCard(entry))}
          </ul>

          {filter === 'audio' && audioItems.length > audioLimit && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                className="choice-pill"
                onClick={() => setAudioLimit(n => n + 12)}
              >
                {copy.showMore} ({audioItems.length - audioLimit})
              </button>
            </div>
          )}
        </section>
      )}

      {/* Quick Live Radio Strip in All & Audio Tabs */}
      {showRadioQuickStrip && (
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
              onClick={() => {
                setFilter('radio');
                setPlayingUrl(undefined);
              }}
            >
              {copy.radioAllStations}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>

          <ul className="media-shorts-shelf -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {quickRadioStations.map((station) => {
              const isPlaying = activeAudioUrl === station.streamUrl;
              return (
                <li key={station.id} className="w-[15rem] shrink-0">
                  <button
                    type="button"
                    onClick={() => triggerRadioStation(station)}
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
      )}

      {/* Persistent Media Channel & Pack Discovery Shelf (zero dead-ends!) */}
      {hasAnyMedia && filter !== 'clips' && filter !== 'radio' && !hasSearchQuery && (discoverChannels.length > 0 || contextualPacks.length > 0) && (
        <section aria-labelledby="media-discover-channels-heading" className="space-y-4 border-t border-[var(--line)] pt-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="media-discover-channels-heading" className="text-lg font-bold tracking-tight text-[var(--ink)]">
                {copy.discoverChannels}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{copy.discoverChannelsHint}</p>
            </div>
            <button
              type="button"
              onClick={onSources}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-0.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            >
              {t('discoverAllSources')}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {renderStarterPackGrid(contextualPacks)}

          {onToggleSubscribe && discoverChannels.length > 0 && (
            <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3">
              {discoverChannels.map(src => (
                <div
                  key={src.id}
                  className="source-card flex w-[230px] shrink-0 sm:w-auto items-center justify-between gap-3 rounded-[var(--card-radius)] border p-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <SourceIcon source={src} size="h-9 w-9" rounded="rounded-full" />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[var(--ink)]">{src.name}</h3>
                      <p className="truncate text-[11px] font-medium text-[var(--muted)]">
                        {src.region ? `${src.region} · ` : ''}{categoryLabel(src.category)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleSubscribe(src.id)}
                    aria-label={src.subscribed ? `${src.name}: ${t('discoverFollowing')}` : `${src.name}: ${t('discoverFollow')}`}
                    aria-pressed={src.subscribed}
                    data-active={src.subscribed || undefined}
                    className="source-toggle-btn reaction-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  >
                    {src.subscribed ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}
