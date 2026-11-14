import Capacitor
import Foundation
import WidgetKit

@objc(NewsWidgetPlugin)
public class NewsWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NewsWidgetPlugin"
    public let jsName = "NewsWidget"
    public let pluginMethods = [CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)]

    @objc func update(_ call: CAPPluginCall) {
        guard let stories = call.getArray("stories"),
              let data = try? JSONSerialization.data(withJSONObject: stories),
              let shared = UserDefaults(suiteName: "group.io.opennews.app") else {
            call.reject("Widget-Daten konnten nicht gespeichert werden.")
            return
        }
        if shared.data(forKey: "stories") != data {
            shared.set(data, forKey: "stories")
            WidgetCenter.shared.reloadTimelines(ofKind: "OpenNewsTopStories")
        }
        call.resolve()
    }
}
