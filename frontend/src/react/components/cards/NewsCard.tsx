import { ContentItem } from "../../../services/dashboard_service";

interface Props {
  item?: ContentItem;
  onLike: () => void;
  onSkip: () => void;
}

export default function NewsCard({ item, onLike, onSkip }: Props) {
  return (
    <section className="db-card db-card--gradient">
      <header className="db-header">
        <div className="db-hstack">
          <h2 className="db-title">Market News</h2>
          <div className="db-pill">Ranked</div>
        </div>
        <div className="db-sub">Top headlines matched to your interests</div>
      </header>

      <div className="db-body">
        {!item ? (
          <div className="db-empty">No news right now. Check back soon.</div>
        ) : (
          <div className="db-item db-item--featured">
            <a className="db-link db-link--lg" href={item.url} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            <div className="db-meta">
              {item.source && <span className="db-badge">{item.source}</span>}
              {item.publishedAt && <span className="db-dim">• {new Date(item.publishedAt).toLocaleString()}</span>}
              {typeof item.score === "number" && (
                <span className="db-score" title="Relevance score">{Math.round(item.score)}</span>
              )}
            </div>
            {item.summary && <p className="db-text db-clamp-5">{item.summary}</p>}
            <div className="db-actions">
              <button className="db-btn" onClick={onLike} aria-label="Like news">👍 Like</button>
              <button className="db-btn db-btn--danger" onClick={onSkip} aria-label="Skip news">👎 Skip</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
