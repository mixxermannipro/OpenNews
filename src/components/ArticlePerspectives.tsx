import { useState } from 'react';
import { comparePerspectives } from '../lib/aiClient';
import type { AIProviderConfig, NewsArticle } from '../types/news';

export function ArticlePerspectives({ articles, config }: { articles: NewsArticle[]; config: AIProviderConfig }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof comparePerspectives>>>();

  const compare = async () => {
    setLoading(true);
    setError(false);
    try {
      setReport(await comparePerspectives(articles, config));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
      <button className="choice-pill" type="button" disabled={loading} onClick={() => void compare()}>
        {loading ? 'Perspektiven werden verglichen …' : 'Perspektiven vergleichen'}
      </button>
      <p className="text-sm">Die eingestellte KI erhält die Überschriften und Kurztexte der verglichenen Quellen.</p>
      <div role="status" className="space-y-2 text-sm">
        {error && <p>Der Vergleich ist fehlgeschlagen. Bitte versuche es erneut.</p>}
        {report && <h3 className="font-semibold">KI-Einordnung</h3>}
        {report?.map(({ text, sources }, index) => <div key={index}>
          <p>{text}</p>
          <p className="font-medium">{sources.map(id => articles[id - 1].sourceName).join(' · ')}</p>
        </div>)}
      </div>
    </div>
  );
}
