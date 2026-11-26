import type { ActiveAudioTrack } from '../components/MiniAudioPlayer';
import type { AppLanguage } from '../types/news';
import { foldSearchText as foldText } from './textSearch';

export type RadioCategory = 'news' | 'culture' | 'international';
export type RadioFilterGroup = 'all' | 'dach' | 'international' | 'favorites';

export interface RadioStation {
  id: string;
  name: string;
  subtitle: string;
  streamUrl: string;
  homepageUrl: string;
  language: AppLanguage;
  region: string;
  shortCode: string;
  accentColor: string;
  category: RadioCategory;
  keywords: string[];
}

export const NEWS_UPDATE_AUDIO_SOURCE_IDS = [
  'tagesschau-100s-audio',
  'tagesschau-20-audio',
  'tagesthemen-audio',
  'dlf-nachrichten-audio',
  'ndr-info-nachrichten',
  'zdf-heute-journal-podcast',
  'dlf-aktuell',
  'dlf-der-tag',
  'srf-echo-der-zeit',
  'bbc-global-podcast',
  'npr-up-first',
  'rfi-francais-facile',
] as const;

export const RADIO_STATIONS: readonly RadioStation[] = [
  {
    id: 'dlf',
    name: 'Deutschlandfunk',
    subtitle: 'Nachrichten, Hintergründe & Analysen rund um die Uhr',
    streamUrl: 'https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3',
    homepageUrl: 'https://www.deutschlandfunk.de/',
    language: 'de',
    region: 'DE',
    shortCode: 'DLF',
    accentColor: '#1D4ED8',
    category: 'news',
    keywords: ['dlf', 'deutschlandfunk', 'nachrichten', 'inforadio', 'politik'],
  },
  {
    id: 'dlf-kultur',
    name: 'Deutschlandfunk Kultur',
    subtitle: 'Kultur, Feuilleton, Debatten & Hörspiel',
    streamUrl: 'https://st02.sslstream.dlf.de/dlf/02/128/mp3/stream.mp3',
    homepageUrl: 'https://www.deutschlandfunkkultur.de/',
    language: 'de',
    region: 'DE',
    shortCode: 'DK',
    accentColor: '#7C3AED',
    category: 'culture',
    keywords: ['dlf kultur', 'kultur', 'feuilleton', 'radio'],
  },
  {
    id: 'dlf-nova',
    name: 'Deutschlandfunk Nova',
    subtitle: 'Wissen, Netzpolitik, Gesellschaft & junge Themen',
    streamUrl: 'https://st03.sslstream.dlf.de/dlf/03/128/mp3/stream.mp3',
    homepageUrl: 'https://www.deutschlandfunknova.de/',
    language: 'de',
    region: 'DE',
    shortCode: 'DN',
    accentColor: '#059669',
    category: 'culture',
    keywords: ['dlf nova', 'wissen', 'netzpolitik', 'gesellschaft'],
  },
  {
    id: 'dlf-dokdeb',
    name: 'Deutschlandfunk DokDeb',
    subtitle: 'Bundestagsdebatten, Pressekonferenzen & Sondersendungen',
    streamUrl: 'https://st04.sslstream.dlf.de/dlf/04/128/mp3/stream.mp3',
    homepageUrl: 'https://www.deutschlandfunk.de/dokumente-und-debatten-100.html',
    language: 'de',
    region: 'DE',
    shortCode: 'DD',
    accentColor: '#0284C7',
    category: 'news',
    keywords: ['dlf dokdeb', 'debatten', 'bundestag', 'live'],
  },
  {
    id: 'ndr-info',
    name: 'NDR Info',
    subtitle: 'Alle 15 Minuten Nachrichten aus dem Norden & der Welt',
    streamUrl: 'https://icecast.ndr.de/ndr/ndrinfo/niedersachsen/mp3/128/stream.mp3',
    homepageUrl: 'https://www.ndr.de/nachrichten/info/',
    language: 'de',
    region: 'DE',
    shortCode: 'NDR',
    accentColor: '#1E40AF',
    category: 'news',
    keywords: ['ndr', 'ndr info', 'ard', 'nachrichten', 'norden'],
  },
  {
    id: 'br24',
    name: 'BR24',
    subtitle: 'Aktuelle Nachrichten, Wirtschaft, Sport & Bayern im 15-Minuten-Takt',
    streamUrl: 'https://dispatcher.rndfnk.com/br/br24/live/mp3/mid',
    homepageUrl: 'https://www.br.de/nachrichten/',
    language: 'de',
    region: 'DE',
    shortCode: 'BR24',
    accentColor: '#0369A1',
    category: 'news',
    keywords: ['br24', 'b5 aktuell', 'bayern', 'ard', 'nachrichten'],
  },
  {
    id: 'wdr5',
    name: 'WDR 5',
    subtitle: 'Das Informations- und Wortprogramm mit Tiefgang',
    streamUrl: 'https://wdr-wdr5-live.icecastssl.wdr.de/wdr/wdr5/live/mp3/128/stream.mp3',
    homepageUrl: 'https://www1.wdr.de/radio/wdr5/',
    language: 'de',
    region: 'DE',
    shortCode: 'WDR5',
    accentColor: '#2563EB',
    category: 'news',
    keywords: ['wdr 5', 'wdr5', 'ard', 'morgenecho', 'nrw'],
  },
  {
    id: 'rbb24-inforadio',
    name: 'rbb24 Inforadio',
    subtitle: 'Nachrichten für Berlin, Brandenburg & Deutschland',
    streamUrl: 'https://dispatcher.rndfnk.com/rbb/inforadio/live/mp3/mid',
    homepageUrl: 'https://www.inforadio.de/',
    language: 'de',
    region: 'DE',
    shortCode: 'RBB',
    accentColor: '#B91C1C',
    category: 'news',
    keywords: ['rbb', 'rbb24', 'inforadio', 'berlin', 'brandenburg'],
  },
  {
    id: 'swr-aktuell',
    name: 'SWR Aktuell',
    subtitle: 'Informationen, Interviews & Meldungen im Viertelstundentakt',
    streamUrl: 'https://liveradio.swr.de/sw282p3/swraktuell/',
    homepageUrl: 'https://www.swr.de/swraktuell/radio/',
    language: 'de',
    region: 'DE',
    shortCode: 'SWR',
    accentColor: '#0F766E',
    category: 'news',
    keywords: ['swr', 'swr aktuell', 'ard', 'baden-wuerttemberg', 'rheinland-pfalz'],
  },
  {
    id: 'hr-info',
    name: 'hr-iNFO',
    subtitle: 'Nachrichten, Wirtschaft, Wissen & Kultur aus Hessen',
    streamUrl: 'https://dispatcher.rndfnk.com/hr/hrinfo/live/mp3/high',
    homepageUrl: 'https://www.hr-inforadio.de/',
    language: 'de',
    region: 'DE',
    shortCode: 'HR',
    accentColor: '#0E7490',
    category: 'news',
    keywords: ['hr', 'hr info', 'hessen', 'ard', 'nachrichten'],
  },
  {
    id: 'mdr-aktuell',
    name: 'MDR Aktuell',
    subtitle: 'Das Nachrichtenradio für Mitteldeutschland',
    streamUrl: 'https://mdr-284340-0.sslcast.mdr.de/mdr/284340/0/mp3/high/stream.mp3',
    homepageUrl: 'https://www.mdr.de/nachrichten/',
    language: 'de',
    region: 'DE',
    shortCode: 'MDR',
    accentColor: '#1D4ED8',
    category: 'news',
    keywords: ['mdr', 'mdr aktuell', 'ard', 'sachsen', 'thueringen'],
  },
  {
    id: 'srf4-news',
    name: 'SRF 4 News',
    subtitle: 'Das Informationsradio der Schweiz rund um die Uhr',
    streamUrl: 'https://stream.srg-ssr.ch/srgssr/srf4news/mp3/128',
    homepageUrl: 'https://www.srf.ch/audio/srf-4-news',
    language: 'de',
    region: 'CH',
    shortCode: 'SRF4',
    accentColor: '#DC2626',
    category: 'news',
    keywords: ['srf', 'srf 4', 'schweiz', 'news', 'echo der zeit'],
  },
  {
    id: 'orf-oe1',
    name: 'ORF Ö1',
    subtitle: 'Journale, Politik, Kultur & Wissenschaft aus Österreich',
    streamUrl: 'https://orf-live.ors-shoutcast.at/oe1-q2a',
    homepageUrl: 'https://oe1.orf.at/',
    language: 'de',
    region: 'AT',
    shortCode: 'Ö1',
    accentColor: '#B91C1C',
    category: 'news',
    keywords: ['orf', 'oe1', 'ö1', 'oesterreich', 'journale'],
  },
  {
    id: 'bbc-world-service',
    name: 'BBC World Service',
    subtitle: 'Global breaking news, correspondents & international reporting',
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    homepageUrl: 'https://www.bbc.co.uk/sounds/play/live:bbc_world_service',
    language: 'en',
    region: 'UK',
    shortCode: 'BBC',
    accentColor: '#DC2626',
    category: 'international',
    keywords: ['bbc', 'world service', 'uk', 'english', 'global'],
  },
  {
    id: 'npr-live',
    name: 'NPR Program Stream',
    subtitle: 'Live U.S. & world public radio reporting from Washington',
    streamUrl: 'https://npr-ice.streamguys1.com/live.mp3',
    homepageUrl: 'https://www.npr.org/',
    language: 'en',
    region: 'US',
    shortCode: 'NPR',
    accentColor: '#0284C7',
    category: 'international',
    keywords: ['npr', 'usa', 'public radio', 'english', 'news'],
  },
  {
    id: 'france-info',
    name: 'France Info',
    subtitle: 'Toute l’actualité en direct et en continu',
    streamUrl: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3',
    homepageUrl: 'https://www.francetvinfo.fr/',
    language: 'fr',
    region: 'FR',
    shortCode: 'FI',
    accentColor: '#D97706',
    category: 'international',
    keywords: ['franceinfo', 'france info', 'radio france', 'direct', 'actualites'],
  },
  {
    id: 'france-inter',
    name: 'France Inter',
    subtitle: 'Information, débats, matinale et culture en direct',
    streamUrl: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3',
    homepageUrl: 'https://www.radiofrance.fr/franceinter',
    language: 'fr',
    region: 'FR',
    shortCode: 'INT',
    accentColor: '#E11D48',
    category: 'international',
    keywords: ['france inter', 'radio france', 'francais', 'culture'],
  },
  {
    id: 'rfi-monde',
    name: 'RFI Monde',
    subtitle: 'L’actualité internationale vue de France',
    streamUrl: 'https://rfimonde64k.ice.infomaniak.ch/rfimonde-64.mp3',
    homepageUrl: 'https://www.rfi.fr/',
    language: 'fr',
    region: 'FR',
    shortCode: 'RFI',
    accentColor: '#DC2626',
    category: 'international',
    keywords: ['rfi', 'rfi monde', 'francais', 'afrique', 'europe'],
  },
  {
    id: 'rne-radio5',
    name: 'RNE Radio 5 Todo Noticias',
    subtitle: 'Información continua de Radio Nacional de España',
    streamUrl: 'https://dispatcher.rndfnk.com/crtve/rne5/main/mp3/high',
    homepageUrl: 'https://www.rtve.es/radio/radio5/',
    language: 'es',
    region: 'ES',
    shortCode: 'RNE5',
    accentColor: '#EA580C',
    category: 'international',
    keywords: ['rne', 'radio 5', 'rtve', 'espana', 'noticias'],
  },
  {
    id: 'cadena-ser',
    name: 'Cadena SER',
    subtitle: 'Noticias, análisis y actualidad de España en directo',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3',
    homepageUrl: 'https://cadenaser.com/',
    language: 'es',
    region: 'ES',
    shortCode: 'SER',
    accentColor: '#0284C7',
    category: 'international',
    keywords: ['cadena ser', 'espana', 'noticias', 'directo'],
  },
  {
    id: 'rai-radio1',
    name: 'Rai Radio 1',
    subtitle: 'Giornali radio, politica e informazione in diretta',
    streamUrl: 'https://icestreaming.rai.it/1.mp3',
    homepageUrl: 'https://www.raiplaysound.it/radio1',
    language: 'it',
    region: 'IT',
    shortCode: 'RAI1',
    accentColor: '#2563EB',
    category: 'international',
    keywords: ['rai', 'rai radio 1', 'italia', 'giornale radio'],
  },
  {
    id: 'tsf-pt',
    name: 'TSF Rádio Notícias',
    subtitle: 'Notícias, reportagens e debates em direto de Portugal',
    streamUrl: 'https://tsfdirecto.tsf.pt/tsfdirecto.mp3',
    homepageUrl: 'https://www.tsf.pt/',
    language: 'pt',
    region: 'PT',
    shortCode: 'TSF',
    accentColor: '#DC2626',
    category: 'international',
    keywords: ['tsf', 'portugal', 'noticias', 'direto'],
  },
  {
    id: 'observador-pt',
    name: 'Rádio Observador',
    subtitle: 'Informação e análise em tempo real de Lisboa',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/OBSERVADOR.mp3',
    homepageUrl: 'https://observador.pt/radio/',
    language: 'pt',
    region: 'PT',
    shortCode: 'OBS',
    accentColor: '#0369A1',
    category: 'international',
    keywords: ['observador', 'portugal', 'lisboa', 'noticias'],
  },
  {
    id: 'cbn-br',
    name: 'CBN São Paulo',
    subtitle: 'A rádio que toca notícia ao vivo no Brasil',
    streamUrl: 'https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_SP.mp3',
    homepageUrl: 'https://cbn.globo.com/',
    language: 'pt',
    region: 'BR',
    shortCode: 'CBN',
    accentColor: '#B91C1C',
    category: 'international',
    keywords: ['cbn', 'brasil', 'noticias', 'ao vivo'],
  },
];

