package io.opennews.app;

import java.text.Normalizer;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

final class AutoAudioCatalog {
    static final class FeedSpec {
        final String id;
        final String name;
        final String url;
        final String language;
        final String region;
        final boolean newsUpdate;

        FeedSpec(String id, String name, String url, String language, String region, boolean newsUpdate) {
            this.id = id;
            this.name = name;
            this.url = url;
            this.language = language;
            this.region = region;
            this.newsUpdate = newsUpdate;
        }
    }

    static final class RadioSpec {
        final String id;
        final String name;
        final String subtitle;
        final String streamUrl;
        final String language;
        final String region;
        final String shortCode;
        final String accentColor;
        final boolean newsCategory;
        final boolean musicCategory;
        final String keywords;

        RadioSpec(
            String id,
            String name,
            String subtitle,
            String streamUrl,
            String language,
            String region,
            String shortCode,
            String accentColor,
            boolean newsCategory,
            String keywords
        ) {
            this(id, name, subtitle, streamUrl, language, region, shortCode, accentColor, newsCategory, false, keywords);
        }

        RadioSpec(
            String id,
            String name,
            String subtitle,
            String streamUrl,
            String language,
            String region,
            String shortCode,
            String accentColor,
            boolean newsCategory,
            boolean musicCategory,
            String keywords
        ) {
            this.id = id;
            this.name = name;
            this.subtitle = subtitle;
            this.streamUrl = streamUrl;
            this.language = language;
            this.region = region;
            this.shortCode = shortCode;
            this.accentColor = accentColor;
            this.newsCategory = newsCategory;
            this.musicCategory = musicCategory;
            this.keywords = keywords;
        }
    }

    static final List<FeedSpec> BUILTIN_FEEDS = Collections.unmodifiableList(Arrays.asList(
        new FeedSpec("tagesschau-20-audio", "Tagesschau 20 Uhr (Audio)", "https://www.tagesschau.de/tagesschau_20_uhr/podcast-ts2000-audio-100~podcast.xml", "de", "DE", true),
        new FeedSpec("tagesschau-100s-audio", "Tagesschau in 100 Sek. (Audio)", "https://www.tagesschau.de/tagesschau_in_100_sekunden/podcast-ts100-audio-100~podcast.xml", "de", "DE", true),
        new FeedSpec("tagesthemen-audio", "Tagesthemen (Audio)", "https://www.tagesschau.de/tagesthemen/podcast-tt-audio-100~podcast.xml", "de", "DE", true),
        new FeedSpec("dlf-nachrichten-audio", "Deutschlandfunk Nachrichten", "https://www.deutschlandfunk.de/nachrichten-108.xml", "de", "DE", true),
        new FeedSpec("ndr-info-nachrichten", "NDR Info Nachrichten", "https://www.ndr.de/nachrichten/info/podcast4370.xml", "de", "DE", true),
        new FeedSpec("zdf-heute-journal-podcast", "heute journal – der Podcast", "https://cdn.audiorella.com/podcasts/1477-heute-journal-der-podcast/feed.rss", "de", "DE", true),
        new FeedSpec("dlf-aktuell", "Deutschlandfunk aktuell", "https://www.deutschlandfunk.de/informationen-am-morgen-102.xml", "de", "DE", true),
        new FeedSpec("dlf-der-tag", "Deutschlandfunk – Der Tag", "https://www.deutschlandfunk.de/podcast-104.xml", "de", "DE", true),
        new FeedSpec("srf-echo-der-zeit", "SRF Echo der Zeit", "https://www.srf.ch/feed/podcast/sd/28549e81-c453-4671-92ad-cb28796d06a8.xml", "de", "CH", true),
        new FeedSpec("bbc-global-podcast", "BBC Global News Podcast", "https://podcasts.files.bbci.co.uk/p02nq0gn.rss", "en", "UK", true),
        new FeedSpec("npr-up-first", "NPR Up First", "https://feeds.npr.org/510318/podcast.xml", "en", "US", true),
        new FeedSpec("rfi-francais-facile", "RFI Journal en français facile", "https://francaisfacile.rfi.fr/fr/podcasts/journal-en-fran%C3%A7ais-facile/podcast", "fr", "FR", true),
        new FeedSpec("lage-der-nation", "Lage der Nation", "https://feeds.lagedernation.org/feeds/ldn-mp3.xml", "de", "DE", false),
        new FeedSpec("handelsblatt-today", "Handelsblatt Today", "https://handelsblatt-today.podigee.io/feed/mp3", "de", "DE", false),
        new FeedSpec("apokalypse-filterkaffee", "Apokalypse & Filterkaffee", "https://apokalypse-und-filterkaffee.podigee.io/feed/mp3", "de", "DE", false),
        new FeedSpec("dlf-forschung-audio", "DLF Forschung aktuell", "https://www.deutschlandfunk.de/forschung-aktuell-104.xml", "de", "DE", false),
        new FeedSpec("guardian-today-focus", "Today in Focus (Guardian)", "https://www.theguardian.com/news/series/todayinfocus/podcast.xml", "en", "UK", false),
        new FeedSpec("npr-planet-money", "NPR Planet Money", "https://feeds.npr.org/510289/podcast.xml", "en", "US", false),
        new FeedSpec("npr-short-wave", "NPR Short Wave", "https://feeds.npr.org/510351/podcast.xml", "en", "US", false),
        new FeedSpec("bbc-tech-life", "BBC Tech Life", "https://podcasts.files.bbci.co.uk/p002w6r2.rss", "en", "UK", false),
        new FeedSpec("vergecast", "The Vergecast", "https://feeds.megaphone.fm/vergecast", "en", "US", false),
        new FeedSpec("ilpost-scienza", "Il Post – Ci vuole una scienza", "https://www.ilpost.it/podcasts/ci-vuole-una-scienza/feed/", "it", "IT", false)
    ));

