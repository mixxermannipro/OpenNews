# Widgets und iOS

Das Android-Widget „OpenNews Top-Themen“ zeigt bis zu zwei Überschriften aus der Ansicht „Heute“. Es übernimmt sie beim Aktualisieren der App. Ein Tippen öffnet OpenNews. Auf dem Startbildschirm lässt sich das Widget über die Widget-Auswahl des Android-Launchers hinzufügen. Die Überschriften werden lokal gespeichert.

Für iOS ist macOS mit Xcode nötig. Das Capacitor-Ziel muss zur verwendeten Capacitor-Version passen. Auf einem Mac `npm ci`, `npm run build`, `npx cap add ios` und `npx cap sync ios` ausführen, mit der im Projekt festgeschriebenen Capacitor-Version. Vor Übernahme das Fetch-Verhalten, native Gesten, Audio und die plattformspezifischen Funktionsprüfungen auf einem iPhone testen. Für ein WidgetKit-Ziel müssen die App und die Widget-Erweiterung dieselbe App Group nutzen. Signierung und Zielkonfiguration auf dem Mac prüfen.

Das Android-Widget übernimmt dieselben redaktionellen Themenbilder wie die App. Die kompakte Ansicht zeigt den Aufmacher und seine Quelle. Mit mehr Platz kommen das Themenbild und eine zweite Meldung hinzu. Die Oberfläche folgt dem Hell-Dunkel-Modus des Systems.

## WidgetKit in Xcode einbinden

1. Das Capacitor-App-Ziel in Xcode öffnen. Die Dateien `native/ios/NewsWidgetPlugin.swift` und `native/ios/OpenNewsBridgeViewController.swift` dem App-Ziel hinzufügen. Im Main-Storyboard die Controller-Klasse auf `OpenNewsBridgeViewController` im App-Modul setzen.
2. Ein Widget Extension-Ziel ohne Live Activity mit iOS 17 oder neuer anlegen. Die generierte Widget-Implementierung durch `native/ios/OpenNewsWidget.swift` ersetzen. Die Datei gehört nur zur Erweiterung.
3. Für beide Ziele die App Group `group.io.opennews.app` aktivieren. Im App-Ziel unter URL Types das Schema `opennews` für den Widget-Tipp eintragen. Die Widget-Erweiterung mit der App bündeln.
4. Auf einem iPhone App starten, Nachrichten laden, Widget hinzufügen und den Inhalt in kleiner und mittlerer Größe prüfen. Das Widget liest die lokal geteilten Überschriften. Zielregistrierung und Signierung wurden unter Linux nicht geprüft.
