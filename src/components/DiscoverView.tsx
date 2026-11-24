import { ViewStatus } from './ViewStatus';
import { SourceIcon } from './SourceIcon';
import politicsImage from '../assets/images/news_bundestag_berlin_1794556463691.jpg';
import businessImage from '../assets/images/news_renewable_europe_1794556463653.jpg';
import technologyImage from '../assets/images/news_ai_semiconductor_1794556462965.jpg';
import societyImage from '../assets/images/news_eu_parliament_1794556462855.jpg';
import React, { useMemo, useState } from 'react';
import { BellOff, Check, ChevronDown, ChevronRight, Flame, Plus, Radar, X } from 'lucide-react';
import type { NewsArticle, NewsCategory, NewsSource, PersonalizationProfile } from '../types/news';
import { BentoArticleCard, CompactArticleCard, HeadlineArticleCard, HeroArticleCard } from './ArticleCards';
import { featuredStoryIds } from '../lib/featuredStories';
import { TOPICS } from '../lib/preferences';
import { useI18n } from '../lib/i18n';
import { buildTrendingTopics } from '../lib/localEditorialAI';
import { buildKeywordRadarMatches, type MuteDuration, type MutedKeywordRule } from '../lib/keywordFilter';
import { DiscoverSearch } from './DiscoverSearch';

interface DiscoverViewProps {
  articles: NewsArticle[];
  sources: NewsSource[];
  profile: PersonalizationProfile;
  mutedKeywords: MutedKeywordRule[];
  trackedKeywords: string[];
  onAddMuteKeyword: (keyword: string, duration: MuteDuration) => void;
  onRemoveMuteKeyword: (id: string) => void;
  onAddTrackedKeyword: (keyword: string) => void;
  onRemoveTrackedKeyword: (keyword: string) => void;
  onToggleSubscribe: (sourceId: string) => void;
  onOpenArticle: (article: NewsArticle) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onOpenSourcesSettings: () => void;
}

const DISCOVER_CATEGORIES = ['Alle', ...TOPICS] as const;