const DACH_REGIONS = new Set(['DE', 'AT', 'CH']);

function normalizeRadioSearchText(value: string): string {
  return foldText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function filterRadioStations(
  stations: readonly RadioStation[],
  options: {
    query?: string;
    group?: RadioFilterGroup;
    language?: AppLanguage;
    favoriteIds?: readonly string[];
  } = {},
): RadioStation[] {
  const { query = '', group = 'all', language = 'de', favoriteIds = [] } = options;
  const favorites = new Set(favoriteIds);
  const foldedQuery = normalizeRadioSearchText(query);
  const tokens = foldedQuery ? foldedQuery.split(/\s+/).filter(Boolean) : [];

  const filtered = stations.filter((station) => {
    if (group === 'favorites' && !favorites.has(station.id)) return false;
    if (group === 'dach' && !DACH_REGIONS.has(station.region)) return false;
    if (group === 'international' && DACH_REGIONS.has(station.region)) return false;

    if (tokens.length === 0) return true;
    const haystack = normalizeRadioSearchText(
      `${station.name} ${station.subtitle} ${station.region} ${station.shortCode} ${station.keywords.join(' ')}`,
    );
    return tokens.every((token) => haystack.includes(token));
  });

  const priority = (station: RadioStation): number => {
    let score = 0;
    if (favorites.has(station.id)) score += 1000;
    if (station.language === language) score += 200;
    if (DACH_REGIONS.has(station.region)) score += 40;
    if (station.category === 'news') score += 20;
    return score;
  };

  return [...filtered].sort((a, b) => priority(b) - priority(a));
}

export function buildRadioAudioTrack(station: RadioStation): ActiveAudioTrack {
  const articleId = `radio:${station.id}`;
  return {
    article: {
      id: articleId,
      sourceId: articleId,
      sourceName: `${station.name} · ${station.region}`,
      sourceShortCode: station.shortCode,
      sourceColor: station.accentColor,
      title: station.name,
      summary: station.subtitle,
      paragraphs: [station.subtitle],
      link: station.homepageUrl,
      category: station.category === 'culture' ? 'Kultur' : 'Politik',
      publishedAt: new Date().toISOString(),
      readingTimeMin: 1,
      keywords: station.keywords,
      audioUrl: station.streamUrl,
    },
    media: {
      type: 'audio',
      url: station.streamUrl,
    },
    isLive: true,
    radioStation: {
      id: station.id,
      region: station.region,
      accentColor: station.accentColor,
      shortCode: station.shortCode,
      subtitle: station.subtitle,
    },
  };
}
