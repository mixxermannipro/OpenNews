import { TranscriptSummary } from './TranscriptSummary';
import { ViewStatus } from './ViewStatus';
import { Capacitor, SystemBars } from '@capacitor/core';
import { ArrowLeft, Bookmark, ChevronDown, ChevronRight, ChevronUp, Headphones, Heart, Play, Share2, Video } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { collectDistinctMedia } from '../lib/articleMedia';
import type { AIProviderConfig, NewsArticle } from '../types/news';
import { ArticleImage } from './ArticleImage';
import { MediaPlayer } from './MediaPlayer';
import { shareArticle } from '../lib/shareArticle';
import { formatRelativeTimeDe } from '../lib/personalization';

const FILTERS = { all: 'Alle', video: 'Videos', audio: 'Audio', clips: 'Clips' } as const;
type MediaFilter = keyof typeof FILTERS;

export function MediaView({ aiConfig, articles, loading, background, onArticle, onSources, onLike, onSave, onEngaged, liked, saved }: {
  aiConfig: AIProviderConfig;
  articles: NewsArticle[];
  loading: boolean;
  background: boolean;
  onArticle: (article: NewsArticle) => void;
  onSources: () => void;
  onLike: (article: NewsArticle) => void;
  onSave: (article: NewsArticle) => void;
  onEngaged: (article: NewsArticle, seconds: number) => void;
  liked: string[];
  saved: string[];
}) {
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [selected, setSelected] = useState<string>();
  const [shareFeedback, setShareFeedback] = useState('');
  const dialogExit = useRef<(() => void) | undefined>(undefined);
  const clipsDialog = useRef<HTMLDialogElement>(null);
  const clipsPane = useRef<HTMLUListElement>(null);
  const clipsButton = useRef<HTMLButtonElement>(null);
  const entries = useMemo(() => collectDistinctMedia(articles), [articles]);
  const clips = entries.filter(({ media }) => media.portrait);
  const [startClip, setStartClip] = useState<string>();
  const [clipMuted, setClipMuted] = useState(false);
  const clipIndex = clips.findIndex(({ media }) => media.url === selected);
  const scrollToClip = (index: number) => {
    const pane = clipsPane.current;
    if (pane && index >= 0 && index < clips.length) {
      pane.scrollTo({ top: index * pane.clientHeight, behavior: 'instant' });
    }
  };
  const closeClips = () => {
    setFilter('all');
    setSelected(undefined);
    setStartClip(undefined);
  };

  useEffect(() => {
    if (filter !== 'clips') return;
    const dialog = clipsDialog.current;
    const opener = document.activeElement;
    dialog?.showModal();
    if (Capacitor.isNativePlatform()) void SystemBars.hide().catch(() => {});
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState(window.history.state, '');
    const back = () => {
      closeClips();
      const action = dialogExit.current;
      dialogExit.current = undefined;
      action?.();
    };
    window.addEventListener('popstate', back);
    return () => {
      window.removeEventListener('popstate', back);
      document.body.style.overflow = originalOverflow;
      dialog?.close();
      if (Capacitor.isNativePlatform()) void SystemBars.show().catch(() => {});
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus({ preventScroll: true });
      else clipsButton.current?.focus({ preventScroll: true });
    };
  }, [filter]);

  useEffect(() => {
    if (!startClip || filter !== 'clips') return;
    const pane = clipsPane.current;
    const card = [...(pane?.children ?? [])].find(child => (child as HTMLElement).dataset.mediaUrl === startClip);
    if (card instanceof HTMLElement) {
      pane?.scrollTo({ top: card.offsetTop, behavior: 'instant' });
      setSelected(startClip);
    }
  }, [filter, startClip]);
  useEffect(() => {
    const pane = clipsPane.current;
    if (filter !== 'clips' || !pane) return;
    const observer = new IntersectionObserver(changes => {
      const visible = changes.find(change => change.intersectionRatio >= 0.55);
      if (visible) {
        setSelected((visible.target as HTMLElement).dataset.mediaUrl);
      } else {
        const leaving = new Set(changes.map(change => (change.target as HTMLElement).dataset.mediaUrl));
        setSelected(current => leaving.has(current) ? undefined : current);
      }
    }, { root: pane, threshold: 0.55 });
    for (const card of pane.children) observer.observe(card);
    return () => observer.disconnect();
  }, [filter, entries]);
  const groups = (['video', 'audio'] as const).map(kind => ({
    kind,
    items: entries.filter(({ media }) => kind === 'audio' ? media.type === 'audio' : media.type !== 'audio' && !media.portrait),
  })).filter(group => group.items.length && (filter === 'all' || filter === group.kind));

  const renderCard = ({ article, media }: (typeof entries)[number], clip = false) => {
    const playing = selected === media.url;
    const audio = media.type === 'audio';
    const embeddedClip = clip && playing && media.type === 'youtube';
    const artwork = article.imageUrl;
    const Icon = audio ? Headphones : Video;
    return (
      <li key={media.url} data-media-url={media.url}
        className={clip ? 'relative h-full snap-start snap-always overflow-hidden bg-black text-white' : audio ? 'settings-group media-audio overflow-hidden' : 'overflow-hidden'}>
        <div className={embeddedClip ? 'absolute inset-x-3 top-[calc(4.25rem+env(safe-area-inset-top))] bottom-[var(--clip-caption-height)] bg-black' : clip ? 'absolute inset-0 bg-black' : audio ? 'media-artwork relative overflow-hidden bg-slate-900' : 'relative aspect-[2.1] overflow-hidden rounded-[var(--card-radius)] bg-black'}>
          {playing && !audio ? (
            <MediaPlayer media={media} title={article.title} poster={artwork} background={!clip && background} clip={clip} autoPlay
              muted={clip && clipMuted} onToggleMute={() => setClipMuted(value => !value)} onEngaged={seconds => onEngaged(article, seconds)} />
          ) : (
            <button type="button" aria-label={`${article.title} abspielen`} onClick={() => {
                if (media.portrait && !clip) {
                  setStartClip(media.url);
                  setFilter('clips');
                } else setSelected(media.url);
              }}
              className="absolute inset-0 grid w-full place-items-center text-white">
              {artwork ? <ArticleImage src={artwork} alt="" sourceShortCode={article.sourceShortCode}
                sourceColor={article.sourceColor} className="absolute inset-0 h-full w-full" /> : <Icon size={44} aria-hidden />}
              <span className="relative grid size-12 place-items-center rounded-full border border-white/30 bg-black/75">
                <Play size={24} fill="currentColor" aria-hidden />
              </span>
            </button>
          )}
        </div>
        {playing && audio && <div className="media-audio-player px-4 pt-3"><MediaPlayer media={media} title={article.title} background={background} autoPlay onEngaged={seconds => onEngaged(article, seconds)} /></div>}
        {playing && !clip && <TranscriptSummary article={article} config={aiConfig} />}
        <div className={embeddedClip ? 'absolute inset-x-0 bottom-0 h-[var(--clip-caption-height)] overflow-auto px-4 pt-3 pb-safe space-y-1.5' : clip
          ? 'pointer-events-none absolute inset-x-0 bottom-0 space-y-1.5 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pt-16 pb-[calc(3.5rem+env(safe-area-inset-bottom))] [&_a]:pointer-events-auto [&_button]:pointer-events-auto'
          : audio ? 'min-w-0 space-y-1.5' : 'space-y-1.5 py-3'}>
          <p className={clip ? 'text-xs text-slate-300' : 'text-xs text-slate-600 dark:text-slate-300'}>
            {article.sourceName} · {formatRelativeTimeDe(article.publishedAt)}
          </p>
          <button type="button" className="block text-left text-base font-bold leading-snug [overflow-wrap:anywhere]" onClick={() => {
            if (clip) {
              dialogExit.current = () => onArticle(article);
              window.history.back();
            } else onArticle(article);
          }}>{article.title}</button>
          {playing && media.type === 'youtube' && (
            <a className="text-xs underline" href={article.link} target="_blank" rel="noreferrer">Auf YouTube ansehen</a>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="choice-pill" aria-pressed={liked.includes(article.id)} onClick={() => onLike(article)}>
              <Heart size={16} aria-hidden /> Gefällt mir
            </button>
            <button type="button" className="choice-pill" aria-pressed={saved.includes(article.id)} onClick={() => onSave(article)}>
              <Bookmark size={16} aria-hidden /> Speichern
            </button>
            <button type="button" className="choice-pill" onClick={() => {
              setShareFeedback('');
              void shareArticle(article, article.linkIsFeed ? media.url : article.link).then(copied => {
                if (copied) setShareFeedback('Link kopiert');
              }).catch(error => {
                if (!(error instanceof DOMException && error.name === 'AbortError')) setShareFeedback('Teilen gerade nicht möglich');
              });
            }}>
              <Share2 size={16} aria-hidden /> Teilen
            </button>
          </div>
        </div>
      </li>
    );
  };
  return (
    <section aria-labelledby="media-heading" className="screen-entry space-y-5">
      <p role="status" className={shareFeedback ? "text-sm" : "sr-only"}>{shareFeedback}</p>
      <header>
        <h1 id="media-heading" className="screen-title">Video &amp; Audio</h1>
        <p className="screen-subtitle">Nachrichten in Bild und Ton.</p>
      </header>
      <div className="segmented-control media-tabs" role="group" aria-label="Medien filtern">
        {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map(key => (
          <button key={key} ref={key === 'clips' ? clipsButton : undefined} type="button" className="choice-pill" aria-pressed={filter === key}
            onClick={() => { setFilter(key); setSelected(undefined); }}>{FILTERS[key]}</button>
        ))}
      </div>
      {filter === 'clips' && createPortal(
        <dialog ref={clipsDialog} aria-label="Hochformat-Clips im Vollbild"
          className="clips-dialog fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-black text-white [--clip-caption-height:calc(9rem+env(safe-area-inset-bottom))] [@media(max-height:480px)]:[--clip-caption-height:calc(4rem+env(safe-area-inset-bottom))]"
          onCancel={event => { event.preventDefault(); window.history.back(); }}>
          <button type="button" className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] left-3 z-10 grid size-12 place-items-center rounded-full bg-black/70"
            aria-label="Clips schließen" onClick={() => window.history.back()}><ArrowLeft aria-hidden /></button>
          {clips.length > 1 && (
            <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] left-1/2 z-10 flex -translate-x-1/2 gap-2">
              <button type="button" className="grid size-12 place-items-center rounded-full bg-black/70 disabled:opacity-40"
                aria-label="Vorheriger Clip" disabled={clipIndex <= 0} onClick={() => scrollToClip(clipIndex - 1)}>
                <ChevronUp aria-hidden />
              </button>
              <button type="button" className="grid size-12 place-items-center rounded-full bg-black/70 disabled:opacity-40"
                aria-label="Nächster Clip" disabled={clipIndex >= clips.length - 1} onClick={() => scrollToClip(clipIndex + 1)}>
                <ChevronDown aria-hidden />
              </button>
            </div>
          )}
          {shareFeedback && <p role="status" className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 z-10 rounded-full bg-black/80 px-3 py-2 text-sm">{shareFeedback}</p>}
          {clips.length > 0 ? (
            <ul ref={clipsPane} tabIndex={0} aria-label="Hochformat-Clips"
              className="relative h-full w-full snap-y snap-mandatory overflow-y-auto touch-pan-y overscroll-y-contain">
              {clips.map(entry => renderCard(entry, true))}
            </ul>
          ) : (
            <div className="grid h-full place-content-center gap-4 p-6 text-center">
              <p role="status">{loading ? 'Clips werden geladen …' : 'Gerade sind keine Hochformat-Clips verfügbar.'}</p>
              {!loading && <button type="button" className="choice-pill" onClick={() => { dialogExit.current = onSources; window.history.back(); }}>Quellen verwalten</button>}
            </div>
          )}
        </dialog>,
        document.body,
      )}
      {groups.length ? groups.map(({ kind, items }) => (
        <section key={`${filter}-${kind}`} aria-labelledby={`media-${kind}`} className="screen-entry space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`media-${kind}`} className="text-xl font-bold tracking-tight">{kind === 'audio' ? 'Audio & Podcasts' : 'Jetzt ansehen'}</h2>
            {filter === 'all' && items.length > 1 && (
              <button className="choice-pill" type="button" onClick={() => { setFilter(kind); setSelected(undefined); }}>
                {kind === 'audio' ? 'Alle Audios' : 'Alle Videos'}
              </button>
            )}
          </div>
          <ul className={filter === 'all' ? 'grid gap-4' : kind === 'audio' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'}>
            {(filter === 'all' ? items.slice(0, 1) : items).map(entry => renderCard(entry))}
          </ul>
        </section>
      )) : filter !== 'clips' && !(filter === 'all' && clips.length > 0) && (
        <ViewStatus
          title={loading ? 'Beiträge werden geladen …' : 'Hier sind gerade keine passenden Beiträge verfügbar.'}
          action={!loading && <button type="button" className="choice-pill" onClick={onSources}>Quellen verwalten</button>}
        />
      )}
      {filter === 'all' && clips.length > 0 && (
        <section aria-labelledby="clips-heading" className="screen-entry space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="clips-heading" className="text-xl font-bold tracking-tight">Kurze Clips</h2>
            <button className="choice-pill inline-flex items-center gap-1" type="button"
              onClick={() => { setSelected(undefined); setFilter('clips'); }}>
              Alle Clips <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:gap-3">
            {clips.slice(0, 3).map(({ article, media }) => (
              <li key={media.url} className="min-w-0">
                <button type="button" aria-label={`${article.title} abspielen`}
                  className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[var(--card-radius)] bg-slate-900 text-white"
                  onClick={() => { setStartClip(media.url); setFilter('clips'); }}>
                  <ArticleImage src={article.imageUrl} alt="" sourceShortCode={article.sourceShortCode}
                    sourceColor={article.sourceColor} className="absolute inset-0 h-full w-full" />
                  <span className="relative grid size-11 place-items-center rounded-full bg-black/75">
                    <Play size={18} fill="currentColor" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {groups.length > 0 && <button type="button" className="choice-pill" onClick={onSources}>Medienquellen verwalten</button>}
    </section>
  );
}
