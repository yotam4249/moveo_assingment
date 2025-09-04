import { ContentItem } from "../../../services/dashboard_service";

interface Props {
  item?: ContentItem;
  onHelpful: () => void;
  onNotGreat: () => void;
}

export default function InsightCard({ item, onHelpful, onNotGreat }: Props) {
  return (
    <section className="db-card db-card--glass">
      <header className="db-header">
        <div className="db-hstack">
          <h2 className="db-title">AI Insight of the Day</h2>
          <div className="db-pill db-pill--ai">AI</div>
        </div>
        <div className="db-sub">Personalized by your profile</div>
      </header>

      <div className="db-body">
        {!item ? (
          <div className="db-empty">No insights yet.</div>
        ) : (
          <>
            <div className="db-scroll">
              <div className="db-stack">
                <div className="db-strong db-strong--lg">{item.title}</div>
                {item.summary && <p className="db-text">{item.summary}</p>}
                {item.url && (
                  <a className="db-link" href={item.url} target="_blank" rel="noreferrer">
                    Read more
                  </a>
                )}
              </div>
            </div>
            <div className="db-actions db-actions--footer">
              <button className="db-btn" onClick={onHelpful}>👍 Helpful</button>
              <button className="db-btn db-btn--danger" onClick={onNotGreat}>👎 Not great</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
