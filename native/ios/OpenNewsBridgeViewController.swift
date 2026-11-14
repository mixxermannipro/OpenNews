import Capacitor

final class OpenNewsBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NewsWidgetPlugin())
    }
}
