import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { cleanExtractedBlocks, extractArticle, preStripHtml } from './articleExtraction';

test('finds editorial text outside an article element and returns plain text', () => {
  const detail = 'Die Redaktion beschreibt die neuen Entwicklungen und ordnet die Folgen für die Region ausführlich ein.';
  const dom = new JSDOM(`<head><meta property="og:image" content="/photo.jpg"></head>
    <body><nav>Navigationsmenü</nav><main><div class="article-body"><h1>Nachrichten</h1>
    <p>${detail.repeat(6)}</p><h2>Was folgt</h2><p>${detail.repeat(4)}</p>
    <script>throw new Error('This must never execute')</script></div></main></body>`,
  { url: 'https://example.org/news' });
  const result = extractArticle(dom.window.document, dom.window.location.href);
  assert.equal(result.ogImage, 'https://example.org/photo.jpg');
  assert.ok(result.paragraphs.some(text => text.includes(detail)));
  assert.ok(result.paragraphs.every(text => !text.includes('Navigationsmenü') && !text.includes('never execute')));
  assert.ok(result.headingIndexes.some(index => result.paragraphs[index] === 'Was folgt'));
  dom.window.close();
});

test('preStripHtml removes script, style, template, noscript, svg and HTML comments before JSDOM', () => {
  const raw = '<!-- comment --><style>.a{color:red}</style><svg><path d="M0 0"/></svg><p>Artikeltext</p><script>evil()</script>';
  const stripped = preStripHtml(raw);
  assert.equal(stripped, '<p>Artikeltext</p>');
});

test('deduplicates nested headings (heise/FAZ/BBC pattern) and strips duplicate article title', () => {
  const dom = new JSDOM(`<html><head><title>Neue Studie</title></head><body><article>
    <h1>Neue Studie zu Batterien</h1>
    <h2>Neue Studie zu Batterien</h2>
    <p>Forscher in Europa haben eine neue Generation von Festkörperbatterien vorgestellt, die deutlich schneller laden.</p>
    <ul><li><h2>Hintergrund der Entwicklung</h2></li></ul>
    <p>Die Ergebnisse wurden nach drei Jahren intensiver Laborarbeit in mehreren Ländern veröffentlicht und unabhängig geprüft.</p>
  </article></body></html>`, { url: 'https://example.org/batterien' });

  const result = extractArticle(dom.window.document, dom.window.location.href, 'Neue Studie zu Batterien');
  const headingOccurrences = result.paragraphs.filter(p => p === 'Hintergrund der Entwicklung');
  assert.equal(headingOccurrences.length, 1);
  assert.ok(!result.paragraphs.includes('Neue Studie zu Batterien'));
  dom.window.close();
});

test('rejects whole-article cookie/consent/PUR walls (Golem pattern)', () => {
  const result = cleanExtractedBlocks([
    { text: 'Accept cookies', isHeading: true },
    { text: 'Visit Golem.de as usual with advertising and tracking.', isHeading: false },
    { text: 'Consent is not possible inside an iFrame.', isHeading: false },
    { text: '… or subscribe to Golem pur', isHeading: true },
    { text: 'Precise geolocation data, and identification through device scanning.', isHeading: false },
  ]);
  assert.deepEqual(result.paragraphs, []);
  assert.equal(result.blockedWall, true);
});

