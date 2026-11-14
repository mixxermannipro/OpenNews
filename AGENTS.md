# OpenNews

- Node.js 22 und npm verwenden. Abhängigkeiten mit `npm ci` installieren.
- `npm run dev` startet die Web-App mit ihrem Express-Server.
- Vor einem PR `npm run lint`, `npm test`, `npm run build` und `git diff --check` ausführen.
- Die Web-Oberfläche liegt in `src/`. Native Android-Erweiterungen liegen in `native/android/` und werden beim Sync kopiert.
- Nutzerprofile und persönliche Einstellungen bleiben lokal. Änderungen an der Datenübertragung auch in der README beschreiben.
- Zugangsdaten und von Capacitor erzeugte Android-Dateien gehören außerhalb von Git.
