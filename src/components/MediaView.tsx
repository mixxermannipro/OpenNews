import { Headphones, Play, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getArticleMedia } from '../lib/articleMedia';
import type { NewsArticle } from '../types/news';
import { ArticleImage } from './ArticleImage';
import { MediaPlayer } from './MediaPlayer';
import { formatRelativeTimeDe } from '../lib/personalization';

const FILTERS = { all: 'Alle', video: 'Videos', audio: 'Audio' } as const;
type MediaFilter = keyof typeof FILTERS;

export function MediaView({ articles, loading, background, onArticle, onSources }: {
  articles: NewsArticle[];
  loading: boolean;
  background: boolean;
  onArticle: (article: NewsArticle) => void;
  onSources: () => void;
}) {
  const [filter, setFilter] = useState<MediaFilter>('all');
  const [selected, setSelected] = useState<string>();
  const entries = useMemo(() => {
    const seen = new Set<string>();
    return articles.flatMap(article => getArticleMedia(article).flatMap(media => {
      if (seen.has(media.url)) return [];
      seen.add(media.url);
      return [{ article, media }];
    }));
  }, [articles]);
  const current = entries.find(entry => entry.media.url === selected);
  const groups = (['video', 'audio'] as const).map(kind => ({
    kind,
    items: entries.filter(({ media }) => kind === 'audio' ? media.type === 'audio' : media.type !== 'audio'),
  })).filter(group => group.items.length && (filter === 'all' || filter === group.kind));
  return (
    <section aria-labelledby="media-heading" className="space-y-5">
      <h1 id="media-heading" className="screen-title">Video &amp; Audio</h1>
      {current && (
        <section aria-label="Aktueller Beitrag" className="settings-group overflow-hidden">
          <div className={current.media.type === 'audio' ? 'px-4 pt-4' : current.media.portrait ? 'mx-auto aspect-[9/16] max-w-[19rem]' : 'aspect-video'}>
            <MediaPlayer key={current.media.url} media={current.media} title={current.article.title}
              poster={current.article.imageUrl} background={background} autoPlay />
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">{current.article.sourceName}</p>
            <h2 className="text-lg font-semibold leading-snug">{current.article.title}</h2>
            <button type="button" className="choice-pill" onClick={() => onArticle(current.article)}>Zum Artikel</button>
          </div>
        </section>
      )}
      <div className="segmented-control" role="group" aria-label="Medien filtern">
        {(Object.keys(FILTERS) as Array<keyof typeof FILTERS>).map(key => (
          <button key={key} type="button" className="choice-pill" aria-pressed={filter === key}
            onClick={() => setFilter(key)}>{FILTERS[key]}</button>
        ))}
      </div>
      {groups.length ? groups.map(({ kind, items }) => (
        <section key={kind} aria-labelledby={`media-${kind}`} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id={`media-${kind}`} className="text-lg font-semibold">{kind === 'audio' ? 'Zum Hören' : 'Zum Ansehen'}</h2>
            {filter === 'all' && items.length > 3 && (
              <button className="choice-pill" type="button" onClick={() => setFilter(kind)}>
                {kind === 'audio' ? 'Alle Audios' : 'Alle Videos'}
              </button>
            )}
          </div>
          <ul className="settings-group divide-y divide-slate-400/20">
          {(filter === 'all' ? items.slice(0, 3) : items).map(({ article, media }) => {
            const Icon = media.type === 'audio' ? Headphones : Video;
            return (
              <li key={media.url}>
                <button type="button" aria-pressed={selected === media.url}
                  onClick={() => {
                    setSelected(media.url);
                    window.scrollTo({ top: 0, behavior: 'instant' });
                  }}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-500/10 sm:gap-4">
                  <span className="relative block h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-500/10">
                    {article.imageUrl && <ArticleImage src={article.imageUrl} alt="" sourceShortCode={article.sourceShortCode}
                      sourceColor={article.sourceColor} className="h-full w-full" />}
                    <span className="absolute bottom-1 right-1 rounded-full bg-black/75 p-1.5 text-white"><Icon size={14} aria-hidden /></span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-slate-600 dark:text-slate-300">
                      {media.type === 'audio' ? 'Audio' : 'Video'} · {article.sourceName} · {formatRelativeTimeDe(article.publishedAt)}
                    </span>
                    <span className="mt-1 block text-sm font-semibold leading-snug sm:text-base">{article.title}</span>
                  </span>
                  <Play size={18} className="shrink-0" aria-hidden />
                </button>
              </li>
            );
          })}
          </ul>
        </section>
      )) : (
        <div className="settings-group space-y-3 p-5">
          <p role="status" className="text-sm">{loading ? 'Beiträge werden geladen …' : 'Hier sind gerade keine passenden Beiträge verfügbar.'}</p>
          {!loading && <button type="button" className="choice-pill" onClick={onSources}>Quellen verwalten</button>}
        </div>
      )}
      {groups.length > 0 && <button type="button" className="choice-pill" onClick={onSources}>Medienquellen verwalten</button>}
    </section>
  );
}
