import { useState } from 'react';
import type { AIProviderConfig, NewsArticle } from '../types/news';
import { createWeeklyReview } from '../lib/aiClient';

export function WeeklyReview({ articles, config, week }: {
  articles: NewsArticle[]; config: AIProviderConfig; week: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof createWeeklyReview>>>();

  const generate = async () => {
    setLoading(true);
    setError(false);
    try {
      setReport(await createWeeklyReview(articles, config, week));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return <section className="space-y-2 rounded-2xl border border-black/10 p-4 dark:border-white/10">
    <h2 className="font-semibold">Dein Wochenrückblick</h2>
    <p className="text-sm">Die eingestellte KI erhält Überschriften und Kurztexte aus deinen Lesezeichen und Likes der letzten sieben Tage.</p>
    <button className="choice-pill" type="button" onClick={() => void generate()} disabled={loading}>
      {loading ? 'Wochenrückblick wird erstellt …' : 'Wochenrückblick erstellen'}
    </button>
    <div role="status" className="space-y-2 text-sm">
      {error && <p>Der Wochenrückblick konnte nicht erstellt werden.</p>}
      {report && <p className="font-semibold">KI-Zusammenfassung</p>}
      {report?.map(({ text, sources }, index) => <div key={index}>
        <p>{text}</p>
        <p className="font-medium">{[...new Set(sources.map(id => articles[id - 1].sourceName))].join(' · ')}</p>
      </div>)}
    </div>
  </section>;
}
