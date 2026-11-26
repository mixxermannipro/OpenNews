import type { AppLanguage } from '../types/news';

export interface DiscoverExtraCopy {
  sortRelevance: string;
  sortNewest: string;
  filterMediaOnly: string;
  trackInRadar: string;
  trackedInRadar: string;
  discoverSourcesTitle: string;
  discoverSourcesForTopic: (topic: string) => string;
  sourceTabNew: string;
  sourceTabInternational: string;
  sourceTabMedia: string;
  sourceTabPacks: string;
  packNewSources: (count: number) => string;
  packAllActive: string;
  loadMore: string;
  liveTopicsLabel: string;
  radarActiveMatches: string;
  themenwelten: string;
}

const COPY: Record<AppLanguage, DiscoverExtraCopy> = {
  de: {
    sortRelevance: 'Relevanz',
    sortNewest: 'Neueste',
    filterMediaOnly: 'Video & Audio',
    trackInRadar: 'Im Radar verfolgen',
    trackedInRadar: 'Im Radar aktiv',
    discoverSourcesTitle: 'Neue Quellen & Perspektiven',
    discoverSourcesForTopic: (topic) => `Weitere Quellen für ${topic}`,
    sourceTabNew: 'Neu entdecken',
    sourceTabInternational: 'International',
    sourceTabMedia: 'Video & Podcasts',
    sourceTabPacks: 'Starter-Pakete',
    packNewSources: (count) => `+${count} neue Quellen`,
    packAllActive: 'Alle aktiv',
    loadMore: 'Mehr laden',
    liveTopicsLabel: 'Aktuell im Feed',
    radarActiveMatches: 'Treffer aus deinem Stichwort-Radar',
    themenwelten: 'Themenwelten',
  },
  en: {
    sortRelevance: 'Relevance',
    sortNewest: 'Newest',
    filterMediaOnly: 'Video & Audio',
    trackInRadar: 'Track in Radar',
    trackedInRadar: 'Tracked in Radar',
    discoverSourcesTitle: 'Discover new sources',
    discoverSourcesForTopic: (topic) => `More sources for ${topic}`,
    sourceTabNew: 'For you',
    sourceTabInternational: 'International',
    sourceTabMedia: 'Video & Podcasts',
    sourceTabPacks: 'Starter packs',
    packNewSources: (count) => `+${count} new sources`,
    packAllActive: 'All active',
    loadMore: 'Load more',
    liveTopicsLabel: 'Live in your feed',
    radarActiveMatches: 'Matches from your keyword radar',
    themenwelten: 'Topic spotlights',
  },
  fr: {
    sortRelevance: 'Pertinence',
    sortNewest: 'Récentes',
    filterMediaOnly: 'Vidéo & Audio',
    trackInRadar: 'Suivre au radar',
    trackedInRadar: 'Suivi actif',
    discoverSourcesTitle: 'Nouvelles sources et regards',
    discoverSourcesForTopic: (topic) => `Plus de sources pour ${topic}`,
    sourceTabNew: 'Découvrir',
    sourceTabInternational: 'International',
    sourceTabMedia: 'Vidéo & Podcasts',
    sourceTabPacks: 'Packs',
    packNewSources: (count) => `+${count} nouvelles`,
    packAllActive: 'Toutes actives',
    loadMore: 'Charger plus',
    liveTopicsLabel: 'Sujets du moment',
    radarActiveMatches: 'Résultats de votre radar',
    themenwelten: 'Thématiques',
  },
  es: {
    sortRelevance: 'Relevancia',
    sortNewest: 'Más recientes',
    filterMediaOnly: 'Vídeo y audio',
    trackInRadar: 'Seguir en radar',
    trackedInRadar: 'En el radar',
    discoverSourcesTitle: 'Nuevas fuentes y perspectivas',
    discoverSourcesForTopic: (topic) => `Más fuentes sobre ${topic}`,
    sourceTabNew: 'Descubrir',
    sourceTabInternational: 'Internacional',
    sourceTabMedia: 'Vídeo y podcasts',
    sourceTabPacks: 'Paquetes',
    packNewSources: (count) => `+${count} nuevas`,
    packAllActive: 'Todas activas',
    loadMore: 'Cargar más',
    liveTopicsLabel: 'Ahora en tu feed',
    radarActiveMatches: 'Coincidencias de tu radar',
    themenwelten: 'Temas destacados',
  },
  it: {
    sortRelevance: 'Rilevanza',
    sortNewest: 'Più recenti',
    filterMediaOnly: 'Video e audio',
    trackInRadar: 'Segui nel radar',
    trackedInRadar: 'Nel radar',
    discoverSourcesTitle: 'Nuove fonti e prospettive',
    discoverSourcesForTopic: (topic) => `Altre fonti per ${topic}`,
    sourceTabNew: 'Scopri',
    sourceTabInternational: 'Internazionale',
    sourceTabMedia: 'Video e podcast',
    sourceTabPacks: 'Pacchetti',
    packNewSources: (count) => `+${count} nuove`,
    packAllActive: 'Tutte attive',
    loadMore: 'Carica altri',
    liveTopicsLabel: 'Temi del momento',
    radarActiveMatches: 'Risultati dal tuo radar',
    themenwelten: 'Aree tematiche',
  },
  pt: {
    sortRelevance: 'Relevância',
    sortNewest: 'Mais recentes',
    filterMediaOnly: 'Vídeo e áudio',
    trackInRadar: 'Seguir no radar',
    trackedInRadar: 'No radar',
    discoverSourcesTitle: 'Novas fontes e perspetivas',
    discoverSourcesForTopic: (topic) => `Mais fontes sobre ${topic}`,
    sourceTabNew: 'Descobrir',
    sourceTabInternational: 'Internacional',
    sourceTabMedia: 'Vídeo e podcasts',
    sourceTabPacks: 'Pacotes',
    packNewSources: (count) => `+${count} novas`,
    packAllActive: 'Todas ativas',
    loadMore: 'Carregar mais',
    liveTopicsLabel: 'Em destaque agora',
    radarActiveMatches: 'Correspondências do radar',
    themenwelten: 'Temas em foco',
  },
};

export function getDiscoverCopy(lang: AppLanguage): DiscoverExtraCopy {
  return COPY[lang] ?? COPY.de;
}
