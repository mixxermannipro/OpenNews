import type { AppLanguage, NewsArticle } from '../types/news';
import { isPromotionalNoise } from './newsFeed';
import { clusterStories } from './storyClusters';

export interface BriefingBullet {
  id: string;
  category: NewsArticle['category'];
  headline: string;
  detail: string;
  sources: string[];
  leadArticle: NewsArticle;
  relatedCount: number;
}

export interface LocalDailyBriefing {
  greeting: string;
  intro: string;
  bullets: BriefingBullet[];
  quickNotes: Array<{ title: string; sourceName: string; article: NewsArticle }>;
  sourceCount: number;
  estimatedMinutes: number;
  spokenScript: string;
}

const GREETINGS: Record<AppLanguage, { morning: string; day: string; evening: string; intro: (stories: number, sources: number) => string; quickPrefix: string }> = {
  de: {
    morning: 'Guten Morgen',
    day: 'Dein Tagesüberblick',
    evening: 'Guten Abend',
    intro: (n, s) => `Die ${n} wichtigsten Entwicklungen aus ${s} deiner Quellen – kompakt zusammengefasst.`,
    quickPrefix: 'Kurz notiert',
  },
  en: {
    morning: 'Good morning',
    day: 'Your daily briefing',
    evening: 'Good evening',
    intro: (n, s) => `The ${n} key developments from ${s} of your sources — distilled for a quick scan.`,
    quickPrefix: 'Also noted',
  },
  fr: {
    morning: 'Bonjour',
    day: 'Votre point du jour',
    evening: 'Bonsoir',
    intro: (n, s) => `Les ${n} faits marquants issus de ${s} de vos sources, résumés en un coup d’œil.`,
    quickPrefix: 'En bref',
  },
  es: {
    morning: 'Buenos días',
    day: 'Tu resumen diario',
    evening: 'Buenas tardes',
    intro: (n, s) => `Las ${n} claves del día según ${s} de tus fuentes, resumidas al instante.`,
    quickPrefix: 'En breve',
  },
  it: {
    morning: 'Buongiorno',
    day: 'Il tuo riepilogo del giorno',
    evening: 'Buonasera',
    intro: (n, s) => `Le ${n} notizie principali da ${s} delle tue fonti, sintetizzate in breve.`,
    quickPrefix: 'In breve',
  },
  pt: {
    morning: 'Bom dia',
    day: 'Seu resumo diário',
    evening: 'Boa noite',
    intro: (n, s) => `Os ${n} principais destaques de ${s} das suas fontes, resumidos de forma direta.`,
    quickPrefix: 'Em resumo',
  },
};

function cleanSentence(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/^[–—•\-:\s]+/, '').trim();
}

function extractDistilledDetail(article: NewsArticle): string {
  const titleNorm = article.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const pool = [article.summary, ...(article.paragraphs ?? []).slice(0, 2)]
    .filter(Boolean)
    .join(' ');
  const sentences = pool
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter(s => s.length >= 28);

  const distinct = sentences.find(sentence => {
    const norm = sentence.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!norm || norm === titleNorm) return false;
    const prefix = titleNorm.slice(0, Math.min(30, titleNorm.length));
    return !(prefix.length >= 16 && norm.startsWith(prefix));
  });

  const best = distinct ?? sentences[0] ?? cleanSentence(article.summary || '');
  if (!best) return '';
  return best.length > 195 ? `${best.slice(0, 192).trim()}…` : best;
}

/**
 * Synthesizes an AI-style structured daily briefing purely on-device with zero external API calls.
 */
export function synthesizeLocalBriefing(
  articles: NewsArticle[],
  lang: AppLanguage = 'de',
  now: Date = new Date(),
  maxBullets = 5,
): LocalDailyBriefing {
  const copy = GREETINGS[lang] ?? GREETINGS.de;
  const hour = now.getHours();
  const greeting = hour < 11 ? copy.morning : hour >= 18 ? copy.evening : copy.day;

  if (!articles.length) {
    return {
      greeting,
      intro: '',
      bullets: [],
      quickNotes: [],
      sourceCount: 0,
      estimatedMinutes: 0,
      spokenScript: '',
    };
  }

  const editorialArticles = articles.filter(article => !isPromotionalNoise(article));
  const pool = editorialArticles.length ? editorialArticles : articles;
  const clusters = clusterStories(pool.slice(0, 40));
  const usedIds = new Set<string>();
  const bullets: BriefingBullet[] = [];
  const usedCategories = new Map<string, number>();

  // Prioritize multi-source & breaking clusters while keeping topic variety balanced
  const scoredClusters = clusters
    .map((cluster, idx) => {
      const uniqueSources = [...new Set(cluster.reports.map(r => r.sourceName))];
      const score =
        (cluster.lead.isBreaking ? 10 : 0) +
        uniqueSources.length * 4 +
        Math.max(0, 12 - idx) * 0.45;
      return { cluster, uniqueSources, score };
    })
    .sort((a, b) => b.score - a.score);

  for (const { cluster, uniqueSources } of scoredClusters) {
    if (bullets.length >= maxBullets) break;
    const catCount = usedCategories.get(cluster.lead.category) ?? 0;
    if (catCount >= 2 && scoredClusters.length > maxBullets + 2) continue;

    usedCategories.set(cluster.lead.category, catCount + 1);
    for (const report of cluster.reports) usedIds.add(report.id);

    const detail = extractDistilledDetail(cluster.lead);
    bullets.push({
      id: cluster.lead.id,
      category: cluster.lead.category,
      headline: cluster.lead.title.trim(),
      detail,
      sources: uniqueSources.slice(0, 4),
      leadArticle: cluster.lead,
      relatedCount: Math.max(0, cluster.reports.length - 1),
    });
  }

  const quickNotes = pool
    .filter(article => !usedIds.has(article.id))
    .slice(0, 3)
    .map(article => ({
      title: article.title.trim(),
      sourceName: article.sourceName,
      article,
    }));

  const uniqueSourceNames = new Set<string>([
    ...bullets.flatMap(b => b.sources),
    ...quickNotes.map(q => q.sourceName),
  ]);

  const intro = copy.intro(bullets.length, Math.max(1, uniqueSourceNames.size));

  const spokenParts = [
    `${greeting}. ${intro}`,
    ...bullets.map((b, i) => {
      const src = b.sources.slice(0, 2).join(', ');
      const body = b.detail && b.detail !== b.headline ? `${b.headline}. ${b.detail}` : b.headline;
      return `${i + 1}. ${src}: ${body}`;
    }),
    ...(quickNotes.length
      ? [`${copy.quickPrefix}: ${quickNotes.map(q => `${q.sourceName}: ${q.title}`).join('. ')}.`]
      : []),
  ];

  const spokenScript = spokenParts.join('\n\n');
  const words = spokenScript.match(/\S+/g)?.length ?? 0;
  const estimatedMinutes = Math.max(1, Math.round(words / 155));

  return {
    greeting,
    intro,
    bullets,
    quickNotes,
    sourceCount: uniqueSourceNames.size,
    estimatedMinutes,
    spokenScript,
  };
}
