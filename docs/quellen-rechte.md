# Quellen, Senderdaten und Nutzungsrechte

Stand: 26. November 2026

OpenNews enthält vorkonfigurierte Nachrichten-Feeds (RSS/Atom/JSON) sowie 50 Live-Radiostreams. Standardmäßig ist keine Quelle vorausgewählt (`subscribed: false`); Nutzer stellen sich ihren Feed selbst zusammen oder importieren eigene OPML-Listen.

## Herkunft und Nutzungsgrundlagen

| Bereich | Herkunft / Technik | Rechtliche Einordnung & Hinweise |
|---|---|---|
| **Nachrichten-Feeds** (`src/lib/catalog.ts`) | Öffentliche, von Verlagen und Rundfunkanstalten bereitgestellte RSS-, Atom- und JSON-Feeds | OpenNews ruft ausschließlich die öffentlich angebotenen Syndication-Feeds ab, zeigt Quelle, Titel, Teaser und verlinkt direkt auf den Originalartikel. |
| **Artikel-Volltext** | Optionales Opt-in pro Quelle im Reader (standardmäßig ausgeschaltet) | Kein serverseitiger Volltext-Cache (`Cache-Control: no-store`), Respektierung von `X-Robots-Tag` / `<meta name="robots">` (`noarchive`, `noai`), Paywall-Erkennung ohne Umgehung und Domain-Opt-out. Siehe [Artikelvolltext](artikelvolltext.md). |
| **Live-Radiosender** (`src/lib/radioCatalog.ts`, `AutoAudioCatalog.java`) | Öffentliche HTTPS-Livestreams öffentlich-rechtlicher und privater Radiosender | Streams werden direkt vom jeweiligen Endgerät beim Sender abgerufen (kein Re-Streaming, keine Aufzeichnung, kein Server-Proxy). |
| **Sender-Kacheln & Icons** (`AutoArtworkProvider.java`) | Generierte Grafiken (Farbfläche + Kurzcode + Region-Label) | OpenNews verwendet auf Android Auto ausschließlich selbst gezeichnete, neutrale Typografie-Kacheln ohne fremde Senderlogos oder geschützte Markengrafiken. Quellen-Icons im Web werden nur als kleine redaktionelle Zuordnung verwendet; bei Rechten oder Opt-out-Wünschen werden Einträge umgehend ersetzt. |

## Verlags-Opt-out und Pflege

Verlage und Sender können die Entfernung aus dem Standardkatalog oder das Sperren des serverseitigen Volltext-Abrufs jederzeit formlos beantragen:

- E-Mail an den Betreiberkontakt in [datenschutz.md](datenschutz.md) oder ein Issue im GitHub-Repository.
- Technisch wird die Domain in `src/lib/publisherPolicy.ts` (`DEFAULT_OPTOUT_DOMAINS`) oder per Umgebungsvariable `OPENNEWS_OPTOUT_DOMAINS` gesperrt.

## Automatische Erreichbarkeitsprüfung

Ein wöchentlicher GitHub-Actions-Workflow (`.github/workflows/feed-health-check.yml`) führt `node scripts/check-feeds.mjs` aus und prüft alle vorkonfigurierten Feed- und Stream-URLs auf Erreichbarkeit (HTTP-Status). Bei dauerhaft toten Einträgen eröffnet oder aktualisiert der Workflow automatisch ein GitHub-Issue zur Bereinigung.