    static final List<RadioSpec> RADIO_STATIONS = Collections.unmodifiableList(Arrays.asList(
        new RadioSpec("dlf", "Deutschlandfunk", "Nachrichten, Hintergründe & Analysen", "https://st01.sslstream.dlf.de/dlf/01/128/mp3/stream.mp3", "de", "DE", "DLF", "#1D4ED8", true, "dlf deutschlandfunk nachrichten inforadio politik"),
        new RadioSpec("dlf-kultur", "Deutschlandfunk Kultur", "Kultur, Feuilleton & Debatten", "https://st02.sslstream.dlf.de/dlf/02/128/mp3/stream.mp3", "de", "DE", "DK", "#7C3AED", false, "dlf kultur feuilletton radio"),
        new RadioSpec("dlf-nova", "Deutschlandfunk Nova", "Wissen, Netzpolitik & Gesellschaft", "https://st03.sslstream.dlf.de/dlf/03/128/mp3/stream.mp3", "de", "DE", "DN", "#059669", false, "dlf nova wissen netzpolitik"),
        new RadioSpec("dlf-dokdeb", "Deutschlandfunk DokDeb", "Bundestagsdebatten & Sondersendungen", "https://st04.sslstream.dlf.de/dlf/04/128/mp3/stream.mp3", "de", "DE", "DD", "#0284C7", true, "dlf dokdeb bundestag debatten"),
        new RadioSpec("ndr-info", "NDR Info", "Alle 15 Minuten Nachrichten", "https://icecast.ndr.de/ndr/ndrinfo/niedersachsen/mp3/128/stream.mp3", "de", "DE", "NDR", "#1E40AF", true, "ndr info ard nachrichten"),
        new RadioSpec("br24", "BR24", "Nachrichten & Bayern im 15-Minuten-Takt", "https://dispatcher.rndfnk.com/br/br24/live/mp3/mid", "de", "DE", "BR24", "#0369A1", true, "br24 b5 aktuell bayern ard nachrichten"),
        new RadioSpec("wdr5", "WDR 5", "Informations- und Wortprogramm", "https://wdr-wdr5-live.icecastssl.wdr.de/wdr/wdr5/live/mp3/128/stream.mp3", "de", "DE", "WDR5", "#2563EB", true, "wdr 5 wdr5 ard nrw morgenecho"),
        new RadioSpec("rbb24-inforadio", "rbb24 Inforadio", "Nachrichten für Berlin & Brandenburg", "https://dispatcher.rndfnk.com/rbb/inforadio/live/mp3/mid", "de", "DE", "RBB", "#B91C1C", true, "rbb rbb24 inforadio berlin brandenburg"),
        new RadioSpec("swr-aktuell", "SWR Aktuell", "Informationen & Meldungen live", "https://liveradio.swr.de/sw282p3/swraktuell/", "de", "DE", "SWR", "#0F766E", true, "swr aktuell ard baden wuerttemberg"),
        new RadioSpec("hr-info", "hr-iNFO", "Nachrichten, Wirtschaft & Wissen aus Hessen", "https://dispatcher.rndfnk.com/hr/hrinfo/live/mp3/high", "de", "DE", "HR", "#0E7490", true, "hr info hessen ard nachrichten"),
        new RadioSpec("mdr-aktuell", "MDR Aktuell", "Das Nachrichtenradio für Mitteldeutschland", "https://mdr-284340-0.sslcast.mdr.de/mdr/284340/0/mp3/high/stream.mp3", "de", "DE", "MDR", "#1D4ED8", true, "mdr aktuell ard sachsen thueringen"),
        new RadioSpec("srf4-news", "SRF 4 News", "Das Informationsradio der Schweiz", "https://stream.srg-ssr.ch/srgssr/srf4news/mp3/128", "de", "CH", "SRF4", "#DC2626", true, "srf 4 news schweiz echo der zeit"),
        new RadioSpec("orf-oe1", "ORF Ö1", "Journale, Politik & Kultur aus Österreich", "https://orf-live.ors-shoutcast.at/oe1-q2a", "de", "AT", "Ö1", "#B91C1C", true, "orf oe1 ö1 oesterreich journale"),
        new RadioSpec("bbc-world-service", "BBC World Service", "Global breaking news & reporting", "https://stream.live.vc.bbcmedia.co.uk/bbc_world_service", "en", "UK", "BBC", "#DC2626", true, "bbc world service uk english global"),
        new RadioSpec("npr-live", "NPR Program Stream", "Live U.S. & world public radio", "https://npr-ice.streamguys1.com/live.mp3", "en", "US", "NPR", "#0284C7", true, "npr usa public radio english"),
        new RadioSpec("france-info", "France Info", "Toute l'actualité en direct", "https://icecast.radiofrance.fr/franceinfo-midfi.mp3", "fr", "FR", "FI", "#D97706", true, "franceinfo france info radio france"),
        new RadioSpec("france-inter", "France Inter", "Information, débats et culture", "https://icecast.radiofrance.fr/franceinter-midfi.mp3", "fr", "FR", "INT", "#E11D48", false, "france inter radio france"),
        new RadioSpec("rfi-monde", "RFI Monde", "L'actualité internationale en français", "https://rfimonde64k.ice.infomaniak.ch/rfimonde-64.mp3", "fr", "FR", "RFI", "#DC2626", true, "rfi monde francais"),
        new RadioSpec("rne-radio5", "RNE Radio 5 Todo Noticias", "Información continua de España", "https://dispatcher.rndfnk.com/crtve/rne5/main/mp3/high", "es", "ES", "RNE5", "#EA580C", true, "rne radio 5 rtve espana noticias"),
        new RadioSpec("cadena-ser", "Cadena SER", "Noticias y análisis en directo", "https://playerservices.streamtheworld.com/api/livestream-redirect/CADENASER.mp3", "es", "ES", "SER", "#0284C7", true, "cadena ser espana noticias"),
        new RadioSpec("rai-radio1", "Rai Radio 1", "Giornali radio e informazione", "https://icestreaming.rai.it/1.mp3", "it", "IT", "RAI1", "#2563EB", true, "rai radio 1 italia giornale radio"),
        new RadioSpec("tsf-pt", "TSF Rádio Notícias", "Notícias em direto de Portugal", "https://tsfdirecto.tsf.pt/tsfdirecto.mp3", "pt", "PT", "TSF", "#DC2626", true, "tsf portugal noticias"),
        new RadioSpec("observador-pt", "Rádio Observador", "Informação em tempo real de Lisboa", "https://playerservices.streamtheworld.com/api/livestream-redirect/OBSERVADOR.mp3", "pt", "PT", "OBS", "#0369A1", true, "observador portugal lisboa"),
        new RadioSpec("cbn-br", "CBN São Paulo", "A rádio que toca notícia ao vivo", "https://playerservices.streamtheworld.com/api/livestream-redirect/CBN_SP.mp3", "pt", "BR", "CBN", "#B91C1C", true, "cbn brasil noticias"),
        new RadioSpec("swr3", "SWR3", "Pop, Charts & aktuelle Hits im Südwesten", "https://liveradio.swr.de/sw282p3/swr3/play.mp3", "de", "DE", "SWR3", "#E11D48", false, true, "swr3 pop musik charts ard"),
        new RadioSpec("1live", "1LIVE", "Junge Musik, Pop & Hip-Hop vom WDR", "https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3", "de", "DE", "1LIVE", "#DB2777", false, true, "1live einslive wdr pop musik"),
        new RadioSpec("wdr2", "WDR 2", "Pop-Klassiker, aktuelle Hits & NRW-Updates", "https://wdr-wdr2-rheinland.icecastssl.wdr.de/wdr/wdr2/rheinland/mp3/128/stream.mp3", "de", "DE", "WDR2", "#2563EB", false, true, "wdr2 wdr 2 pop musik nrw"),
        new RadioSpec("ndr2", "NDR 2", "Popmusik & Information für Norddeutschland", "https://icecast.ndr.de/ndr/ndr2/niedersachsen/mp3/128/stream.mp3", "de", "DE", "NDR2", "#0284C7", false, true, "ndr2 ndr 2 pop musik norden"),
        new RadioSpec("njoy", "N-JOY", "Charts, Urban & Dance vom NDR", "https://icecast.ndr.de/ndr/njoy/live/mp3/128/stream.mp3", "de", "DE", "NJOY", "#7C3AED", false, true, "njoy n-joy ndr pop dance"),
        new RadioSpec("bayern3", "BAYERN 3", "Hits, Pop & Comedy vom Bayerischen Rundfunk", "https://dispatcher.rndfnk.com/br/br3/live/mp3/mid", "de", "DE", "BR3", "#0369A1", false, true, "bayern 3 bayern3 br3 pop musik"),
        new RadioSpec("radioeins", "radioeins", "Indie, Alternative & Pop vom rbb", "https://dispatcher.rndfnk.com/rbb/radioeins/live/mp3/mid", "de", "DE", "r1", "#EA580C", false, true, "radioeins rbb indie alternative musik"),
        new RadioSpec("fritz", "Fritz", "Urban, Electro & Indie für Berlin & Brandenburg", "https://dispatcher.rndfnk.com/rbb/fritz/live/mp3/mid", "de", "DE", "FRITZ", "#9333EA", false, true, "fritz rbb electro hip hop indie"),
        new RadioSpec("cosmo", "COSMO", "Globale Sounds, Afrobeats, Reggae & Urban Pop", "https://wdr-cosmo-live.icecastssl.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3", "de", "DE", "COSMO", "#0D9488", false, true, "cosmo wdr world global beats"),
        new RadioSpec("dasding", "DASDING", "Deutschrap, Pop & Electro vom SWR", "https://liveradio.swr.de/sw282p3/dasding/play.mp3", "de", "DE", "DING", "#EC4899", false, true, "dasding swr rap pop musik"),
        new RadioSpec("youfm", "YOU FM", "Charts, Hip-Hop & Electronic vom hr", "https://dispatcher.rndfnk.com/hr/youfm/live/mp3/high", "de", "DE", "YOUFM", "#F59E0B", false, true, "you fm youfm hr hessen pop"),
        new RadioSpec("br-klassik", "BR-KLASSIK", "Sinfonik, Kammermusik & Konzerte rund um die Uhr", "https://dispatcher.rndfnk.com/br/brklassik/live/mp3/mid", "de", "DE", "KLAS", "#4338CA", false, true, "br klassik classic br konzert"),
        new RadioSpec("fluxfm", "FluxFM", "Alternative, Indie, Electronic & Subkultur aus Berlin", "https://streams.fluxfm.de/live/mp3-128/streams.fluxfm.de/", "de", "DE", "FLUX", "#E11D48", false, true, "fluxfm indie alternative berlin musik"),
        new RadioSpec("egofm", "egoFM", "Entdeckerradio für Indie, Alternative & Soul", "https://streams.egofm.de/egoFM-hq", "de", "DE", "egoFM", "#059669", false, true, "egofm indie alternative soul musik"),
        new RadioSpec("fm4", "FM4", "Alternative Rock, Electronic & Hip-Hop vom ORF", "https://orf-live.ors-shoutcast.at/fm4-q2a", "de", "AT", "FM4", "#D97706", false, true, "fm4 orf alternative indie wien"),
        new RadioSpec("oe3", "Hitradio Ö3", "Pop & aktuelle Hits aus Österreich", "https://orf-live.ors-shoutcast.at/oe3-q2a", "de", "AT", "Ö3", "#DC2626", false, true, "oe3 orf hits oesterreich"),
        new RadioSpec("srf3", "Radio SRF 3", "Pop, Rock & Live-Sessions aus der Schweiz", "https://stream.srg-ssr.ch/srgssr/srf3/mp3/128", "de", "CH", "SRF3", "#B91C1C", false, true, "srf3 srf 3 pop rock schweiz"),
        new RadioSpec("srf-virus", "Radio SRF Virus", "Urban, Electro & Alternativ-Sounds von SRF", "https://stream.srg-ssr.ch/srgssr/srfvirus/mp3/128", "de", "CH", "VIRUS", "#0F766E", false, true, "srf virus electro urban schweiz"),
        new RadioSpec("swiss-pop", "Radio Swiss Pop", "Nonstop Popmusik ohne Moderation", "https://stream.srg-ssr.ch/srgssr/rsp/mp3/128", "de", "CH", "POP", "#EC4899", false, true, "swiss pop musik schweiz"),
        new RadioSpec("swiss-jazz", "Radio Swiss Jazz", "Jazz, Soul & Blues nonstop aus Basel", "https://stream.srg-ssr.ch/srgssr/rsj/mp3/128", "de", "CH", "JAZZ", "#78350F", false, true, "swiss jazz soul blues schweiz"),
        new RadioSpec("swiss-classic", "Radio Swiss Classic", "Klassische Meisterwerke ohne Ansagen", "https://stream.srg-ssr.ch/srgssr/rsc_de/mp3/128", "de", "CH", "CLSC", "#3730A3", false, true, "swiss classic klassik schweiz"),
        new RadioSpec("fip", "FIP", "Eklektische Musik-Kuration aus Paris: Jazz, Funk, Indie", "https://icecast.radiofrance.fr/fip-midfi.mp3", "fr", "FR", "FIP", "#BE185D", false, true, "fip radio france paris eclectic jazz funk"),
        new RadioSpec("fip-groove", "FIP Groove", "Soul, Funk, Disco & Nu-Groove von Radio France", "https://icecast.radiofrance.fr/fipgroove-midfi.mp3", "fr", "FR", "GRV", "#9333EA", false, true, "fip groove soul funk disco musik"),
        new RadioSpec("fip-electro", "FIP Electro", "House, Techno & Downbeat-Electronics nonstop", "https://icecast.radiofrance.fr/fipelectro-midfi.mp3", "fr", "FR", "ELEC", "#06B6D4", false, true, "fip electro house electronic musik"),
        new RadioSpec("kexp", "KEXP 90.3 FM", "Independent Music Discovery & Live Sessions aus Seattle", "https://kexp-mp3-128.streamguys1.com/kexp128.mp3", "en", "US", "KEXP", "#EA580C", false, true, "kexp seattle indie alternative live"),
        new RadioSpec("somafm-groovesalad", "SomaFM Groove Salad", "Ambient, Chillout & Downtempo Beats zum Fokussieren", "https://ice1.somafm.com/groovesalad-128-mp3", "en", "US", "SOMA", "#10B981", false, true, "somafm groove salad ambient chillout focus")
    ));

