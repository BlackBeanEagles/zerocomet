const PALETTE = ["var(--coral)", "var(--violet)", "var(--lime)", "var(--sky)", "var(--pink)"];

function hash(s = "") {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export default function Avatar({ user, agent, size = 36, status }) {
  const name = user?.name || "?";
  const bg = PALETTE[hash(user?.uid) % PALETTE.length];
  return (
    <span className={`avatar ${agent ? "is-agent" : ""}`} style={{ width: size, height: size, "--av": bg }}>
      {agent ? <PagerGlyph /> : <span className="initial">{name.slice(0, 1).toUpperCase()}</span>}
      {status && <i className={`dot ${status}`} />}
    </span>
  );
}

export function PagerGlyph() {
  return (
    <svg viewBox="0 0 64 64" width="62%" height="62%" aria-hidden="true">
      <rect x="6" y="12" width="52" height="40" rx="12" fill="#0d0b14" />
      <rect x="14" y="20" width="36" height="12" rx="4" fill="#f4f1ff" />
      <circle cx="21" cy="42" r="3.5" fill="#f4f1ff" />
      <circle cx="32" cy="42" r="3.5" fill="#f4f1ff" />
      <circle cx="43" cy="42" r="3.5" fill="#f4f1ff" />
    </svg>
  );
}
