// FORGE SIGHT — brand components.
//
// The mark combines the two ideas in the name:
//   · an anvil silhouette  → the forge / manufacturing
//   · an eye cut into it   → sight / precision analysis
// Rendered as inline SVG so it stays crisp everywhere and works on light
// backgrounds (default) and dark surfaces (tone="light").

let uid = 0

export function ForgeSightMark({ size = 34, tone = 'dark' }) {
  const id = `fsm${++uid}`
  const anvil = tone === 'dark' ? '#26364A' : '#FCFBF8'
  const pupil = tone === 'dark' ? '#26364A' : '#252525'
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" role="img" aria-label="Forge Sight mark">
      <defs>
        <linearGradient id={`${id}-g`} x1="8" y1="8" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#26364A" />
          <stop offset="1" stopColor="#31445C" />
        </linearGradient>
      </defs>
      {/* anvil body with an eye-shaped cutout (evenodd) */}
      <path
        fillRule="evenodd" clipRule="evenodd"
        fill={`url(#${id}-g)`}
        d="M7.5 15.5c0-1.38 1.12-2.5 2.5-2.5h28c1.38 0 2.5 1.12 2.5 2.5 0 5.6-3.9 9.5-10.2 10.6l-2.3.4V32h5.5c1.66 0 3 1.34 3 3v2.5c0 .83-.67 1.5-1.5 1.5h-22c-.83 0-1.5-.67-1.5-1.5V35c0-1.66 1.34-3 3-3H20v-5.5l-2.3-.4C11.4 25 7.5 21.1 7.5 15.5Z
           M16 15.5c2.2-2.4 5-3.6 8-3.6s5.8 1.2 8 3.6c-2.2 2.4-5 3.6-8 3.6s-5.8-1.2-8-3.6Z"
      />
      {/* pupil */}
      <circle cx="24" cy="15.5" r="2.6" fill={pupil} />
    </svg>
  )
}

export function ForgeSightLogo({ size = 34, tone = 'dark', tagline = false, compact = false }) {
  const main = tone === 'dark' ? '#252525' : '#FCFBF8'
  const accent = tone === 'dark' ? '#26364A' : '#9FB2CC'
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <ForgeSightMark size={size} tone={tone} />
      <span className="flex flex-col leading-none">
        <span className="flex items-baseline gap-1.5" style={{ fontSize: size * 0.5 }}>
          <span className="font-semibold tracking-tight" style={{ color: main }}>FORGE</span>
          <span className="font-extrabold tracking-tight" style={{ color: accent }}>SIGHT</span>
        </span>
        {tagline && (
          <span className="mt-1 font-medium" style={{ fontSize: Math.max(9.5, size * 0.24), color: tone === 'dark' ? '#667085' : '#B9C6DB' }}>
            See the problem. Find the cause.
          </span>
        )}
        {compact && !tagline && (
          <span className="mt-0.5" style={{ fontSize: Math.max(9, size * 0.23), color: tone === 'dark' ? '#667085' : '#B9C6DB' }}>
            Manufacturing Intelligence
          </span>
        )}
      </span>
    </span>
  )
}
