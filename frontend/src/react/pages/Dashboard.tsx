/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
// src/react/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import onboardingService from "../../services/onboarding_service";
import dashboardService, { ContentItem, FeedResponse, Meme } from "../../services/dashboard_service";
import apiClient from "../../services/api";
import "../../css/dashboard.css";

type SectionKey = "news" | "prices" | "insight" | "meme";

export default function Dashboard() {
  const [prefs, setPrefs] = useState<string[]>([]);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // cursors for "next on 👎" as a LOCAL fallback (used only if backend doesn't return fresh section data)
  const [newsIdx, setNewsIdx] = useState(0);
  const [priceIdx, setPriceIdx] = useState(0);
  const [insightIdx, setInsightIdx] = useState(0);

  // ALWAYS show all four sections, regardless of prefs
  const visibleSections: SectionKey[] = ["news", "prices", "insight", "meme"];

  // prefer ranked arrays, fallback to legacy grouping
  const newsList = useMemo<ContentItem[]>(
    () => feed?.ranked?.news ?? (feed?.items || []).filter((i) => i.tags.includes("news")),
    [feed]
  );
  const priceList = useMemo<ContentItem[]>(
    () => feed?.ranked?.prices ?? (feed?.items || []).filter((i) => i.tags.includes("prices")),
    [feed]
  );
  const insightList = useMemo<ContentItem[]>(
    () => feed?.ranked?.insight ?? (feed?.items || []).filter((i) => i.tags.includes("insight")),
    [feed]
  );

  const currentNews = newsList[newsIdx];
  const currentPrice = priceList[priceIdx];
  const currentInsight = insightList[insightIdx];

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1) get user prefs (kept for future personalization, but not used to hide sections)
        const status = await onboardingService.getStatus(); // GET /onboarding/status
        if (!mounted) return;
        setPrefs(status.onboarding?.contentPrefs ?? []);

        // 2) fetch curated feed
        const data = await dashboardService.fetchFeed(); // GET /feed
        if (!mounted) return;
        setFeed(data);
        // initial indices start at 0; no global reset on later changes
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /** Patch only one section in the current feed (do NOT replace whole feed) */
  function updateSection(section: "news" | "prices" | "insight", fresh: FeedResponse) {
    setFeed((prev) => {
      if (!prev) return fresh; // first load safety
      const prevRanked = prev.ranked ?? { news: [], prices: [], insight: [] };
      const freshRanked = fresh.ranked ?? { news: [], prices: [], insight: [] };
      let nextRanked = { ...prevRanked };
      if (section === "news")    nextRanked.news = freshRanked.news ?? [];
      if (section === "prices")  nextRanked.prices = freshRanked.prices ?? [];
      if (section === "insight") nextRanked.insight = freshRanked.insight ?? [];
      // Keep prev.items and other sections intact
      return { ...prev, ranked: nextRanked };
    });

    // Reset ONLY that section's cursor to top
    if (section === "news") setNewsIdx(0);
    if (section === "prices") setPriceIdx(0);
    if (section === "insight") setInsightIdx(0);
  }

  /** Send feedback; if server returns a fresh feed, update ONLY the given section */
  async function sendFeedbackAndRefreshSection(
    section: "news" | "prices" | "insight",
    item: ContentItem,
    decision: "up" | "down"
  ) {
    try {
      const resp = await dashboardService.submitFeedback(
        { id: item.id, tags: item.tags, assets: item.assets },
        decision
      );
      if (resp?.feed) {
        updateSection(section, resp.feed);
        return true;
      }
    } catch (e) {
      console.warn("submitFeedback failed:", e);
    }
    return false;
  }

  function voteUp(section: "news" | "prices" | "insight", item: ContentItem) {
    // Let backend learn; we keep UI as-is for likes
    sendFeedbackAndRefreshSection(section, item, "up");
  }

  async function voteDown(section: "news" | "prices" | "insight", item: ContentItem) {
    const refreshed = await sendFeedbackAndRefreshSection(section, item, "down");
    if (refreshed) return; // only that section was updated

    // Fallback if server didn't send a fresh feed: advance local cursor in that section
    if (section === "news") setNewsIdx((i) => Math.min(i + 1, Math.max(0, newsList.length - 1)));
    if (section === "prices") setPriceIdx((i) => Math.min(i + 1, Math.max(0, priceList.length - 1)));
    if (section === "insight") setInsightIdx((i) => Math.min(i + 1, Math.max(0, insightList.length - 1)));
  }

  // Meme: on 👎, fetch a brand-new meme only (do not touch other sections)
  async function fetchAndSwapMeme() {
    try {
      const { data } = await apiClient.get<Meme>("/meme");
      setFeed((prev) => (prev ? { ...prev, meme: data } : prev));
    } catch (e) {
      console.warn("Failed to fetch new meme:", e);
      setFeed((prev) => (prev ? { ...prev, meme: null } : prev));
    }
  }

  if (loading) {
    return (
      <div className="db-wrap">
        <div className="db-grid">
          <div className="db-card">
            <h2 className="db-title">Loading…</h2>
          </div>
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
              <div className="db-sub">{feed?.date ? new Date(feed.date).toLocaleString() : ""}</div>
            </header>

            {!currentNews ? (
              <p className="db-empty">No news right now.</p>
            ) : (
              <div className="db-item">
                <a className="db-link" href={currentNews.url} target="_blank" rel="noreferrer">
                  {currentNews.title}
                </a>
                <div className="db-meta">
                  {currentNews.source && <span>{currentNews.source}</span>}
                  {currentNews.publishedAt && <span>• {new Date(currentNews.publishedAt).toLocaleString()}</span>}
                  {typeof currentNews.score === "number" && <span> • Score {currentNews.score}</span>}
                </div>
                <div className="db-vote">
                  <button className="db-btn" onClick={() => voteUp("news", currentNews)}>👍</button>
                  <button className="db-btn" onClick={() => voteDown("news", currentNews)}>👎</button>
                </div>
              </div>
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

            {!currentPrice ? (
              <p className="db-empty">No prices available.</p>
            ) : (
              <div className="db-item">
                <div className="db-strong">{currentPrice.title}</div>
                <div className="db-meta">{currentPrice.summary}</div>
                <div className="db-row">
                  {currentPrice.url && (
                    <a className="db-link" href={currentPrice.url} target="_blank" rel="noreferrer">
                      Details
                    </a>
                  )}
                  <div className="db-vote">
                    <button className="db-btn" onClick={() => voteUp("prices", currentPrice)}>👍</button>
                    <button className="db-btn" onClick={() => voteDown("prices", currentPrice)}>👎</button>
                  </div>
                </div>
              </div>
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

            {!currentInsight ? (
              <p className="db-empty">No insights yet.</p>
            ) : (
              <div className="db-stack">
                <div className="db-strong">{currentInsight.title}</div>
                {currentInsight.summary && <p className="db-text">{currentInsight.summary}</p>}
                {currentInsight.url && (
                  <a className="db-link" href={currentInsight.url} target="_blank" rel="noreferrer">
                    Read more
                  </a>
                )}
                <div className="db-actions">
                  <button className="db-btn" onClick={() => voteUp("insight", currentInsight)}>👍 Helpful</button>
                  <button className="db-btn" onClick={() => voteDown("insight", currentInsight)}>👎 Not great</button>
                </div>
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
                    onClick={async () => {
                      // Like meme: record feedback only
                      await dashboardService.submitFeedback({ id: "meme", tags: ["insight"], assets: [] }, "up");
                    }}
                  >
                    😂 Upvote
                  </button>
                  <button
                    className="db-btn"
                    onClick={async () => {
                      // Dislike meme: record feedback, then always fetch & swap a new meme
                      await dashboardService.submitFeedback({ id: "meme", tags: ["insight"], assets: [] }, "down");
                      await fetchAndSwapMeme();
                    }}
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
