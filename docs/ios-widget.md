# OpenNews-Widget auf iOS

> **Plattform-Status (v0.2):** Eine iOS-App inklusive WidgetKit-Erweiterung ist derzeit **weder gebaut noch auf iOS-Geräten getestet und steht aktuell nicht zum Download zur Verfügung**. OpenNews unterstützt produktiv ausschließlich **Web/PWA** und **Android**. Die Dateien unter `native/ios/` und diese Anleitung dienen ausschließlich als vorbereitende Referenz für eine spätere Xcode-Portierung unter macOS.

Das Widget „OpenNews Top-Themen“ gibt es in drei Größen. Klein zeigt es eine Schlagzeile und öffnet deren Reader beim Tippen. Mittel bietet die Reiter „Heute“, „Für dich“ und „Neueste“. Groß zeigt Datum, Bildaufmacher, bis zu zwei kompakte Meldungen und „Weitere Themen entdecken“. Das Lesezeichen speichert den Artikel in OpenNews und öffnet den Reader. Der Aktualisieren-Knopf öffnet den gewählten Reiter und startet den Feed-Abruf der App.

Die Themenbilder liegen lokal in der Widget-Erweiterung. Die App teilt bis zu drei gekürzte Artikel je Reiter über die gemeinsame App Group. Die Widget-Erweiterung ruft keine Feeds selbst ab. iOS entscheidet, wann es die Darstellung im Hintergrund neu aufbaut. Die Reiterwahl gilt für Widgets dieser App auf demselben Gerät.

## Einrichtung in Xcode

1. Auf macOS mit Xcode 26 oder neuer `npm ci`, `npm run build`, `npx cap add ios` und `npx cap sync ios` ausführen. Falls das iOS-Projekt schon besteht, genügt statt `cap add` der Sync. Mit `npx cap open ios` öffnen.
2. Im App-Ziel die von Capacitor 8 erzeugte `SceneDelegate.swift` durch `native/ios/SceneDelegate.swift` ersetzen. `NewsWidgetPlugin.swift` und `OpenNewsBridgeViewController.swift` dem App-Ziel hinzufügen. Bei einem bestehenden Projekt prüfen, dass das App-Ziel den SceneDelegate lädt.
3. Ein Ziel vom Typ „Widget Extension“ ohne Live Activity anlegen. Die generierten Widget- und Intent-Dateien durch `native/ios/OpenNewsWidget.swift` ersetzen. Die Datei gehört nur zur Erweiterung. Das Widget-Ziel braucht iOS 17 oder neuer. Für die Ton- und Widget-Funktionsprüfungen ein iPhone mit dem gleichen oder einem neueren iOS verwenden.
4. Die fünf Dateien `native/android/widget/drawable-nodpi/widget_*.jpg` als Bildsets ohne Dateiendung im Asset-Katalog der Erweiterung anlegen. Die Namen entsprechen den Widget-Themen. Die App Group `group.io.opennews.app` in beiden Zielen aktivieren. Das URL-Schema `opennews` im App-Ziel unter URL Types eintragen. Die Erweiterung muss mit der App gebündelt sein.
5. Auf einem iPhone die App öffnen und Feeds laden. Das Widget in allen drei Größen hinzufügen. Beim großen Widget alle Reiter antippen und den Sprung zum Artikel, zur Merkliste, zu „Entdecken“ und zum Feed-Abruf prüfen. Die Links bei offener und geschlossener App testen. Hell/Dunkel, größere Schrift, leere Auswahl und Flugmodus prüfen.

Die Einrichtung, die Signierung und die Darstellung in WidgetKit wurden unter Linux nicht geprüft. Ein Xcode-Build und ein Gerätetest stehen aus. [Capacitor – iOS](https://capacitorjs.com/docs/ios) · [Apple – interaktive Widgets](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)
