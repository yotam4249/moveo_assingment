/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import onboardingService from "../../services/onboarding_service";
import "../../css/onboarding.css";

export default function OnBoarding() {
  const navigate = useNavigate();

  // steps: 0 = assets, 1 = investor type, 2 = content prefs
  const [step, setStep] = useState(0);

  // step 1
  const [assets, setAssets] = useState<string[]>([]);
  const [assetInput, setAssetInput] = useState("");

  // step 2
  const [investorType, setInvestorType] = useState<string>("");
  const [investorInput, setInvestorInput] = useState("");

  // step 3
  const [contentPrefs, setContentPrefs] = useState<string[]>([]);
  const [contentInput, setContentInput] = useState("");

  // UX
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // suggestions
  const assetSuggestions = useMemo(
    () => ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "AVAX", "DOGE", "MATIC", "LTC"],
    []
  );
  const investorSuggestions = useMemo(
    () => ["HODLer", "Day Trader", "NFT Collector", "DeFi Yield Farmer", "Long-term Investor"],
    []
  );
  const contentSuggestions = useMemo(
    () => ["Market News", "Charts", "Social", "Fun", "On-chain Analytics", "Education"],
    []
  );

  // hydrate from server (if already completed, skip to dashboard)
  useEffect(() => {
    (async () => {
      try {
        const status = await onboardingService.getStatus();
        if (status.completed || status.onboarding?.completed) {
          navigate("/dashboard", { replace: true });
          return;
        }
        // prefill if user had partial state saved server-side
        setAssets(status.onboarding?.assets ?? []);
        setInvestorType(status.onboarding?.investorType ?? "");
        setContentPrefs(status.onboarding?.contentPrefs ?? []);
      } catch {
        // ignore and let user fill from scratch
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const dedupe = (arr: string[]) => Array.from(new Set(arr));

  function addAsset(token: string) {
    const v = token.trim().toUpperCase();
    if (!v) return;
    setAssets((prev) => dedupe([...prev, v]));
    setAssetInput("");
  }
  function removeAsset(token: string) {
    setAssets((prev) => prev.filter((x) => x !== token));
  }

  function setCustomInvestor() {
    const v = investorInput.trim();
    if (!v) return;
    setInvestorType(v);
    setInvestorInput("");
  }

  function toggleContent(pref: string) {
    setContentPrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref]
    );
  }
  function addContentCustom() {
    const v = contentInput.trim();
    if (!v) return;
    setContentPrefs((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setContentInput("");
  }

  const canNext =
    (step === 0 && assets.length > 0) ||
    (step === 1 && investorType.trim().length > 0) ||
    (step === 2 && contentPrefs.length > 0);

  async function submitAll() {
    setErr(null);
    setSubmitting(true);
    try {
      await onboardingService.submitOnboarding({
        assets,
        investorType,
        contentPrefs,
      });
      navigate("/dashboard");
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || "Failed to save onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (step < 2) setStep((s) => s + 1);
    else void submitAll();
  }
  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  const progressClass =
    step === 0 ? "ob-progress ob-s1" : step === 1 ? "ob-progress ob-s2" : "ob-progress ob-s3";

  if (loading) {
    return (
      <div className="ob-wrap">
        <div className="ob-card">
          <div className="ob-title">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-wrap">
      <div className="ob-card" role="region" aria-labelledby="ob-title">
        <div className={progressClass} aria-hidden="true" />
        <h1 id="ob-title" className="ob-title">Let’s personalize your dashboard</h1>
        <p className="ob-sub">Answer a few quick questions.</p>

        {/* STEP 1: ASSETS ---------------------------------------------------------------------------------------------- */}
        {step === 0 && (
          <section aria-labelledby="q-assets">
            <h2 id="q-assets" className="ob-q">What crypto assets are you interested in?</h2>

            <div className="ob-chips">
              {assetSuggestions.map((s) => {
                const selected = assets.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    className={`ob-chip ${selected ? "ob-chip--selected" : ""}`}
                    onClick={() => (selected ? removeAsset(s) : addAsset(s))}
                  >
                    {s}
                  </button>
                );
              })}
            </div>

            <form
              className="ob-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                addAsset(assetInput);
              }}
            >
              <label className="sr-only" htmlFor="asset-input">Add another asset</label>
              <input
                id="asset-input"
                className="ob-input"
                placeholder="Add another (e.g. ARB, OP)…"
                value={assetInput}
                onChange={(e) => setAssetInput(e.target.value)}
              />
              <button type="submit" className="ob-btn ob-btn--secondary">Add</button>
            </form>

            {assets.length > 0 && (
              <div className="ob-selected" aria-live="polite">
                {assets.map((a) => (
                  <span key={a} className="ob-tag">
                    {a}
                    <button
                      type="button"
                      className="ob-tag__x"
                      aria-label={`Remove ${a}`}
                      onClick={() => removeAsset(a)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP 2: INVESTOR TYPE ----------------------------------------------------------------------------------------------*/}
        {step === 1 && (
          <section aria-labelledby="q-investor">
            <h2 id="q-investor" className="ob-q">What type of investor are you?</h2>

            <div className="ob-grid">
              {investorSuggestions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`ob-card-opt ${investorType === opt ? "is-active" : ""}`}
                  onClick={() => setInvestorType(opt)}
                >
                  <span>{opt}</span>
                </button>
              ))}
            </div>

            <form
              className="ob-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                setCustomInvestor();
              }}
            >
              <label className="sr-only" htmlFor="investor-input">Other investor type</label>
              <input
                id="investor-input"
                className="ob-input"
                placeholder="Other (type your own)…"
                value={investorInput}
                onChange={(e) => setInvestorInput(e.target.value)}
              />
              <button type="submit" className="ob-btn ob-btn--secondary">Set</button>
            </form>

            {investorType && (
              <div className="ob-selected" aria-live="polite">
                <span className="ob-tag">
                  {investorType}
                  <button
                    type="button"
                    className="ob-tag__x"
                    aria-label="Clear investor type"
                    onClick={() => setInvestorType("")}
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </section>
        )}

        {/* STEP 3: CONTENT PREFERENCES ----------------------------------------------------------------------------------------------*/}
        {step === 2 && (
          <section aria-labelledby="q-content">
            <h2 id="q-content" className="ob-q">What kind of content would you like to see?</h2>

            <div className="ob-chips">
              {contentSuggestions.map((c) => {
                const selected = contentPrefs.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`ob-chip ${selected ? "ob-chip--selected" : ""}`}
                    onClick={() => toggleContent(c)}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <form
              className="ob-inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                addContentCustom();
              }}
            >
              <label className="sr-only" htmlFor="content-input">Add custom content</label>
              <input
                id="content-input"
                className="ob-input"
                placeholder="Add another (e.g. Airdrops, Education)…"
                value={contentInput}
                onChange={(e) => setContentInput(e.target.value)}
              />
              <button type="submit" className="ob-btn ob-btn--secondary">Add</button>
            </form>

            {contentPrefs.length > 0 && (
              <div className="ob-selected" aria-live="polite">
                {contentPrefs.map((p) => (
                  <span key={p} className="ob-tag">
                    {p}
                    <button
                      type="button"
                      className="ob-tag__x"
                      aria-label={`Remove ${p}`}
                      onClick={() => setContentPrefs((prev) => prev.filter((x) => x !== p))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {err && <div className="ob-error" role="alert">{err}</div>}

        <div className="ob-actions">
          <button className="ob-btn ob-btn--ghost" type="button" onClick={back} disabled={step === 0 || submitting}>
            Back
          </button>
          <button
            className="ob-btn"
            type="button"
            onClick={next}
            disabled={!canNext || submitting}
          >
            {step < 2 ? "Next" : submitting ? "Saving…" : "Finish"}
          </button>
        </div>
      </div>
    </div>
  );
}
