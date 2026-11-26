# Sicherheitsmeldungen

Melde vermutete Lücken vertraulich beim Repository-Inhaber [mixxermannipro](https://github.com/mixxermannipro). Wenn GitHub im Repository die private Meldung anbietet, nutze **Security → Report a vulnerability**. Andernfalls bitte den Inhaber über einen bestehenden Kontakt um einen vertraulichen Kanal.

Nenne die betroffene Version, den betroffenen Teil der App, die mögliche Auswirkung und die Voraussetzungen. Schwärze Zugangsdaten und persönliche Daten. Warte mit öffentlichen Details, bis die Behebung abgestimmt ist.

## Web-API, Herkunftsprüfung und Rate-Limiting

Sowohl der lokale Express-Server (`server.ts`) als auch die Cloudflare Pages Functions (`functions/api/[[path]].ts` → `src/lib/pagesApi.ts`) nutzen dieselbe gemeinsame Sicherheitslogik in `src/lib/apiCore.ts`:

- **Herkunftsprüfung (`checkApiOrigin`):** Alle `/api/*`-Endpunkte außer `/api/health` lehnen Anfragen ohne passenden `Origin`-Header **und** ohne `Sec-Fetch-Site: same-origin` (z. B. direkte `curl`-Aufrufe ohne Browser-Kontext) sowie fremde Origins mit HTTP `403` ab. Die Android-App nutzt `CapacitorHttp` direkt auf dem Gerät und ruft die Web-API nicht auf.
- **Rate-Limiting:** Einheitliche Grenzwerte in Express und Cloudflare Pages (optional über Workers-Bindings `RATE_LIMIT_API`, `RATE_LIMIT_AI`, `RATE_LIMIT_TTS` mit eingebautem Sliding-Window-Fallback):
  - Allgemein (`/api/*` außer `/api/health`): **65 Anfragen / Minute**
  - KI-Proxy (`/api/ai/proxy`): **10 Anfragen / Minute**
  - TTS-Proxy (`/api/tts/proxy`): **20 Anfragen / Minute**
- **SSRF- und Redirect-Schutz:** Alle ausgehenden URLs werden über `isSafeHttpUrl` (keine privaten IPs, Loopback, internen Domains oder Infrastruktur-Ports) validiert; Express erzwingt zusätzlich DNS-Pinning über `src/lib/publicHttp.ts`. Sensible Header werden bei domänenübergreifenden Weiterleitungen entfernt.
- **Kein Logging von Schlüsseln:** `redactSecrets()` maskiert gängige API-Key-Muster in Fehlerantworten. Weder Diagnose noch Proxy-Logs schreiben API-Schlüssel.
- **Web-Schlüsselspeicherung:** Im Web liegen optionale KI- und TTS-Schlüssel standardmäßig nur im flüchtigen `sessionStorage` (`src/lib/webSecretStorage.ts`). Dauerhaftes Speichern in `localStorage` erfolgt ausschließlich nach expliziter Opt-in-Einwilligung.

## KI und Quelleninhalte

OpenNews übergibt Artikel und Kurztexte als JSON in einem markierten Datenblock.
Der Auftrag an das Modell steht davor. Zusammenfassungen und Tagesüberblicke
werden vor der Anzeige oder Sprachausgabe auf Format und Länge geprüft.
Beim Tagesüberblick muss mindestens ein bekannter Quellenname vorkommen.
Diese Prüfungen begrenzen unerwartete Ausgaben. Die inhaltliche Treue der KI
zu den Quellen kann die App damit nur teilweise prüfen.

Der Test in `src/lib/aiClient.test.ts` prüft, dass ein präparierter Artikel
mit einem eingebetteten Trenner den Datenblock nicht verlassen kann.

## Offengelegte Zugangsdaten

Widerrufe oder rotiere einen versehentlich eingecheckten Schlüssel sofort beim Aussteller. Melde den betroffenen Commit und die Art des Schlüssels vertraulich, damit der Projektinhaber die Bereinigung abstimmen kann.
