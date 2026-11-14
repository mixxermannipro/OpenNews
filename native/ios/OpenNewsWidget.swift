import SwiftUI
import WidgetKit

struct OpenNewsEntry: TimelineEntry {
    let date: Date
    let stories: [Story]

    struct Story: Decodable {
        let title: String
        let source: String
    }
}

struct OpenNewsTimeline: TimelineProvider {
    func placeholder(in context: Context) -> OpenNewsEntry {
        OpenNewsEntry(date: .now, stories: [.init(title: "Die wichtigsten Meldungen des Tages", source: "OpenNews")])
    }

    func getSnapshot(in context: Context, completion: @escaping (OpenNewsEntry) -> Void) {
        completion(entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OpenNewsEntry>) -> Void) {
        completion(Timeline(entries: [entry()], policy: .never))
    }

    private func entry() -> OpenNewsEntry {
        let data = UserDefaults(suiteName: "group.io.opennews.app")?.data(forKey: "stories")
        let stories = data.flatMap { try? JSONDecoder().decode([OpenNewsEntry.Story].self, from: $0) } ?? []
        return OpenNewsEntry(date: .now, stories: stories)
    }
}

struct OpenNewsWidgetView: View {
    let entry: OpenNewsEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("OpenNews").font(.subheadline.weight(.semibold))
                Spacer()
                Image(systemName: "arrow.up.right").foregroundStyle(.secondary)
            }
            if let lead = entry.stories.first {
                Text(lead.title).font(.headline).lineLimit(3)
                Text(lead.source).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            } else {
                Text("Öffne OpenNews, um die Top-Themen zu laden.")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            if family != .systemSmall, entry.stories.count > 1 {
                Divider()
                Text(entry.stories[1].title).font(.subheadline.weight(.medium)).lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .widgetURL(URL(string: "opennews://today"))
        .containerBackground(for: .widget) {
            Color(uiColor: .systemBackground)
        }
    }
}

@main
struct OpenNewsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "OpenNewsTopStories", provider: OpenNewsTimeline()) { entry in
            OpenNewsWidgetView(entry: entry)
        }
        .configurationDisplayName("OpenNews Top-Themen")
        .description("Die wichtigsten Meldungen aus Heute.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
