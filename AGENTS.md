# OpenNews

- Node.js 22 und npm verwenden. Abhängigkeiten mit `npm ci` installieren.
- `npm run dev` startet die Web-App mit ihrem Express-Server.
- Vor einem PR `npm run lint`, `npm test`, `npm run build` und `git diff --check` ausführen.
- Die Produktwebsite liegt in `apps/website/`. Änderungen dort mit `npm run verify` aus diesem Ordner prüfen.
- Die Web-Oberfläche der App liegt in `src/`. Native Android-Erweiterungen liegen in `native/android/` und werden beim Sync kopiert.
- Nutzerprofile und persönliche Einstellungen bleiben lokal. Änderungen an der Datenübertragung auch in der README und in `docs/datenschutz.md` beschreiben.
- Zugangsdaten und von Capacitor erzeugte Android-Dateien gehören außerhalb von Git.
- Android-Release-Signierung:
  - `JAVA_HOME="$HOME/.local/share/jdks/temurin-21"` und `ANDROID_HOME="$HOME/Android/sdk"` verwenden.
  - Aktiver Upload-Keystore: `~/.local/share/opennews-signing/upload-v3.p12` (Alias `opennews-upload`, öffentliches Zertifikat `build/android-release/OpenNews-upload-certificate-v3.pem`).
  - Das Keystore-Passwort liegt im System-Schlüsselspeicher und wird ohne Ausgabe per `printf '%s\n' "$(secret-tool lookup application OpenNews purpose play-upload-v3)" | ... npm run android:release -- <versionCode>` an das Release-Skript übergeben.

## Dokumentation aktuell halten

- Die `README.md` wird bei **jeder** Änderung im selben Pull Request geprüft und aktualisiert.
- Alle vorhandenen Dokumente (`docs/*.md`, `AGENTS.md`, `CONTRIBUTING.md`, `DESIGN.md`, `PRODUCT.md`, `SECURITY.md`) werden kontinuierlich gepflegt, nicht nur bei großen Umbauten.
- Befehle, Pfade, API-Routen, Umgebungsvariablen sowie Quellen- und Testanzahl vor dem PR gegen den Code prüfen. Veraltete Angaben korrigieren oder entfernen.
- Neue Funktionen, Konfiguration und Datenübertragung sofort dokumentieren.
- Passt ein Dokument nicht mehr zur App, gilt das als Fehler und blockiert den PR.