    private AutoAudioCatalog() {}

    static FeedSpec findFeed(String id) {
        for (FeedSpec spec : BUILTIN_FEEDS) {
            if (spec.id.equals(id)) return spec;
        }
        return null;
    }

    static RadioSpec findRadio(String id) {
        for (RadioSpec spec : RADIO_STATIONS) {
            if (spec.id.equals(id)) return spec;
        }
        return null;
    }

    static boolean isNewsUpdateFeed(String id, String name, String url) {
        FeedSpec builtin = findFeed(id);
        if (builtin != null) return builtin.newsUpdate;
        String combined = (id + " " + name + " " + url).toLowerCase(Locale.ROOT);
        return combined.contains("tagesschau")
            || combined.contains("tagesthemen")
            || combined.contains("heute journal")
            || combined.contains("nachrichten")
            || combined.contains("up first")
            || combined.contains("global news")
            || combined.contains("echo der zeit");
    }

    static String normalizeSearch(String value) {
        if (value == null) return "";
        String lower = value.toLowerCase(Locale.ROOT)
            .replace("ä", "ae")
            .replace("ö", "oe")
            .replace("ü", "ue")
            .replace("ß", "ss");
        String decomposed = Normalizer.normalize(lower, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
            .replaceAll("[^a-z0-9]+", " ")
            .trim();
    }

    static String label(String lang, String key) {
        String l = (lang == null || lang.isEmpty()) ? "de" : lang.toLowerCase(Locale.ROOT);
        if (l.startsWith("en")) {
            switch (key) {
                case "updates": return "News Updates";
                case "podcasts": return "Podcasts";
                case "radio": return "Live Radio";
                case "radioNews": return "News & Culture Radio";
                case "radioMusic": return "Music Radio";
                case "queue": return "Queue";
                case "playAllTitle": return "Play all latest updates";
                case "playAllSub": return "Top bulletins from Tagesschau, DLF, ZDF & more";
                case "replay15": return "Back 15 sec";
                case "forward15": return "Forward 15 sec";
                case "today": return "Today";
                case "yesterday": return "Yesterday";
                case "live": return "LIVE";
                case "min": return "min";
                case "emptyQueue": return "No saved queue episodes yet";
                case "loadingUpdates": return "Loading latest news audio…";
                default: return key;
            }
        }
        if (l.startsWith("fr")) {
            switch (key) {
                case "updates": return "Flashs info";
                case "podcasts": return "Podcasts";
                case "radio": return "Radio en direct";
                case "radioNews": return "Info & Culture";
                case "radioMusic": return "Musique";
                case "queue": return "File d'attente";
                case "playAllTitle": return "Lire tous les derniers flashs";
                case "playAllSub": return "Bulletins d'actualité enchaînés";
                case "replay15": return "Reculer 15 s";
                case "forward15": return "Avancer 15 s";
                case "today": return "Aujourd'hui";
                case "yesterday": return "Hier";
                case "live": return "DIRECT";
                case "min": return "min";
                case "emptyQueue": return "Aucun épisode dans la file";
                case "loadingUpdates": return "Chargement des flashs info…";
                default: return key;
            }
        }
        if (l.startsWith("es")) {
            switch (key) {
                case "updates": return "Noticias";
                case "podcasts": return "Podcasts";
                case "radio": return "Radio en vivo";
                case "radioNews": return "Noticias y Cultura";
                case "radioMusic": return "Música";
                case "queue": return "Cola";
                case "playAllTitle": return "Reproducir últimos boletines";
                case "playAllSub": return "Resumen continuo de actualidad";
                case "replay15": return "Retroceder 15 s";
                case "forward15": return "Avanzar 15 s";
                case "today": return "Hoy";
                case "yesterday": return "Ayer";
                case "live": return "EN VIVO";
                case "min": return "min";
                case "emptyQueue": return "No hay episodios en cola";
                case "loadingUpdates": return "Cargando boletines de audio…";
                default: return key;
            }
        }
        if (l.startsWith("it")) {
            switch (key) {
                case "updates": return "Notiziari";
                case "podcasts": return "Podcast";
                case "radio": return "Radio live";
                case "radioNews": return "Notizie e Cultura";
                case "radioMusic": return "Musica";
                case "queue": return "Coda";
                case "playAllTitle": return "Riproduci gli ultimi notiziari";
                case "playAllSub": return "Edizioni recenti in sequenza";
                case "replay15": return "Indietro 15 s";
                case "forward15": return "Avanti 15 s";
                case "today": return "Oggi";
                case "yesterday": return "Ieri";
                case "live": return "LIVE";
                case "min": return "min";
                case "emptyQueue": return "Nessun episodio in coda";
                case "loadingUpdates": return "Caricamento notiziari audio…";
                default: return key;
            }
        }
        if (l.startsWith("pt")) {
            switch (key) {
                case "updates": return "Boletins";
                case "podcasts": return "Podcasts";
                case "radio": return "Rádio ao vivo";
                case "radioNews": return "Notícias e Cultura";
                case "radioMusic": return "Música";
                case "queue": return "Fila";
                case "playAllTitle": return "Ouvir últimos boletins";
                case "playAllSub": return "Edições mais recentes em sequência";
                case "replay15": return "Recuar 15 s";
                case "forward15": return "Avançar 15 s";
                case "today": return "Hoje";
                case "yesterday": return "Ontem";
                case "live": return "AO VIVO";
                case "min": return "min";
                case "emptyQueue": return "Nenhum episódio na fila";
                case "loadingUpdates": return "A carregar boletins de áudio…";
                default: return key;
            }
        }
        switch (key) {
            case "updates": return "Nachrichten-Updates";
            case "podcasts": return "Podcasts";
            case "radio": return "Live-Radio";
            case "radioNews": return "Nachrichten & Kultur";
            case "radioMusic": return "Musik-Radio";
            case "queue": return "Warteschlange";
            case "playAllTitle": return "Alle aktuellen Updates abspielen";
            case "playAllSub": return "Tagesschau, DLF, heute journal & mehr hintereinander";
            case "replay15": return "15 Sek. zurück";
            case "forward15": return "15 Sek. vor";
            case "today": return "Heute";
            case "yesterday": return "Gestern";
            case "live": return "LIVE";
            case "min": return "Min.";
            case "emptyQueue": return "Noch keine Episoden in der Warteschlange";
            case "loadingUpdates": return "Aktuelle Audio-Nachrichten werden geladen…";
            default: return key;
        }
    }

    static String formatEpisodeSubtitle(String lang, String sourceName, long publishedMs, int durationSec) {
        StringBuilder sb = new StringBuilder();
        if (sourceName != null && !sourceName.isEmpty()) {
            sb.append(sourceName);
        }
        if (publishedMs > 0) {
            String dayPart = formatRelativeDayTime(lang, publishedMs);
            if (!dayPart.isEmpty()) {
                if (sb.length() > 0) sb.append(" · ");
                sb.append(dayPart);
            }
        }
        if (durationSec > 0) {
            int mins = Math.max(1, Math.round(durationSec / 60.0f));
            if (sb.length() > 0) sb.append(" · ");
            sb.append(mins).append(' ').append(label(lang, "min"));
        }
        return sb.toString();
    }

    private static String formatRelativeDayTime(String lang, long publishedMs) {
        Calendar now = Calendar.getInstance();
        Calendar pub = Calendar.getInstance();
        pub.setTimeInMillis(publishedMs);

        SimpleDateFormat timeFmt = new SimpleDateFormat("HH:mm", Locale.getDefault());
        String timeStr = timeFmt.format(new Date(publishedMs));

        if (now.get(Calendar.YEAR) == pub.get(Calendar.YEAR)
            && now.get(Calendar.DAY_OF_YEAR) == pub.get(Calendar.DAY_OF_YEAR)) {
            return label(lang, "today") + " · " + timeStr;
        }

        Calendar yesterday = (Calendar) now.clone();
        yesterday.add(Calendar.DAY_OF_YEAR, -1);
        if (yesterday.get(Calendar.YEAR) == pub.get(Calendar.YEAR)
            && yesterday.get(Calendar.DAY_OF_YEAR) == pub.get(Calendar.DAY_OF_YEAR)) {
            return label(lang, "yesterday") + " · " + timeStr;
        }

        SimpleDateFormat dateFmt = new SimpleDateFormat("dd.MM. · HH:mm", Locale.getDefault());
        return dateFmt.format(new Date(publishedMs));
    }
}
