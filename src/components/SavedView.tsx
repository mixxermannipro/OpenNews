import React, { useMemo, useState } from 'react';
import { Bookmark, Heart, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { NewsArticle, NewsSource, PersonalizationProfile } from '../types/news';
import { CompactArticleCard } from './ArticleCards';

interface SavedViewProps {
  initialPage: 'bookmarks' | 'history';
  history: NewsArticle[];
  articles: NewsArticle[];
  sources: NewsSource[];
  profile: PersonalizationProfile;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onResetAlgorithm: () => void;
}

export const SavedView: React.FC<SavedViewProps> = ({
  initialPage,
  history,
  articles,
  sources,
  profile,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onResetAlgorithm,
}) => {
  const [subTab, setSubTab] = useState<'bookmarks' | 'likes' | 'history' | 'algorithm'>(initialPage);

  const bookmarkedArticles = useMemo(
    () => articles.filter((a) => profile.bookmarkedIds.includes(a.id)),
    [articles, profile.bookmarkedIds]
  );

  const likedArticles = useMemo(
    () => articles.filter((a) => profile.likedIds.includes(a.id)),
    [articles, profile.likedIds]
  );

  const topTopics = useMemo(
    () =>
      Object.entries(profile.topicWeights)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1]),
    [profile.topicWeights]
  );

  const topSources = useMemo(
    () =>
      Object.entries(profile.sourceWeights)
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id, w]) => ({
          id,
          name: sources.find((s) => s.id === id)?.name || id,
          weight: w,
        })),
    [profile.sourceWeights, sources]
  );

  const activeList = subTab === 'history' ? history : subTab === 'bookmarks' ? bookmarkedArticles : likedArticles;

  return (
    <section aria-label="Gespeichert und Interessen" className="space-y-5">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
          {subTab === 'history' ? 'Leseverlauf' : 'Gespeichert'}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Deine Leseliste, Likes und dein lokaler Algorithmus
        </p>
      </div>

      {/* Segmented Control */}
      <div className="liquid-glass-subtle flex flex-wrap rounded-2xl p-1 gap-1">
        <button
          type="button"
          onClick={() => setSubTab('bookmarks')}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            subTab === 'bookmarks'
              ? 'bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Gespeichert ({bookmarkedArticles.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('likes')}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            subTab === 'likes'
              ? 'bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <Heart className="h-3.5 w-3.5" />
          Gefällt mir ({likedArticles.length})
        </button>
        <button type="button" className="choice-pill" aria-pressed={subTab === 'history'} onClick={() => setSubTab('history')}>Gelesen</button>
        <button
          type="button"
          onClick={() => setSubTab('algorithm')}
          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition ${
            subTab === 'algorithm'
              ? 'bg-[#2C2F36] text-white shadow-sm dark:bg-white dark:text-slate-950'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Algorithmus
        </button>
      </div>

      {subTab === 'algorithm' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="liquid-glass rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Gelernte Themen-Präferenzen
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                Lesezeit: {Math.floor((profile.totalReadingSeconds || 0) / 60)}m {(profile.totalReadingSeconds || 0) % 60}s
              </span>
            </div>
            {topTopics.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Markiere Artikel mit „Gefällt mir“ oder lies Beiträge länger, damit „Für dich“ deine Lieblingsthemen und Quellen bevorzugt.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topTopics.map(([topic, weight]) => {
                  const secs = profile.readingSecondsByTopic?.[topic] ?? 0;
                  return (
                    <div key={topic} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-800 dark:text-slate-200">{topic}</span>
                        <span className="tabular-nums text-slate-500">
                          +{weight.toFixed(1)} · {secs > 0 ? `${Math.round(secs)}s gelesen` : 'Likes'}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.min(100, weight * 10)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="liquid-glass rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Bevorzugte Anbieter
              </span>
              <button
                type="button"
                onClick={onResetAlgorithm}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-rose-500 hover:bg-rose-500/10"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Zurücksetzen
              </button>
            </div>
            {topSources.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Noch keine Anbieter-Gewichtung gespeichert. Alles wird ausschließlich lokal auf deinem Gerät berechnet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topSources.map((src) => {
                  const secs = profile.readingSecondsBySource?.[src.id] ?? 0;
                  return (
                    <div key={src.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{src.name}</span>
                      <span className="tabular-nums text-blue-600 dark:text-blue-400">
                        +{src.weight.toFixed(1)} · {secs > 0 ? `${Math.round(secs)}s` : 'Likes'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : activeList.length === 0 ? (
        <div className="liquid-glass rounded-3xl p-8 text-center">
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            {subTab === 'history' ? 'Noch keine Artikel gelesen' : subTab === 'bookmarks' ? 'Noch keine gespeicherten Artikel' : 'Noch keine Likes vergeben'}
          </p>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {subTab === 'history' ? 'Hier erscheinen Artikel, die du geöffnet hast.' : subTab === 'bookmarks'
              ? 'Tippe bei einem Artikel auf das Lesezeichen-Symbol, um ihn offline verfügbar zu halten.'
              : 'Tippe auf das Herz-Symbol, um OpenNews beizubringen, welche Themen und Quellen dir gefallen.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {activeList.map((article) => (
            <CompactArticleCard
              key={article.id}
              article={article}
              isBookmarked={profile.bookmarkedIds.includes(article.id)}
              isLiked={profile.likedIds.includes(article.id)}
              onOpen={onOpenArticle}
              onToggleBookmark={onToggleBookmark}
              onToggleLike={onToggleLike}
            />
          ))}
        </div>
      )}
    </section>
  );
};
