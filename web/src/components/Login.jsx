import Avatar, { PagerGlyph } from "./Avatar.jsx";

export default function Login({ cfg, demo, onPick }) {
  return (
    <main className="login">
      <section className="hero">
        <div className="logo">
          <span className="logo-mark">
            <PagerGlyph />
          </span>
          Agent&nbsp;Pager
        </div>
        <h1>
          Your coding agent,
          <br />
          in the group chat.
        </h1>
        <p className="lede">
          Text <b>@{cfg.agent.name}</b> from your phone. It edits the real repo, runs the tests, and sends back the diff.
          A teammate approves it before anything is committed.
        </p>
        <p className="stack">Claude Code · CometChat · runs on your laptop</p>
      </section>

      <section className="pick glass">
        <p className="eyebrow">Sign in to #{cfg.group.name.toLowerCase().replace(/\s+/g, "-")}</p>
        <div className="people">
          {cfg.humans.map((h) => (
            <button key={h.uid} className="person" onClick={() => onPick(h.uid)}>
              <Avatar user={h} size={52} />
              <span>
                <b>{h.name}</b>
                <small>@{h.uid}</small>
              </span>
              <span className="arrow">→</span>
            </button>
          ))}
        </div>
        <div className="agent-row">
          <Avatar user={cfg.agent} agent size={40} status="online" />
          <span>
            <b>{cfg.agent.name}</b> is already in the room
            <small>coding agent · only takes orders from the people above</small>
          </span>
        </div>
        {demo && (
          <p className="demo-note">
            <span className="tag">Demo mode</span>
            {cfg.configured ? "Forced with ?demo." : "No CometChat keys on the server yet, so the agent is simulated."}
          </p>
        )}
      </section>
    </main>
  );
}
