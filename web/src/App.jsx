import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import Blobs from "./components/Blobs.jsx";
import Login from "./components/Login.jsx";
import Room from "./components/Room.jsx";

const FALLBACK = {
  configured: false,
  appId: "",
  region: "",
  agent: { uid: "pager-agent", name: "Pager" },
  group: { guid: "ship-it", name: "Ship It" },
  humans: [
    { uid: "hridya", name: "Hridya" },
    { uid: "sam", name: "Sam" },
  ],
  mode: "poll",
};

export default function App() {
  const [cfg, setCfg] = useState(null);
  const [uid, setUid] = useState(() => {
    try {
      return localStorage.getItem("pager.uid");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : FALLBACK))
      .catch(() => FALLBACK)
      .then(setCfg);
  }, []);

  const demo = !cfg?.configured || new URLSearchParams(location.search).has("demo");

  const choose = (next) => {
    try {
      next ? localStorage.setItem("pager.uid", next) : localStorage.removeItem("pager.uid");
    } catch {
      /* private mode */
    }
    // Crossfade between login and room where the browser supports it.
    if (document.startViewTransition) document.startViewTransition(() => flushSync(() => setUid(next)));
    else setUid(next);
  };

  return (
    <>
      <Blobs />
      {!cfg ? (
        <div className="boot">
          <span className="pulse" />
        </div>
      ) : uid && cfg.humans.some((h) => h.uid === uid) ? (
        <Room cfg={cfg} uid={uid} demo={demo} onLeave={() => choose(null)} />
      ) : (
        <Login cfg={cfg} demo={demo} onPick={choose} />
      )}
    </>
  );
}
