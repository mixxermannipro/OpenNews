import type { ReactNode } from 'react';
import { faqItems } from './content/faq.ts';
import type { Route } from './content/meta.ts';
import { isPreview, site } from './content/site.ts';

function Arrow() {
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>;
}

function Brand() {
  return <a className="brand" href="/"><img src="/favicon.svg" alt="" width="32" height="32" />OpenNews</a>;
}

function AppImage({ file, alt, priority = false, widget = false }: {
  file: string; alt: string; priority?: boolean; widget?: boolean;
}) {
  const image = <img src={`/screenshots/${file}.webp`} alt={alt}
    width={widget ? 420 : 824} height={widget ? 625 : 1740}
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
        <figcaption>Aufnahmen aus der Entwicklung</figcaption>
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
        <h3>Deine Quellen bestimmen.</h3>
        <p>Entdecke Themen und Redaktionen. Wähle deine Quellen aus oder füge einen eigenen RSS-Feed hinzu.</p>
      </article>
      <article>
        <div className="feature-image"><AppImage file="artikel" alt="Artikelansicht eines Entwicklungsbuilds mit Quelle, Überschrift und Lesezeichen" /></div>
        <h3>Später in Ruhe lesen.</h3>
        <p>Merk dir interessante Meldungen für später. In der geplanten Play-Beta führt die Artikelansicht mit Titel, Quelle und Datum zum Original.</p>
      </article>
      <article>
        <div className="feature-image"><AppImage file="medien" alt="Video- und Audioübersicht mit Vorschauen aus der Entwicklung" /></div>
        <h3>Nachrichten als Video und Audio.</h3>
        <p>Finde Videos, Clips und Audiobeiträge aus deinen Quellen. In der geplanten Play-Beta öffnen sie sich bei den jeweiligen Anbietern.</p>
      </article>
    </div>
    <p className="capture-note">App-Aufnahmen aus der Entwicklung</p>
    <div className="widget-feature">
      <AppImage file="widget" alt="Android-Widget mit Schlagzeilen und auswählbaren Ansichten" widget />
      <div><h3>Dein Überblick auf dem Startbildschirm.</h3>
        <p>Das Android-Widget bringt Schlagzeilen auf deinen Startbildschirm. Den Tagesüberblick kannst du in der App lesen oder dir vorlesen lassen.</p></div>
    </div>
  </section>;
}

function Home() {
  return <>
    <section className="wrap hero">
      <div className="hero-copy">
        <h1>Deine Nachrichten.<br />Deine Quellen.<br /><em>Dein Überblick.</em></h1>
        <p>Wähle, von wem du Nachrichten liest. OpenNews bündelt deine Quellen und zeigt dir, was heute wichtig ist und was dich interessiert.</p>
        <div className="actions"><a className="button primary" href="#einblick">App ansehen <Arrow /></a><a className="text-link" href="#download">Verfügbarkeit</a></div>
      </div>
      <figure className="hero-stage">
        <AppImage file="heute" alt="OpenNews auf einem Smartphone mit der Ansicht Heute" priority />
        <figcaption>OpenNews in der Entwicklung</figcaption>
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
        <h2>OpenNews für Android.</h2>
        <p>{site.playStoreUrl ? 'OpenNews ist über Google Play erhältlich.' : 'OpenNews befindet sich im Test und ist noch nicht öffentlich bei Google Play verfügbar.'}</p>
        {site.playStoreUrl && <a className="button primary" href={site.playStoreUrl}>Bei Google Play öffnen <Arrow /></a>}
        {site.webAppUrl && <a className="text-link" href={site.webAppUrl}>Web-App öffnen <Arrow /></a>}
      </div>
    </section>
  </>;
}

function Legal({ path }: { path: Exclude<Route, '/'> }) {
  const { operator } = site;
  const email = <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>;
  let title: string;
  let content: ReactNode;
  if (path === '/impressum/') {
    title = 'Impressum';
    content = isPreview ? <p>Die bestätigten Betreiberangaben werden vor der Veröffentlichung ergänzt. Fragen kannst du über die <a href="/kontakt/">Kontaktseite</a> stellen.</p> : <>
      <h2>Betreiber der Website</h2>
      <address>{operator.name}<br />{operator.street}<br />{operator.postalCode} {operator.city}<br />{operator.country}</address>
      <h2>Kontakt</h2><p>{email}{operator.phone && <><br />{operator.phone}</>}</p>
      {operator.additionalDetails && <p className="notice-text">{operator.additionalDetails}</p>}
    </>;
  } else if (path === '/datenschutz/') {
    title = 'Datenschutz';
    content = <>
      <h2>Diese Website</h2>
      {isPreview ? <p>Diese Vorschau speichert nur deine manuell gewählte Darstellung im Browser. Die Angaben zum öffentlichen Hosting und zum Verantwortlichen werden vor der Veröffentlichung ergänzt.</p> : <>
        <p>Verantwortlich ist der im <a href="/impressum/">Impressum</a> genannte Betreiber.</p>
        <p>Eine manuell gewählte Darstellung speichert die Website im lokalen Speicher deines Browsers. Mit der Auswahl „System“ entfernst du diese Einstellung wieder.</p>
        <p className="notice-text">{site.privacyNotice}</p>
      </>}
      <h2>Die OpenNews-App</h2>
      <p>Quellen, Interessen, Leseverlauf, Lesezeichen und Einstellungen sind auf deinem Gerät gespeichert. Du kannst die Interessen zurücksetzen und die Daten im Browser oder in den Android-Einstellungen löschen.</p>
      <p>Android ruft Feeds direkt ab. Die Web-App nutzt dafür einen OpenNews-Server. Quellen und externe Medien können beim Aufruf technische Verbindungsdaten erhalten. Optionale Dienste wie externe KI oder Android-Übersetzung haben eigene Datenflüsse.</p>
      <h2>Datenschutzkontakt</h2><p>Fragen zur Website oder App kannst du an {email} richten.</p>
    </>;
  } else if (path === '/kontakt/') {
    title = 'Kontakt';
    content = <><p>Hast du Feedback zu OpenNews, Fragen zur Veröffentlichung oder ein Datenschutzanliegen? Schreib an {email}.</p>
      <p>Wenn du einen Fehler meldest, helfen das Gerät, die App-Version und eine kurze Beschreibung, wie der Fehler auftritt.</p></>;
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
      <a className="button nav-action" href="/#download">App-Status <Arrow /></a>
    </div></header>
    <main id="inhalt" tabIndex={-1}>{path === '/' ? <Home /> : <Legal path={path} />}</main>
    <footer className="wrap footer">
      <div><Brand /><p>Nachrichten aus deinen Quellen.</p></div>
      <nav aria-label="Weitere Links">
        <a href="/kontakt/">Kontakt</a><a href="/datenschutz/">Datenschutz</a><a href="/impressum/">Impressum</a>
        <a href="/#download">App-Status</a>
        {site.social.map(link => <a href={link.href} key={link.href}>{link.label}</a>)}
      </nav>
      <label hidden>Darstellung <select id="theme"><option value="system">System</option><option value="dark">Dunkel</option><option value="light">Hell</option></select></label>
    </footer>
  </>;
}
