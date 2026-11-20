import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Clapperboard,
  Compass,
  Globe,
  History,
  Layers,
  Mail,
  Palette,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { PWAInstallButton } from './PWAInstallButton';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFERENCES,
  EDITIONS,
  RETENTION_OPTIONS,
  TOPICS,
  resolveHomeTab,
  resolveRetention,
  type AppPreferences,
  type Edition,
  type HomeTab,
} from '../lib/preferences';
import { APP_LANGUAGES, useI18n, type LanguageSetting } from '../lib/i18n';
import { STARTER_PACKS } from '../lib/catalog';
import { SourceIcon } from './SourceIcon';
import type { NewsCategory, NewsSource, ReaderFontFamily, ReaderFontSize, ThemeMode } from '../types/news';

const SUPPORT_EMAIL = 'mixxermannipropvp@gmail.com';
const PRIVACY_URL = 'https://opennews-app.pages.dev/datenschutz/';
const IMPRINT_URL = 'https://opennews-app.pages.dev/impressum/';
const DiagnosticsSettings = lazy(() => import('./DiagnosticsSettings').then(module => ({ default: module.DiagnosticsSettings })));

interface AppearanceProps {
  theme: ThemeMode;
  onTheme: (theme: ThemeMode) => void;
  preferences: AppPreferences;
  onPreferences: (preferences: AppPreferences) => void;
}

export function PreferenceSelect<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="preference-row preference-select">
      <span>{label}</span>
      <select className="preference-input" value={value} onChange={event => onChange(event.target.value as T)}>
        {Object.entries(options).map(([id, title]) => <option key={id} value={id}>{String(title)}</option>)}
      </select>
    </label>
  );
}

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export function ThemeChoices({ theme, onTheme }: Pick<AppearanceProps, 'theme' | 'onTheme'>) {
  const { t } = useI18n();
  const options: Record<ThemeMode, string> = { system: t('system'), light: t('light'), dark: t('dark') };
  const activeIndex = Math.max(0, THEME_MODES.indexOf(theme));
  return (
    <div
      className="segmented-control sliding-tabs"
      role="group"
      aria-label={t('settingsAppearance')}
      style={{ '--tab-count': THEME_MODES.length, '--tab-index': activeIndex } as React.CSSProperties}
    >
      <span className="tab-track" aria-hidden="true"><span className="tab-selection" /></span>
      {THEME_MODES.map(mode => (
        <button key={mode} type="button" className="choice-pill whitespace-nowrap" aria-pressed={theme === mode} onClick={() => onTheme(mode)}>
          {options[mode]}
        </button>
      ))}
    </div>
  );
}

