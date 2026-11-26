import type { AppLanguage } from '../types/news';

export interface ReaderCopy {
  resumeReading: (pct: number) => string;
  backToTop: string;
  prevArticle: string;
  nextArticle: string;
  chaptersLabel: (count: number) => string;
  paywallTitle: string;
  paywallDesc: string;
  paywallAlternativesTitle: string;
  paywallReadInApp: string;
  paywallSearchMore: string;
  paywallOpenSource: string;
  onLabel: string;
  offLabel: string;
  offlineRemoved: string;
  offlineSavedFull: string;
  offlineSavedText: string;
  offlineError: string;
  briefingMiniTitle: string;
  briefingPointProgress: (current: number, total: number) => string;
  briefingPrevPoint: string;
  briefingNextPoint: string;
  briefingOpenDialog: string;
  briefingReadStory: string;
  briefingBackgroundHint: string;
  briefingIntroLabel: string;
  briefingQuickNotesLabel: string;
  briefingAiLabel: string;
}

const COPY: Record<AppLanguage, ReaderCopy> = {
  de: {
    resumeReading: pct => `Weiterlesen ab ${pct} %`,
    backToTop: 'Zum Anfang',
    prevArticle: 'Vorheriger Artikel',
    nextArticle: 'Nächster Artikel',
    chaptersLabel: count => `Abschnitte (${count})`,
    paywallTitle: 'Nur gekürzte Vorschau verfügbar',
    paywallDesc: 'Diese Quelle stellt den Volltext nicht frei bereit oder nutzt eine Bezahlschranke.',
    paywallAlternativesTitle: 'Freie Alternativen zum selben Thema',
    paywallReadInApp: 'Im Reader öffnen',
    paywallSearchMore: 'Weitere Quellen suchen',
    paywallOpenSource: 'Bei der Quelle öffnen',
    onLabel: 'An',
    offLabel: 'Aus',
    offlineRemoved: 'Offline-Kopie entfernt.',
    offlineSavedFull: 'Text und Bild offline verfügbar.',
    offlineSavedText: 'Text offline verfügbar.',
    offlineError: 'Offline-Kopie konnte nicht gespeichert oder entfernt werden.',
    briefingMiniTitle: 'Tagesüberblick',
    briefingPointProgress: (current, total) => `Punkt ${current} von ${total}`,
    briefingPrevPoint: 'Vorheriger Punkt',
    briefingNextPoint: 'Nächster Punkt',
    briefingOpenDialog: 'Tagesüberblick öffnen',
    briefingReadStory: 'Artikel öffnen',
    briefingBackgroundHint: 'Läuft beim Schließen im Mini-Player weiter.',
    briefingIntroLabel: 'Einleitung',
    briefingQuickNotesLabel: 'Kurz notiert',
    briefingAiLabel: 'KI-Tagesüberblick',
  },
  en: {
    resumeReading: pct => `Resumed at ${pct}%`,
    backToTop: 'Back to top',
    prevArticle: 'Previous article',
    nextArticle: 'Next article',
    chaptersLabel: count => `Sections (${count})`,
    paywallTitle: 'Preview only available',
    paywallDesc: 'This publisher restricts full-text extraction or uses a paywall.',
    paywallAlternativesTitle: 'Open coverage on the same story',
    paywallReadInApp: 'Read in app',
    paywallSearchMore: 'Find more sources',
    paywallOpenSource: 'Open at publisher',
    onLabel: 'On',
    offLabel: 'Off',
    offlineRemoved: 'Offline copy removed.',
    offlineSavedFull: 'Text and image saved offline.',
    offlineSavedText: 'Text saved offline.',
    offlineError: 'Could not update offline copy.',
    briefingMiniTitle: 'Daily Briefing',
    briefingPointProgress: (current, total) => `Item ${current} of ${total}`,
    briefingPrevPoint: 'Previous item',
    briefingNextPoint: 'Next item',
    briefingOpenDialog: 'Open briefing',
    briefingReadStory: 'Read article',
    briefingBackgroundHint: 'Keeps playing in the mini player when closed.',
    briefingIntroLabel: 'Introduction',
    briefingQuickNotesLabel: 'Quick notes',
    briefingAiLabel: 'AI Daily Briefing',
  },
  fr: {
    resumeReading: pct => `Reprise à ${pct} %`,
    backToTop: 'Début',
    prevArticle: 'Article précédent',
    nextArticle: 'Article suivant',
    chaptersLabel: count => `Sections (${count})`,
    paywallTitle: 'Aperçu uniquement disponible',
    paywallDesc: 'Cette source limite le texte intégral ou utilise un mur payant.',
    paywallAlternativesTitle: 'Autres sources sur le même sujet',
    paywallReadInApp: 'Lire ici',
    paywallSearchMore: 'Chercher d’autres sources',
    paywallOpenSource: 'Ouvrir chez la source',
    onLabel: 'Activé',
    offLabel: 'Désactivé',
    offlineRemoved: 'Copie hors ligne supprimée.',
    offlineSavedFull: 'Texte et image enregistrés hors ligne.',
    offlineSavedText: 'Texte enregistré hors ligne.',
    offlineError: 'Impossible de modifier la copie hors ligne.',
    briefingMiniTitle: 'Briefing du jour',
    briefingPointProgress: (current, total) => `Point ${current} sur ${total}`,
    briefingPrevPoint: 'Point précédent',
    briefingNextPoint: 'Point suivant',
    briefingOpenDialog: 'Ouvrir le briefing',
    briefingReadStory: 'Lire l’article',
    briefingBackgroundHint: 'Continue dans le mini-lecteur à la fermeture.',
    briefingIntroLabel: 'Introduction',
    briefingQuickNotesLabel: 'En bref',
    briefingAiLabel: 'Briefing IA',
  },
  es: {
    resumeReading: pct => `Continuando en ${pct} %`,
    backToTop: 'Al principio',
    prevArticle: 'Artículo anterior',
    nextArticle: 'Artículo siguiente',
    chaptersLabel: count => `Secciones (${count})`,
    paywallTitle: 'Solo vista previa disponible',
    paywallDesc: 'Esta fuente restringe el texto completo o usa un muro de pago.',
    paywallAlternativesTitle: 'Otras fuentes sobre el mismo tema',
    paywallReadInApp: 'Leer aquí',
    paywallSearchMore: 'Buscar más fuentes',
    paywallOpenSource: 'Abrir en la fuente',
    onLabel: 'Sí',
    offLabel: 'No',
    offlineRemoved: 'Copia sin conexión eliminada.',
    offlineSavedFull: 'Texto e imagen guardados sin conexión.',
    offlineSavedText: 'Texto guardado sin conexión.',
    offlineError: 'No se pudo actualizar la copia sin conexión.',
    briefingMiniTitle: 'Resumen del día',
    briefingPointProgress: (current, total) => `Punto ${current} de ${total}`,
    briefingPrevPoint: 'Punto anterior',
    briefingNextPoint: 'Siguiente punto',
    briefingOpenDialog: 'Abrir resumen',
    briefingReadStory: 'Leer artículo',
    briefingBackgroundHint: 'Sigue sonando en el minirreproductor al cerrar.',
    briefingIntroLabel: 'Introducción',
    briefingQuickNotesLabel: 'En breve',
    briefingAiLabel: 'Resumen IA',
  },
  it: {
    resumeReading: pct => `Ripreso al ${pct}%`,
    backToTop: 'All’inizio',
    prevArticle: 'Articolo precedente',
    nextArticle: 'Articolo successivo',
    chaptersLabel: count => `Sezioni (${count})`,
    paywallTitle: 'Solo anteprima disponibile',
    paywallDesc: 'Questa fonte limita il testo completo o utilizza un paywall.',
    paywallAlternativesTitle: 'Altre fonti sullo stesso tema',
    paywallReadInApp: 'Leggi qui',
    paywallSearchMore: 'Cerca altre fonti',
    paywallOpenSource: 'Apri alla fonte',
    onLabel: 'Attivo',
    offLabel: 'Spento',
    offlineRemoved: 'Copia offline rimossa.',
    offlineSavedFull: 'Testo e immagine salvati offline.',
    offlineSavedText: 'Testo salvato offline.',
    offlineError: 'Impossibile aggiornare la copia offline.',
    briefingMiniTitle: 'Briefing del giorno',
    briefingPointProgress: (current, total) => `Punto ${current} di ${total}`,
    briefingPrevPoint: 'Punto precedente',
    briefingNextPoint: 'Punto successivo',
    briefingOpenDialog: 'Apri briefing',
    briefingReadStory: 'Leggi articolo',
    briefingBackgroundHint: 'Continua nel mini-player alla chiusura.',
    briefingIntroLabel: 'Introduzione',
    briefingQuickNotesLabel: 'In breve',
    briefingAiLabel: 'Briefing IA',
  },
  pt: {
    resumeReading: pct => `Retomado em ${pct}%`,
    backToTop: 'Ir ao topo',
    prevArticle: 'Artigo anterior',
    nextArticle: 'Próximo artigo',
    chaptersLabel: count => `Seções (${count})`,
    paywallTitle: 'Apenas prévia disponível',
    paywallDesc: 'Esta fonte limita o texto completo ou usa paywall.',
    paywallAlternativesTitle: 'Outras fontes sobre o mesmo assunto',
    paywallReadInApp: 'Ler no app',
    paywallSearchMore: 'Buscar mais fontes',
    paywallOpenSource: 'Abrir na fonte',
    onLabel: 'Ativo',
    offLabel: 'Inativo',
    offlineRemoved: 'Cópia offline removida.',
    offlineSavedFull: 'Texto e imagem salvos offline.',
    offlineSavedText: 'Texto salvo offline.',
    offlineError: 'Não foi possível atualizar a cópia offline.',
    briefingMiniTitle: 'Resumo do dia',
    briefingPointProgress: (current, total) => `Ponto ${current} de ${total}`,
    briefingPrevPoint: 'Ponto anterior',
    briefingNextPoint: 'Próximo ponto',
    briefingOpenDialog: 'Abrir resumo',
    briefingReadStory: 'Ler artigo',
    briefingBackgroundHint: 'Continua no miniplayer ao fechar.',
    briefingIntroLabel: 'Introdução',
    briefingQuickNotesLabel: 'Notas rápidas',
    briefingAiLabel: 'Resumo IA',
  },
};

export function getReaderCopy(lang: AppLanguage): ReaderCopy {
  return COPY[lang] ?? COPY.de;
}
