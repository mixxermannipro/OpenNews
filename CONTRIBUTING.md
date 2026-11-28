# Zu OpenNews beitragen

`npm ci` richtet das Projekt mit Node.js 22 ein (`.nvmrc` und `engine-strict=true` in `.npmrc` erzwingen mindestens Node 22). `npm run dev` startet Web-App und API lokal. Die [README](README.md) beschreibt auch den Android-Testbuild.

## Bewusste Abhängigkeitsentscheidungen

- **`express@^4.21.2`:** Bleibt bewusst auf Express 4, solange `express-rate-limit` und die schlanke API-Adapter-Schicht damit stabil ohne Migrationsrisiko laufen.
- **`lucide-react@^0.546.0`:** Bleibt stabil gepinnt, um unerwartete Icon-Umbenennungen oder Tree-Shaking-Sprünge am 170-KiB-JS-Budget zu vermeiden.
- **Abhängigkeits-Audits:** `npm audit --omit=dev --audit-level=moderate` läuft fest in der Web-CI (gepatchte `minimatch`/`glob`-Versionen via `overrides`).

Eröffne für eine konkrete Änderung einen Branch. Beschreibe im Pull Request das Problem, die Lösung und die ausgeführten Prüfungen. Bei Änderungen an der Oberfläche hilft ein Bildschirmfoto ohne persönliche Daten.

Vor dem Pull Request:

```sh
npm run lint
npm test
npm run build
git diff --check
```

Für Sicherheitslücken gilt der [vertrauliche Meldeweg](SECURITY.md). Für die Zusammenarbeit gilt der [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Lizenz und Beiträge

OpenNews ist Open Source und steht unter **AGPL-3.0-or-later** ([LICENSE](LICENSE), [LICENSES/AGPL-3.0-or-later.txt](LICENSES/AGPL-3.0-or-later.txt)). Bis Commit `d6cd0de2ab7fe5c97678fc9a04e62d2ee5dcd839` war der Code unter [Apache-2.0](LICENSES/Apache-2.0.txt) verfügbar und bleibt es in dieser Historie. Name und Logo sind nicht mitlizenziert ([TRADEMARKS.md](TRADEMARKS.md)).

Für Beiträge gilt das **Developer Certificate of Origin (DCO)** in Version 1.1 (<https://developercertificate.org/>). Mit dem Einreichen eines Pull Requests und dem Sign-off deiner Commits (`git commit -s`, erzeugt `Signed-off-by: Name <email>`) bestätigst du, dass du berechtigt bist, den Beitrag unter der Projektlizenz (`AGPL-3.0-or-later`) einzureichen. Kennzeichne separat lizenzierte Inhalte und deren Hinweise im Pull Request.

Entferne vor dem Einreichen Zugangsdaten und personenbezogene Angaben aus
Logs, Testdaten und Bildschirmfotos. Kennzeichne separat lizenzierte Inhalte.