export function LanguageGrid({ value, onChange }: { value: LanguageSetting; onChange: (lang: LanguageSetting) => void }) {
  const { lang, t } = useI18n();
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-[var(--muted)]">{t('onboardingLangLabel')}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={t('profileLanguage')}>
        {APP_LANGUAGES.map(item => {
          const active = value === item.code || (value === 'system' && lang === item.code);
          return (
            <button
              key={item.code}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.code)}
              className="source-card flex min-h-[48px] items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left"
              data-selected={active || undefined}
            >
              <span className="text-sm font-semibold text-[var(--ink)]">{item.label}</span>
              <span className="text-[11px] font-bold tracking-wider text-[var(--muted)]">{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TopicChoices({ topics, onChange }: { topics: NewsCategory[]; onChange: (topics: NewsCategory[]) => void }) {
  const { t, categoryLabel } = useI18n();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('profileTopics')}>
      {TOPICS.map(topic => (
        <button
          key={topic}
          type="button"
          className="choice-pill"
          aria-pressed={topics.includes(topic)}
          onClick={() => onChange(topics.includes(topic) ? topics.filter(item => item !== topic) : [...topics, topic])}
        >
          {categoryLabel(topic)}
        </button>
      ))}
    </div>
  );
}

export function Appearance({ theme, onTheme, preferences, onPreferences }: AppearanceProps) {
  const { t } = useI18n();
  const languageOptions: Record<LanguageSetting, string> = {
    system: t('settingsLanguageAuto'),
    de: 'Deutsch',
    en: 'English',
    fr: 'Français',
    es: 'Español',
    it: 'Italiano',
    pt: 'Português',
  };
  return (
    <div className="space-y-4">
      <ThemeChoices theme={theme} onTheme={onTheme} />
      <div className="settings-group">
        <PreferenceSelect
          label={t('profileLanguage')}
          value={preferences.language ?? 'system'}
          options={languageOptions}
          onChange={language => onPreferences({ ...preferences, language })}
        />
        <PreferenceSelect label={t('settingsAccent')} value={preferences.accent} options={{ system: 'Neutral', blue: 'Blau', green: 'Grün', violet: 'Violett' }} onChange={accent => onPreferences({ ...preferences, accent })} />
        <PreferenceSelect label={t('settingsGlass')} value={preferences.glass} options={{ subtle: 'Subtle', clear: 'Clear', off: 'Off' }} onChange={glass => onPreferences({ ...preferences, glass })} />
        <PreferenceSelect label={t('settingsCorners')} value={preferences.corners} options={{ small: 'S', medium: 'M', round: 'L' }} onChange={corners => onPreferences({ ...preferences, corners })} />
        <PreferenceSelect label={t('settingsCards')} value={preferences.cards} options={{ balanced: 'Balanced', compact: 'Compact' }} onChange={cards => onPreferences({ ...preferences, cards })} />
        <PreferenceSelect label={t('settingsTextScale')} value={preferences.textScale} options={{ small: 'S', normal: 'M', large: 'L' }} onChange={textScale => onPreferences({ ...preferences, textScale })} />
      </div>
    </div>
  );
}

export type ProfilePage = 'profile' | 'preferences' | 'appearance' | 'feed' | 'reader' | 'motion' | 'playback' | 'privacy' | 'topics' | 'language';

export function ProfileView({ page, onPage, onBack, onSaved, onHistory, onSources, onAI, onNotifications, backupControls, autoTranslate, onAutoTranslate, backgroundPlayback, onBackgroundPlayback, fontSize, fontFamily, onFontSize, onFontFamily, stats, ...appearance }: AppearanceProps & {
  page: ProfilePage;
  onPage: (page: ProfilePage) => void;
  onBack: () => void;
  onSaved: () => void;
  onHistory: () => void;
  onSources: () => void;
  onAI: () => void;
  onNotifications: () => void;
  backupControls: ReactNode;
  autoTranslate: boolean;
  onAutoTranslate: (enabled: boolean) => void;
  backgroundPlayback: boolean;
  onBackgroundPlayback: (enabled: boolean) => void;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  onFontSize: (value: ReaderFontSize) => void;
  onFontFamily: (value: ReaderFontFamily) => void;
  stats?: { sources: number; saved: number; read: number };
}) {
  const { lang, t, homeTabLabel } = useI18n();
  const { preferences, onPreferences } = appearance;
  const activeLanguageLabel = APP_LANGUAGES.find(item => item.code === lang)?.label ?? 'Deutsch';
  const labels: Record<ProfilePage, string> = {
    profile: t('profileTitle'),
    preferences: t('profileSettings'),
    appearance: t('settingsAppearance'),
    feed: t('settingsFeed'),
    reader: t('settingsReader'),
    motion: t('settingsMotion'),
    playback: t('settingsPlayback'),
    privacy: t('settingsPrivacy'),
    topics: t('profileTopics'),
    language: t('profileLanguage'),
  };
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [page]);

  const link = (label: string, icon: ReactNode, action: () => void, meta?: string) => (
    <button type="button" className="preference-row settings-link" onClick={action}>
      {icon}
      <span>{label}</span>
      {meta && <span className="flex-none text-xs font-medium text-[var(--muted)] tabular-nums">{meta}</span>}
      <ChevronRight aria-hidden="true" />
    </button>
  );

  const homeTabOptions: Record<HomeTab, string> = {
    Heute: homeTabLabel('Heute'),
    'Für dich': homeTabLabel('Für dich'),
    Neueste: homeTabLabel('Neueste'),
  };

  return (
    <section key={page} className={page === 'profile' ? 'screen-entry settings-page profile-page' : 'screen-entry settings-page'}>
      {page !== 'profile' && (
        <button className="choice-pill inline-flex w-fit items-center gap-2" onClick={onBack} type="button">
          <ArrowLeft size={16} aria-hidden="true" /> {t('back')}
        </button>
      )}
      <header>
        <h1 ref={title} tabIndex={-1} className="screen-title">{labels[page]}</h1>
        {page === 'profile' && <p className="screen-subtitle">{t('profileSubtitle')}</p>}
      </header>
      {page === 'profile' && <>
        <div className="settings-group profile-intro">
          <span className="profile-avatar"><UserRound aria-hidden="true" /></span>
          <div className="min-w-0 space-y-1">
            <p className="whitespace-pre-line leading-snug">{t('profileTagline')}</p>
            {stats && (
              <p className="text-xs font-medium text-[var(--muted)] tabular-nums">
                {t('profileStats', stats)}
              </p>
            )}
          </div>
        </div>
        <div className="settings-group">
          {link(t('profileSaved'), <Bookmark aria-hidden="true" />, onSaved, stats && stats.saved > 0 ? String(stats.saved) : undefined)}
          {link(t('profileHistory'), <History aria-hidden="true" />, onHistory, stats && stats.read > 0 ? String(stats.read) : undefined)}
        </div>
        <div className="settings-group">
          {link(t('profileSources'), <Layers aria-hidden="true" />, onSources, stats ? String(stats.sources) : undefined)}
          {link(t('profileTopics'), <Compass aria-hidden="true" />, () => onPage('topics'), preferences.topics.length ? String(preferences.topics.length) : undefined)}
          {link(t('profileLanguage'), <Globe aria-hidden="true" />, () => onPage('language'), activeLanguageLabel)}
          {link(t('profileSettings'), <SlidersHorizontal aria-hidden="true" />, () => onPage('preferences'))}
        </div>
        <div className="settings-group">
          <a className="preference-row settings-link" href={`mailto:${SUPPORT_EMAIL}?subject=OpenNews%20Beta`}>
            <Mail aria-hidden="true" /><span>{t('profileContact')}</span><ChevronRight aria-hidden="true" />
          </a>
        </div>
      </>}
      {page === 'language' && (
        <div className="space-y-4">
          <LanguageGrid
            value={preferences.language ?? 'system'}
            onChange={language => onPreferences({ ...preferences, language })}
          />
          <button
            type="button"
            className="choice-pill"
            aria-pressed={(preferences.language ?? 'system') === 'system'}
            onClick={() => onPreferences({ ...preferences, language: 'system' })}
          >
            {t('settingsLanguageAuto')}
          </button>
        </div>
      )}
      {page === 'preferences' && <>
        <button type="button" className="choice-pill" onClick={() => {
          onPreferences({ ...DEFAULT_PREFERENCES, language: preferences.language, topics: preferences.topics });
          appearance.onTheme('system');
          onFontSize('normal');
          onFontFamily('sans');
        }}>{t('settingsApplyRecommended')}</button>
        <div className="settings-group">
          {link(labels.language, <Globe aria-hidden="true" />, () => onPage('language'), activeLanguageLabel)}
          {link(labels.appearance, <Palette aria-hidden="true" />, () => onPage('appearance'))}
          {link(labels.feed, <Layers aria-hidden="true" />, () => onPage('feed'))}
          {link(labels.reader, <BookOpen aria-hidden="true" />, () => onPage('reader'))}
          {link(labels.playback, <Clapperboard aria-hidden="true" />, () => onPage('playback'))}
          {link(labels.motion, <SlidersHorizontal aria-hidden="true" />, () => onPage('motion'))}
        </div>
        <div className="settings-group">
          {link(t('settingsNotifications'), <Bell aria-hidden="true" />, onNotifications)}
          {link(t('settingsAI'), <Sparkles aria-hidden="true" />, onAI)}
          {link(labels.privacy, <ShieldCheck aria-hidden="true" />, () => onPage('privacy'))}
        </div>
        {!Capacitor.isNativePlatform() && <PWAInstallButton />}
      </>}
      {page === 'playback' && (
        <div className="settings-group">
          <label className="preference-row justify-between">
            <span>{t('settingsBgPlayback')}</span>
            <input type="checkbox" role="switch" checked={backgroundPlayback}
              aria-describedby="background-playback-help"
              onChange={event => onBackgroundPlayback(event.target.checked)} />
          </label>
          <p id="background-playback-help" className="px-4 pb-3 text-sm text-[var(--muted)]">
            {t('settingsBgPlaybackHelp')}
          </p>
        </div>
      )}
      {page === 'appearance' && <Appearance {...appearance} />}
      {page === 'feed' && <>
        <div className="settings-group">
          <PreferenceSelect label="Journalistische Voreinstellung" value={preferences.edition ?? 'balanced'}
            options={Object.fromEntries(Object.entries(EDITIONS).map(([key, value]) => [key, value.label])) as Record<Edition, string>}
            onChange={edition => onPreferences({ ...preferences, edition })} />
          <p className="px-4 pb-3 text-sm text-[var(--muted)]">
            {(EDITIONS[preferences.edition] ?? EDITIONS.balanced).description}
          </p>
        </div>
        <div className="settings-group">
          <PreferenceSelect label={t('settingsStartView')} value={resolveHomeTab(preferences.home)}
            options={homeTabOptions} onChange={home => onPreferences({ ...preferences, home })} />
          <label className="preference-row">{t('settingsShowHero')} <input type="checkbox" checked={preferences.hero} onChange={event => onPreferences({ ...preferences, hero: event.target.checked })} /></label>
          <label className="preference-row">{t('settingsShowImages')} <input type="checkbox" checked={preferences.images} onChange={event => onPreferences({ ...preferences, images: event.target.checked })} /></label>
        </div>
        <div className="settings-group">
          <PreferenceSelect label={t('settingsRetention')} value={resolveRetention(preferences.retention)}
            options={RETENTION_OPTIONS}
            onChange={retention => onPreferences({ ...preferences, retention })} />
        </div>
      </>}
      {page === 'reader' && <div className="settings-group">
        <PreferenceSelect label={t('settingsArticleFontSize')} value={fontSize} options={{ normal: 'Standard', large: 'L', xlarge: 'XL' }} onChange={onFontSize} />
        <PreferenceSelect label={t('settingsArticleFont')} value={fontFamily} options={{ sans: 'Sans', serif: 'Serif' }} onChange={onFontFamily} />
        {Capacitor.getPlatform() === 'android' && <>
          <label className="preference-row justify-between">
            Artikel automatisch auf Deutsch lesen
            <input type="checkbox" checked={autoTranslate} onChange={event => onAutoTranslate(event.target.checked)} />
          </label>
        </>}
      </div>}
      {page === 'motion' && <div className="settings-group">
        <PreferenceSelect label={t('settingsAnimations')} value={preferences.motion} options={{ system: t('system'), reduced: 'Reduced' }} onChange={motion => onPreferences({ ...preferences, motion })} />
      </div>}
      {page === 'privacy' && <div className="settings-group p-5 space-y-3 leading-relaxed">
        <p>{t('settingsPrivacyNote1')}</p>
        <p>{t('settingsPrivacyNote2')}</p>
        <p>{t('settingsPrivacyContact')} <a className="break-all underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a className="underline" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{t('settingsPrivacyPolicy')}</a>
          <a className="underline" href={IMPRINT_URL} target="_blank" rel="noopener noreferrer">{t('settingsImprint')}</a>
        </p>
        {backupControls}
        <Suspense fallback={null}><DiagnosticsSettings /></Suspense>
      </div>}
      {page === 'topics' && <TopicChoices topics={preferences.topics} onChange={topics => onPreferences({ ...preferences, topics })} />}
    </section>
  );
}

export function Onboarding({
  sources,
  onToggleSource,
  onSetSourceSubscriptions,
  onFinish,
  onConfigure,
  ...appearance
}: AppearanceProps & {
  sources: NewsSource[];
  onToggleSource: (sourceId: string) => void;
  onSetSourceSubscriptions: (ids: string[], subscribed: boolean) => void;
  onFinish: () => void;
  onConfigure: () => void;
}) {
  const { lang, t, categoryLabel } = useI18n();
  const [step, setStep] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step > 0) title.current?.focus(); }, [step]);
  const { preferences, onPreferences } = appearance;
  const StepIcon = [Globe, Layers, Palette][step];

  const selectedCount = useMemo(
    () => sources.reduce((count, s) => count + (s.subscribed ? 1 : 0), 0),
    [sources],
  );

  const subscribedSet = useMemo(
    () => new Set(sources.filter(s => s.subscribed).map(s => s.id)),
    [sources],
  );

  const onboardingPacks = useMemo(() => {
    return [...STARTER_PACKS]
      .sort((a, b) => (a.language === lang ? -1 : b.language === lang ? 1 : 0))
      .slice(0, 3);
  }, [lang]);

  const suggestedSources = useMemo(() => {
    const primary = sources.filter(s => s.language === lang && s.recommended && s.format !== 'podcast').slice(0, 8);
    if (primary.length >= 6) return primary;
    const fallback = sources.filter(s => s.language === 'en' && s.recommended && s.format !== 'podcast').slice(0, 6 - primary.length);
    return [...primary, ...fallback];
  }, [sources, lang]);

  return (
    <main className="onboarding">
      <div className="flex items-center justify-between gap-4">
        <span className="onboarding-step-icon"><StepIcon size={30} aria-hidden="true" /></span>
        <div className="flex items-center gap-1.5" aria-label={t('onboardingStepAria', { current: step + 1, total: 3 })} role="img">
          {[0, 1, 2].map(index => <span key={index} className="onboarding-progress" data-current={index === step} />)}
        </div>
      </div>

      <div key={step} className="screen-entry space-y-5">
        <div className="space-y-3">
          <p className="text-sm font-bold tracking-wide text-[var(--accent)]">OpenNews</p>
          <h1 ref={title} tabIndex={-1} className="screen-title">
            {[t('onboardingTitle0'), t('onboardingTitle1'), t('onboardingTitle2')][step]}
          </h1>
          <p className="leading-relaxed text-[var(--muted)]">
            {[t('onboardingDesc0'), t('onboardingDesc1'), t('onboardingDesc2')][step]}
          </p>
        </div>

        {step === 0 && (
          <LanguageGrid
            value={preferences.language ?? 'system'}
            onChange={language => onPreferences({ ...preferences, language })}
          />
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--muted)]">{t('sourcesStarterPacks')}</span>
              <span className="text-xs font-bold text-[var(--accent)] tabular-nums">
                {t('onboardingSelectedCount', { count: selectedCount })}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {onboardingPacks.map(pack => {
                const allActive = pack.sourceIds.every(id => subscribedSet.has(id));
                return (
                  <button
                    key={pack.id}
                    type="button"
                    aria-pressed={allActive}
                    data-selected={allActive || undefined}
                    onClick={() => onSetSourceSubscriptions([...pack.sourceIds], !allActive)}
                    className="source-pack-card article-card-interactive flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[var(--ink)]">{pack.label}</p>
                      <p className="truncate text-xs text-[var(--muted)]">{pack.subtitle}</p>
                    </div>
                    <span
                      className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold ${
                        allActive
                          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                          : 'bg-[var(--control)] text-[var(--ink)]'
                      }`}
                    >
                      {allActive ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                      {allActive ? t('sourcesStarterApplied') : pack.sourceIds.length}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {suggestedSources.map(src => (
                <button
                  key={src.id}
                  type="button"
                  aria-pressed={src.subscribed}
                  data-selected={src.subscribed || undefined}
                  onClick={() => onToggleSource(src.id)}
                  className="source-card flex min-h-[54px] items-center justify-between gap-2.5 rounded-2xl border px-3 py-2 text-left"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <SourceIcon source={src} size="h-8 w-8" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[var(--ink)]">{src.name}</p>
                      <p className="truncate text-[11px] text-[var(--muted)]">{categoryLabel(src.category)}</p>
                    </div>
                  </div>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                      src.subscribed
                        ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                        : 'bg-[var(--control)] text-[var(--muted)]'
                    }`}
                  >
                    {src.subscribed ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Plus className="h-3.5 w-3.5" />}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">{t('onboardingAllSourcesHint')}</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <TopicChoices topics={preferences.topics} onChange={topics => onPreferences({ ...preferences, topics })} />
            <ThemeChoices {...appearance} />
            <div className="settings-group space-y-1.5 p-4">
              <p className="text-xs font-bold tracking-wide text-[var(--accent)]">{t('onboardingPreview')}</p>
              <p className="text-xl font-bold tracking-tight">{t('onboardingPreviewTitle')}</p>
              <p className="text-sm text-[var(--muted)]">{t('onboardingPreviewDesc')}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-1">
        <button className="primary-action w-full" type="button" onClick={() => step < 2 ? setStep(step + 1) : onFinish()}>
          {step === 2 ? t('onboardingStart') : t('onboardingNext')} <ArrowRight size={18} aria-hidden="true" />
        </button>
        <div className="flex flex-wrap justify-between gap-2">
          {step > 0 && <button className="choice-pill" type="button" onClick={() => setStep(step - 1)}>{t('back')}</button>}
          <button className="choice-pill" type="button" onClick={step === 2 ? onConfigure : onFinish}>
            {step === 2 ? t('onboardingMoreSettings') : t('onboardingSkip')}
          </button>
        </div>
      </div>
    </main>
  );
}
