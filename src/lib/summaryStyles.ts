import type { SummaryStyle } from '../types/news';

export const SUMMARY_STYLES = {
  highlights: { label: 'Kernaussagen', instruction: 'Fasse die Kernaussagen neutral auf Deutsch zusammen.', max: 4 },
  'five-w': { label: '5 W-Fragen', instruction: 'Beantworte nach Möglichkeit Wer, Was, Wann, Wo und Warum auf Deutsch. Kennzeichne fehlende Angaben.', max: 5 },
  plain: { label: 'Einfach erklärt', instruction: 'Fasse den Artikel auf Deutsch in B1-Sprache mit kurzen Sätzen zusammen.', max: 4 },
  english: { label: 'Auf Englisch', instruction: 'Fasse den Artikel neutral auf Englisch zusammen.', max: 4 },
} satisfies Record<SummaryStyle, { label: string; instruction: string; max: number }>;

export function resolveSummaryStyle(value: unknown): SummaryStyle {
  return typeof value === 'string' && Object.hasOwn(SUMMARY_STYLES, value) ? value as SummaryStyle : 'highlights';
}
