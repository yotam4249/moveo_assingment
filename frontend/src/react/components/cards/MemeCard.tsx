import { Meme } from "../../../services/dashboard_service";

interface Props {
  meme: Meme | null;
  onUpvote: () => Promise<void> | void;
  onNewMeme: () => Promise<void> | void;
}

export default function MemeCard({ meme, onUpvote, onNewMeme }: Props) {
  return (
    <section className="db-card db-card--fun">
      <header className="db-header">
        <div className="db-hstack">
          <h2 className="db-title">Fun Crypto Meme</h2>
          <div className="db-pill db-pill--fun">Just for laughs</div>
        </div>
        <div className="db-sub">From Reddit via your server</div>
      </header>

      <div className="db-body">
        {!meme ? (
          <div className="db-empty">No meme right now.</div>
        ) : (
          <div className="db-meme">
            {meme.url ? (
              <div className="db-media">
                <img className="db-meme-img" src={meme.url} alt={meme.caption ?? "Crypto meme"} />
              </div>
            ) : (
              <div className="db-empty">Meme unavailable 😅</div>
            )}
            {meme.caption && <div className="db-meme-cap db-clamp-3">{meme.caption}</div>}
            <div className="db-actions">
              <button className="db-btn" onClick={onUpvote}>😂 Upvote</button>
              <button className="db-btn db-btn--danger" onClick={onNewMeme}>🙄 New meme</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