const featuredTopics = [
  { topic: 'Politik', image: politicsImage, tint: 'linear-gradient(135deg, #3b2330 0%, #1d2536 100%)' },
  { topic: 'Wirtschaft', image: businessImage, tint: 'linear-gradient(135deg, #1b3a34 0%, #182533 100%)' },
  { topic: 'Technologie', image: technologyImage, tint: 'linear-gradient(135deg, #1d3252 0%, #1d2238 100%)' },
  { topic: 'Gesellschaft', image: societyImage, tint: 'linear-gradient(135deg, #3a2d4a 0%, #1f2536 100%)' },
] as const;

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  articles,
  sources,
  profile,
  mutedKeywords,
  trackedKeywords,
  onAddMuteKeyword,
  onRemoveMuteKeyword,
  onAddTrackedKeyword,
  onRemoveTrackedKeyword,
  onToggleSubscribe,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onOpenSourcesSettings,
}) => {
  const { lang, t, categoryLabel, formatRelative } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NewsCategory>('Alle');
  const [radarInput, setRadarInput] = useState('');
  const [muteInput, setMuteInput] = useState('');
  const [muteDuration, setMuteDuration] = useState<MuteDuration>('7d');
  const [filtersOpen, setFiltersOpen] = useState(() => trackedKeywords.length > 0 || mutedKeywords.length > 0);

  const filtered = useMemo(
    () => category === 'Alle' ? articles : articles.filter(article => article.category === category),
    [articles, category],
  );

  const trendingTopics = useMemo(() => buildTrendingTopics(articles, 5), [articles]);
  const radarMatches = useMemo(
    () => buildKeywordRadarMatches(articles, trackedKeywords, 4),
    [articles, trackedKeywords],
  );

  const hero = filtered[0];
  const bentoLeft = filtered[1];
  const bentoRightTop = filtered[2];
  const bentoRightBottom = filtered[3];
  const moreCards = filtered.slice(4, 12);
  const featured = featuredStoryIds(moreCards.map(lead => ({ lead, reports: [] })), { ranked: false });

  const popularSources = useMemo(() => {
    const localized = sources.filter(s => s.recommended && s.format !== 'podcast' && s.language === lang);
    const others = sources.filter(s => s.recommended && s.format !== 'podcast' && s.language !== lang);
    return [...localized, ...others].slice(0, 8);
  }, [sources, lang]);

  const submitRadar = (event: React.FormEvent) => {
    event.preventDefault();
    if (radarInput.trim().length < 2) return;
    onAddTrackedKeyword(radarInput.trim());
    setRadarInput('');
  };

  const submitMute = (event: React.FormEvent) => {
    event.preventDefault();
    if (muteInput.trim().length < 2) return;
    onAddMuteKeyword(muteInput.trim(), muteDuration);
    setMuteInput('');
  };

  return (
    <section aria-label={t('discoverTitle')} className="screen-entry space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="screen-title">{t('discoverTitle')}</h1>
          <p className="screen-subtitle">{t('discoverSubtitle')}</p>
        </div>
      </div>

      <DiscoverSearch
        articles={articles}
        sources={sources}
        profile={profile}
        query={query}
        onQuery={setQuery}
        onToggleSubscribe={onToggleSubscribe}
        onOpenArticle={onOpenArticle}
        onToggleBookmark={onToggleBookmark}
        onToggleLike={onToggleLike}
      />

      {!query.trim() && (
        <div className="space-y-5">
          {/* Local Story Radar ("Gerade viel besprochen") */}
          {trendingTopics.length > 0 && category === 'Alle' && (
            <section aria-labelledby="discover-trending-heading" className="space-y-3">
              <div className="flex items-center gap-2">
                <Flame size={18} className="text-[var(--accent)]" aria-hidden="true" />
                <h2 id="discover-trending-heading" className="text-lg font-bold tracking-tight text-[var(--ink)]">
                  {t('discoverTrending')}
                </h2>
              </div>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                {trendingTopics.map(topic => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => onOpenArticle(topic.lead)}
                    className="settings-group article-card-interactive flex w-[264px] shrink-0 sm:w-auto flex-col justify-between gap-3 p-4 text-left"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold tracking-wide text-[var(--accent)]">
                          {categoryLabel(topic.category)}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--muted)] tabular-nums">
                          {t('discoverSourcesCount', { count: topic.sourceCount })}
                        </span>
                      </div>
                      <h3 className="line-clamp-3 text-[15px] font-bold leading-snug text-[var(--ink)]">
                        {topic.lead.title}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center -space-x-1.5">
                        {topic.sources.slice(0, 4).map(src => (
                          <span key={src.id} className="rounded-md ring-2 ring-[var(--panel)]">
                            <SourceIcon
                              source={{ id: src.id, shortCode: src.shortCode, accentColor: src.color }}
                              size="h-5 w-5 rounded-[5px] text-[7px]"
                            />
                          </span>
                        ))}
                      </div>
                      <span className="text-[11px] text-[var(--muted)] tabular-nums">
                        {formatRelative(topic.lead.publishedAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Collapsible Keyword Radar & Mute Filter Panel */}
          <details
            className="settings-group cluster-disclosure overflow-hidden"
            open={filtersOpen}
            onToggle={event => setFiltersOpen(event.currentTarget.open)}
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <Radar size={16} className="text-[var(--accent)]" aria-hidden="true" />
                {t('discoverFilterSection')}
                {(trackedKeywords.length > 0 || mutedKeywords.length > 0) && (
                  <span className="text-xs font-medium text-[var(--muted)] tabular-nums">
                    ({trackedKeywords.length + mutedKeywords.length})
                  </span>
                )}
              </span>
              <ChevronDown size={16} className="cluster-chevron text-[var(--muted)]" aria-hidden="true" />
            </summary>

            <div className="grid gap-5 border-t border-[var(--line)] p-4 md:grid-cols-2">
              {/* Tracked Keywords (Stichwort-Radar) */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  <Radar size={13} aria-hidden="true" />
                  <span>{t('discoverRadarTitle')}</span>
                </div>
                <form onSubmit={submitRadar} className="flex gap-2">
                  <input
                    type="text"
                    value={radarInput}
                    onChange={e => setRadarInput(e.target.value)}
                    placeholder={t('discoverRadarPlaceholder')}
                    className="preference-input min-w-0 flex-1 text-sm"
                  />
                  <button type="submit" className="choice-pill shrink-0">
                    {t('discoverRadarAdd')}
                  </button>
                </form>
                {trackedKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {trackedKeywords.map(keyword => (
                      <span
                        key={keyword}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] pl-3 pr-1.5 py-1 text-xs font-semibold text-[var(--ink)]"
                      >
                        {keyword}
                        <button
                          type="button"
                          onClick={() => onRemoveTrackedKeyword(keyword)}
                          aria-label={`${keyword} ${t('sourcesDelete')}`}
                          className="grid h-6 w-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--control)] hover:text-[var(--ink)]"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mute Keywords (Stummschalt-Filter) */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                  <BellOff size={13} aria-hidden="true" />
                  <span>{t('discoverMuteTitle')}</span>
                </div>
                <form onSubmit={submitMute} className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={muteInput}
                      onChange={e => setMuteInput(e.target.value)}
                      placeholder={t('discoverMutePlaceholder')}
                      className="preference-input min-w-0 flex-1 text-sm"
                    />
                    <button type="submit" className="choice-pill shrink-0">
                      {t('discoverMuteAdd')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      ['24h', t('discoverMute24h')],
                      ['7d', t('discoverMute7d')],
                      ['forever', t('discoverMuteForever')],
                    ] as const).map(([dur, label]) => (
                      <button
                        key={dur}
                        type="button"
                        aria-pressed={muteDuration === dur}
                        onClick={() => setMuteDuration(dur)}
                        className="choice-pill min-h-9 px-3 text-xs"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </form>
                {mutedKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {mutedKeywords.map(rule => (
                      <span
                        key={rule.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel-2)] pl-3 pr-1.5 py-1 text-xs font-medium text-[var(--muted)]"
                      >
                        <span className="line-through text-[var(--ink)]">{rule.keyword}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveMuteKeyword(rule.id)}
                          aria-label={`${rule.keyword} ${t('sourcesDelete')}`}
                          className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--control)] hover:text-[var(--ink)]"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Live Keyword Radar Matches */}
            {radarMatches.some(m => m.articles.length > 0) && (
              <div className="space-y-3 border-t border-[var(--line)] p-4">
                {radarMatches
                  .filter(m => m.articles.length > 0)
                  .map(match => (
                    <div key={match.keyword} className="space-y-2">
                      <p className="text-xs font-bold text-[var(--accent)]">
                        #{match.keyword} · {match.articles.length}
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        {match.articles.slice(0, 2).map(article => (
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
                    </div>
                  ))}
              </div>
            )}
          </details>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t('discoverTitle')}>
            {featuredTopics.map(({ topic, image, tint }) => (
              <button
                key={topic}
                type="button"
                className="topic-card article-card-interactive"
                style={{ background: tint }}
                aria-pressed={category === topic}
                onClick={() => setCategory(category === topic ? 'Alle' : topic)}
              >
                <img src={image} alt="" loading="eager" decoding="async" />
                <span>{categoryLabel(topic)}</span>
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label={t('profileTopics')}
            className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
          >
            {DISCOVER_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(cat)}
                  className="choice-pill shrink-0 whitespace-nowrap"
                >
                  {categoryLabel(cat)}
                </button>
              );
            })}
          </div>

          <div className="feed-content space-y-5" key={category}>
            {hero && (
              <HeroArticleCard
                article={hero}
                badgeLabel={t('featuredTopic')}
                isBookmarked={profile.bookmarkedIds.includes(hero.id)}
                isLiked={profile.likedIds.includes(hero.id)}
                onOpen={onOpenArticle}
                onToggleBookmark={onToggleBookmark}
                onToggleLike={onToggleLike}
              />
            )}

            {bentoLeft && (
              <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-3.5">
                <BentoArticleCard
                  article={bentoLeft}
                  tall
                  className="row-span-2"
                  isBookmarked={profile.bookmarkedIds.includes(bentoLeft.id)}
                  isLiked={profile.likedIds.includes(bentoLeft.id)}
                  onOpen={onOpenArticle}
                  onToggleBookmark={onToggleBookmark}
                  onToggleLike={onToggleLike}
                />
                {bentoRightTop && (
                  <BentoArticleCard
                    article={bentoRightTop}
                    isBookmarked={profile.bookmarkedIds.includes(bentoRightTop.id)}
                    isLiked={profile.likedIds.includes(bentoRightTop.id)}
                    onOpen={onOpenArticle}
                    onToggleBookmark={onToggleBookmark}
                    onToggleLike={onToggleLike}
                  />
                )}
                {bentoRightBottom && (
                  <BentoArticleCard
                    article={bentoRightBottom}
                    isBookmarked={profile.bookmarkedIds.includes(bentoRightBottom.id)}
                    isLiked={profile.likedIds.includes(bentoRightBottom.id)}
                    onOpen={onOpenArticle}
                    onToggleBookmark={onToggleBookmark}
                    onToggleLike={onToggleLike}
                  />
                )}
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
                  {t('discoverPopularSources')}
                </h2>
                <button
                  type="button"
                  onClick={onOpenSourcesSettings}
                  className="inline-flex min-h-[44px] items-center gap-0.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                >
                  {t('discoverAllSources')}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 sm:grid sm:grid-cols-4">
                {popularSources.map((src) => (
                  <div
                    key={src.id}
                    data-selected={src.subscribed || undefined}
                    className="source-card flex w-[168px] shrink-0 sm:w-auto flex-col justify-between rounded-[var(--card-radius)] border p-3.5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <SourceIcon source={src} size="h-9 w-9" />
                        <button
                          type="button"
                          onClick={() => onToggleSubscribe(src.id)}
                          aria-label={src.subscribed ? `${src.name}: ${t('discoverFollowing')}` : `${src.name}: ${t('discoverFollow')}`}
                          aria-pressed={src.subscribed}
                          data-active={src.subscribed || undefined}
                          className="source-toggle-btn reaction-btn flex h-11 w-11 items-center justify-center rounded-full"
                        >
                          {src.subscribed ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                        </button>
                      </div>
                      <h3 className="mt-2.5 text-sm font-bold text-[var(--ink)] truncate">
                        {src.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">
                        {src.region ? `${src.region} · ` : ''}{categoryLabel(src.category)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--muted)]">
                        {src.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {moreCards.length > 0 && (
              <div className="space-y-3 pt-1">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
                  {t('homeMore')}
                </h2>
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {moreCards.map(article => {
                    const large = featured.has(article.id);
                    const Card = large ? HeadlineArticleCard : CompactArticleCard;
                    return (
                      <div key={article.id} className={large ? 'md:col-span-2' : undefined}>
                        <Card
                          article={article}
                          isBookmarked={profile.bookmarkedIds.includes(article.id)}
                          isLiked={profile.likedIds.includes(article.id)}
                          onOpen={onOpenArticle}
                          onToggleBookmark={onToggleBookmark}
                          onToggleLike={onToggleLike}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filtered.length === 0 && (
              <ViewStatus
                title={t('discoverEmptyTopic')}
                action={
                  <button type="button" className="choice-pill" onClick={onOpenSourcesSettings}>
                    {t('homeChooseSources')}
                  </button>
                }
              >
                {t('discoverEmptyTopicHint')}
              </ViewStatus>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
