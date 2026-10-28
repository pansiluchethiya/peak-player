import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleDot,
  Code2,
  Gauge,
  Globe2,
  KeyRound,
  Layers3,
  LockKeyhole,
  MonitorPlay,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Waypoints,
  Zap,
} from 'lucide-react';
import { Backlight } from '@/components/marketing/backlight';
import { BentoCard, BentoGrid } from '@/components/marketing/bento-grid';
import { BorderBeam } from '@/components/marketing/border-beam';
import { HeroVideoDialog } from '@/components/marketing/hero-video-dialog';
import { Marquee } from '@/components/marketing/marquee';
import { NumberTicker } from '@/components/marketing/number-ticker';
import { MiniPlayerDemo } from '@/components/MiniPlayerDemo';

const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'https://docs.peak-player.com';

const providers = [
  'Vixsrc',
  'Videasy',
  'Netmirror',
  'Vaplayer',
  'Vidlink',
  'Streamflix',
  'Showbox',
  'CastleTV',
  'HDGharTV',
  '4KHDHub',
  'OneTouchTV',
  'ZXCStreams',
];

const quickStart = `curl -X POST https://api.peak.example/api/v1/embed/sessions \\
  -H "x-api-key: $PEAK_API_KEY" \\
  -H "content-type: application/json" \\
  -d '{"type":"movie","id":"550"}'

# → { "embedUrl": "https://player.peak.example/embed/movie/550?token=…",
#     "expiresAt": "2026-10-25T12:15:00.000Z" }`;

const mountSnippet = `const player = PeakEmbed.mount({
  target: '#peak-player',
  url: session.embedUrl,
  title: 'Fight Club',
});

player.on('sourcechange', ({ quality, provider }) => {
  console.log('playing', quality, 'from', provider);
});

player.play();`;

const eventSnippet = `player.on('ready', () => {});
player.on('play', () => {});
player.on('pause', () => {});
player.on('timeupdate', ({ currentTime }) => {});
player.on('sourcechange', ({ index, quality }) => {});
player.on('ended', () => {});
player.on('error', ({ code }) => {});`;

const faqs = [
  {
    question: 'Can a partner use the player without exposing provider URLs?',
    answer:
      'Yes. The browser receives only signed Peak proxy URLs from the player API. Raw provider URLs stay on the server. External HTML5 sources are excluded from embed event streams unless a live channel has no embeddable HLS source, in which case the player returns NO_EMBEDDABLE_SOURCE.',
  },
  {
    question: 'What happens when the first source is dead?',
    answer:
      'The player validates sources before playback, ranks them by health and quality, then fails over automatically. Each source is tried once, and the source rail shows which provider is carrying the stream.',
  },
  {
    question: 'How long do embed tokens last?',
    answer:
      'Tokens are short-lived and signed with HMAC-SHA256. The default session is 15 minutes; partners can request anything from 60 seconds to 24 hours. Expired or tampered tokens are rejected at the edge with a 401.',
  },
  {
    question: 'Which origins can frame the player?',
    answer:
      'Only the exact origins in the signed token. Peak writes a Content-Security-Policy frame-ancestors allowlist for those origins plus self. Wildcards are rejected when partner configuration is loaded.',
  },
  {
    question: 'Does live TV work in an embed?',
    answer:
      'HLS live channels work through the same player, with health checks and failover. Channels that only expose a third-party HTML page are blocked in embed mode so the upstream iframe URL never reaches the partner page.',
  },
  {
    question: 'Can we theme the player?',
    answer:
      'The player uses Peak design tokens for accent, surfaces, and focus states. Branding metadata is served by the player API, so a partner skin can be applied without forking the playback engine.',
  },
];

const statusRows = [
  { label: 'Player API', detail: 'Signed sessions, SSE source events', icon: Server },
  { label: 'Media proxy', detail: 'Signed playlists and range requests', icon: Waypoints },
  { label: 'Embed edge', detail: 'Token verification and frame allowlist', icon: ShieldCheck },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="peak-section-label">
      <span aria-hidden="true" />
      {children}
    </p>
  );
}

