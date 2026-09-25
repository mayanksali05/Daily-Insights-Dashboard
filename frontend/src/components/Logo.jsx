/**
 * The Daily Command Center mark: a panel tile with a tall card, a small card and a green "live" sun.
 * Follows the theme: dark tile on the light theme, light tile on the dark theme.
 * The static copy for favicons and the desktop widget lives in public/favicon.svg.
 */
export default function Logo({ size = 24, className = "" }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="512" height="512" rx="116" style={{ fill: "rgb(var(--c-white))" }} />
      <rect x="104" y="104" width="136" height="304" rx="40" style={{ fill: "rgb(var(--c-slate-900))" }} />
      <circle cx="340" cy="172" r="68" fill="#3fc28f" />
      <rect x="272" y="272" width="136" height="136" rx="40" style={{ fill: "rgb(var(--c-slate-900))", fillOpacity: 0.55 }} />
    </svg>
  );
}
