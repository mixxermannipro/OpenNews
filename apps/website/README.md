# OpenNews-Website

Statische Produktwebsite für die OpenNews-App. Die Website, ihre Schriften und die vorbereiteten App-Aufnahmen liegen unter `apps/website/` im [OpenNews-Repository](../../README.md). Die Website wurde aus dem bisherigen Website-Repository mit Stand `f70e0e6` übernommen.

## Lokal ansehen

Mit Node.js 22 (mindestens 22.12) und npm:

```sh
cd apps/website
npm ci
npm run dev
```

Die Vorschau läuft unter [localhost:4321](http://localhost:4321). Der Produktionsbuild erzeugt HTML für die Startseite, Kontakt, Datenschutz, Impressum und die Fehlerseite. Die Feed-Auswahl und die FAQ funktionieren im Browser auch ohne JavaScript. JavaScript speichert die gewählte Darstellung lokal. Bilder und Schriften liegen im eigenen Projekt.

```sh
npx playwright install chromium
npm run verify
```

`verify` prüft Typen, Build, Konfiguration, statische Ausgabe und Interaktionen in Chromium. Der Build liegt in `dist/`. Mit `npm run preview` lässt er sich lokal öffnen.

## Cloudflare Pages

GitHub in Cloudflare unter **Workers & Pages → Create application → Pages → Connect to Git** verbinden. Der Cloudflare-Integration Zugriff auf `mixxermannipro/OpenNews` geben. Das Repository kann privat bleiben.

| Einstellung | Wert |
| --- | --- |
| Projekt | Pages, Free |
| Repository | `mixxermannipro/OpenNews` |
| Produktionsbranch | `main` |
| Vorschau-Deployments | Deaktivieren, wenn die Vorschau privat bleiben soll |
| Build-Watch-Pfade | `apps/website/**` |
| Framework-Preset | React (Vite) |
| Stammverzeichnis | `apps/website` |
| Build-Befehl | `npm run build` |
| Build-Ausgabe | `dist` |
| Node.js | `.nvmrc` wählt Node 22. Optional `NODE_VERSION` auf eine aktuelle 22.x-Version setzen. |

Pages weist dem Projekt eine HTTPS-Adresse unter `.pages.dev` zu. Diese exakte Adresse oder die eigene Produktionsdomain als `VITE_SITE_URL` setzen. Der Hostname muss mindestens einen Punkt enthalten, zum Beispiel `xyz.pages.dev`. Die Adresse darf keinen Unterpfad enthalten. So erhalten die kanonischen Links, Social-Vorschauen, strukturierten Daten und die Sitemap die richtige Domain. Änderungen an `apps/website/` auf `main` starten bei aktivierter Git-Integration einen neuen Build. Die Website braucht weder Datenbank noch API.

[Cloudflare-Anleitung für Git-Integration](https://developers.cloudflare.com/pages/get-started/git-integration/) · [Build-Einstellungen](https://developers.cloudflare.com/pages/configuration/build-configuration/) · [Node-Version](https://developers.cloudflare.com/pages/configuration/build-image/)

## Vor der Veröffentlichung

Die Standardkonfiguration ist für die lokale Vorschau bestimmt. Sie enthält eine Vorschau-Kennzeichnung auf den Rechteseiten und ein `noindex`-Signal. `noindex` verhindert keine Zugriffe. Cloudflare-Vorschauen bei Bedarf mit Cloudflare Access schützen oder deaktivieren.

1. Den Namen des Betreibers, die ladungsfähige Anschrift, die öffentliche E-Mail-Adresse und gegebenenfalls weitere Pflichtangaben bestätigen. Die E-Mail-Adresse über `VITE_CONTACT_EMAIL` setzen. Ohne diese Angabe erscheint auf Kontakt und Datenschutz ein Hinweis.
2. Den Entwurf auf der Datenschutzseite anhand der mit `TODO(Manuel)` markierten Punkte vervollständigen. Dazu gehören der Verantwortliche und die Angaben zum Hosting und zur Bearbeitung von Kontaktanfragen. Die App-Übersicht auf der Datenschutzseite beschreibt die wichtigsten Unterschiede. Vor einem Store-Launch zusätzlich die vollständigen App-Datenschutzhinweise prüfen und veröffentlichen.
3. App-Aufnahmen in `public/screenshots/` und das daraus erstellte Social-Bild `public/og/opennews.jpg` vor der öffentlichen Nutzung prüfen. Die Aufnahmen stammen aus der Entwicklung und enthalten teilweise Inhalte Dritter. Bei fehlender Freigabe durch Aufnahmen mit freigegebenen Inhalten ersetzen und das Social-Bild neu erstellen. Die geplante Play-Beta verlinkt auf die Originale und unterscheidet sich in der Darstellung von den Entwicklungsaufnahmen.
4. In den Produktions-Einstellungen von Pages die bestätigten Werte aus [.env.example](.env.example) hinterlegen. `VITE_WEBSITE_PRIVACY_NOTICE` erhält den fertigen Hinweis zu Hosting und Kontakt als Text. `VITE_IMPRINT_DETAILS` steht für zusätzliche Angaben bereit. Nach der Prüfung `VITE_RELEASE_APPROVED=yes` und `VITE_SITE_STATUS=live` setzen. Der Live-Build prüft, ob die dafür nötigen Angaben vorhanden sind. Er prüft die Inhalte nicht rechtlich.
5. Lokal oder über eine geschützte Vorschau testen, dann die Veröffentlichung in Pages auslösen. Die `VITE_*`-Werte sind öffentliche Website-Angaben. Zugangsdaten gehören dort nicht hinein.

Den Google-Play-Link erst bei öffentlicher Freigabe als `VITE_PLAY_STORE_URL` setzen. Er muss zum Paket `io.opennews.app` führen. Bis dahin zeigt der Bereich den Teststatus. `VITE_WEB_APP_URL` ist optional und sollte erst auf eine bestätigte öffentliche Web-App zeigen.

## Lizenz

Für den eigenen Quellcode, die Texte und die Gestaltung gilt der [Rechtevorbehalt des Projekts](../../LICENSE). Für Schriften gelten die [beiliegenden OFL-Lizenzen](public/fonts/), für Inhalte Dritter die Rechte der jeweiligen Inhaber.
