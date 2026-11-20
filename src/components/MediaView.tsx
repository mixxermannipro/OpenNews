import {
  Bookmark,
  ChevronRight,
  ExternalLink,
  Film,
  Headphones,
  Heart,
  Layers,
  Play,
  Plus,
  Share2,
  Sparkles,
  Video,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { collectDistinctMedia, type PlayableMedia } from '../lib/articleMedia';
import { STARTER_PACKS } from '../lib/catalog';
import { buildClipsPlaylist, extractMediaChannels, type MediaEntry } from '../lib/clipsEngine';
import { useI18n } from '../lib/i18n';
import type { AudioPositionEntry } from '../lib/readerExtras';
import { shareArticle } from '../lib/shareArticle';
import type { AIProviderConfig, NewsArticle } from '../types/news';
import { ArticleImage } from './ArticleImage';
import { ClipsFeed } from './ClipsFeed';
import { MediaPlayer } from './MediaPlayer';
import { formatAudioClock } from './MiniAudioPlayer';
import { SourceIcon } from './SourceIcon';
import { TranscriptSummary } from './TranscriptSummary';
import { ViewStatus } from './ViewStatus';

type MediaFilter = 'all' | 'video' | 'audio' | 'clips';
const FILTER_KEYS: MediaFilter[] = ['all', 'video', 'audio', 'clips'];
const MEDIA_PACK_IDS = new Set(['clips-social', 'video-audio', 'podcasts-daily']);

export function MediaView({
  aiConfig,
  articles,
  hasActiveSources,
  loading,
  background,
  activeAudioUrl,
  audioPositions = {},
  initialClipUrl,
  onClearInitialClip,
  onPlayAudio,
  onArticle,
  onSources,
  onApplyStarterPack,
  onLike,
  onSave,
  onEngaged,
  liked,
  saved,
}: {
  aiConfig: AIProviderConfig;
  articles: NewsArticle[];
  hasActiveSources?: boolean;
  loading: boolean;
  background: boolean;
  activeAudioUrl?: string;
  audioPositions?: Record<string, AudioPositionEntry>;
  initialClipUrl?: string;
  onClearInitialClip?: () => void;
  onPlayAudio?: (article: NewsArticle, media: PlayableMedia) => void;
  onArticle: (article: NewsArticle) => void;
  onSources: () => void;
  onApplyStarterPack?: (sourceIds: readonly string[]) => void;
  onLike: (article: NewsArticle) => void;
  onSave: (article: NewsArticle) => void;
  onEngaged: (article: NewsArticle, seconds: number) => void;
  liked: string[];
  saved: string[];
}) {
  const { t, formatRelative } = useI18n();
  const [filter, setFilter] = useState<MediaFilter>(initialClipUrl ? 'clips' : 'all');
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string>();
  const [startClipUrl, setStartClipUrl] = useState<string | undefined>(initialClipUrl);
  const [shareFeedback, setShareFeedback] = useState('');
  const clipsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (initialClipUrl) {
      setStartClipUrl(initialClipUrl);
      setFilter('clips');
      onClearInitialClip?.();
    }
  }, [initialClipUrl, onClearInitialClip]);

  const allEntries = useMemo(() => collectDistinctMedia(articles), [articles]);
  const channels = useMemo(() => extractMediaChannels(allEntries), [allEntries]);

  const filteredEntries = useMemo(
    () => (selectedChannel ? allEntries.filter(({ article }) => (article.sourceId || article.sourceName) === selectedChannel) : allEntries),
    [allEntries, selectedChannel],
  );

  const clipsPreview = useMemo(() => buildClipsPlaylist(filteredEntries, 'shorts', false).items, [filteredEntries]);
  const videoItems = useMemo(
    () => filteredEntries.filter(({ media }) => media.type !== 'audio' && !media.portrait),
    [filteredEntries],
  );
  const audioItems = useMemo(
    () => filteredEntries.filter(({ media }) => media.type === 'audio'),
    [filteredEntries],
  );

  const mediaStarterPacks = useMemo(
    () => STARTER_PACKS.filter(pack => MEDIA_PACK_IDS.has(pack.id)),
    [],
  );

  const filterLabels: Record<MediaFilter, string> = {
    all: t('mediaFilterAll'),
    video: t('mediaFilterVideo'),
    audio: t('mediaFilterAudio'),
    clips: t('mediaFilterClips'),
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

  const activeVideoEntry = useMemo(
    () => videoItems.find(({ media }) => media.url === playingUrl),
    [videoItems, playingUrl],
  );

  const renderVideoCard = ({ article, media }: MediaEntry, featured = false) => {
    const isPlaying = playingUrl === media.url;
    const isLiked = liked.includes(article.id);
    const isSaved = saved.includes(article.id);
    const artwork = article.imageUrl;

    return (
      <li
        key={media.url}
        data-media-url={media.url}
        className={`media-video-card group overflow-hidden ${featured ? 'sm:col-span-2 lg:col-span-3' : ''}`}
      >
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
              className="absolute inset-0 grid w-full place-items-center text-white"
            >
              {artwork ? (
                <ArticleImage
                  src={artwork}
                  alt=""
                  sourceShortCode={article.sourceShortCode}
                  sourceColor={article.sourceColor}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
              ) : (
                <Video size={40} className="text-white/60" aria-hidden="true" />
              )}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
              />
              <span className="relative grid size-14 place-items-center rounded-full border border-white/25 bg-black/65 backdrop-blur-md transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
                <Play size={24} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>

        {isPlaying && <TranscriptSummary article={article} config={aiConfig} />}

        <div className="mt-3 flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            <SourceIcon
              source={{
                id: article.sourceId,
                shortCode: article.sourceShortCode,
                accentColor: article.sourceColor,
              }}
              size="h-9 w-9"
              rounded="rounded-full"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <button
              type="button"
              onClick={() => onArticle(article)}
              className="block text-left text-[15px] font-bold leading-snug text-[var(--ink)] transition-colors hover:text-[var(--accent)] line-clamp-2 [overflow-wrap:anywhere]"
            >
              {article.title}
            </button>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
              <span className="font-medium text-[var(--ink)]/80">{article.sourceName}</span>
              <span aria-hidden="true">·</span>
              <span>{formatRelative(article.publishedAt)}</span>
              {isPlaying && media.type === 'youtube' && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline hover:text-[var(--ink)]"
                  >
                    {t('mediaWatchYoutube')}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                className="choice-pill"
                aria-pressed={isLiked}
                onClick={() => onLike(article)}
              >
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                {t('like')}
              </button>
              <button
                type="button"
                className="choice-pill"
                aria-pressed={isSaved}
                onClick={() => onSave(article)}
              >
                <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                {t('saveShort')}
              </button>
              <button
                type="button"
                className="choice-pill"
                onClick={() => handleShare(article, media.url)}
              >
                <Share2 size={15} aria-hidden="true" />
                {t('share')}
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

    return (
      <li
        key={media.url}
        data-media-url={media.url}
        className={`settings-group media-audio-card overflow-hidden p-3.5 transition-colors ${
          isPlaying ? 'ring-1 ring-[var(--accent)]/40' : ''
        }`}
      >
        <div className="flex items-start gap-3.5">
          <button
            type="button"
            aria-label={article.title}
            onClick={() => {
              if (onPlayAudio) {
                onPlayAudio(article, media);
              } else {
                setPlayingUrl(isPlayingInline ? undefined : media.url);
              }
            }}
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
                <Headphones size={28} aria-hidden="true" />
              </span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/35">
              {isPlaying ? (
                <span className="media-eq" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <span className="grid size-10 place-items-center rounded-full bg-black/70 backdrop-blur-sm">
                  <Play size={18} fill="currentColor" className="translate-x-0.5" aria-hidden="true" />
                </span>
              )}
            </span>
          </button>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <span className="truncate font-semibold text-[var(--ink)]/85">{article.sourceName}</span>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">{formatRelative(article.publishedAt)}</span>
            </div>
            <button
              type="button"
              onClick={() => onArticle(article)}
              className="block text-left text-[15px] font-bold leading-snug text-[var(--ink)] line-clamp-2 [overflow-wrap:anywhere] hover:text-[var(--accent)]"
            >
              {article.title}
            </button>
            {savedPos && savedPos.seconds >= 5 && !isPlaying && (
              <p className="text-[11px] font-semibold text-[var(--accent)] tabular-nums">
                {t('miniPlayerResume', { time: formatAudioClock(savedPos.seconds) })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                className="choice-pill"
                aria-pressed={isLiked}
                onClick={() => onLike(article)}
              >
                <Heart size={15} fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                {t('like')}
              </button>
              <button
                type="button"
                className="choice-pill"
                aria-pressed={isSaved}
                onClick={() => onSave(article)}
              >
                <Bookmark size={15} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                {t('saveShort')}
              </button>
              <button
                type="button"
                className="choice-pill"
                onClick={() => handleShare(article, media.url)}
              >
                <Share2 size={15} aria-hidden="true" />
                {t('share')}
              </button>
            </div>
          </div>
        </div>

        {isPlayingInline && (
          <div className="mt-3.5 border-t border-[var(--line)] pt-3">
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

  const hasAnyMedia = allEntries.length > 0;
  const showShortsShelf = (filter === 'all' || filter === 'video') && clipsPreview.length > 0;
  const showVideos = (filter === 'all' || filter === 'video') && videoItems.length > 0;
  const showAudio = (filter === 'all' || filter === 'audio') && audioItems.length > 0;
  const showFilteredEmpty = filter !== 'clips' && hasAnyMedia && !showShortsShelf && !showVideos && !showAudio;

  return (
    <section aria-labelledby="media-heading" className="screen-entry space-y-6">
      <p role="status" className={shareFeedback ? 'text-sm font-medium text-[var(--accent)]' : 'sr-only'}>
        {shareFeedback}
      </p>

      <header className="flex items-start justify-between gap-3">
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
      <div
        className="segmented-control sliding-tabs media-tabs"
        role="group"
        aria-label={t('mediaTitle')}
        style={{ '--tab-count': FILTER_KEYS.length, '--tab-index': FILTER_KEYS.indexOf(filter) } as React.CSSProperties}
      >
        <span className="tab-track" aria-hidden="true">
          <span className="tab-selection" />
        </span>
        {FILTER_KEYS.map(key => (
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
            {filterLabels[key]}
          </button>
        ))}
      </div>

      {/* Instagram / YouTube Subscriptions-Style Channel Stories Strip */}
      {channels.length > 1 && filter !== 'clips' && (
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
              <Film className="h-5 w-5" aria-hidden="true" />
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
                      : channel.hasClips
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

      {/* Full-Screen TikTok / Reels / YouTube Shorts Clips Theater */}
      {filter === 'clips' && (
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

      {/* Empty State with Instant 1-Tap Media Starter Packs */}
      {!hasAnyMedia && filter !== 'clips' && (
        loading ? (
          <ViewStatus title={t('mediaLoading')} />
        ) : (
          <div className="settings-group space-y-5 p-6 sm:p-8">
            <div className="space-y-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--control)] text-[var(--ink)]">
                <Film className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-[var(--ink)]">
                {hasActiveSources === false ? t('mediaEmptyNoSources') : t('mediaEmpty')}
              </h2>
              <p className="max-w-lg text-sm leading-relaxed text-[var(--muted)]">
                {t('mediaStarterHint')}
              </p>
            </div>

            {onApplyStarterPack && mediaStarterPacks.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {mediaStarterPacks.map(pack => (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => onApplyStarterPack(pack.sourceIds)}
                    className="source-pack-card flex flex-col justify-between gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-left"
                  >
                    <div className="space-y-1">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
                        <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
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
            )}

            <div className="pt-1">
              <button type="button" className="primary-action inline-flex items-center gap-2" onClick={onSources}>
                <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t('mediaManageSources')}
              </button>
            </div>
          </div>
        )
      )}

      {showFilteredEmpty && (
        <ViewStatus
          title={t('mediaEmpty')}
          action={
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
          }
        />
      )}

      {/* YouTube-Shorts / Instagram-Reels 9:16 Vertical Preview Shelf */}
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

      {/* YouTube-Style Widescreen Video Hub */}
      {showVideos && (
        <section aria-labelledby="media-video-heading" className="screen-entry space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="media-video-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
              {t('mediaVideoSection')}
            </h2>
            {filter === 'all' && videoItems.length > 3 && (
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
            {(filter === 'all' ? videoItems.slice(0, 6) : videoItems)
              .filter(({ media }) => media.url !== activeVideoEntry?.media.url)
              .map(entry => renderVideoCard(entry, false))}
          </ul>
        </section>
      )}

      {/* Spotify / Apple Podcasts-Style Audio Hub */}
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
            {(filter === 'all' ? audioItems.slice(0, 4) : audioItems).map(entry => renderAudioCard(entry))}
          </ul>
        </section>
      )}
    </section>
  );
}
