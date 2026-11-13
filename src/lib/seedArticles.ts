import renewableImg from '../assets/images/news_renewable_europe_1794556463653.jpg';
import euParliamentImg from '../assets/images/news_eu_parliament_1794556462855.jpg';
import aiChipImg from '../assets/images/news_ai_semiconductor_1794556462965.jpg';
import exoplanetImg from '../assets/images/news_exoplanet_space_1794556463043.jpg';
import bundestagImg from '../assets/images/news_bundestag_berlin_1794556463691.jpg';
import type { NewsArticle } from '../types/news';

const now = Date.now();
const minsAgo = (m: number) => new Date(now - m * 60_000).toISOString();

export const SEED_ARTICLES: NewsArticle[] = [
  {
    id: 'seed-europa-energie',
    sourceId: 'tagesschau',
    sourceName: 'Tagesschau',
    sourceShortCode: 'TS',
    sourceColor: '#3B82F6',
    title: 'Europa beschleunigt den Ausbau erneuerbarer Energien',
    summary:
      'Neue Vereinbarungen sollen den Übergang zu einer klimafreundlichen Wirtschaft deutlich voranbringen und Genehmigungsverfahren verkürzen.',
    paragraphs: [
      'Die Europäische Union treibt den Ausbau erneuerbarer Energien deutlich voran. Die Mitgliedstaaten haben sich auf ein neues Maßnahmenpaket geeinigt, das Genehmigungen beschleunigt, Investitionen erhöht und den Ausbau von Wind- und Solarenergie in den kommenden Jahren spürbar stärkt.',
      'Damit will die EU ihre Energieversorgung unabhängiger, widerstandsfähiger und klimafreundlicher machen. Gleichzeitig sollen die Energiekosten langfristig sinken – ein wichtiger Impuls für Wirtschaft und Verbraucher.',
      'Kernpunkt der Reform sind verbindliche Höchstfristen für Planungsverfahren in sogenannten Beschleunigungsgebieten sowie ein gezielter Ausbau grenzüberschreitender Stromnetze und Großspeicher.',
      'Energieverbände begrüßten die Entscheidung als überfälliges Signal für Planungssicherheit, mahnten jedoch zugleich an, dass Netzausbau und Digitalisierung der Verteilnetze Schritt halten müssten.',
    ],
    link: 'https://www.tagesschau.de/wirtschaft/energie/',
    author: 'Redaktion Wirtschaft',
    category: 'Europa',
    publishedAt: minsAgo(36),
    readingTimeMin: 4,
    imageUrl: renewableImg,
    keywords: ['europa', 'energie', 'erneuerbare', 'ausbau', 'wirtschaft', 'klima'],
    isBreaking: true,
  },
  {
    id: 'seed-eu-parlament',
    sourceId: 'faz',
    sourceName: 'FAZ.NET',
    sourceShortCode: 'FAZ',
    sourceColor: '#CBD5E1',
    title: 'Europaparlament: Die wichtigsten Entscheidungen und ihre Folgen',
    summary:
      'Welche Weichen stellt das Europaparlament bei Digitalpolitik, Wettbewerbsfähigkeit und Sicherheit? Eine Einordnung der Kräfteverhältnisse.',
    paragraphs: [
      'In Straßburg und Brüssel stehen richtungsweisende Abstimmungen zur industriellen Wettbewerbsfähigkeit Europas auf der Agenda. Im Fokus stehen vereinfachte Berichtspflichten für mittelständische Unternehmen sowie gemeinsame Investitionen in digitale Souveränität.',
      'Beobachter verweisen darauf, dass sich die Mehrheiten je nach Dossier deutlich flexibler gestalten als in früheren Legislaturperioden. Während bei Infrastrukturprojekten breiter Konsens herrscht, wird über Haushaltsprioritäten intensiv gerungen.',
      'Für Deutschland als größte Volkswirtschaft der Union ist vor allem die Frage entscheidend, wie schnell europäische Förderprogramme in konkrete Industrieprojekte überführt werden können.',
    ],
    link: 'https://www.faz.net/aktuell/politik/ausland/',
    author: 'Korrespondent Brüssel',
    category: 'Europa',
    publishedAt: minsAgo(62),
    readingTimeMin: 5,
    imageUrl: euParliamentImg,
    keywords: ['europaparlament', 'europa', 'brüssel', 'politik', 'wettbewerb'],
  },
  {
    id: 'seed-bundestag-sicherheit',
    sourceId: 'zdfheute',
    sourceName: 'ZDFheute',
    sourceShortCode: 'ZDF',
    sourceColor: '#F59E0B',
    title: 'Bund berät neues Paket für innere Sicherheit und Katastrophenschutz',
    summary:
      'Innenministerium und Länder koordinieren zusätzliche Mittel für Bevölkerungsschutz, digitale Krisenwarnung und kritische Infrastruktur.',
    paragraphs: [
      'Im Bundestag beginnen heute die Beratungen über ein umfassendes Gesetz zur Stärkung der Resilienz kritischer Infrastrukturen. Dazu zählen Energieversorger, Krankenhäuser, Telekommunikationsnetze und kommunale Wasserwerke.',
      'Geplant ist unter anderem eine engere Verzahnung von Bundesamt für Bevölkerungsschutz und den Katastrophenstäben der Länder sowie ein Ausbau redundanter Warnkanäle auf Smartphones.',
      'Kommunale Spitzenverbände fordern begleitend eine verlässliche Gegenfinanzierung durch den Bund, damit Städte und Landkreise die neuen Sicherheitsstandards zügig umsetzen können.',
    ],
    link: 'https://www.zdf.de/nachrichten/politik/',
    author: 'Hauptstadtstudio Berlin',
    category: 'Politik',
    publishedAt: minsAgo(120),
    readingTimeMin: 3,
    imageUrl: bundestagImg,
    keywords: ['bundestag', 'sicherheit', 'politik', 'berlin', 'infrastruktur'],
  },
  {
    id: 'seed-ki-chips',
    sourceId: 'heise',
    sourceName: 'heise online',
    sourceShortCode: 'HO',
    sourceColor: '#38BDF8',
    title: 'KI und Chips: Der neue Wettlauf um effiziente Rechenpower',
    summary:
      'Wie spezialisierte NPU-Architekturen und lokale Sprachmodelle Smartphones unabhängiger von Cloud-Rechenzentren machen.',
    paragraphs: [
      'Die nächste Generation mobiler Prozessoren setzt verstärkt auf dedizierte Matrix-Beschleuniger und vereinheitlichten Speicher mit hoher Bandbreite. Damit lassen sich kompakte Sprach- und Analysemodelle direkt auf dem Endgerät ausführen.',
      'Für Nutzerinnen und Nutzer bedeutet dieser Trend nicht nur geringere Latenzzeiten, sondern auch echten Datenschutz: Texte, Zusammenfassungen und persönliche Präferenzen verlassen das eigene Smartphone gar nicht erst.',
      'Gleichzeitig arbeiten europäische Forschungsinstitute an offenen Chip-Designs auf RISC-V-Basis, um langfristig eigene Fertigungs- und Entwicklungskapazitäten in Europa zu stärken.',
    ],
    link: 'https://www.heise.de/thema/Kuenstliche-Intelligenz',
    author: 'Redaktion Hardware & KI',
    category: 'Technologie',
    publishedAt: minsAgo(180),
    readingTimeMin: 4,
    imageUrl: aiChipImg,
    keywords: ['chips', 'halbleiter', 'technologie', 'rechenpower', 'lokal'],
  },
  {
    id: 'seed-exoplaneten',
    sourceId: 'nasa',
    sourceName: 'NASA Breaking News',
    sourceShortCode: 'NASA',
    sourceColor: '#2563EB',
    title: 'Forscher finden neue Hinweise auf wasserreiche Exoplaneten',
    summary:
      'Spektralanalysen liefern detaillierte Daten zur Atmosphäre ferner Super-Erden und rücken die Frage nach bewohnbaren Welten näher.',
    paragraphs: [
      'Mithilfe hochauflösender Infrarot-Spektroskopie hat ein internationales Forschungsteam neue Signaturen von Wasserdampf und Wolkenstrukturen in der Atmosphäre eines rund 120 Lichtjahre entfernten Exoplaneten nachgewiesen.',
      'Die Messungen erlauben erstmals präzisere Modelle darüber, wie sich Ozeane auf Planeten entwickeln können, die etwas größer und massereicher als die Erde sind.',
      'In den kommenden Monaten sollen weitere Beobachtungsfenster genutzt werden, um zusätzlich nach Spurengasen wie Kohlendioxid und Methan zu suchen.',
    ],
    link: 'https://www.nasa.gov/universe/exoplanets/',
    author: 'Science Mission Directorate',
    category: 'Wissenschaft',
    publishedAt: minsAgo(420),
    readingTimeMin: 4,
    imageUrl: exoplanetImg,
    keywords: ['exoplaneten', 'wissenschaft', 'weltraum', 'forschung', 'wasser'],
  },
  {
    id: 'seed-wirtschaft-konjunktur',
    sourceId: 'handelsblatt',
    sourceName: 'Handelsblatt',
    sourceShortCode: 'HB',
    sourceColor: '#F97316',
    title: 'Märkte im Aufwind: Was die Erholung im Industrie-Sektor trägt',
    summary:
      'Stabilere Lieferketten, sinkende Energiepreise und Investitionen in Automatisierung stützen die Exportaussichten.',
    paragraphs: [
      'Nach mehreren verhaltenen Quartalen zeigen aktuelle Einkaufsmanagerindizes erste Anzeichen einer Stabilisierung im verarbeitenden Gewerbe. Besonders Unternehmen aus den Bereichen Energietechnik, Maschinenbau und Software verzeichnen wieder steigende Auftragseingänge.',
      'Volkswirte führen diese Entwicklung auf eine Kombination aus nachlassendem Preisdruck bei Vorprodukten und einer allmählichen Entspannung bei den Finanzierungskosten zurück.',
      'Entscheidend für eine nachhaltige Trendwende bleibt jedoch, ob geplante Investitionen in Verkehrswege und digitale Verwaltung zügig abgerufen werden.',
    ],
    link: 'https://www.handelsblatt.com/finanzen/',
    author: 'Finanzredaktion',
    category: 'Wirtschaft',
    publishedAt: minsAgo(290),
    readingTimeMin: 3,
    imageUrl: renewableImg,
    keywords: ['wirtschaft', 'märkte', 'konjunktur', 'industrie', 'export'],
  },
];
