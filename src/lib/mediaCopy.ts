import type { AppLanguage } from '../types/news';

export interface MediaExtraCopy {
  searchPlaceholder: string;
  continueListening: string;
  remainingMin: (min: number) => string;
  resumeEpisode: string;
  closePlayer: string;
  nextEpisode: string;
  audioLoadError: string;
  openOriginal: string;
  discoverChannels: string;
  discoverChannelsHint: string;
  emptyAudioTitle: string;
  emptyAudioHint: string;
  emptyVideoTitle: string;
  emptyVideoHint: string;
  emptyClipsTitle: string;
  emptyClipsHint: string;
  searchNoResults: string;
  clearSearch: string;
  showMore: string;
  seekLabel: string;
}

const COPY: Record<AppLanguage, MediaExtraCopy> = {
  de: {
    searchPlaceholder: 'Videos, Podcasts oder Kanäle suchen …',
    continueListening: 'Weiterhören',
    remainingMin: (min) => `noch ${min} Min.`,
    resumeEpisode: 'Fortsetzen',
    closePlayer: 'Player schließen',
    nextEpisode: 'Nächste Folge',
    audioLoadError: 'Audio konnte nicht direkt geladen werden.',
    openOriginal: 'Bei der Quelle öffnen',
    discoverChannels: 'Weitere Medienkanäle entdecken',
    discoverChannelsHint: 'Ergänze deinen Feed um kuratierte Video-Kanäle und Podcasts.',
    emptyAudioTitle: 'Noch keine Podcasts abonniert',
    emptyAudioHint: 'Aktiviere ein Podcast-Paket oder einzelne Audio-Quellen mit einem Tipp.',
    emptyVideoTitle: 'Noch keine Video-Kanäle aktiv',
    emptyVideoHint: 'Füge Nachrichten- und Wissenskanäle für deinen Video-Feed hinzu.',
    emptyClipsTitle: 'Noch keine Kurz-Clips verfügbar',
    emptyClipsHint: 'Abonniere ein Clips-Paket, um vertikale Nachrichten-Shorts im Vollbild zu sehen.',
    searchNoResults: 'Keine passenden Videos oder Podcasts gefunden.',
    clearSearch: 'Suche zurücksetzen',
    showMore: 'Mehr anzeigen',
    seekLabel: 'Wiedergabeposition',
  },
  en: {
    searchPlaceholder: 'Search videos, podcasts, or channels …',
    continueListening: 'Continue listening',
    remainingMin: (min) => `${min} min left`,
    resumeEpisode: 'Resume',
    closePlayer: 'Close player',
    nextEpisode: 'Next episode',
    audioLoadError: 'Audio stream could not be loaded directly.',
    openOriginal: 'Open at source',
    discoverChannels: 'Discover more media channels',
    discoverChannelsHint: 'Expand your feed with curated video channels and podcasts.',
    emptyAudioTitle: 'No podcasts subscribed yet',
    emptyAudioHint: 'Activate a podcast pack or individual audio feeds with one tap.',
    emptyVideoTitle: 'No video channels active yet',
    emptyVideoHint: 'Add news and explainer channels to build your video hub.',
    emptyClipsTitle: 'No short clips available yet',
    emptyClipsHint: 'Subscribe to a clips pack to watch vertical news Shorts in full screen.',
    searchNoResults: 'No matching videos or podcasts found.',
    clearSearch: 'Clear search',
    showMore: 'Show more',
    seekLabel: 'Playback position',
  },
  fr: {
    searchPlaceholder: 'Rechercher vidéos, podcasts ou chaînes …',
    continueListening: 'Reprendre l’écoute',
    remainingMin: (min) => `${min} min restantes`,
    resumeEpisode: 'Reprendre',
    closePlayer: 'Fermer le lecteur',
    nextEpisode: 'Épisode suivant',
    audioLoadError: 'Impossible de charger le flux audio directement.',
    openOriginal: 'Ouvrir la source',
    discoverChannels: 'Découvrir d’autres chaînes',
    discoverChannelsHint: 'Ajoutez des chaînes vidéo et podcasts sélectionnés.',
    emptyAudioTitle: 'Aucun podcast abonné',
    emptyAudioHint: 'Activez un pack podcast ou des flux audio en un geste.',
    emptyVideoTitle: 'Aucune chaîne vidéo active',
    emptyVideoHint: 'Ajoutez des chaînes d’actualité et documentaires.',
    emptyClipsTitle: 'Aucun clip court disponible',
    emptyClipsHint: 'Abonnez-vous à un pack clips pour regarder des Shorts.',
    searchNoResults: 'Aucune vidéo ni podcast trouvé.',
    clearSearch: 'Effacer la recherche',
    showMore: 'Afficher plus',
    seekLabel: 'Position de lecture',
  },
  es: {
    searchPlaceholder: 'Buscar vídeos, podcasts o canales …',
    continueListening: 'Seguir escuchando',
    remainingMin: (min) => `quedan ${min} min`,
    resumeEpisode: 'Reanudar',
    closePlayer: 'Cerrar reproductor',
    nextEpisode: 'Siguiente episodio',
    audioLoadError: 'No se pudo cargar el audio directamente.',
    openOriginal: 'Abrir en la fuente',
    discoverChannels: 'Descubrir más canales',
    discoverChannelsHint: 'Amplía tu feed con canales de vídeo y podcasts.',
    emptyAudioTitle: 'Aún no hay podcasts suscritos',
    emptyAudioHint: 'Activa un paquete de podcasts con un solo toque.',
    emptyVideoTitle: 'Aún no hay canales de vídeo activos',
    emptyVideoHint: 'Añade canales de noticias y documentales.',
    emptyClipsTitle: 'Aún no hay clips cortos',
    emptyClipsHint: 'Suscríbete a un paquete de clips para ver Shorts.',
    searchNoResults: 'No se encontraron vídeos ni podcasts.',
    clearSearch: 'Borrar búsqueda',
    showMore: 'Mostrar más',
    seekLabel: 'Posición de reproducción',
  },
  it: {
    searchPlaceholder: 'Cerca video, podcast o canali …',
    continueListening: 'Continua ad ascoltare',
    remainingMin: (min) => `${min} min rimasti`,
    resumeEpisode: 'Riprendi',
    closePlayer: 'Chiudi player',
    nextEpisode: 'Episodio successivo',
    audioLoadError: 'Impossibile caricare direttamente l’audio.',
    openOriginal: 'Apri alla fonte',
    discoverChannels: 'Scopri altri canali',
    discoverChannelsHint: 'Aggiungi canali video e podcast selezionati.',
    emptyAudioTitle: 'Nessun podcast seguito',
    emptyAudioHint: 'Attiva un pacchetto podcast con un tocco.',
    emptyVideoTitle: 'Nessun canale video attivo',
    emptyVideoHint: 'Aggiungi canali di notizie e approfondimento.',
    emptyClipsTitle: 'Nessun clip breve disponibile',
    emptyClipsHint: 'Iscriviti a un pacchetto clip per guardare gli Shorts.',
    searchNoResults: 'Nessun video o podcast trovato.',
    clearSearch: 'Cancella ricerca',
    showMore: 'Mostra altri',
    seekLabel: 'Posizione di riproduzione',
  },
  pt: {
    searchPlaceholder: 'Pesquisar vídeos, podcasts ou canais …',
    continueListening: 'Continuar a ouvir',
    remainingMin: (min) => `${min} min restantes`,
    resumeEpisode: 'Retomar',
    closePlayer: 'Fechar leitor',
    nextEpisode: 'Próximo episódio',
    audioLoadError: 'Não foi possível carregar o áudio diretamente.',
    openOriginal: 'Abrir na fonte',
    discoverChannels: 'Descobrir mais canais',
    discoverChannelsHint: 'Adicione canais de vídeo e podcasts selecionados.',
    emptyAudioTitle: 'Nenhum podcast seguido',
    emptyAudioHint: 'Ative um pacote de podcasts com um toque.',
    emptyVideoTitle: 'Nenhum canal de vídeo ativo',
    emptyVideoHint: 'Adicione canais de notícias e documentários.',
    emptyClipsTitle: 'Nenhum clip curto disponível',
    emptyClipsHint: 'Subscreva um pacote de clips para ver Shorts.',
    searchNoResults: 'Nenhum vídeo ou podcast encontrado.',
    clearSearch: 'Limpar pesquisa',
    showMore: 'Mostrar mais',
    seekLabel: 'Posição de reprodução',
  },
};

export function getMediaCopy(lang: AppLanguage): MediaExtraCopy {
  return COPY[lang] ?? COPY.de;
}
