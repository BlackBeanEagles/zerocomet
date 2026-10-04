// Abstract background: drifting colour fields + grain. Purely decorative.
export default function Blobs() {
  return (
    <div className="blobs" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      <span className="blob b4" />
      <svg className="shapes" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <circle cx="1040" cy="140" r="64" fill="none" stroke="var(--lime)" strokeWidth="2" opacity=".35" />
        <path d="M80 650 q 60 -80 120 0 t 120 0 t 120 0" fill="none" stroke="var(--sky)" strokeWidth="3" opacity=".3" />
        <rect x="960" y="600" width="90" height="90" rx="22" fill="none" stroke="var(--pink)" strokeWidth="2" opacity=".3" transform="rotate(18 1005 645)" />
        <g fill="var(--lime)" opacity=".35">
          {Array.from({ length: 5 }).flatMap((_, r) =>
            Array.from({ length: 5 }).map((__, c) => <circle key={`${r}-${c}`} cx={120 + c * 18} cy={110 + r * 18} r="2.2" />)
          )}
        </g>
      </svg>
      <div className="grain" />
    </div>
  );
}
