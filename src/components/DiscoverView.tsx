import React, { useMemo, useState } from 'react';
import { BellOff, Check, ChevronRight, Flame, Plus, Radar, SlidersHorizontal, X } from 'lucide-react';
import politicsImage from '../assets/images/news_bundestag_berlin_1794556463691.webp';
import businessImage from '../assets/images/news_renewable_europe_1794556463653.webp';
import technologyImage from '../assets/images/news_ai_semiconductor_1794556462965.webp';
import europeImage from '../assets/images/news_eu_parliament_1794556462855.webp';
import type { NewsArticle, NewsCategory, NewsSource, PersonalizationProfile } from '../types/news';
import { STARTER_PACKS } from '../lib/catalog';
import { getDiscoverCopy } from '../lib/discoverCopy';
import {
  countDiscoverCategories,
  curateDiscoverFeed,
  selectDiscoverSources,
  selectDiscoverStarterPacks,
  type DiscoverSourceTab,
} from '../lib/discoverEngine';
import { featuredStoryIds } from '../lib/featuredStories';
import { useI18n } from '../lib/i18n';
import { buildKeywordRadarMatches, type MuteDuration, type MutedKeywordRule } from '../lib/keywordFilter';
import { buildTrendingTopics } from '../lib/localEditorialAI';
import { TOPICS } from '../lib/preferences';
import { CompactArticleCard, HeadlineArticleCard } from './ArticleCards';
import { BentoArticleCard, HeroArticleCard } from './DiscoverCards';
import { DiscoverSearch } from './DiscoverSearch';
import { SourceIcon } from './SourceIcon';
import { ViewStatus } from './ViewStatus';
import type { ReadingProgressEntry } from '../lib/readerExtras';

interface DiscoverViewProps {
  articles: NewsArticle[];
  sources: NewsSource[];
  profile: PersonalizationProfile;
  readingQueueIds?: string[];
  readingProgress?: Record<string, ReadingProgressEntry>;
  mutedKeywords: MutedKeywordRule[];
  trackedKeywords: string[];
  onAddMuteKeyword: (keyword: string, duration: MuteDuration) => void;
  onRemoveMuteKeyword: (id: string) => void;
  onAddTrackedKeyword: (keyword: string) => void;
  onRemoveTrackedKeyword: (keyword: string) => void;
  onToggleSubscribe: (sourceId: string) => void;
  onApplyStarterPack?: (sourceIds: readonly string[]) => void;
  onOpenArticle: (article: NewsArticle, contextList?: readonly NewsArticle[]) => void;
  onToggleBookmark: (article: NewsArticle) => void;
  onToggleLike: (article: NewsArticle) => void;
  onToggleQueue?: (article: NewsArticle) => void;
  onOpenSourcesSettings: () => void;
}

const DISCOVER_CATEGORIES = ['Alle', ...TOPICS] as const;

const featuredTopics = [
  { topic: 'Politik', image: politicsImage, tint: 'linear-gradient(135deg, #3b2330 0%, #1d2536 100%)' },
  { topic: 'Wirtschaft', image: businessImage, tint: 'linear-gradient(135deg, #1b3a34 0%, #182533 100%)' },
  { topic: 'Technologie', image: technologyImage, tint: 'linear-gradient(135deg, #1d3252 0%, #1d2238 100%)' },
  { topic: 'Europa', image: europeImage, tint: 'linear-gradient(135deg, #253456 0%, #1c2438 100%)' },
] as const;

