import type { ReactNode } from 'react';
import { faqItems } from './content/faq.ts';
import type { Route } from './content/meta.ts';
import { isPreview, site } from './content/site.ts';

const LINK_RE = /((?:https:\/\/)?(?:cloudflare\.com|policies\.google\.com|developers\.google\.com|lda\.bayern\.de|opennews-app\.pages\.dev)[^\s),]*[a-zA-Z0-9/#?=_-])/g;

function linkify(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const token = match[0];
    const href = token.startsWith('https://') ? token : `https://${token}`;
    parts.push(<a key={`${start}-${token}`} href={href} target="_blank" rel="noopener noreferrer">{token}</a>);
    lastIndex = start + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function NoticeBlocks({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map(block => block.trim()).filter(Boolean);
  return <>
    {blocks.map((block, index) => {
      const lines = block.split('\n');
      if (lines.length >= 2 && lines[0].length <= 80 && !lines[0].endsWith('.')) {
        return <section key={index} className="notice-section">
          <h3>{lines[0]}</h3>
          <p>{linkify(lines.slice(1).join(' '))}</p>
        </section>;
      }
      return <p key={index} className="notice-text">{linkify(block)}</p>;
    })}
  </>;
}

function Arrow() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

function Brand() {
  return <a className="brand" href="/"><img src="/icon-192.png" alt="" width="32" height="32" />OpenNews</a>;
}

function AppImage({ file, alt, priority = false, widget = false }: {
  file: string; alt: string; priority?: boolean; widget?: boolean;
}) {
  const image = <img src={`/screenshots/${file}.webp`} alt={alt}
    width={widget ? 420 : 810} height={widget ? 625 : 1440}
    loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined}
    decoding="async" />;
  return <div className={widget ? 'widget-image' : 'phone'}>{image}</div>;
}

const feeds = [
  { id: 'heute', title: 'Heute', heading: 'Was heute wichtig ist.', text: 'Die wichtigsten Meldungen aus deinen Quellen. Ein Aufmacher gibt einer Nachricht mehr Platz, kompakte Zeilen zeigen dir, was außerdem passiert ist.', alt: 'App-Ansicht Heute mit großem Aufmacher und weiteren Schlagzeilen' },
  { id: 'fuer-dich', title: 'Für dich', heading: 'Was dich interessiert.', text: 'Deine Themen und Lesegewohnheiten helfen OpenNews, Meldungen für dich zu sortieren. Die App lernt auf deinem Gerät.', alt: 'App-Ansicht Für dich mit einer personalisierten Auswahl von Nachrichten' },
  { id: 'neueste', title: 'Neueste', heading: 'Was gerade reinkommt.', text: 'Die neuesten Meldungen deiner Quellen in der Reihenfolge, in der sie veröffentlicht wurden. So findest du schnell den neuesten Stand.', alt: 'App-Ansicht Neueste mit kompakten Meldungen und Zeitangaben' },
];

function FeedDemo() {
  return <section className="band" id="einblick" aria-labelledby="feeds-title">
    <div className="wrap demo">
      <div>
        <h2 id="feeds-title">Drei Wege zu deinen Nachrichten.</h2>
        <fieldset className="feed-options">
          <legend className="sr-only">App-Ansicht auswählen</legend>
          {feeds.map((feed, index) => <label key={feed.id}>
            <input type="radio" name="feed" value={feed.id} defaultChecked={index === 0} />
            <span>{feed.title}</span>
          </label>)}
        </fieldset>
        {feeds.map(feed => <div className="feed-copy" data-feed={feed.id} key={feed.id}>
          <h3>{feed.heading}</h3><p>{feed.text}</p>
        </div>)}
      </div>
      <figure className="demo-stage">
        {feeds.map(feed => <div className="feed-shot" data-feed={feed.id} key={feed.id}>
          <AppImage file={feed.id} alt={feed.alt} />
        </div>)}
        <figcaption>Ansichten: Heute, Für dich und Neueste</figcaption>
      </figure>
    </div>
  </section>;
}

function Features() {
  return <section className="wrap features" id="funktionen" aria-labelledby="features-title">
    <h2 id="features-title">Lesen, schauen, hören.</h2>
    <div className="feature-spread">
      <article>
        <div className="feature-image"><AppImage file="entdecken" alt="Entdecken-Ansicht mit Suche und Themen wie Politik und Technologie" /></div>
        <h3>Deine Quellen &amp; 6 Sprachen.</h3>
        <p>Entdecke Themen und Redaktionen aus mehreren Ländern – auf Deutsch, Englisch, Französisch, Spanisch, Italienisch und Portugiesisch – oder füge eigene RSS-Feeds hinzu.</p>
      </article>
      <article>
        <div className="feature-image"><AppImage file="artikel" alt="Artikelansicht mit Quelle, Überschrift und Lesezeichen" /></div>
        <h3>Später in Ruhe lesen.</h3>
        <p>Speichere interessante Meldungen für später. Die Artikelansicht zeigt nach Möglichkeit den Volltext und bietet einen direkten Link zur Originalquelle.</p>
      </article>
      <article>
        <div className="feature-image"><AppImage file="medien" alt="Video- und Audioübersicht aus abonnierten Quellen" /></div>
        <h3>Clips, Videos und Audio.</h3>
        <p>Finde Kurzclips, Videos und Audiobeiträge aus deinen Quellen – mit durchlaufendem Mini-Audio-Player im Web und direktem Abruf beim Anbieter.</p>
      </article>
    </div>
    <p className="capture-note">App-Ansichten auf Android mit Beispielmeldungen</p>
    <div className="widget-feature">
      <AppImage file="widget" alt="Scrollbarer OpenNews-Feed mit Aufmacher und drei Reitern auf dem Android-Startbildschirm" widget />
      <div><h3>Dein Überblick auf dem Startbildschirm.</h3>
        <p>Scrolle durch deine Schlagzeilen direkt auf dem Android-Startbildschirm. Ziehe das Widget auf die passende Größe und wähle eigene Themen, Quellen und Ansichten.</p></div>
    </div>
  </section>;
}

function Home() {
  return <>
    <section className="wrap hero">
      <div className="hero-copy">
        <h1>Deine Nachrichten.<br />Deine Quellen.<br /><em>Dein Überblick.</em></h1>
        <p>Wähle, von wem du Nachrichten liest. OpenNews bündelt deine Quellen in sechs Sprachen und zeigt dir, was heute wichtig ist und was dich interessiert – auf Android und direkt im Browser.</p>
        <div className="actions">
          {site.webAppUrl ? (
            <>
              <a className="button primary" href={site.webAppUrl}>Web-App öffnen <Arrow /></a>
              <a className="text-link" href="#einblick">App ansehen</a>
            </>
          ) : (
            <a className="button primary" href="#einblick">App ansehen <Arrow /></a>
          )}
          <a className="text-link" href="#download">Verfügbarkeit</a>
        </div>
      </div>
      <figure className="hero-stage">
        <AppImage file="heute" alt="OpenNews auf einem Smartphone mit der Ansicht Heute" priority />
        <figcaption>OpenNews für Web &amp; Android</figcaption>
      </figure>
    </section>
    <FeedDemo />
    <Features />
    <section className="band" id="datenschutz" aria-labelledby="privacy-title">
      <div className="wrap privacy">
        <div><h2 id="privacy-title">Dein Leseverhalten bleibt bei dir.</h2>
          <a className="text-link" href="/datenschutz/">Datenschutz im Detail <Arrow /></a></div>
        <dl>
          <div><dt>Auf deinem Gerät</dt><dd>Quellenwahl, Lesezeichen und Leseverlauf bleiben lokal. Empfehlungen berechnet die App auf deinem Gerät.</dd></div>
          <div><dt>Beim Nachrichtenabruf</dt><dd>Android lädt Feeds direkt. Im Browser vermittelt ein OpenNews-Server. Beim Öffnen von Originalen oder Medien gelten die Bedingungen der jeweiligen Anbieter.</dd></div>
          <div><dt>Bei optionaler externer KI</dt><dd>Wenn du einen Dienst einrichtest und nutzt, erhält er die benötigten Inhalte und gegebenenfalls deinen Schlüssel zur Anmeldung.</dd></div>
        </dl>
      </div>
    </section>
    <section className="wrap faq" id="faq">
      <h2>Häufige Fragen.</h2>
      <div>{faqItems.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
    </section>
    <section className="download" id="download">
      <div className="wrap"><img src="/icon-192.png" width="76" height="76" alt="" loading="lazy" />
        <h2>OpenNews für Web &amp; Android.</h2>
        <p>{site.playStoreUrl ? 'OpenNews ist als Web-App im Browser und über Google Play erhältlich.' : 'Die Web-App läuft direkt im Browser. Die Android-App befindet sich aktuell im geschlossenen Test bei Google Play.'}</p>
        <div className="actions">
          {site.webAppUrl && <a className="button primary" href={site.webAppUrl}>Web-App im Browser öffnen <Arrow /></a>}
          {site.playStoreUrl && <a className={site.webAppUrl ? 'text-link' : 'button primary'} href={site.playStoreUrl}>Bei Google Play öffnen <Arrow /></a>}
        </div>
      </div>
    </section>
  </>;
}

function Legal({ path }: { path: Exclude<Route, '/'> }) {
  const { operator } = site;
  const email = site.contactEmail ? <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> : null;
  const emailPending = 'Die öffentliche Kontaktadresse wird vor der Veröffentlichung ergänzt.';
  let title: string;
  let content: ReactNode;
  if (path === '/impressum/') {
    title = 'Impressum';
    content = isPreview ? <p>Die bestätigten Betreiberangaben werden vor der Veröffentlichung ergänzt. Fragen kannst du über die <a href="/kontakt/">Kontaktseite</a> stellen.</p> : <>
      <p className="legal-meta">App-Paket: <code>io.opennews.app</code></p>
      <h2>Betreiber der Website und App</h2>
      <address>{operator.name}<br />{operator.street}<br />{operator.postalCode} {operator.city}<br />{operator.country}</address>
      <h2>Kontakt</h2><p>{email}{operator.phone && <><br />{operator.phone}</>}</p>
      {operator.additionalDetails && <p className="notice-text">{operator.additionalDetails}</p>}
    </>;
  } else if (path === '/datenschutz/') {
    title = 'Datenschutz';
    content = <>
      <p className="legal-meta">Package ID: <code>io.opennews.app</code> · Stand / Effective Date: 2026-11-19</p>
      <h2>Diese Website</h2>
      {isPreview ? <>
        <p>Diese Vorschau speichert deine manuell gewählte Darstellung im Browser. Mit der Auswahl „System“ entfernst du diese Einstellung wieder.</p>
        <h3>Verantwortlicher</h3>
        <p><strong>TODO(Manuel)</strong> Name und Anschrift des Verantwortlichen ergänzen.</p>
        <h3>Hosting bei Cloudflare Pages</h3>
        <p>Beim Aufruf stellt Cloudflare Pages die Website bereit. Cloudflare verarbeitet dabei technische Daten wie deine IP-Adresse. Der Hoster kann Zugriffe in Server-Protokollen erfassen, etwa mit der aufgerufenen Seite und dem Zeitpunkt.</p>
        <p><strong>TODO(Manuel)</strong> Tatsächliche Protokollierung, Speicherdauer, Rechtsgrundlage und mögliche Übermittlung in andere Länder vor der Veröffentlichung klären.</p>
        <h3>Kontaktaufnahme per E-Mail</h3>
        <p>Wenn du uns schreibst, verwenden wir deine E-Mail-Adresse und den Inhalt deiner Nachricht, um dein Anliegen zu bearbeiten und dir zu antworten. Wir speichern die Nachricht, bis dein Anliegen erledigt ist, soweit keine gesetzlichen Aufbewahrungspflichten gelten.</p>
        <p><strong>TODO(Manuel)</strong> Öffentliche E-Mail-Adresse und Rechtsgrundlage für die Bearbeitung von Anfragen ergänzen.</p>
        <h3>Deine Rechte</h3>
        <p>Du kannst Auskunft über deine personenbezogenen Daten verlangen und falsche Daten berichtigen lassen. Unter den gesetzlichen Voraussetzungen kannst du die Löschung oder Einschränkung der Verarbeitung verlangen, deine Daten übertragen lassen oder der Verarbeitung widersprechen. Eine erteilte Einwilligung kannst du für die Zukunft widerrufen.</p>
        <h3>Beschwerde bei einer Aufsichtsbehörde</h3>
        <p>Wenn du glaubst, dass deine Daten rechtswidrig verarbeitet werden, kannst du dich bei einer Datenschutzaufsichtsbehörde beschweren. Das ist zum Beispiel bei der Behörde an deinem Wohnort möglich.</p>
      </> : <>
        <p>Verantwortlich ist der im <a href="/impressum/">Impressum</a> genannte Betreiber.</p>
        <p>Eine manuell gewählte Darstellung speichert die Website im lokalen Speicher deines Browsers. Mit der Auswahl „System“ entfernst du diese Einstellung wieder.</p>
        <NoticeBlocks text={site.privacyNotice} />
      </>}
      <h2>Die OpenNews-App</h2>
      <p>Quellen, Interessen, Leseverlauf, Lesezeichen und Einstellungen sind auf deinem Gerät gespeichert. Du kannst die Interessen zurücksetzen und die Daten im Browser oder in den Android-Einstellungen löschen.</p>
      <p>Android ruft Feeds direkt ab. Die Web-App nutzt dafür einen OpenNews-Server. Quellen und externe Medien können beim Aufruf technische Verbindungsdaten erhalten. Optionale Dienste wie externe KI oder Android-Übersetzung haben eigene Datenflüsse.</p>
      <h2>Datenschutzkontakt</h2><p>{email ? <>Fragen zur Website oder App kannst du an {email} richten.</> : emailPending}</p>
      <h2>English – Privacy Policy</h2>
      <p><strong>OpenNews</strong> (<code>io.opennews.app</code>) is built around local-first news reading. It requires no user account, displays no advertising, and does not sell or track your reading habits.</p>
      <ul>
        <li><strong>On-device storage:</strong> Selected feeds, bookmarks, reactions, reading history, personalisation weights, widget state and optional diagnostic logs stay locally on your device. Android cloud backups are disabled; manual backups are user-initiated exports.</li>
        <li><strong>Feed &amp; media connections:</strong> On Android, RSS feeds, preview images, full-text articles and linked transcripts are fetched directly by your device. Opening links or playing embedded media connects directly to the respective provider under their privacy policy.</li>
        <li><strong>Optional on-device &amp; external AI:</strong> On-device Android translation and local summarisation use Google ML Kit (which may download language models and send installation-scoped technical diagnostics to Google). External AI providers (such as Google Gemini, OpenAI, Anthropic, Mistral AI, OpenRouter or custom endpoints) are only contacted when you explicitly configure and trigger them.</li>
        <li><strong>Deletion &amp; contact:</strong> Reset interests or clear reading history inside OpenNews settings, or remove all app data via Android system settings. Privacy &amp; GDPR inquiries: {email ?? emailPending} (Operator details in <a href="/impressum/">Imprint</a>).</li>
      </ul>
    </>;
  } else if (path === '/kontakt/') {
    title = 'Kontakt';
    content = <>
      <p className="legal-meta">App-Paket: <code>io.opennews.app</code></p>
      <p>Hast du Feedback zu OpenNews, Fragen zur Veröffentlichung oder ein Datenschutzanliegen? {email ? <>Schreib an {email}.</> : emailPending}</p>
      <p>Wenn du einen Fehler meldest, helfen das Gerät, die App-Version und eine kurze Beschreibung, wie der Fehler auftritt.</p>
      <p>Informationen zum Betreiber findest du im <a href="/impressum/">Impressum</a>, Hinweise zur Datenverarbeitung im <a href="/datenschutz/">Datenschutz</a>.</p>
    </>;
  } else {
    title = 'Seite nicht gefunden';
    content = <p>Hier gibt es keine Seite. Auf der <a href="/">Startseite</a> findest du den App-Einblick und den aktuellen Download-Status.</p>;
  }
  return <article className="wrap prose"><h1>{title}</h1>{content}</article>;
}

export function Page({ path }: { path: Route }) {
  return <>
    <a href="#inhalt" className="skip">Zum Inhalt springen</a>
    <header className="header"><div className="wrap header-inner">
      <Brand />
      <nav aria-label="Hauptnavigation">
        <a href="/#funktionen">Funktionen</a><a href="/#datenschutz">Datenschutz</a><a href="/#faq">FAQ</a>
      </nav>
      {site.webAppUrl ? (
        <a className="button nav-action" href={site.webAppUrl}>Web-App <Arrow /></a>
      ) : (
        <a className="button nav-action" href="/#download">App-Status <Arrow /></a>
      )}
    </div></header>
    <main id="inhalt" tabIndex={-1}>{path === '/' ? <Home /> : <Legal path={path} />}</main>
    <footer className="wrap footer">
      <div><Brand /><p>Nachrichten aus deinen Quellen.</p></div>
      <nav aria-label="Weitere Links">
        <a href="/kontakt/">Kontakt</a><a href="/datenschutz/">Datenschutz</a><a href="/impressum/">Impressum</a>
        <a href="/#download">App-Status</a>
      </nav>
      <label hidden>Darstellung <select id="theme"><option value="system">System</option><option value="dark">Dunkel</option><option value="light">Hell</option></select></label>
    </footer>
  </>;
}
