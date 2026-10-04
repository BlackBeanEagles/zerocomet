import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Avatar from "./Avatar.jsx";
import Messages from "./Messages.jsx";
import Composer from "./Composer.jsx";
import Console from "./Console.jsx";

const STALE_MS = 3 * 60 * 1000;

function reducer(s, a) {
  switch (a.type) {
    case "load":
      return { ...s, messages: a.history, members: a.members, me: a.me, live: a.live };
    case "msg": {
      if (a.msg.kind === "agent_status") return { ...s, run: applyStatus(s.run, a.msg) };
      const i = s.messages.findIndex((m) => m.id === a.msg.id);
      const messages = i >= 0 ? s.messages.map((m, j) => (j === i ? a.msg : m)) : [...s.messages, a.msg];
      return { ...s, messages };
    }
    case "reactions":
      return { ...s, messages: s.messages.map((m) => (m.id === a.id ? { ...m, reactions: a.reactions } : m)) };
    case "typing": {
      const typing = { ...s.typing };
      if (a.on) typing[a.user.uid] = a.user.name;
      else delete typing[a.user.uid];
      return { ...s, typing };
    }
    case "presence":
      return { ...s, members: s.members.map((m) => (m.uid === a.uid ? { ...m, status: a.status } : m)) };
    case "conn":
      return { ...s, conn: a.conn };
    default:
      return s;
  }
}

function applyStatus(run, msg) {
  const d = msg.data || {};
  if (d.state === "idle") return null;
  if (Date.now() - msg.sentAt > STALE_MS) return run;
  const same = run && run.runId === d.runId;
  const steps = same ? run.steps : [];
  const last = steps[steps.length - 1];
  const next = d.step && (!last || last.text !== d.step.text) ? [...steps, { ...d.step, at: msg.sentAt }] : steps;
  return { runId: d.runId, prompt: d.prompt, by: d.by, startedAt: same ? run.startedAt : msg.sentAt, steps: next };
}

export default function Room({ cfg, uid, demo, onLeave }) {
  const [s, dispatch] = useReducer(reducer, {
    messages: [],
    members: [],
    me: null,
    typing: {},
    run: null,
    conn: "connecting",
    live: false,
  });
  const [error, setError] = useState(null);
  const [panel, setPanel] = useState(null); // mobile: "people" | "console" | null
  const chat = useRef(null);

  useEffect(() => {
    let alive = true;
    const handlers = {
      onMessage: (msg) => alive && dispatch({ type: "msg", msg }),
      onReactions: (id, reactions) => alive && dispatch({ type: "reactions", id, reactions }),
      onTyping: (user, on) => alive && user && dispatch({ type: "typing", user, on }),
      onPresence: (u, status) => alive && dispatch({ type: "presence", uid: u, status }),
      onConnection: (conn) => alive && dispatch({ type: "conn", conn }),
    };
    // The SDK is ~800 KB, so it only loads once someone actually joins a live room.
    const load = demo ? import("../lib/mock.js").then((m) => m.createMockChat) : import("../lib/chat.js").then((m) => m.createChat);
    load
      .then((create) => create(cfg, uid, handlers))
      .then((c) => {
        if (!alive) return c.destroy();
        chat.current = c;
        // Replay status messages from history so a run in progress shows up after a reload.
        const statuses = c.history.filter((m) => m.kind === "agent_status");
        const history = c.history.filter((m) => m.kind !== "agent_status");
        dispatch({ type: "load", history, members: c.members, me: c.me, live: c.live });
        statuses.forEach((msg) => dispatch({ type: "msg", msg }));
        dispatch({ type: "conn", conn: "connected" });
      })
      .catch((e) => alive && setError(e.message || String(e)));
    return () => {
      alive = false;
      chat.current?.destroy();
    };
  }, [cfg, uid, demo]);

  const send = useCallback((text, metadata) => chat.current?.sendText(text, metadata), []);
  const react = useCallback((id, emoji, on) => chat.current?.react(id, emoji, on), []);
  const ship = useCallback(
    async (msg) => {
      await chat.current?.react(msg.id, "👍", true).catch(() => {});
      await chat.current?.sendText("👍 ship it", { approveRun: msg.data.runId });
    },
    []
  );
  const discard = useCallback((msg) => chat.current?.sendText("✋ undo that", { discardRun: msg.data.runId }), []);

  const agentUid = cfg.agent.uid;
  const people = useMemo(
    () => [...s.members].sort((a, b) => (a.uid === agentUid) - (b.uid === agentUid) || a.name.localeCompare(b.name)),
    [s.members, agentUid]
  );
  const typingNames = Object.entries(s.typing)
    .filter(([u]) => u !== s.me?.uid)
    .map(([, n]) => n);

  if (error) {
    return (
      <div className="fatal glass">
        <h2>Couldn't join the room</h2>
        <p>{error}</p>
        <p className="muted">Check the server's .env and run <code>npm run setup</code> once.</p>
        <button className="btn" onClick={onLeave}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={`room ${panel ? `show-${panel}` : ""}`}>
      <aside className="side glass">
        <header className="side-head">
          <span className="room-icon">#</span>
          <div>
            <b>{cfg.group.name}</b>
            <small>{s.members.length} members</small>
          </div>
        </header>
        <p className="eyebrow">In the room</p>
        <ul className="members">
          {people.map((m) => {
            const isAgent = m.uid === agentUid;
            const status = isAgent ? (s.run ? "busy" : "online") : m.status;
            return (
              <li key={m.uid} className={isAgent ? "agent" : ""}>
                <Avatar user={m} agent={isAgent} size={34} status={status} />
                <span>
                  <b>
                    {m.name}
                    {m.uid === s.me?.uid && <em> (you)</em>}
                  </b>
                  <small>{isAgent ? (s.run ? "working…" : "coding agent · idle") : status}</small>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="side-foot">
          <span className={`conn ${s.conn}`}>{demo ? "demo mode" : s.conn}</span>
          <button className="link" onClick={onLeave}>
            Switch user
          </button>
        </div>
      </aside>

      <section className="chat glass">
        <header className="chat-head">
          <button className="icon-btn only-mobile" onClick={() => setPanel(panel === "people" ? null : "people")} aria-label="People">
            ☰
          </button>
          <div className="chat-title">
            <b># {cfg.group.name.toLowerCase().replace(/\s+/g, "-")}</b>
            <small>
              {typingNames.length
                ? `${typingNames.join(", ")} ${typingNames.length > 1 ? "are" : "is"} typing…`
                : s.run
                  ? `${cfg.agent.name} is working on “${s.run.prompt.slice(0, 42)}${s.run.prompt.length > 42 ? "…" : ""}”`
                  : "humans + one coding agent"}
            </small>
          </div>
          {demo && <span className="tag">Demo</span>}
          <button className="icon-btn only-mobile console-toggle" onClick={() => setPanel(panel === "console" ? null : "console")} aria-label="Agent console">
            {s.run ? <span className="spinner" /> : "⌁"}
          </button>
        </header>
        <Messages
          messages={s.messages}
          me={s.me}
          agent={cfg.agent}
          run={s.run}
          onReact={react}
          onShip={ship}
          onDiscard={discard}
        />
        <Composer agent={cfg.agent} busy={Boolean(s.run)} onSend={send} chat={chat} />
      </section>

      <Console run={s.run} messages={s.messages} agent={cfg.agent} />
      {panel && <div className="scrim" onClick={() => setPanel(null)} />}
    </div>
  );
}
