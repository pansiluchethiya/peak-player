import Link from 'next/link';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import {
  ArrowRight,
  Braces,
  CirclePlay,
  KeyRound,
  Layers3,
  Radio,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

const cards = [
  {
    href: '/docs/quickstart',
    icon: Terminal,
    title: 'Quickstart',
    body: 'Mint a signed session and mount the SDK in a few lines of JavaScript.',
    meta: '5 minutes',
  },
  {
    href: '/docs/concepts',
    icon: Layers3,
    title: 'How Peak works',
    body: 'Sources, validation, ranking, failover, and the embed boundary.',
    meta: 'Concepts',
  },
  {
    href: '/docs/guides/live-tv',
    icon: Radio,
    title: 'Live TV',
    body: 'Channel catalogs, embeddable live sources, and player behaviour.',
    meta: 'Guide',
  },
  {
    href: '/docs/guides/auth',
    icon: KeyRound,
    title: 'Partner auth',
    body: 'API keys, signed tokens, origin allowlists, and expiry.',
    meta: 'Guide',
  },
  {
    href: '/docs/reference/sdk',
    icon: Braces,
    title: 'SDK reference',
    body: 'The complete PeakEmbed JavaScript API and lifecycle.',
    meta: 'Reference',
  },
  {
    href: '/docs/api-reference',
    icon: CirclePlay,
    title: 'API reference',
    body: 'Endpoints, payloads, status codes, and OpenAPI operations.',
    meta: 'HTTP API',
  },
];

export default function HomePage() {
  return (
    <HomeLayout
      nav={{
        title: (
          <span className="flex items-center gap-2.5 font-semibold tracking-tight">
            <img src="/logo.svg" alt="" width={28} height={28} className="rounded-lg" />
            Peak Docs
          </span>
        ),
        url: '/',
      }}
      links={[
        { text: 'Quickstart', url: '/docs/quickstart' },
        { text: 'API reference', url: '/docs/api-reference' },
      ]}
    >
      <main className="peak-docs-home">
        <div className="peak-docs-home-inner">
          <p className="peak-docs-eyebrow">Embed platform documentation</p>
          <h1>
            Every source.
            <br />
            <em>One player.</em>
          </h1>
          <p className="peak-docs-lede">
            Peak resolves, validates, ranks, and fails over media sources behind a custom Hls.js
            player. Partners get a signed embed URL, an exact-origin boundary, and a small
            postMessage SDK. Upstream URLs stay server-side.
          </p>
          <div className="peak-docs-actions">
            <Link className="peak-docs-button primary" href="/docs/quickstart">
              Start integrating <ArrowRight size={15} />
            </Link>
            <Link className="peak-docs-button secondary" href="/docs/api-reference">
              Browse the API
            </Link>
          </div>

          <div className="peak-docs-grid">
            {cards.map(({ href, icon: Icon, title, body, meta }) => (
              <Link className="peak-docs-card" href={href} key={href}>
                <Icon aria-hidden="true" />
                <strong>{title}</strong>
                <span>{body}</span>
                <small>{meta}</small>
              </Link>
            ))}
          </div>

          <div className="peak-docs-meta">
            <span>
              <ShieldCheck size={12} className="inline align-[-2px]" /> HMAC-SHA256 tokens
            </span>
            <span>
              Signed media proxy with <code>Range</code> support
            </span>
            <span>
              <code>frame-ancestors</code> allowlist, never wildcard
            </span>
          </div>
        </div>
      </main>
    </HomeLayout>
  );
}
