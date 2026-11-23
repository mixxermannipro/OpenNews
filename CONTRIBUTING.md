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

## Licensing and contribution rights

OpenNews is **source-available, not OSI-approved open source**. See [LICENSE](LICENSE). Reading and proposing improvements is welcome, but the project license does not grant general permission to redistribute or commercially exploit OpenNews. Statutory rights, GitHub's terms and separate third-party licenses remain unaffected.

Submit only contributions you own or are authorized to license. By submitting a pull request, you grant the project maintainer a perpetual, worldwide, non-exclusive, royalty-free license to review, reproduce, modify, incorporate, and distribute your submitted contribution as part of OpenNews, including under the project's source-available terms. You retain ownership of your original contribution. Do not submit code if you cannot grant these rights.

Do not commit private data, API tokens, signing material, copyrighted screenshots, or third-party assets without appropriate rights.