type SourceDiscoveryFilter = DiscoverSourceTab | 'packs';

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  articles,
  sources,
  profile,
  readingQueueIds = [],
  readingProgress = {},
  mutedKeywords,
  trackedKeywords,
  onAddMuteKeyword,
  onRemoveMuteKeyword,
  onAddTrackedKeyword,
  onRemoveTrackedKeyword,
  onToggleSubscribe,
  onApplyStarterPack,
  onOpenArticle,
  onToggleBookmark,
  onToggleLike,
  onToggleQueue,
  onOpenSourcesSettings,
}) => {
  const { lang, t, categoryLabel, formatRelative } = useI18n();
  const copy = getDiscoverCopy(lang);
  const bookmarkedSet = useMemo(() => new Set(profile.bookmarkedIds), [profile.bookmarkedIds]);
  const likedSet = useMemo(() => new Set(profile.likedIds), [profile.likedIds]);
  const readSet = useMemo(() => new Set(profile.readIds), [profile.readIds]);
  const queueSet = useMemo(() => new Set(readingQueueIds), [readingQueueIds]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<NewsCategory>('Alle');
  const [sourceTab, setSourceTab] = useState<SourceDiscoveryFilter>('discover');
  const [radarInput, setRadarInput] = useState('');
  const [muteInput, setMuteInput] = useState('');
  const [muteDuration, setMuteDuration] = useState<MuteDuration>('7d');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreLimit, setMoreLimit] = useState(12);

  const categoryCounts = useMemo(() => countDiscoverCategories(articles), [articles]);
  const curated = useMemo(
    () => curateDiscoverFeed(articles, category),
    [articles, category],
  );

  const trendingTopics = useMemo(() => buildTrendingTopics(articles, 6), [articles]);
  const radarMatches = useMemo(
    () => buildKeywordRadarMatches(articles, trackedKeywords, 4),
    [articles, trackedKeywords],
  );
  const activeRadarMatches = useMemo(
    () => radarMatches.filter(match => match.articles.length > 0),
    [radarMatches],
  );

  const spotlightPool = useMemo(() => {
    if (category !== 'Alle' || trendingTopics.length === 0 || curated.length < 10) return curated;
    const trendingIds = new Set(trendingTopics.map(topic => topic.lead.id));
    const fresh = curated.filter(article => !trendingIds.has(article.id));
    const repeated = curated.filter(article => trendingIds.has(article.id));
    return fresh.length >= 6 ? [...fresh, ...repeated] : curated;
  }, [category, trendingTopics, curated]);

  const hero = spotlightPool[0];
  const bentoLeft = spotlightPool[1];
  const bentoRightTop = spotlightPool[2];
  const bentoRightBottom = spotlightPool[3];
  const remainingCards = spotlightPool.slice(4);
  const visibleMoreCards = remainingCards.slice(0, moreLimit);
  const featured = useMemo(
    () => featuredStoryIds(visibleMoreCards.map(lead => ({ lead, reports: [] })), { ranked: false }),
    [visibleMoreCards],
  );

  const subscribedIds = useMemo(
    () => new Set(sources.filter(source => source.subscribed).map(source => source.id)),
    [sources],
  );

  const discoverySources = useMemo(
    () => (sourceTab === 'packs'
      ? []
      : selectDiscoverSources(sources, lang, sourceTab, category, 8)),
    [sources, lang, sourceTab, category],
  );

  const starterPacks = useMemo(
    () => selectDiscoverStarterPacks(STARTER_PACKS, lang, subscribedIds),
    [lang, subscribedIds],
  );

  const ruleCount = trackedKeywords.length + mutedKeywords.length;

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

  const handleSelectCategory = (next: NewsCategory) => {
    setCategory(next);
    setMoreLimit(12);
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
        trackedKeywords={trackedKeywords}
        onAddTrackedKeyword={onAddTrackedKeyword}
        onToggleSubscribe={onToggleSubscribe}
        onOpenArticle={onOpenArticle}
        onToggleBookmark={onToggleBookmark}
        onToggleLike={onToggleLike}
        radarToggle={
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-pressed={filtersOpen}
            onClick={() => setFiltersOpen(prev => !prev)}
            className="choice-pill inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span className="hidden sm:inline">{t('discoverFilterSection')}</span>
            {ruleCount > 0 && (
              <span className="text-[11px] font-bold opacity-80 tabular-nums">({ruleCount})</span>
            )}
          </button>
        }
      />

      {!query.trim() && (
        <div className="space-y-6">
          {/* Collapsible Keyword Radar & Mute Filter Drawer (opens on demand via top button) */}
          {filtersOpen && (
            <div className="settings-group overflow-hidden">
              <div className="grid gap-5 p-4 md:grid-cols-2">
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
            </div>
          )}

          {/* Clean Broadsheet Ressort Rail with Quiet Tabular Counts (single canonical category navigation) */}
          <div
            role="group"
            aria-label={t('profileTopics')}
            className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
          >
            {DISCOVER_CATEGORIES.map((cat) => {
              const active = category === cat;
              const count = categoryCounts[cat] ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectCategory(cat)}
                  className="choice-pill shrink-0 whitespace-nowrap"
                >
                  <span>{categoryLabel(cat)}</span>
                  {count > 0 && cat !== 'Alle' && (
                    <span className="ml-1 text-[11px] opacity-65 tabular-nums">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Keyword Radar Matches (always visible when user tracks keywords with live matches!) */}
          {activeRadarMatches.length > 0 && category === 'Alle' && (
            <section aria-labelledby="discover-radar-matches-heading" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Radar size={16} className="text-[var(--accent)]" aria-hidden="true" />
                  <h2 id="discover-radar-matches-heading" className="text-base font-bold tracking-tight text-[var(--ink)]">
                    {copy.radarActiveMatches}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  {t('sourcesEdit')}
                </button>
              </div>
              <div className="space-y-3">
                {activeRadarMatches.slice(0, 3).map(match => (
                  <div key={match.keyword} className="space-y-2">
                    <p className="text-xs font-bold text-[var(--accent)] tabular-nums">
                      #{match.keyword} · {match.articles.length}
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      {match.articles.slice(0, 2).map(article => (
                        <CompactArticleCard
                          key={article.id}
                          article={article}
                          isBookmarked={bookmarkedSet.has(article.id)}
                          isLiked={likedSet.has(article.id)}
                          inQueue={queueSet.has(article.id)}
                          isRead={readSet.has(article.id)}
                          readingProgress={readingProgress[article.id]?.ratio}
                          onOpen={item => onOpenArticle(item, match.articles)}
                          onToggleBookmark={onToggleBookmark}
                          onToggleLike={onToggleLike}
                          onToggleQueue={onToggleQueue}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Immediate Above-the-Fold Multi-Source Story Radar ("Gerade viel besprochen") */}
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
                    onClick={() => onOpenArticle(topic.lead, trendingTopics.map(entry => entry.lead))}
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

          {/* Source-Diversified Editorial Spotlight & Bento */}
          <div className="feed-content space-y-6" key={category}>
            {hero && (
              <HeroArticleCard
                article={hero}
                badgeLabel={category === 'Alle' ? t('featuredTopic') : categoryLabel(category)}
                isBookmarked={bookmarkedSet.has(hero.id)}
                isLiked={likedSet.has(hero.id)}
                inQueue={queueSet.has(hero.id)}
                isRead={readSet.has(hero.id)}
                readingProgress={readingProgress[hero.id]?.ratio}
                onOpen={item => onOpenArticle(item, spotlightPool)}
                onToggleBookmark={onToggleBookmark}
                onToggleLike={onToggleLike}
                onToggleQueue={onToggleQueue}
              />
            )}

            {bentoLeft && (
              <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-3.5">
                <BentoArticleCard
                  article={bentoLeft}
                  tall
                  className="row-span-2"
                  isBookmarked={bookmarkedSet.has(bentoLeft.id)}
                  isLiked={likedSet.has(bentoLeft.id)}
                  inQueue={queueSet.has(bentoLeft.id)}
                  isRead={readSet.has(bentoLeft.id)}
                  readingProgress={readingProgress[bentoLeft.id]?.ratio}
                  onOpen={item => onOpenArticle(item, spotlightPool)}
                  onToggleBookmark={onToggleBookmark}
                  onToggleLike={onToggleLike}
                  onToggleQueue={onToggleQueue}
                />
                {bentoRightTop && (
                  <BentoArticleCard
                    article={bentoRightTop}
                    isBookmarked={bookmarkedSet.has(bentoRightTop.id)}
                    isLiked={likedSet.has(bentoRightTop.id)}
                    inQueue={queueSet.has(bentoRightTop.id)}
                    isRead={readSet.has(bentoRightTop.id)}
                    readingProgress={readingProgress[bentoRightTop.id]?.ratio}
                    onOpen={item => onOpenArticle(item, spotlightPool)}
                    onToggleBookmark={onToggleBookmark}
                    onToggleLike={onToggleLike}
                    onToggleQueue={onToggleQueue}
                  />
                )}
                {bentoRightBottom && (
                  <BentoArticleCard
                    article={bentoRightBottom}
                    isBookmarked={bookmarkedSet.has(bentoRightBottom.id)}
                    isLiked={likedSet.has(bentoRightBottom.id)}
                    inQueue={queueSet.has(bentoRightBottom.id)}
                    isRead={readSet.has(bentoRightBottom.id)}
                    readingProgress={readingProgress[bentoRightBottom.id]?.ratio}
                    onOpen={item => onOpenArticle(item, spotlightPool)}
                    onToggleBookmark={onToggleBookmark}
                    onToggleLike={onToggleLike}
                    onToggleQueue={onToggleQueue}
                  />
                )}
              </div>
            )}

            {/* Compact Editorial Themenwelten Band (below Spotlight when viewing Alle) */}
            {category === 'Alle' && (
              <section aria-label={copy.themenwelten} className="space-y-3">
                <h2 className="text-lg font-bold tracking-tight text-[var(--ink)]">
                  {copy.themenwelten}
                </h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {featuredTopics.map(({ topic, image, tint }) => {
                    const count = categoryCounts[topic] ?? 0;
                    return (
                      <button
                        key={topic}
                        type="button"
                        className="topic-card article-card-interactive !min-h-[92px]"
                        style={{ background: tint }}
                        onClick={() => handleSelectCategory(topic)}
                      >
                        <img src={image} alt="" loading="lazy" decoding="async" />
                        <span className="flex w-full items-baseline justify-between gap-2">
                          <span>{categoryLabel(topic)}</span>
                          {count > 0 && (
                            <span className="text-xs font-semibold text-white/80 tabular-nums">{count}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Upgraded "Neue Quellen & Perspektiven" Discovery Hub (Unsubscribed-First + Tabs) */}
            <section aria-labelledby="discover-sources-heading" className="space-y-3.5 border-t border-[var(--line)] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="discover-sources-heading" className="text-xl font-bold tracking-tight text-[var(--ink)]">
                  {category === 'Alle'
                    ? copy.discoverSourcesTitle
                    : copy.discoverSourcesForTopic(categoryLabel(category))}
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

              <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label={copy.discoverSourcesTitle}>
                {([
                  ['discover', copy.sourceTabNew],
                  ['international', copy.sourceTabInternational],
                  ['media', copy.sourceTabMedia],
                  ...(onApplyStarterPack ? [['packs', copy.sourceTabPacks] as const] : []),
                ] as const).map(([tabKey, label]) => (
                  <button
                    key={tabKey}
                    type="button"
                    aria-pressed={sourceTab === tabKey}
                    onClick={() => setSourceTab(tabKey)}
                    className="choice-pill min-h-9 shrink-0 whitespace-nowrap px-3.5 text-xs"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sourceTab === 'packs' && onApplyStarterPack ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {starterPacks.map(pack => {
                    const allActive = pack.newCount === 0;
                    return (
                      <button
                        key={pack.id}
                        type="button"
                        disabled={allActive}
                        onClick={() => onApplyStarterPack(pack.sourceIds)}
                        className="source-pack-card flex flex-col justify-between gap-2.5 rounded-[var(--card-radius)] border border-[var(--line)] bg-[var(--panel)] p-4 text-left transition hover:border-[var(--accent)]/50 disabled:opacity-65"
                      >
                        <div className="space-y-1">
                          <span className="block text-sm font-bold text-[var(--ink)]">
                            {pack.label}
                          </span>
                          <span className="block text-xs leading-relaxed text-[var(--muted)]">
                            {pack.subtitle}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] tabular-nums">
                          {allActive ? (
                            <>
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              {copy.packAllActive}
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              {copy.packNewSources(pack.newCount)}
                            </>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2 sm:grid sm:grid-cols-4">
                  {discoverySources.map((src) => (
                    <div
                      key={src.id}
                      data-selected={src.subscribed || undefined}
                      className="source-card flex w-[176px] shrink-0 sm:w-auto flex-col justify-between rounded-[var(--card-radius)] border p-3.5"
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
                            {src.subscribed ? (
                              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                            ) : (
                              <Plus className="h-4 w-4" aria-hidden="true" />
                            )}
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
              )}
            </section>

            {/* Paginated Source-Diversified "Weitere Meldungen" */}
            {visibleMoreCards.length > 0 && (
              <div className="space-y-3 pt-1">
                <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
                  {t('homeMore')}
                </h2>
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  {visibleMoreCards.map(article => {
                    const large = featured.has(article.id);
                    const Card = large ? HeadlineArticleCard : CompactArticleCard;
                    return (
                      <div key={article.id} className={large ? 'md:col-span-2' : undefined}>
                        <Card
                          article={article}
                          isBookmarked={bookmarkedSet.has(article.id)}
                          isLiked={likedSet.has(article.id)}
                          inQueue={queueSet.has(article.id)}
                          isRead={readSet.has(article.id)}
                          readingProgress={readingProgress[article.id]?.ratio}
                          onOpen={item => onOpenArticle(item, spotlightPool)}
                          onToggleBookmark={onToggleBookmark}
                          onToggleLike={onToggleLike}
                          onToggleQueue={onToggleQueue}
                        />
                      </div>
                    );
                  })}
                </div>
                {remainingCards.length > moreLimit && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      className="choice-pill"
                      onClick={() => setMoreLimit(n => n + 12)}
                    >
                      {copy.loadMore} ({remainingCards.length - moreLimit})
                    </button>
                  </div>
                )}
              </div>
            )}

            {curated.length === 0 && (
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