test('strips breadcrumbs, print boilerplate, audio scrubber, photo credits, paywall promos and trailing link dumps', () => {
  const result = cleanExtractedBlocks([
    { text: 'Startseite', isHeading: false },
    { text: 'Finanzen', isHeading: false },
    { text: 'Märkte', isHeading: false },
    { text: 'Online seit heute, 20.41 Uhr', isHeading: false },
    { text: '00:00', isHeading: false },
    { text: '/', isHeading: false },
    { text: '04:00', isHeading: false },
    { text: 'Dieser Ausdruck wurde am 25.11.2026 erstellt und ist ausschließlich für den persönlichen Gebrauch lizenziert.', isHeading: false },
    { text: 'Image source, AFP via Getty Images', isHeading: false },
    { text: 'A ls die Zentralbank am Donnerstag ihre neuen Prognosen vorstellte, reagierten die Anleihemärkte prompt.', isHeading: false },
    { text: 'Die Inflation im Euroraum entwickelt sich stabiler als im Frühjahr befürchtet, betonte die Präsidentin.', isHeading: false },
    { text: 'Foto: Breuel-Bild/imago', isHeading: false },
    { text: 'lwö', isHeading: false },
    { text: 'Nicht alle Bilder konnten vollständig geladen werden. Bitte schließen Sie die Druckvorschau.', isHeading: false },
    { text: 'Jetzt Artikel freischalten', isHeading: true },
    { text: 'Wöchentlich den SPIEGEL als E-Paper lesen', isHeading: false },
    { text: '3 Monate für nur 15 Euro', isHeading: false },
    { text: 'Willkommen bei DER STANDARD', isHeading: true },
    { text: 'Sie entscheiden darüber, wie Sie unsere Inhalte nutzen wollen.', isHeading: false },
    { text: 'Weitere empfehlenswerte Artikel', isHeading: true },
    { text: 'Irgendein Werbe-Deal zum Black Friday', isHeading: false },
  ]);

  assert.deepEqual(result.paragraphs, [
    'Als die Zentralbank am Donnerstag ihre neuen Prognosen vorstellte, reagierten die Anleihemärkte prompt.',
    'Die Inflation im Euroraum entwickelt sich stabiler als im Frühjahr befürchtet, betonte die Präsidentin.',
  ]);
  assert.deepEqual(result.headingIndexes, []);
});

test('preserves valid English sentences starting with A or I while repairing German drop-caps', () => {
  const result = cleanExtractedBlocks([
    { text: 'A new report from Brussels highlights major energy grid investments across Europe.', isHeading: false },
    { text: 'I believe the reform will pass before summer, the minister told reporters.', isHeading: false },
    { text: 'D ie Debatte im Bundestag dauerte bis spät in den Abend an.', isHeading: false },
  ]);

  assert.equal(result.paragraphs[0], 'A new report from Brussels highlights major energy grid investments across Europe.');
  assert.equal(result.paragraphs[1], 'I believe the reform will pass before summer, the minister told reporters.');
  assert.equal(result.paragraphs[2], 'Die Debatte im Bundestag dauerte bis spät in den Abend an.');
});

test('rejects German IAB TCF / Golem consent wall and strips period-terminated Google promo', () => {
  const wall = cleanExtractedBlocks([
    { text: 'Cookies zustimmen', isHeading: true },
    { text: 'Besuchen Sie Golem.de wie gewohnt mit Werbung und Tracking, indem Sie der Nutzung aller Cookies zustimmen.', isHeading: false },
    { text: 'Die Zustimmung in einem iFrame ist nicht möglich. Seite in eigenem Fenster öffnen.', isHeading: false },
    { text: '… oder Golem pur bestellen', isHeading: true },
    { text: 'Es können genaue Standortdaten verarbeitet werden, um sie für einen oder mehrere Verarbeitungszwecke zu nutzen.', isHeading: false },
  ]);
  assert.deepEqual(wall.paragraphs, []);
  assert.equal(wall.blockedWall, true);

  const welt = cleanExtractedBlocks([
    { text: 'Der FC Bayern muss im Champions-League-Spiel auf zahlreiche Offensivstars verzichten und baut die Startelf um.', isHeading: false },
    { text: 'Klicken Sie hier, um sich Artikel von WELT in der Google-Suche bevorzugt anzeigen zu lassen.', isHeading: false },
  ]);
  assert.deepEqual(welt.paragraphs, [
    'Der FC Bayern muss im Champions-League-Spiel auf zahlreiche Offensivstars verzichten und baut die Startelf um.',
  ]);
});
