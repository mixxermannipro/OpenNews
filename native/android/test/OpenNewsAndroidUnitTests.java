package io.opennews.app;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class OpenNewsAndroidUnitTests {

    @Test
    public void autoCatalogHasAtLeastFiftyUniqueHttpsStations() {
        assertTrue(AutoAudioCatalog.RADIO_STATIONS.size() >= 50);
        Set<String> ids = new HashSet<>();
        Set<String> urls = new HashSet<>();
        int musicCount = 0;
        int newsCount = 0;
        for (AutoAudioCatalog.RadioSpec spec : AutoAudioCatalog.RADIO_STATIONS) {
            assertTrue("Duplicate station id: " + spec.id, ids.add(spec.id));
            assertTrue("Duplicate stream url: " + spec.streamUrl, urls.add(spec.streamUrl));
            assertTrue("Stream URL must use https: " + spec.id, spec.streamUrl.startsWith("https://"));
            assertFalse(spec.name.trim().isEmpty());
            assertFalse(spec.shortCode.trim().isEmpty());
            assertTrue(spec.accentColor.startsWith("#"));
            if (spec.musicCategory) {
                musicCount++;
            } else {
                newsCount++;
            }
        }
        assertTrue(musicCount >= 25);
        assertTrue(newsCount >= 24);
    }

    @Test
    public void autoCatalogFindAndLocalizationLabels() {
        AutoAudioCatalog.RadioSpec swr3 = AutoAudioCatalog.findRadio("swr3");
        assertNotNull(swr3);
        assertTrue(swr3.musicCategory);
        assertNull(AutoAudioCatalog.findRadio("nonexistent-station"));

        assertEquals("Music Radio", AutoAudioCatalog.label("en", "radioMusic"));
        assertEquals("Musik-Radio", AutoAudioCatalog.label("de", "radioMusic"));
        assertEquals("Musique", AutoAudioCatalog.label("fr", "radioMusic"));
        assertEquals("Música", AutoAudioCatalog.label("es", "radioMusic"));
        assertEquals("Musica", AutoAudioCatalog.label("it", "radioMusic"));
        assertEquals("Música", AutoAudioCatalog.label("pt", "radioMusic"));
    }

    @Test
    public void autoCatalogNewsUpdateFeedDetection() {
        assertTrue(AutoAudioCatalog.isNewsUpdateFeed("tagesschau-20-audio", "", ""));
        assertTrue(AutoAudioCatalog.isNewsUpdateFeed("custom", "Echo der Zeit", "https://example.org/feed.xml"));
        assertFalse(AutoAudioCatalog.isNewsUpdateFeed("custom-tech", "Tech Talk", "https://example.org/tech.xml"));
    }

    @Test
    public void autoCatalogNormalizeSearchHandlesGermanUmlauts() {
        assertEquals("oe1 oesterreich ueber", AutoAudioCatalog.normalizeSearch("Ö1 Österreich über"));
        assertEquals("", AutoAudioCatalog.normalizeSearch(null));
    }

    @Test
    public void autoFeedFetcherSafetyAndMediaHelpers() {
        assertTrue(AutoFeedFetcher.isPlayableAudioUrl("https://cdn.example.org/show.mp3", "audio/mpeg"));
        assertTrue(AutoFeedFetcher.isPlayableAudioUrl("https://cdn.example.org/episode.m4a?t=1", null));
        assertFalse(AutoFeedFetcher.isPlayableAudioUrl("http://cdn.example.org/insecure.mp3", "audio/mpeg"));
        assertFalse(AutoFeedFetcher.isPlayableAudioUrl("https://cdn.example.org/article.html", "text/html"));
        assertFalse(AutoFeedFetcher.isPlayableAudioUrl(null, null));
        assertFalse(AutoFeedFetcher.isPublicHost("localhost"));
        assertFalse(AutoFeedFetcher.isPublicHost("127.0.0.1"));
        assertEquals("Hallo Welt", AutoFeedFetcher.cleanText("<p>Hallo&nbsp;<b>Welt</b></p>"));
    }

    @Test
    public void widgetRefreshParsesJsonFeedIncludingThumbnailsAndFiltersAds() throws Exception {
        JSONObject source = new JSONObject()
            .put("id", "tagesschau")
            .put("name", "tagesschau.de")
            .put("shortCode", "TS")
            .put("accentColor", "#1D4ED8")
            .put("category", "Politik")
            .put("url", "https://www.tagesschau.de/");

        JSONObject root = new JSONObject().put("items", new JSONArray()
            .put(new JSONObject()
                .put("id", "a1")
                .put("title", "Anzeige: Produktwerbung")
                .put("url", "https://www.tagesschau.de/ad")
                .put("summary", "Werbetext"))
            .put(new JSONObject()
                .put("id", "a2")
                .put("title", "Bundesrat beschließt neues Gesetz")
                .put("url", "https://www.tagesschau.de/inland/gesetz-100.html")
                .put("summary", "<p>Wichtige Entscheidung heute in Berlin.</p>")
                .put("image", "https://images.tagesschau.de/image/123.jpg")
                .put("date_published", "2026-11-26T10:15:00Z")));

        List<JSONObject> parsed = WidgetRefreshService.parseJsonFeed(root.toString(), source);
        assertEquals(1, parsed.size());
        JSONObject item = parsed.get(0);
        assertEquals("a2", item.getString("id"));
        assertEquals("Bundesrat beschließt neues Gesetz", item.getString("title"));
        assertEquals("Wichtige Entscheidung heute in Berlin.", item.getString("summary"));
        assertEquals("https://images.tagesschau.de/image/123.jpg", item.getString("imageUrl"));
    }

    @Test
    public void widgetRefreshMutedAndAdvertorialFilters() {
        assertTrue(WidgetRefreshService.isAdvertorialTitle("ANZEIGE: Sonderangebot"));
        assertTrue(WidgetRefreshService.isAdvertorialTitle("Sponsored Story"));
        assertFalse(WidgetRefreshService.isAdvertorialTitle("Wirtschaft wächst leicht"));

        List<String> muted = Arrays.asList("krypto", "casino");
        assertTrue(WidgetRefreshService.isMutedArticle("Neuer Krypto-Boom", "Details", muted));
        assertFalse(WidgetRefreshService.isMutedArticle("Klimagipfel beginnt", "Delegierte treffen sich", muted));
    }

    @Test
    public void widgetRefreshMergePreservesSavedStateAndSortsNewestFirst() throws Exception {
        long nowMs = 1_795_700_000_000L;
        JSONObject existing = new JSONObject().put("today", new JSONArray()
            .put(new JSONObject()
                .put("id", "old-1")
                .put("title", "Ältere Meldung")
                .put("link", "https://example.org/old-1")
                .put("publishedAt", "2026-11-25T08:00:00Z")
                .put("widgetSaved", true)));

        JSONObject freshUpdated = new JSONObject()
            .put("id", "old-1")
            .put("title", "Ältere Meldung (aktualisiert)")
            .put("link", "https://example.org/old-1")
            .put("publishedAt", "2026-11-26T12:00:00Z");

        JSONObject merged = WidgetRefreshService.mergeIntoSnapshot(existing, Collections.singletonList(freshUpdated), nowMs);
        JSONArray latest = merged.getJSONArray("latest");
        assertEquals(1, latest.length());
        assertTrue(latest.getJSONObject(0).getBoolean("widgetSaved"));
    }

    @Test
    public void widgetRefreshSafeUrlAndHostValidation() {
        assertTrue(WidgetRefreshService.isSafeWebUrl("https://www.tagesschau.de/feed.xml"));
        assertFalse(WidgetRefreshService.isSafeWebUrl("javascript:alert(1)"));
        assertFalse(WidgetRefreshService.isSafeWebUrl("file:///etc/passwd"));
        assertFalse(WidgetRefreshService.isPublicHost("localhost"));
        assertFalse(WidgetRefreshService.isPublicHost("192.168.1.1"));
        assertFalse(WidgetRefreshService.isPublicHost("printer.local"));
    }

    @Test
    public void pushBreakingTitleDetection() {
        assertTrue(NewsMessagingService.isBreakingTitle("Eilmeldung: Einigung im Haushaltsstreit"));
        assertTrue(NewsMessagingService.isBreakingTitle("+++ Erdbeben erschüttert Küste +++"));
        assertTrue(NewsMessagingService.isBreakingTitle("Breaking News: Central bank cuts rates"));
        assertFalse(NewsMessagingService.isBreakingTitle("Wochenrückblick aus dem Parlament"));
        assertFalse(NewsMessagingService.isBreakingTitle(null));
    }

    @Test
    public void pushActiveTimeWindowStandardAndOvernight() {
        assertTrue(NewsMessagingService.isWithinActiveWindow("07:00", "22:00", "14:30"));
        assertFalse(NewsMessagingService.isWithinActiveWindow("07:00", "22:00", "23:15"));
        assertTrue(NewsMessagingService.isWithinActiveWindow("22:00", "06:00", "23:30"));
        assertTrue(NewsMessagingService.isWithinActiveWindow("22:00", "06:00", "04:45"));
        assertFalse(NewsMessagingService.isWithinActiveWindow("22:00", "06:00", "12:00"));
    }

    @Test
    public void pushMonitorClampsInterval() {
        assertEquals(15, NewsPushMonitorService.clampIntervalMinutes(5));
        assertEquals(15, NewsPushMonitorService.clampIntervalMinutes(15));
        assertEquals(30, NewsPushMonitorService.clampIntervalMinutes(30));
        assertEquals(60, NewsPushMonitorService.clampIntervalMinutes(60));
        assertEquals(60, NewsPushMonitorService.clampIntervalMinutes(120));
    }
}
