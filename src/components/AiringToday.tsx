import { Link } from 'react-router-dom'
import { fetchAiringBetween, mediaTitle } from '../lib/anilist'
import { formatClock, formatDuration, localDayBounds, useNow } from '../lib/time'
import { useList } from '../lib/tracker'
import { useAsync } from '../lib/useAsync'
import { ErrorMessage, Skeleton } from './Status'

export default function AiringToday() {
  const entries = useList()
  const now = useNow()
  const [from, to] = localDayBounds(now)
  const ids = Object.values(entries)
    .filter((e) => e.status === 'WATCHING')
    .map((e) => e.media.id)
    .sort((a, b) => a - b)
  const key = ids.join(',')

  const airing = useAsync((signal) => fetchAiringBetween(ids, from, to, { signal }), [key, from])

  if (!ids.length)
    return (
      <div className="card p-5 text-sm text-ink-500 dark:text-ink-300">
        Mark shows as <b>Watching</b> in{' '}
        <Link to="/tracker" className="font-semibold text-brand-500">
          your list
        </Link>{' '}
        and their new episodes will show up here.
      </div>
    )
  if (airing.status === 'error') return <ErrorMessage error={airing.error} onRetry={airing.retry} />
  if (airing.status === 'loading')
    return (
      <div className="flex gap-3">
        <Skeleton className="h-36 w-28" />
        <Skeleton className="h-36 w-28" />
      </div>
    )
  if (!airing.data.length)
    return <div className="card p-5 text-sm text-ink-500 dark:text-ink-300">Nothing from your Watching list airs today. 😴</div>

  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {airing.data.map((a) => {
        const entry = entries[a.mediaId]
        if (!entry) return null
        const ms = a.airingAt * 1000 - now
        return (
          <Link key={`${a.mediaId}-${a.episode}`} to={`/anime/${a.mediaId}`} className="w-28 shrink-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl" style={{ backgroundColor: entry.media.color ?? undefined }}>
              {entry.media.cover && <img src={entry.media.cover} alt="" className="size-full object-cover" />}
              <span
                className={`chip absolute top-2 left-2 ${ms <= 0 ? 'bg-emerald-500 text-white' : 'bg-ink-950/75 text-white backdrop-blur'}`}
              >
                {ms <= 0 ? 'Out now' : `in ${formatDuration(ms)}`}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{mediaTitle(entry.media)}</p>
            <p className="text-xs text-ink-500 dark:text-ink-300">
              Ep {a.episode} · {formatClock(a.airingAt)}
            </p>
          </Link>
        )
      })}
    </div>
  )
}
