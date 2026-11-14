import { useState } from 'react';
import type { AIProviderConfig, NewsArticle } from '../types/news';
import { hasCloudAI, summarizeMediaTranscript } from '../lib/aiClient';
import { loadTranscript } from '../lib/mediaTranscript';

export function TranscriptSummary({ article, config }: { article: NewsArticle; config: AIProviderConfig }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);

  const generate = async () => {
    if (!article.transcript) return;
    setLoading(true);
    setError('');
    try {
      const text = await loadTranscript(article.transcript);
      setBullets(await summarizeMediaTranscript(article, text, config));
    } catch {
      setError('Das Transkript konnte nicht geladen oder zusammengefasst werden.');
    } finally {
      setLoading(false);
    }
  };

  if (!article.transcript) return <p className="text-sm">Im Feed ist kein abrufbares Transkript hinterlegt.</p>;
  if (!hasCloudAI(config)) return <p className="text-sm">Für die Transkript-Zusammenfassung brauchst du einen KI-Anbieter.</p>;
  return <section className="space-y-2">
    <button className="choice-pill" type="button" disabled={loading} onClick={() => void generate()}>
      {loading ? 'Zusammenfassung wird erstellt …' : 'Transkript zusammenfassen'}
    </button>
    <p className="text-sm">Die eingestellte KI erhält bis zu 18.000 Zeichen des Transkripts.</p>
    <div role="status" className="text-sm">
      {error && <p>{error}</p>}
      {bullets.length > 0 && <>
        <p className="font-semibold">KI-Zusammenfassung</p>
        <ul className="list-disc ps-5">{bullets.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>
      </>}
    </div>
  </section>;
}
