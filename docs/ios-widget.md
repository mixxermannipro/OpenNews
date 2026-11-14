# Widgets und iOS

Das Android-Widget „OpenNews Top-Themen“ zeigt bis zu drei Überschriften aus der Ansicht „Heute“. Es übernimmt sie beim Aktualisieren der App. Ein Tippen öffnet OpenNews. Auf dem Startbildschirm lässt sich das Widget über die Widget-Auswahl des Android-Launchers hinzufügen. Die Überschriften werden lokal gespeichert.

Für iOS ist macOS mit Xcode nötig. Das Capacitor-Ziel muss zur verwendeten Capacitor-Version passen. Auf einem Mac `npm ci`, `npm run build`, `npx cap add ios` und `npx cap sync ios` ausführen, nachdem `@capacitor/ios` in der passenden Version ergänzt wurde. Vor Übernahme das Fetch-Verhalten, native Gesten, Audio und die plattformspezifischen Funktionsprüfungen auf einem iPhone testen. Für ein WidgetKit-Ziel müssen die App und die Widget-Erweiterung dieselbe App Group nutzen. Signierung und Zielkonfiguration auf dem Mac prüfen.
