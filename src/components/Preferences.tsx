import { ArrowLeft, ArrowRight, Bell, Bookmark, BookOpen, ChevronRight, Compass, History, Layers, Palette, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_PREFERENCES, TOPICS, type AppPreferences } from '../lib/preferences';
import type { NewsCategory, ReaderFontFamily, ReaderFontSize, ThemeMode } from '../types/news';

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
    <label className="preference-row">
      <span>{label}</span>
      <select className="preference-input" value={value} onChange={event => onChange(event.target.value as T)}>
        {Object.entries(options).map(([id, title]) => <option key={id} value={id}>{String(title)}</option>)}
      </select>
    </label>
  );
}

export function ThemeChoices({ theme, onTheme }: Pick<AppearanceProps, 'theme' | 'onTheme'>) {
  const options = { system: 'System', light: 'Hell', dark: 'Dunkel' } as const;
  return (
    <div className="segmented-control" role="group" aria-label="Farbmodus">
      {(Object.keys(options) as ThemeMode[]).map(mode => (
        <button key={mode} type="button" className="choice-pill" aria-pressed={theme === mode} onClick={() => onTheme(mode)}>
          {options[mode]}
        </button>
      ))}
    </div>
  );
}

export function TopicChoices({ topics, onChange }: { topics: NewsCategory[]; onChange: (topics: NewsCategory[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Lieblingsthemen">
      {TOPICS.map(topic => (
        <button key={topic} type="button" className="choice-pill" aria-pressed={topics.includes(topic)}
          onClick={() => onChange(topics.includes(topic) ? topics.filter(item => item !== topic) : [...topics, topic])}>
          {topic}
        </button>
      ))}
    </div>
  );
}

export function Appearance({ theme, onTheme, preferences, onPreferences }: AppearanceProps) {
  return (
    <div className="space-y-4">
      <ThemeChoices theme={theme} onTheme={onTheme} />
      <div className="settings-group">
        <PreferenceSelect label="Akzentfarbe" value={preferences.accent} options={{ system: 'Neutral', blue: 'Blau', green: 'Grün', violet: 'Violett' }} onChange={accent => onPreferences({ ...preferences, accent })} />
        <PreferenceSelect label="Liquid Glass" value={preferences.glass} options={{ subtle: 'Dezent', clear: 'Transparent', off: 'Aus' }} onChange={glass => onPreferences({ ...preferences, glass })} />
        <PreferenceSelect label="Eckenradius" value={preferences.corners} options={{ small: 'Klein', medium: 'Mittel', round: 'Rund' }} onChange={corners => onPreferences({ ...preferences, corners })} />
        <PreferenceSelect label="Kartenstil" value={preferences.cards} options={{ balanced: 'Ausgewogen', compact: 'Kompakt' }} onChange={cards => onPreferences({ ...preferences, cards })} />
        <PreferenceSelect label="Schriftgröße der App" value={preferences.textScale} options={{ small: 'Klein', normal: 'Standard', large: 'Groß' }} onChange={textScale => onPreferences({ ...preferences, textScale })} />
      </div>
    </div>
  );
}

export type ProfilePage = 'profile' | 'preferences' | 'appearance' | 'feed' | 'reader' | 'motion' | 'privacy' | 'topics';

export function ProfileView({ page, onPage, onSaved, onHistory, onSources, onAI, onNotifications, fontSize, fontFamily, onFontSize, onFontFamily, ...appearance }: AppearanceProps & {
  page: ProfilePage;
  onPage: (page: ProfilePage) => void;
  onSaved: () => void;
  onHistory: () => void;
  onSources: () => void;
  onAI: () => void;
  onNotifications: () => void;
  fontSize: ReaderFontSize;
  fontFamily: ReaderFontFamily;
  onFontSize: (value: ReaderFontSize) => void;
  onFontFamily: (value: ReaderFontFamily) => void;
}) {
  const { preferences, onPreferences } = appearance;
  const labels: Record<ProfilePage, string> = {
    profile: 'Profil', preferences: 'Individuelle Einstellungen', appearance: 'Darstellung & Design',
    feed: 'Feed & Startseite', reader: 'Lesen & Artikel', motion: 'Navigation & Bewegung',
    privacy: 'Datenschutz', topics: 'Interessen',
  };
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [page]);

  const link = (label: string, icon: ReactNode, action: () => void) => (
    <button type="button" className="preference-row settings-link" onClick={action}>
      {icon}<span>{label}</span><ChevronRight aria-hidden="true" />
    </button>
  );

  return (
    <section className="settings-page">
      {page !== 'profile' && (
        <button className="choice-pill inline-flex items-center gap-2" onClick={() => onPage(
          ['appearance', 'feed', 'reader', 'motion'].includes(page) ? 'preferences' : 'profile'
        )} type="button"><ArrowLeft size={16} /> Zurück</button>
      )}
      <h1 ref={title} tabIndex={-1} className="screen-title">{labels[page]}</h1>
      {page === 'profile' && <>
        <div className="settings-group">
          {link('Gespeichert', <Bookmark />, onSaved)}
          {link('Leseverlauf', <History />, onHistory)}
        </div>
        <div className="settings-group">
          {link(labels.preferences, <SlidersHorizontal />, () => onPage('preferences'))}
          {link('Benachrichtigungen', <Bell />, onNotifications)}
          {link(labels.topics, <Compass />, () => onPage('topics'))}
          {link('Quellen', <Layers />, onSources)}
          {link(labels.privacy, <ShieldCheck />, () => onPage('privacy'))}
        </div>
      </>}
      {page === 'preferences' && <>
        <button type="button" className="choice-pill" onClick={() => {
          onPreferences({ ...DEFAULT_PREFERENCES, topics: preferences.topics });
          appearance.onTheme('system');
          onFontSize('normal');
          onFontFamily('sans');
        }}>Empfohlene Einstellungen übernehmen</button>
        <div className="settings-group">
          {link(labels.appearance, <Palette />, () => onPage('appearance'))}
          {link(labels.feed, <Layers />, () => onPage('feed'))}
          {link(labels.reader, <BookOpen />, () => onPage('reader'))}
          {link('KI & Personalisierung', <Sparkles />, onAI)}
          {link(labels.motion, <SlidersHorizontal />, () => onPage('motion'))}
        </div>
      </>}
      {page === 'appearance' && <Appearance {...appearance} />}
      {page === 'feed' && <div className="settings-group">
        <PreferenceSelect label="Rubrik beim Start" value={preferences.home} options={{ 'Für dich': 'Für dich', Alle: 'Alle' }} onChange={home => onPreferences({ ...preferences, home })} />
        <label className="preference-row">Großen Aufmacher zeigen <input type="checkbox" checked={preferences.hero} onChange={event => onPreferences({ ...preferences, hero: event.target.checked })} /></label>
        <label className="preference-row">Vorschaubilder im Feed zeigen <input type="checkbox" checked={preferences.images} onChange={event => onPreferences({ ...preferences, images: event.target.checked })} /></label>
      </div>}
      {page === 'reader' && <div className="settings-group">
        <PreferenceSelect label="Textgröße im Artikel" value={fontSize} options={{ normal: 'Standard', large: 'Groß', xlarge: 'Sehr groß' }} onChange={onFontSize} />
        <PreferenceSelect label="Schrift im Artikel" value={fontFamily} options={{ sans: 'Systemschrift', serif: 'Serifenschrift' }} onChange={onFontFamily} />
      </div>}
      {page === 'motion' && <div className="settings-group">
        <PreferenceSelect label="Animationen" value={preferences.motion} options={{ system: 'Wie im System', reduced: 'Reduziert' }} onChange={motion => onPreferences({ ...preferences, motion })} />
      </div>}
      {page === 'privacy' && <div className="settings-group p-5 space-y-3 leading-relaxed">
        <p>Deine Einstellungen, Interessen und Leseliste werden auf diesem Gerät gespeichert.</p>
        <p>Beim Abrufen von Nachrichten verbindet sich OpenNews mit den ausgewählten Quellen. Wenn du eine externe KI verwendest, erhält der Anbieter den Artikeltext für die Analyse.</p>
      </div>}
      {page === 'topics' && <TopicChoices topics={preferences.topics} onChange={topics => onPreferences({ ...preferences, topics })} />}
    </section>
  );
}

export function Onboarding({ onFinish, onConfigure, ...appearance }: AppearanceProps & { onFinish: () => void; onConfigure: () => void }) {
  const [step, setStep] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (step > 0) title.current?.focus(); }, [step]);
  const { preferences, onPreferences } = appearance;

  return (
    <main className="onboarding">
      <img className="onboarding-mark" src="/logo.png" alt="" />
      <div className="space-y-4">
        <p className="text-lg font-semibold">OpenNews</p>
        <h1 ref={title} tabIndex={-1} className="screen-title">{['Deine Nachrichten.', 'Was interessiert dich?', 'Deine Ansicht'][step]}</h1>
        <p className="text-slate-600 dark:text-slate-300">
          {['Lies deine Quellen an einem Ort und richte OpenNews so ein, wie du es magst.', 'Diese Themen bekommen unter „Für dich“ mehr Gewicht.', 'OpenNews übernimmt standardmäßig das Erscheinungsbild deines Geräts.'][step]}
        </p>
      </div>
      {step === 1 && <TopicChoices topics={preferences.topics} onChange={topics => onPreferences({ ...preferences, topics })} />}
      {step === 2 && <Appearance {...appearance} />}
      <div className="space-y-3">
        <button className="primary-action w-full" type="button" onClick={() => step < 2 ? setStep(step + 1) : onFinish()}>
          {step === 2 ? 'Nachrichten öffnen' : 'Weiter'} <ArrowRight size={18} />
        </button>
        <div className="flex flex-wrap justify-between gap-2">
          {step > 0 && <button className="choice-pill" type="button" onClick={() => setStep(step - 1)}>Zurück</button>}
          <button className="choice-pill" type="button" onClick={step === 2 ? onConfigure : onFinish}>
            {step === 2 ? 'Weitere Einstellungen' : 'Einrichtung überspringen'}
          </button>
        </div>
      </div>
    </main>
  );
}
