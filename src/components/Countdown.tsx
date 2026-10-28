import type { Media } from '../lib/anilist'
import { formatDuration, useNow } from '../lib/time'

/** "Ep 8 in 2d 4h" for shows with a known next episode. */
export default function Countdown({ next, className = '' }: { next: Media['nextAiringEpisode']; className?: string }) {
  const now = useNow()
  if (!next) return null
  const ms = next.airingAt * 1000 - now
  return (
    <span className={`chip bg-pop-500/15 text-cyan-700 dark:text-pop-400 ${className}`}>
      {ms > 60_000 ? `Ep ${next.episode} in ${formatDuration(ms)}` : `Ep ${next.episode} out now`}
    </span>
  )
}