export default function HomePage() {
  return (
    <div className="peak-site">
      <a className="peak-skip" href="#main">
        Skip to content
      </a>

      <header className="peak-header">
        <Link className="peak-brand" href="/" aria-label="Peak home">
          <img src="/logo.svg" alt="" width={34} height={34} />
          <span>
            Peak
            <small>Embed</small>
          </span>
        </Link>
        <nav className="peak-nav" aria-label="Primary">
          <a href="#player">Player</a>
          <a href="#quickstart">Quick start</a>
          <a href="#features">Features</a>
          <a href="#docs">Docs</a>
        </nav>
        <div className="peak-header-actions">
          <a className="peak-status-pill" href="#status">
            <span className="peak-status-dot" aria-hidden="true" />
            Status
          </a>
          <Link className="peak-header-cta" href="/embed/demo">
            Open demo
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="main">
        <section className="peak-hero" id="player" aria-labelledby="hero-title">
          <Backlight className="peak-hero-backlight">
            <div className="peak-hero-grid">
              <div className="peak-hero-copy">
                <SectionLabel>Peak Embed / signed player platform</SectionLabel>
                <h1 id="hero-title">
                  Every source.
                  <br />
                  One player.
                  <br />
                  <em>Your frame.</em>
                </h1>
                <p className="peak-hero-lede">
                  A custom Hls.js player with validated sources, provider failover, live TV, and
                  short-lived partner tokens. Ship the playback experience without shipping your
                  provider list.
                </p>
                <div className="peak-hero-actions">
                  <Link className="peak-button peak-button-primary" href="/embed/demo">
                    <MonitorPlay aria-hidden="true" />
                    Open the live demo
                  </Link>
                  <a className="peak-button peak-button-ghost" href="#quickstart">
                    Read the quick start
                    <ArrowRight aria-hidden="true" />
                  </a>
                </div>
                <ul className="peak-hero-facts" aria-label="Platform guarantees">
                  <li>
                    <BadgeCheck aria-hidden="true" />
                    Signed, short-lived sessions
                  </li>
                  <li>
                    <BadgeCheck aria-hidden="true" />
                    Exact-origin frame allowlist
                  </li>
                  <li>
                    <BadgeCheck aria-hidden="true" />
                    No upstream URLs in embed HTML
                  </li>
                </ul>
              </div>

              <div className="peak-hero-artifact">
                <div className="peak-artifact-topline">
                  <span className="peak-artifact-kicker">Now playing / movie 550</span>
                  <span className="peak-artifact-live">
                    <CircleDot aria-hidden="true" />
                    validated
                  </span>
                </div>
                <div className="peak-player-card">
                  <div className="peak-player-chrome">
                    <span className="peak-chrome-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>player.peak.example/embed/movie/550</span>
                    <LockKeyhole aria-hidden="true" />
                  </div>
                  <div className="peak-player-stage">
                    <div className="peak-player-film" aria-hidden="true">
                      <div className="peak-film-glow" />
                      <div className="peak-film-grain" />
                    </div>
                    <div className="peak-player-title">
                      <p>Fight Club</p>
                      <span>1999 · 2h 19m · 1080p</span>
                    </div>
                    <div className="peak-player-center">
                      <HeroVideoDialog label="Preview the Peak player" />
                    </div>
                    <div className="peak-player-controls" aria-hidden="true">
                      <span className="peak-play-glyph">▶</span>
                      <span className="peak-player-time">00:42:18</span>
                      <span className="peak-player-track">
                        <i style={{ width: '31%' }} />
                      </span>
                      <span className="peak-player-time">02:19:00</span>
                      <span className="peak-player-badge">1080p</span>
                      <span className="peak-player-badge">CC</span>
                    </div>
                  </div>
                </div>
                <div className="peak-source-rail" aria-label="Source health preview">
                  <div className="peak-source-head">
                    <span>Source health</span>
                    <span>failover armed</span>
                  </div>
                  {[
                    ['Vixsrc', 'HLS · 1080p', 'playing'],
                    ['Videasy', 'HLS · 1080p', 'standby'],
                    ['Netmirror', 'MP4 · 720p', 'validated'],
                    ['Vaplayer', 'HLS · 720p', 'standby'],
                  ].map(([name, meta, state], index) => (
                    <div className={`peak-source-row ${index === 0 ? 'is-active' : ''}`} key={name}>
                      <span className="peak-source-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="peak-source-name">
                        {name}
                        <small>{meta}</small>
                      </span>
                      <span className="peak-source-state">{state}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Backlight>
        </section>

        <section className="peak-provider-band" aria-label="Supported providers">
          <div className="peak-provider-intro">
            <span>Provider network</span>
            <p>One ranked queue, many sources.</p>
          </div>
          <Marquee className="peak-provider-marquee">
            {providers.map((provider) => (
              <span className="peak-provider-chip" key={provider}>
                <span aria-hidden="true" />
                {provider}
              </span>
            ))}
          </Marquee>
        </section>

        <section className="peak-quickstart" id="quickstart" aria-labelledby="quickstart-title">
          <div className="peak-section-heading">
            <div>
              <SectionLabel>Quick start</SectionLabel>
              <h2 id="quickstart-title">Three moves from API key to playing.</h2>
            </div>
            <p>
              The partner server mints a session. The browser mounts the SDK. Peak handles source
              validation, ranking, failover, and playback.
            </p>
          </div>

          <div className="peak-quickstart-grid">
            <ol className="peak-steps">
              <li>
                <span className="peak-step-number">01</span>
                <div>
                  <h3>Mint a signed session</h3>
                  <p>
                    Send your partner <code>x-api-key</code> to{' '}
                    <code>/api/v1/embed/sessions</code>. The response contains a short-lived token
                    and an embed URL scoped to the media and your exact origins.
                  </p>
                </div>
              </li>
              <li>
                <span className="peak-step-number">02</span>
                <div>
                  <h3>Mount the player</h3>
                  <p>
                    Load <code>peak-embed.js</code> and call <code>PeakEmbed.mount</code> with the
                    signed URL. The SDK creates the iframe and validates the player origin.
                  </p>
                </div>
              </li>
              <li>
                <span className="peak-step-number">03</span>
                <div>
                  <h3>Listen and control</h3>
                  <p>
                    Subscribe to <code>ready</code>, <code>play</code>, <code>pause</code>,{' '}
                    <code>timeupdate</code>, <code>sourcechange</code>, <code>ended</code>, and{' '}
                    <code>error</code>. Send playback commands back over the same channel.
                  </p>
                </div>
              </li>
            </ol>

            <div className="peak-code-stack">
              <div className="peak-code-card">
                <div className="peak-code-head">
                  <span>
                    <Terminal aria-hidden="true" />
                    Partner server
                  </span>
                  <span>POST /api/v1/embed/sessions</span>
                </div>
                <pre>
                  <code>{quickStart}</code>
                </pre>
              </div>
              <div className="peak-code-card peak-code-card-dark">
                <div className="peak-code-head">
                  <span>
                    <Code2 aria-hidden="true" />
                    Browser
                  </span>
                  <span>peak-embed.js</span>
                </div>
                <pre>
                  <code>{mountSnippet}</code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className="peak-features" id="features" aria-labelledby="features-title">
          <div className="peak-section-heading">
            <div>
              <SectionLabel>Built for playback</SectionLabel>
              <h2 id="features-title">The player is the product. The platform keeps it honest.</h2>
            </div>
            <p>
              Every layer exists to protect one moment: the first frame. Sources are checked,
              ranked, and swapped before a partner sees a failure.
            </p>
          </div>

          <BentoGrid>
            <BentoCard
              className="peak-bento-wide"
              icon={<Activity aria-hidden="true" />}
              title="Source health"
              description="Each candidate gets a real validation pass before it is eligible for playback. Dead URLs are rejected with diagnostics instead of shown as a broken player."
            >
              <div className="peak-health-graphic" aria-hidden="true">
                <span style={{ width: '92%' }} />
                <span style={{ width: '68%' }} />
                <span style={{ width: '81%' }} />
                <span style={{ width: '54%' }} />
              </div>
            </BentoCard>
            <BentoCard
              icon={<Zap aria-hidden="true" />}
              title="Failover"
              description="Sources are ranked by provider health and quality, then tried once in order. A failed first source never strands the viewer."
            />
            <BentoCard
              icon={<LockKeyhole aria-hidden="true" />}
              title="Signed URLs"
              description="Playlist and segment URLs carry an HMAC signature and expiry. Unsigned proxy requests are rejected."
            />
            <BentoCard
              className="peak-bento-tall"
              icon={<KeyRound aria-hidden="true" />}
              title="Partner auth"
              description="API keys mint tokens. Tokens are scoped to partner, media, and exact origins. The player verifies them at the edge before rendering."
            >
              <div className="peak-auth-diagram" aria-hidden="true">
                <span>partner</span>
                <i />
                <span>api key</span>
                <i />
                <span>signed token</span>
                <i />
                <span>frame allowlist</span>
              </div>
            </BentoCard>
            <BentoCard
              icon={<Layers3 aria-hidden="true" />}
              title="Provider breadth"
              description="HLS, progressive MP4, and provider-specific sources share one ranked queue. The UI shows quality and provenance without exposing upstream URLs."
            />
            <BentoCard
              icon={<Radio aria-hidden="true" />}
              title="Live TV"
              description="HLS live channels use the same player, source validation, and failover. External-only channels are filtered in embed mode."
            />
          </BentoGrid>
        </section>

        <section className="peak-stats" aria-label="Acceptance targets">
          <div className="peak-stat-intro">
            <SectionLabel>Acceptance targets</SectionLabel>
            <h2>Numbers we can defend, not vanity metrics.</h2>
            <p>
              These are the gates the player and embed platform are measured against, including the
              20-title source matrix.
            </p>
          </div>
          <dl className="peak-stat-grid">
            <div>
              <dt>
                <NumberTicker value={95} suffix="%" />
              </dt>
              <dd>First-play success target across the 20-title matrix</dd>
            </div>
            <div>
              <dt>
                <NumberTicker value={3} prefix="&lt;" suffix="s" />
              </dt>
              <dd>p75 time to first frame</dd>
            </div>
            <div>
              <dt>
                <NumberTicker value={100} suffix="%" />
              </dt>
              <dd>Sources validated before playback</dd>
            </div>
            <div>
              <dt>
                <NumberTicker value={0} />
              </dt>
              <dd>Wildcard origins or unsigned proxy requests</dd>
            </div>
          </dl>
        </section>

        <section className="peak-integration" aria-labelledby="integration-title">
          <div className="peak-integration-copy">
            <SectionLabel>Integration</SectionLabel>
            <h2 id="integration-title">Designed for a partner page, not a player rewrite.</h2>
            <p>
              Keep your catalog, account system, and page chrome. Peak owns the video surface and
              the source pipeline behind it.
            </p>
            <div className="peak-integration-points">
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>
                  <strong>Parent-origin validation</strong>
                  The SDK only accepts messages from the player iframe origin.
                </span>
              </div>
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>
                  <strong>Commands, not internals</strong>
                  Play, pause, seek, volume, subtitles, and quality are explicit API commands.
                </span>
              </div>
              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>
                  <strong>Graceful failure</strong>
                  Embed errors return a code and message; provider diagnostics stay server-side.
                </span>
              </div>
            </div>
          </div>
          <div className="peak-event-card">
            <div className="peak-event-head">
              <span>
                <Sparkles aria-hidden="true" />
                Event surface
              </span>
              <span>postMessage / peak-player</span>
            </div>
            <pre>
              <code>{eventSnippet}</code>
            </pre>
            <div className="peak-event-footer">
              <Globe2 aria-hidden="true" />
              Exact-origin delivery. No wildcard <code>postMessage</code>.
            </div>
          </div>
        </section>

        <section className="peak-auth" aria-labelledby="auth-title">
          <div className="peak-auth-art">
            <BorderBeam />
            <div className="peak-auth-orbit" aria-hidden="true">
              <span className="peak-orbit-core">
                <ShieldCheck />
              </span>
              <span className="peak-orbit-node peak-orbit-node-a">API key</span>
              <span className="peak-orbit-node peak-orbit-node-b">HMAC-SHA256</span>
              <span className="peak-orbit-node peak-orbit-node-c">frame-ancestors</span>
              <span className="peak-orbit-ring" />
            </div>
          </div>
          <div className="peak-auth-copy">
            <SectionLabel>Partner auth</SectionLabel>
            <h2 id="auth-title">Trust is a short-lived token, not a promise.</h2>
            <p>
              Partners authenticate server-to-server. Peak signs a token with the partner id, media
              target, exact origins, issued-at, and expiry. The edge verifies the signature and
              builds a <code>frame-ancestors</code> policy from the token before the player renders.
            </p>
            <ul className="peak-auth-list">
              <li>
                <ShieldCheck aria-hidden="true" />
                HMAC-SHA256, base64url, timing-safe verification
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                Expired, forged, and wildcard tokens rejected with 401
              </li>
              <li>
                <ShieldCheck aria-hidden="true" />
                No provider or upstream URL in embed HTML
              </li>
            </ul>
            <div className="peak-auth-actions">
              <a className="peak-button peak-button-primary" href="#quickstart">
                See the session API
                <ArrowRight aria-hidden="true" />
              </a>
              <a className="peak-text-link" href="/embed/demo">
                Try a signed demo
              </a>
            </div>
          </div>
        </section>

        <section className="peak-docs" id="docs" aria-labelledby="docs-title">
          <div className="peak-docs-card">
            <div className="peak-docs-copy">
              <SectionLabel>Documentation</SectionLabel>
              <h2 id="docs-title">From first token to production edge cases.</h2>
              <p>
                Task-based guides for movie, TV, and live embeds; the SDK and postMessage API; URL
                signing; theming; playback; errors; self-hosting; architecture; security; and
                troubleshooting.
              </p>
              <div className="peak-docs-actions">
                <Link className="peak-button peak-button-primary" href={DOCS_URL}>
                  Read the docs
                  <ArrowRight aria-hidden="true" />
                </Link>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON endpoint, not a page */}
                <a className="peak-text-link" href="/api/v1/playback/health">
                  Inspect playback health
                </a>
              </div>
            </div>
            <div className="peak-docs-index" aria-label="Documentation highlights">
              {[
                ['01', 'Quick start', 'Mint, mount, listen'],
                ['02', 'Auth', 'Keys, tokens, origins'],
                ['03', 'SDK', 'Events and commands'],
                ['04', 'Live TV', 'HLS channels and fallbacks'],
                ['05', 'Security', 'Proxy and SSRF guards'],
                ['06', 'API reference', 'OpenAPI contract'],
              ].map(([number, title, detail]) => (
                <div className="peak-docs-row" key={title}>
                  <span>{number}</span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="peak-faq" aria-labelledby="faq-title">
          <div className="peak-section-heading">
            <div>
              <SectionLabel>FAQ</SectionLabel>
              <h2 id="faq-title">Questions partners ask before the first iframe.</h2>
            </div>
            <p>
              Short answers for the decisions that usually block an embed integration.
            </p>
          </div>
          <div className="peak-faq-list">
            {faqs.map((faq) => (
              <details className="peak-faq-item" key={faq.question}>
                <summary>
                  <span>{faq.question}</span>
                  <span className="peak-faq-plus" aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="peak-status" id="status" aria-labelledby="status-title">
          <div className="peak-status-copy">
            <SectionLabel>Status</SectionLabel>
            <h2 id="status-title">The surfaces a partner depends on.</h2>
            <p>
              Health and telemetry are exposed by the API. The player records source diagnostics
              without leaking provider URLs to the parent page.
            </p>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON endpoint, not a page */}
            <a className="peak-text-link" href="/api/v1/playback/health">
              View the live health endpoint
              <ArrowRight aria-hidden="true" />
            </a>
          </div>
          <div className="peak-status-card">
            <div className="peak-status-card-head">
              <span>
                <span className="peak-status-dot" aria-hidden="true" />
                Operational
              </span>
              <span>Peak Embed v1</span>
            </div>
            {statusRows.map(({ label, detail, icon: Icon }) => (
              <div className="peak-status-row" key={label}>
                <Icon aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{detail}</small>
                </span>
                <span className="peak-status-check">
                  <CheckCircle2 aria-hidden="true" />
                  Healthy
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="peak-final-cta" aria-labelledby="final-title">
          <div className="peak-final-glow" aria-hidden="true" />
          <div className="peak-final-copy">
            <SectionLabel>Ready when you are</SectionLabel>
            <h2 id="final-title">Put a real player in your frame.</h2>
            <p>
              Mint a signed session, mount the SDK, and let Peak handle the sources behind the
              video. The demo is live.
            </p>
            <div className="peak-final-actions">
              <Link className="peak-button peak-button-primary" href="/embed/demo">
                <MonitorPlay aria-hidden="true" />
                Open the embed demo
              </Link>
              <Link className="peak-button peak-button-ghost" href="/movie/27205">
                Preview the full player
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="peak-footer">
        <div className="peak-footer-brand">
          <img src="/logo.svg" alt="" width={28} height={28} />
          <span>Peak Embed</span>
        </div>
        <nav aria-label="Footer">
          <a href="#player">Player</a>
          <a href="#quickstart">Quick start</a>
          <a href={DOCS_URL}>Docs</a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- JSON endpoint, not a page */}
          <a href="/api/v1/playback/health">Health</a>
        </nav>
        <p>Custom player. Signed sessions. Exact origins.</p>
      </footer>
    </div>
  );
}
