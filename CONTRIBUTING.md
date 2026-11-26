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

OpenNews ist source-available. Für neu beigesteuerte Projektdateien gelten
die Bedingungen in [LICENSE](LICENSE). Früher unter Apache-2.0 veröffentlichte
Bestandteile und separat lizenzierte Inhalte behalten ihre Rechte.

You retain ownership of your contribution. By intentionally submitting a pull
request for inclusion, you grant the project maintainer a perpetual,
worldwide, non-exclusive, royalty-free license to review, reproduce, modify,
incorporate, maintain and distribute your contribution as part of the project,
including under the published source-available terms and in the project's
official releases. Only submit material for which you can grant these
permissions. Identify any separately licensed portions and their notices
in the pull request. Previously granted rights remain valid.

Entferne vor dem Einreichen Zugangsdaten und personenbezogene Angaben aus
Logs, Testdaten und Bildschirmfotos. Kennzeichne separat lizenzierte Inhalte.
