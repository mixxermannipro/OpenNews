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
  fullTextOptInTitle: string;
  fullTextOptInDesc: string;
  fullTextOptInEnable: string;
  fullTextOptInDisable: string;
  fullTextOptOutDesc: string;
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
    fullTextOptInTitle: 'Nur Feed-Vorschau aktiv',
    fullTextOptInDesc: 'Volltext ist für diese Quelle standardmäßig ausgeschaltet. Du kannst ihn bei Bedarf laden oder direkt zur Originalseite wechseln.',
    fullTextOptInEnable: 'Volltext für diese Quelle laden',
    fullTextOptInDisable: 'Volltext für diese Quelle ausschalten',
    fullTextOptOutDesc: 'Dieser Verlag hat dem automatischen Volltextabruf widersprochen. Bitte lies den Artikel direkt bei der Quelle.',
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
    fullTextOptInTitle: 'Feed summary only',
    fullTextOptInDesc: 'Full-text loading is disabled for this source by default. You can enable it for this source or open the original article.',
    fullTextOptInEnable: 'Load full text for this source',
    fullTextOptInDisable: 'Disable full text for this source',
    fullTextOptOutDesc: 'This publisher opted out of automatic full-text extraction. Please read the article on the publisher site.',
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
    fullTextOptInTitle: 'Aperçu du flux uniquement',
    fullTextOptInDesc: 'Le texte intégral est désactivé par défaut pour cette source. Vous pouvez l’activer ou ouvrir l’article original.',
    fullTextOptInEnable: 'Charger le texte intégral pour cette source',
    fullTextOptInDisable: 'Désactiver le texte intégral pour cette source',
    fullTextOptOutDesc: 'Cet éditeur s’oppose à l’extraction automatique. Veuillez lire l’article directement sur son site.',
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
    fullTextOptInTitle: 'Solo resumen del feed',
    fullTextOptInDesc: 'La carga del texto completo está desactivada por defecto para esta fuente. Puedes activarla o abrir el artículo original.',
    fullTextOptInEnable: 'Cargar texto completo para esta fuente',
    fullTextOptInDisable: 'Desactivar texto completo para esta fuente',
    fullTextOptOutDesc: 'Este medio no permite la extracción automática. Lee el artículo directamente en su web.',
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
    fullTextOptInTitle: 'Solo anteprima del feed',
    fullTextOptInDesc: 'Il caricamento del testo completo è disattivato per questa fonte. Puoi attivarlo o aprire l’articolo originale.',
    fullTextOptInEnable: 'Carica testo completo per questa fonte',
    fullTextOptInDisable: 'Disattiva testo completo per questa fonte',
    fullTextOptOutDesc: 'Questo editore ha escluso l’estrazione automatica. Leggi l’articolo sul sito della fonte.',
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
    fullTextOptInTitle: 'Apenas resumo do feed',
    fullTextOptInDesc: 'O carregamento do texto completo vem desativado por padrão para esta fonte. Você pode ativá-lo ou abrir o artigo original.',
    fullTextOptInEnable: 'Carregar texto completo para esta fonte',
    fullTextOptInDisable: 'Desativar texto completo para esta fonte',
    fullTextOptOutDesc: 'Este veículo optou por não permitir a extração automática. Leia o artigo diretamente na fonte.',
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
