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
    <div className="space-y-2.5 border-t border-[var(--line)] pt-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {articles.map(item => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--ink)]"
          >
            {item.sourceName}
          </span>
        ))}
      </div>
      <button className="choice-pill" type="button" disabled={loading} onClick={() => void compare()}>
        {loading ? 'Perspektiven werden verglichen …' : 'Perspektiven vergleichen'}
      </button>
      <p className="text-xs text-[var(--muted)]">
        Die eingestellte KI vergleicht Schwerpunkte und Wortwahl der beteiligten Quellen – auch sprachübergreifend.
      </p>
      <div role="status" className="space-y-2.5 text-sm">
        {error && <p>Der Vergleich ist fehlgeschlagen. Bitte versuche es erneut.</p>}
        {report && <h3 className="font-semibold">KI-Einordnung</h3>}
        {report?.map(({ text, sources }, index) => {
          const labels = sources
            .map(id => articles[id - 1]?.sourceName)
            .filter((name): name is string => Boolean(name));
          return (
            <div key={index} className="space-y-0.5 rounded-xl bg-[var(--panel-2)] p-3">
              <p className="leading-relaxed">{text}</p>
              {labels.length > 0 && (
                <p className="text-xs font-medium text-[var(--muted)]">{labels.join(' · ')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
