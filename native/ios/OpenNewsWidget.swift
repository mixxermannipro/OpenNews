import AppIntents
import SwiftUI
import WidgetKit

private let suite = "group.io.opennews.app"
private let widgetKind = "OpenNewsTopStories"

enum WidgetSection: String, AppEnum {
    case today, personal, latest

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Nachrichtenansicht"
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .today: "Heute", .personal: "Für dich", .latest: "Neueste"
    ]

    var label: String {
        switch self {
        case .today: return "Heute"
        case .personal: return "Für dich"
        case .latest: return "Neueste"
        }
    }

    var url: URL { URL(string: "opennews://\(rawValue)")! }
}

struct SelectWidgetSection: AppIntent {
    static var title: LocalizedStringResource = "Nachrichtenansicht wechseln"
    @Parameter(title: "Ansicht") var section: WidgetSection

    init() {}
    init(_ section: WidgetSection) { self.section = section }

    func perform() async throws -> some IntentResult {
        UserDefaults(suiteName: suite)?.set(section.rawValue, forKey: "widgetSection")
        return .result()
    }
}

struct OpenNewsEntry: TimelineEntry {
    let date: Date
    let section: WidgetSection
    let stories: [Story]
    var launchToken: String? = nil

    struct Story: Decodable {
        let id: String
        let title: String
        let sourceName: String
        let category: String
        let summary: String
        let publishedAt: String

        var publicationDate: Date? {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: publishedAt) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: publishedAt)
        }

        var illustration: String {
            switch category {
            case "Politik": return "widget_politik"
            case "Europa": return "widget_europa"
            case "Technologie": return "widget_technologie"
            case "Wissenschaft": return "widget_wissenschaft"
            default: return "widget_wirtschaft"
            }
        }

        func url(_ action: String = "article", token: String? = nil) -> URL {
            var route = URLComponents()
            route.scheme = "opennews"
            route.host = action
            route.queryItems = [URLQueryItem(name: "id", value: id)]
            if let token { route.queryItems?.append(URLQueryItem(name: "token", value: token)) }
            return route.url ?? WidgetSection.today.url
        }
    }
}

struct OpenNewsTimeline: TimelineProvider {
    func placeholder(in context: Context) -> OpenNewsEntry {
        let story = OpenNewsEntry.Story(id: "placeholder", title: "Schlagzeilen im Überblick",
                                       sourceName: "OpenNews", category: "Europa", summary: "", publishedAt: "")
        return OpenNewsEntry(date: .now, section: .today, stories: [story])
    }

    func getSnapshot(in context: Context, completion: @escaping (OpenNewsEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : entry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OpenNewsEntry>) -> Void) {
        completion(Timeline(entries: [entry()], policy: .after(.now.addingTimeInterval(1800))))
    }

    private func entry() -> OpenNewsEntry {
        let shared = UserDefaults(suiteName: suite)
        let section = shared?.string(forKey: "widgetSection").flatMap(WidgetSection.init(rawValue:)) ?? .today
        let data = shared?.data(forKey: "widgetSnapshot")
        let snapshot = data.flatMap { try? JSONDecoder().decode([String: [OpenNewsEntry.Story]].self, from: $0) }
        return OpenNewsEntry(date: .now, section: section, stories: snapshot?[section.rawValue] ?? [],
                             launchToken: shared?.string(forKey: "widgetLaunchToken"))
    }
}

struct OpenNewsWidgetView: View {
    let entry: OpenNewsEntry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var colorScheme

    private var large: Bool { family == .systemLarge }
    private var control: Color {
        colorScheme == .dark ? Color(red: 0.145, green: 0.149, blue: 0.169) : Color(red: 0.94, green: 0.93, blue: 0.92)
    }
    private var topicColor: Color {
        colorScheme == .dark ? Color(red: 1, green: 0.55, blue: 0.57) : Color(red: 0.63, green: 0.21, blue: 0.25)
    }

