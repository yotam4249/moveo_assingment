// src/react/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import onboardingService from "../../services/onboarding_service";
import dashboardService, { ContentItem, FeedResponse } from "../../services/dashboard_service";
import "../../css/dashboard.css";

type SectionKey = "news" | "prices" | "insight" | "meme";

export default function Dashboard() {
  const [prefs, setPrefs] = useState<string[]>([]);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // derive visible sections from user content prefs
  const visibleSections = useMemo<SectionKey[]>(() => {
    const s = new Set(prefs.map((p) => p.toLowerCase()));
    const sections: SectionKey[] = [];
    if (s.has("market news")) sections.push("news");
    if (s.has("charts") || s.has("market news")) sections.push("prices");
    if (s.has("education") || s.has("on-chain analytics") || s.has("market news")) sections.push("insight");
    if (s.has("fun") || s.has("social")) sections.push("meme");
    return sections.length ? sections : ["news", "prices", "insight", "meme"];
  }, [prefs]);

  // group items by tag for rendering
  const newsItems = useMemo(
    () => (feed?.items || []).filter((i) => i.tags.includes("news")),
    [feed]
  );
  const priceItems = useMemo(
    () => (feed?.items || []).filter((i) => i.tags.includes("prices")),
    [feed]
  );
  const insightItems = useMemo(
    () => (feed?.items || []).filter((i) => i.tags.includes("insight")),
    [feed]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1) get user prefs
        const status = await onboardingService.getStatus(); // GET /onboarding/status
        if (!mounted) return;
        setPrefs(status.onboarding?.contentPrefs ?? []);

        // 2) fetch curated feed
        const data = await dashboardService.fetchFeed();    // GET /feed
        if (!mounted) return;
        setFeed(data);
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function vote(item: ContentItem, decision: "up" | "down") {
    // non-blocking
    dashboardService.submitFeedback(
      { id: item.id, tags: item.tags, assets: item.assets },
      decision
    ).catch(() => {});
  }

  if (loading) {
    return (
      <div className="db-wrap">
        <div className="db-grid">
          <div className="db-card"><h2 className="db-title">Loading…</h2></div>
        </div>
      </div>
    );
  }

  return (
    <div className="db-wrap">
      <div className="db-grid">
        {/* NEWS */}
        {visibleSections.includes("news") && (
          <section className="db-card">
            <header className="db-header">
              <h2 className="db-title">Market News</h2>
              <div className="db-sub">
                {feed?.date ? new Date(feed.date).toLocaleString() : ""}
              </div>
            </header>

            {newsItems.length === 0 ? (
              <p className="db-empty">No news right now.</p>
            ) : (
              <ul className="db-list">
                {newsItems.map((n) => (
                  <li key={n.id} className="db-item">
                    <a className="db-link" href={n.url} target="_blank" rel="noreferrer">
                      {n.title}
                    </a>
                    <div className="db-meta">
                      {n.source && <span>{n.source}</span>}
                      {n.publishedAt && <span>• {new Date(n.publishedAt).toLocaleString()}</span>}
                    </div>
                    <div className="db-vote">
                      <button className="db-btn" onClick={() => vote(n, "up")}>👍</button>
                      <button className="db-btn" onClick={() => vote(n, "down")}>👎</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* PRICES */}
        {visibleSections.includes("prices") && (
          <section className="db-card">
            <header className="db-header">
              <h2 className="db-title">Coin Prices</h2>
              <div className="db-sub">From CoinGecko via your server</div>
            </header>

            {priceItems.length === 0 ? (
              <p className="db-empty">No prices available.</p>
            ) : (
              <ul className="db-list">
                {priceItems.map((p) => (
                  <li key={p.id} className="db-item">
                    <div className="db-strong">{p.title}</div>
                    <div className="db-meta">{p.summary}</div>
                    <div className="db-row">
                      {p.url && (
                        <a className="db-link" href={p.url} target="_blank" rel="noreferrer">
                          Details
                        </a>
                      )}
                      <div className="db-vote">
                        <button className="db-btn" onClick={() => vote(p, "up")}>👍</button>
                        <button className="db-btn" onClick={() => vote(p, "down")}>👎</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* INSIGHT */}
        {visibleSections.includes("insight") && (
          <section className="db-card">
            <header className="db-header">
              <h2 className="db-title">AI Insight of the Day</h2>
              <div className="db-sub">Personalized by your profile</div>
            </header>

            {insightItems.length === 0 ? (
              <p className="db-empty">No insights yet.</p>
            ) : (
              <div className="db-stack">
                {(() => {
                  const i = insightItems[0];
                  return (
                    <>
                      <div className="db-strong">{i.title}</div>
                      {i.summary && <p className="db-text">{i.summary}</p>}
                      {i.url && (
                        <a className="db-link" href={i.url} target="_blank" rel="noreferrer">
                          Read more
                        </a>
                      )}
                      <div className="db-actions">
                        <button className="db-btn" onClick={() => vote(i, "up")}>👍 Helpful</button>
                        <button className="db-btn" onClick={() => vote(i, "down")}>👎 Not great</button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        )}

        {/* MEME */}
        {visibleSections.includes("meme") && (
          <section className="db-card">
            <header className="db-header">
              <h2 className="db-title">Fun Crypto Meme</h2>
              <div className="db-sub">From Reddit via your server</div>
            </header>

            {!feed?.meme ? (
              <p className="db-empty">No meme right now.</p>
            ) : (
              <div className="db-meme">
                {feed.meme.url ? (
                  <img className="db-meme-img" src={feed.meme.url} alt={feed.meme.caption ?? "Crypto meme"} />
                ) : (
                  <div className="db-empty">Meme unavailable 😅</div>
                )}
                {feed.meme.caption && <div className="db-meme-cap">{feed.meme.caption}</div>}
                <div className="db-actions">
                  <button
                    className="db-btn"
                    onClick={() =>
                      dashboardService.submitFeedback(
                        { id: "meme", tags: ["insight"], assets: [] },
                        "up"
                      )
                    }
                  >
                    😂 Upvote
                  </button>
                  <button
                    className="db-btn"
                    onClick={() =>
                      dashboardService.submitFeedback(
                        { id: "meme", tags: ["insight"], assets: [] },
                        "down"
                      )
                    }
                  >
                    🙄 Downvote
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
