# Deine nächsten Schritte in Google Play Console

Stand 19. November 2026. Die Pfade beziehen sich auf die englische Oberfläche,
damit du die Bezeichnungen in der verlinkten Google-Hilfe wiederfindest.
Schritte 1–4 sowie die Vorbereitung von Schritt 5 (Länder/Regionen, Testerliste,
Release `0.1.0-alpha.1` mit `4.aab` und Versionshinweisen) sind in Google Play Console
bereits ausgefüllt und gespeichert. Offen bleibt nur die finale Einreichung zur
Überprüfung und anschließend der 14-tägige geschlossene Test mit mindestens 12 Testern.

1. **Konto bestätigen und App anlegen.** Öffne **Home → Dashboard** und
   erledige offene Verifizierungsaufgaben von Google. Falls Google einen
   Gerätenachweis verlangt, folge dort dem Link zur Play-Console-App auf
   einem echten Android-Gerät. Dann **All apps → Create app** wählen.
   Eingaben sind `OpenNews`, Paket `io.opennews.app` falls abgefragt,
   Standardsprache Deutsch (Deutschland), Typ **App**, **Free**. Google
   erhält Identitätsnachweise direkt von dir. Für die Unterlagen brauchst du
   die bereits bestätigte Support-E-Mail `mixxermannipropvp@gmail.com`. [App einrichten](https://support.google.com/googleplay/android-developer/answer/9859152)
2. **Betreiber und Inhalte bestätigen.** Gib den Namen und die
   ladungsfähige Anschrift des Betreibers und die geplante öffentliche
   Website an. Die bestätigte E-Mail dient auch als Datenschutzkontakt. Bestätige
   Startländer, die Zielgruppe und die Entscheidung zu fremden Volltexten,
   Bildern, Publisher-Logos und eingebetteten Medien. Die Angaben fließen in
   den finalen [Datenschutztext](datenschutz.md) und die
   Nachrichten-Deklaration. Sobald die HTTPS-Seite bereitsteht, in
   **Monitor and improve → Policy and programs → App content → Privacy policy**
   die URL eintragen. Dort auch **Data safety**, **Content ratings**,
   **Target audience and content**, **Ads**, **App access** und
   **News and magazine apps** anhand des geprüften Pakets und der [vorbereiteten Angaben](android-release.md#play-console--vorbereitung-der-angaben) ausfüllen.
   OpenNews als Nachrichtenaggregator beschreiben.
   [Pflichtangaben](https://support.google.com/googleplay/android-developer/answer/9859455)
   · [Nachrichten-Deklaration](https://support.google.com/googleplay/android-developer/answer/16189314)
3. **Store-Eintrag einsetzen.** Unter **Grow users → Store presence →
   Store settings** Kategorie **News & Magazines** und öffentliche
   Kontaktangaben setzen. Unter **Grow users → Store presence → Main store
   listing** die [Texte und Grafiken](play-store-listing.md) einsetzen,
   über **Manage translations → Add translations** Englisch ergänzen und
   die Vorschau prüfen.
   [Store-Grafiken](https://support.google.com/googleplay/android-developer/answer/9866151)
4. **Internen Test starten.** Unter **Test and release → Testing → Internal
   testing → Testers** eine kleine Liste vertrauenswürdiger Google-Konten
   pflegen. Unter **Releases → Create new release** Play App Signing
   einrichten und den freigegebenen lokalen Kandidaten
   `build/android-release/OpenNews-4.aab` aus dem
   [Freigabeprotokoll](android-release.md#signierter-kandidat-vom-16-november-2026) hochladen. Unter **Test and
   release → Setup → App signing** das Upload-Zertifikat mit dem lokalen
   SHA-256-Fingerabdruck abgleichen. Dann **Next → Start rollout to Internal
   testing** und den Anmeldelink teilen. Benötigt werden AAB,
   Tester-E-Mails (direkt in Play Console) und der lokale Fingerabdruck.
   [App-Signierung](https://support.google.com/googleplay/android-developer/answer/9842756)
   · [Testkanäle](https://support.google.com/googleplay/android-developer/answer/9845334)
5. **Geschlossenen Test starten und auswerten.** Unter **Test and release →
   Testing → Closed testing → Manage track** unter **Countries / regions**
   die bestätigten Länder und unter **Testers** die Liste und eine
   Feedback-E-Mail hinterlegen. Unter **Releases** das geprüfte Paket
   auswählen und die Freigabe für den geschlossenen Test bestätigen. Den
   Anmeldelink aus **Testers** separat verschicken. Plane 15–20 Einladungen,
   damit mindestens 12 aktiv teilnehmen können. Diese müssen 14 Tage
   durchgehend angemeldet bleiben. Unter **Dashboard** den Stand prüfen
   und Feedback anhand der [Beta-Testanleitung](beta-product-validation.md)
   auswerten. Für die Auswertung reichen anonymisierte Rückmeldungen.
   [Testanforderungen](https://support.google.com/googleplay/android-developer/answer/14151465)
6. **Produktionszugang beantragen.** Nach erfüllter Testanforderung in
   der App auf **Dashboard → Apply for production access** klicken. Google
   fragt nach Testergewinnung, Nutzungsverhalten, Feedback und Änderungen.
   Nutze die tatsächliche Auswertung. Eine spätere öffentliche Verteilung
   erfolgt nach deiner Freigabe über **Test and release → Production**.
   [Produktionszugang](https://support.google.com/googleplay/android-developer/answer/14151465)
