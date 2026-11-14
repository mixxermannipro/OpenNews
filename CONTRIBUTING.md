# Zu OpenNews beitragen

`npm ci` richtet das Projekt mit Node.js 22 ein. `npm run dev` startet Web-App und API lokal. Die [README](README.md) beschreibt auch den Android-Testbuild.

Eröffne für eine konkrete Änderung einen Branch. Beschreibe im Pull Request das Problem, die Lösung und die ausgeführten Prüfungen. Bei Änderungen an der Oberfläche hilft ein Bildschirmfoto ohne persönliche Daten.

Vor dem Pull Request:

```sh
npm run lint
npm test
npm run build
git diff --check
```

Für Sicherheitslücken gilt der [vertrauliche Meldeweg](SECURITY.md). Für die Zusammenarbeit gilt der [Verhaltenskodex](CODE_OF_CONDUCT.md).