    var body: some View {
        Group {
            if family == .systemSmall {
                content.widgetURL(entry.stories.first?.url() ?? entry.section.url)
            } else {
                content
            }
        }
        .containerBackground(for: .widget) {
            colorScheme == .dark ? Color(red: 0.067, green: 0.071, blue: 0.078)
                : Color(red: 0.965, green: 0.961, blue: 0.949)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: large ? 7 : 5) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.section.label).font(large ? .title2.bold() : .headline).lineLimit(1)
                    if large {
                        Text(entry.date.formatted(.dateTime.weekday(.wide).day().month(.wide).locale(Locale(identifier: "de_DE"))))
                            .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
                Spacer()
                if large {
                    Link(destination: URL(string: "opennews://refresh/\(entry.section.rawValue)")!) {
                        Image(systemName: "arrow.clockwise").frame(width: 44, height: 44)
                            .background(control, in: Circle())
                    }.accessibilityLabel("OpenNews aktualisieren")
                }
            }
            if family != .systemSmall { tabs }
            if let lead = entry.stories.first {
                if large {
                    leadCard(lead).layoutPriority(0)
                    ForEach(entry.stories.dropFirst().prefix(2), id: \.id) { story in
                        compactRow(story).layoutPriority(1)
                    }
                } else if family == .systemSmall {
                    storyText(lead, lines: 3)
                } else {
                    Link(destination: lead.url()) { storyText(lead, lines: 2) }
                    if let second = entry.stories.dropFirst().first {
                        Link(destination: second.url()) {
                            Text(second.title).font(.caption.weight(.medium)).lineLimit(1)
                        }
                    }
                }
            } else {
                if family == .systemSmall {
                    Text("OpenNews öffnen").font(.subheadline).foregroundStyle(.secondary)
                } else {
                    Link("Keine Meldungen · OpenNews öffnen", destination: entry.section.url)
                        .font(.subheadline).foregroundStyle(.secondary)
                }
            }
            if large {
                Spacer(minLength: 0)
                Link(destination: URL(string: "opennews://discover")!) {
                    Label("Weitere Themen entdecken", systemImage: "safari")
                        .font(.subheadline.weight(.semibold)).lineLimit(1)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(control, in: RoundedRectangle(cornerRadius: 15))
                }.layoutPriority(1)
            } else {
                Spacer(minLength: 0)
            }
        }
    }

    private var tabs: some View {
        HStack(spacing: 2) {
            ForEach(WidgetSection.allCases, id: \.self) { section in
                let active = section == entry.section
                Button(intent: SelectWidgetSection(section)) {
                    Text(section.label)
                        .font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
                        .frame(maxWidth: .infinity, minHeight: large ? 36 : 28)
                        .foregroundStyle(active ? (colorScheme == .dark ? Color.black : Color.white) : Color.primary)
                        .background(active ? (colorScheme == .dark ? Color.white : Color.black) : Color.clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(active ? .isSelected : [])
            }
        }
        .padding(2)
        .background(control, in: Capsule())
    }

    private func leadCard(_ story: OpenNewsEntry.Story) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Link(destination: story.url()) {
                Color.clear
                    .overlay { Image(story.illustration).resizable().scaledToFill().accessibilityHidden(true) }
                    .frame(minHeight: 36, maxHeight: 118).clipped()
                    .accessibilityLabel(story.title)
            }
            HStack {
                Link(destination: story.url()) {
                    VStack(alignment: .leading, spacing: 3) {
                        storyText(story, lines: 2)
                        if !story.summary.isEmpty {
                            Text(story.summary).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }.frame(maxWidth: .infinity, alignment: .leading)
                }
                save(story)
            }.padding(.leading, 8)
        }.background(control, in: RoundedRectangle(cornerRadius: 15))
            .clipShape(RoundedRectangle(cornerRadius: 15))
    }

    private func compactRow(_ story: OpenNewsEntry.Story) -> some View {
        HStack(spacing: 6) {
            Link(destination: story.url()) {
                HStack(spacing: 8) {
                    Image(story.illustration).resizable().scaledToFill().frame(width: 55, height: 40)
                        .clipShape(RoundedRectangle(cornerRadius: 8)).accessibilityHidden(true)
                    storyText(story, lines: 1).frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            save(story)
        }.frame(minHeight: 44)
    }

    private func storyText(_ story: OpenNewsEntry.Story, lines: Int) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(story.category).font(.caption2.weight(.semibold)).foregroundStyle(topicColor).lineLimit(1)
            Text(story.title).font(.subheadline.bold()).lineLimit(lines)
            if let date = story.publicationDate {
                (Text(story.sourceName) + Text(" · ") + Text(date, style: .relative))
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            } else {
                Text(story.sourceName).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
        }
    }

    private func save(_ story: OpenNewsEntry.Story) -> some View {
        Link(destination: story.url("save", token: entry.launchToken)) {
            Image(systemName: "bookmark").frame(width: 44, height: 44)
        }.accessibilityLabel("Artikel in OpenNews merken")
    }
}

@main
struct OpenNewsWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: widgetKind, provider: OpenNewsTimeline()) { entry in
            OpenNewsWidgetView(entry: entry)
        }
        .configurationDisplayName("OpenNews Top-Themen")
        .description("Heute, persönliche Empfehlungen und neue Meldungen.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
