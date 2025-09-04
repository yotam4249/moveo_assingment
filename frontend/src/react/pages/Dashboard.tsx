/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
import { useEffect, useMemo, useState, useCallback } from "react";
import onboardingService from "../../services/onboarding_service";
import dashboardService, { ContentItem, FeedResponse, Meme } from "../../services/dashboard_service";
import apiClient from "../../services/api";
import "../../css/dashboard.css";

import Carousel from "../components/Carousel";
import NewsCard from "../components/cards/NewsCard";
import PricesCard from "../components/cards/PricesCard";
import InsightCard from "../components/cards/InsightCard";
import MemeCard from "../components/cards/MemeCard";

//type SectionKey = "news" | "prices" | "insight" | "meme";

export default function Dashboard() {
  const [prefs, setPrefs] = useState<string[]>([]);
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // local cursors for 👎 fallback within each section
  const [newsIdx, setNewsIdx] = useState(0);
  const [priceIdx, setPriceIdx] = useState(0);
  const [insightIdx, setInsightIdx] = useState(0);

  // carousel state: 3 visible, slide between 0..(slides-3)
  const VISIBLE = 3;
  const [slideIndex, setSlideIndex] = useState(0);

  //const visibleSections: SectionKey[] = ["news", "prices", "insight", "meme"];

  // prefer ranked arrays, fallback to tags
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const status = await onboardingService.getStatus();
      setPrefs(status.onboarding?.contentPrefs ?? []);
      const data = await dashboardService.fetchFeed();
      setFeed(data);
    } catch (err: any) {
      console.error("Dashboard load failed:", err);
      setError("Could not load your feed. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try { await load(); } catch {}
      if (!mounted) return;
    })();
    return () => { mounted = false; };
  }, [load]);

  const refreshAll = async () => {
    setRefreshing(true);
    await load();
    setSlideIndex(0);
  };

  /** Patch only one section in the current feed (do NOT replace whole feed) */
  function updateSection(section: "news" | "prices" | "insight", fresh: FeedResponse) {
    setFeed((prev) => {
      if (!prev) return fresh;
      const prevRanked = prev.ranked ?? { news: [], prices: [], insight: [] };
      const freshRanked = fresh.ranked ?? { news: [], prices: [], insight: [] };
      const nextRanked = { ...prevRanked };
      if (section === "news")    nextRanked.news = freshRanked.news ?? [];
      if (section === "prices")  nextRanked.prices = freshRanked.prices ?? [];
      if (section === "insight") nextRanked.insight = freshRanked.insight ?? [];
      return { ...prev, ranked: nextRanked, date: fresh.date ?? prev.date };
    });
    if (section === "news") setNewsIdx(0);
    if (section === "prices") setPriceIdx(0);
    if (section === "insight") setInsightIdx(0);
  }

  /** Send feedback; if server returns a fresh feed, update ONLY that section */
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
    sendFeedbackAndRefreshSection(section, item, "up");
  }

  async function voteDown(section: "news" | "prices" | "insight", item: ContentItem) {
    const refreshed = await sendFeedbackAndRefreshSection(section, item, "down");
    if (refreshed) return;
    if (section === "news") setNewsIdx((i) => Math.min(i + 1, Math.max(0, newsList.length - 1)));
    if (section === "prices") setPriceIdx((i) => Math.min(i + 1, Math.max(0, priceList.length - 1)));
    if (section === "insight") setInsightIdx((i) => Math.min(i + 1, Math.max(0, insightList.length - 1)));
  }

  // Meme: on 👎, fetch a brand-new meme (do not touch other sections)
  async function fetchAndSwapMeme() {
    try {
      const { data } = await apiClient.get<Meme>("/meme");
      setFeed((prev) => (prev ? { ...prev, meme: data } : prev));
    } catch (e) {
      console.warn("Failed to fetch new meme:", e);
      setFeed((prev) => (prev ? { ...prev, meme: null } : prev));
    }
  }

  /* ---------- Early UI states ---------- */

  if (loading) {
    return (
      <div className="db-wrap">
        <header className="db-top">
          <div className="db-top__left">
            <h1 className="db-brand">Crypto Advisor</h1>
            <div className="db-tagline">Daily signal. Zero noise.</div>
          </div>
          <div className="db-top__right">
            <div className="db-chip db-chip--ghost">Loading…</div>
          </div>
        </header>

        <div className="db-carousel">
          <div className="db-track">
            <div className="db-card db-skel" />
            <div className="db-card db-skel" />
            <div className="db-card db-skel" />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- Slides ---------- */
  const slides = [
    <NewsCard
      key="news"
      item={currentNews}
      onLike={() => currentNews && voteUp("news", currentNews)}
      onSkip={() => currentNews && voteDown("news", currentNews)}
    />,
    <PricesCard
      key="prices"
      item={currentPrice}
      onLike={() => currentPrice && voteUp("prices", currentPrice)}
      onSkip={() => currentPrice && voteDown("prices", currentPrice)}
    />,
    <InsightCard
      key="insight"
      item={currentInsight}
      onHelpful={() => currentInsight && voteUp("insight", currentInsight)}
      onNotGreat={() => currentInsight && voteDown("insight", currentInsight)}
    />,
    <MemeCard
      key="meme"
      meme={feed?.meme ?? null}
      onUpvote={async () => {
        await dashboardService.submitFeedback({ id: "meme", tags: ["insight"], assets: [] }, "up");
      }}
      onNewMeme={async () => {
        await dashboardService.submitFeedback({ id: "meme", tags: ["insight"], assets: [] }, "down");
        await fetchAndSwapMeme();
      }}
    />,
  ];
  const maxIndex = Math.max(0, slides.length - VISIBLE);

  return (
    <div className="db-wrap">
      {/* Top bar */}
      <header className="db-top">
        <div className="db-top__left">
          <h1 className="db-brand">Crypto Advisor</h1>
          <div className="db-tagline">Daily signal. Zero noise.</div>
        </div>
        <div className="db-top__right">
          {!!feed?.date && (
            <div className="db-chip" title={new Date(feed.date).toLocaleString()}>
              Updated {new Date(feed.date).toLocaleTimeString()}
            </div>
          )}
          <button
            className="db-btn db-btn--primary"
            onClick={refreshAll}
            disabled={refreshing}
            aria-busy={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh all"}
          </button>
        </div>
      </header>

      {error && (
        <div className="db-alert">
          <div className="db-alert__icon">⚠️</div>
          <div className="db-alert__text">{error}</div>
          <button className="db-btn db-btn--ghost" onClick={refreshAll}>Try again</button>
        </div>
      )}

      {/* Carousel */}
      <Carousel
      slideIndex={slideIndex}
      setSlideIndex={setSlideIndex}
      maxIndex={maxIndex}
      visible={VISIBLE}
    >
      {slides}
    </Carousel>

      {/* Footer */}
      <footer className="db-foot">
        <div className="db-foot__left">
          <span className="db-dim">Preferences:</span>
          <div className="db-chiptray">
            {(prefs ?? []).slice(0, 6).map((p) => (
              <span key={p} className="db-chip db-chip--ghost">{p}</span>
            ))}
            {(!prefs || prefs.length === 0) && <span className="db-chip db-chip--ghost">No preferences yet</span>}
          </div>
        </div>
        <div className="db-foot__right">
          <span className="db-dim">© {new Date().getFullYear()} Crypto Advisor</span>
        </div>
      </footer>
    </div>
  );
}
