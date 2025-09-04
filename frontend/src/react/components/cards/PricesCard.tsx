import { ContentItem } from "../../../services/dashboard_service";

interface Props {
  item?: ContentItem;
  onLike: () => void;
  onSkip: () => void;
}

export default function PricesCard({ item, onLike, onSkip }: Props) {
  return (
    <section className="db-card">
      <header className="db-header">
        <div className="db-hstack">
          <h2 className="db-title">Coin Prices</h2>
          <div className="db-pill db-pill--neutral">Live</div>
        </div>
        <div className="db-sub">From CoinGecko via your server</div>
      </header>

      <div className="db-body">
        {!item ? (
          <div className="db-empty">No prices available.</div>
        ) : (
          <div className="db-item">
            <div className="db-strong">{item.title}</div>
            <div className="db-meta">
              <span className="db-dim db-clamp-2">{item.summary}</span>
            </div>
            <div className="db-row">
              {item.url && (
                <a className="db-link" href={item.url} target="_blank" rel="noreferrer">Details</a>
              )}
              <div className="db-actions">
                <button className="db-btn" onClick={onLike} aria-label="Like prices">👍 Like</button>
                <button className="db-btn db-btn--danger" onClick={onSkip} aria-label="Skip prices">👎 Skip</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
