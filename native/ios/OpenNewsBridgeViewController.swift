import Capacitor
import Foundation

final class OpenNewsBridgeViewController: CAPBridgeViewController {
    private let widget = NewsWidgetPlugin()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(widget)
    }

    func openWidgetURL(_ url: URL) {
        loadViewIfNeeded()
        widget.openWidgetURL(url)
    }
}
