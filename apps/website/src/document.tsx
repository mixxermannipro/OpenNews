import { renderToStaticMarkup } from 'react-dom/server';
import { Page } from './Page.tsx';
import { canonicalFor, routes, type Route } from './content/meta.ts';
import { isPreview, site } from './content/site.ts';

export function renderDocument(template: string, path: Route) {
  const { title, description } = routes[path];
  const canonical = canonicalFor(path);
  const socialImage = site.url ? `${site.url}/og/opennews.jpg` : undefined;
  const data = canonical && path === '/' && !isPreview ? {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: canonical,
    description,
    inLanguage: 'de',
  } : undefined;
  const head = renderToStaticMarkup(<>
    <title>{title}</title>
    <meta name="description" content={description} />
    {(isPreview || path === '/404') && <meta name="robots" content="noindex, nofollow" />}
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="de_DE" />
    <meta property="og:site_name" content={site.name} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    {canonical && <><link rel="canonical" href={canonical} /><meta property="og:url" content={canonical} /></>}
    {socialImage && <>
      <meta property="og:image" content={socialImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="OpenNews mit der App-Ansicht Heute" />
      <meta name="twitter:card" content="summary_large_image" />
    </>}
    {data && <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify(data).replace(/</g, '\\u003c'),
    }} />}
  </>);
  return template.replace('<!--site-head-->', () => head)
    .replace('<!--site-body-->', () => renderToStaticMarkup(<Page path={path} />));
}
