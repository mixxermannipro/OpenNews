import Capacitor
import Foundation
import WidgetKit

@objc(NewsWidgetPlugin)
public class NewsWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NewsWidgetPlugin"
    public let jsName = "NewsWidget"
    public let pluginMethods = [CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)]
    private let sections = ["today", "personal", "latest"]
    private var shared: UserDefaults? { UserDefaults(suiteName: "group.io.opennews.app") }

    @objc func update(_ call: CAPPluginCall) {
        guard let shared else {
            call.reject("Widget-Daten konnten nicht gespeichert werden.")
            return
        }
        if shared.string(forKey: "widgetLaunchToken") == nil {
            shared.set(UUID().uuidString, forKey: "widgetLaunchToken")
        }
        let snapshot = Dictionary(uniqueKeysWithValues: sections.map { ($0, call.getArray($0) ?? []) })
        guard let data = try? JSONSerialization.data(withJSONObject: snapshot, options: .sortedKeys) else {
            call.reject("Widget-Daten konnten nicht gelesen werden.")
            return
        }
        if shared.data(forKey: "widgetSnapshot") != data {
            shared.set(data, forKey: "widgetSnapshot")
            WidgetCenter.shared.reloadTimelines(ofKind: "OpenNewsTopStories")
        }
        call.resolve()
    }

    func openWidgetURL(_ url: URL) {
        guard url.scheme == "opennews" else { return }
        switch url.host {
        case "article", "save":
            let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
            if url.host == "save" {
                guard let token = shared?.string(forKey: "widgetLaunchToken"),
                      query?.first(where: { $0.name == "token" })?.value == token else { return }
            }
            guard let id = query?.first(where: { $0.name == "id" })?.value,
                  let data = shared?.data(forKey: "widgetSnapshot"),
                  let snapshot = (try? JSONSerialization.jsonObject(with: data)) as? [String: [[String: Any]]],
                  let article = sections.lazy.compactMap({ snapshot[$0]?.first(where: { $0["id"] as? String == id }) }).first
            else { return }
            notifyListeners("openStory", data: ["article": article, "save": url.host == "save"], retainUntilConsumed: true)
        case "refresh", "discover", "today", "personal", "latest":
            let host = url.host ?? "today"
            let event: [String: Any] = host == "discover" ? ["discover": true] :
                ["section": host == "refresh" ? url.lastPathComponent : host, "refresh": host == "refresh"]
            notifyListeners("openStory", data: event, retainUntilConsumed: true)
        default:
            return
        }
    }
}
