import { useState } from 'react';
import { askArticleQuestion } from '../lib/aiClient';
import type { ArticleAnswer } from '../lib/aiResponse';
import type { AIProviderConfig, NewsArticle } from '../types/news';

const suggestions = [
  'Um wen oder was geht es?',
  'Welche Zahlen nennt der Artikel?',
  'Was bleibt laut Artikel offen?',
];

export function ArticleQuestions({ article, config, disabled }: {
  article: NewsArticle;
  config: AIProviderConfig;
  disabled: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<{ question: string; answer: ArticleAnswer }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async () => {
    const submitted = question.trim();
    if (!submitted || loading || disabled) return;
    setLoading(true);
    setError('');
    setResult(undefined);
    try {
      setResult({ question: submitted, answer: await askArticleQuestion(article, config, submitted) });
    } catch {
      setError('Die KI konnte die Frage nicht beantworten. Prüfe die KI-Einstellungen oder versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
      <h3 className="font-semibold">Frag den Artikel</h3>
      <p className="text-sm">Die eingestellte KI erhält deine Frage und einen Ausschnitt des Artikeltexts. Je nach Tarif können Kosten anfallen.</p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map(suggestion => (
          <button key={suggestion} className="choice-pill" type="button" onClick={() => setQuestion(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void ask(); }}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Deine Frage
          <input className="choice-pill text-start" maxLength={400} value={question}
            onChange={event => setQuestion(event.target.value)} required />
        </label>
        <button className="choice-pill" type="submit" disabled={loading || disabled || !question.trim()}>
          {loading ? 'Frage wird beantwortet …' : 'Fragen'}
        </button>
      </form>
      <div role="status" className="space-y-2 text-sm">
        {error && <p>{error}</p>}
        {result && <>
          <p className="font-semibold">{result.question}</p>
          <p>{result.answer.answer ?? 'Die Antwort steht nicht im Artikeltext, den die KI erhalten hat.'}</p>
          {result.answer.quote && <blockquote className="border-s-2 border-emerald-500 ps-3">
            „{result.answer.quote}“
            <footer>{article.sourceName}</footer>
          </blockquote>}
        </>}
      </div>
    </div>
  );
}
