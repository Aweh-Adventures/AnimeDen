import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Countdown from '../components/Countdown'
import ListEditor, { StatusButtons } from '../components/ListEditor'
import { ErrorMessage, Skeleton } from '../components/Status'
import { fetchMediaByIds, formatLabel, mediaTitle, searchAnime, MINUTE, type Media } from '../lib/anilist'
import {
  STATUS_COLOR,
  STATUS_LABEL,
  STATUSES,
  addEntry,
  incrementProgress,
  refreshSnapshots,
  useList,
  type ListEntry,
  type ListStatus,
} from '../lib/tracker'
import { useAsync } from '../lib/useAsync'

type Sort = 'updated' | 'title' | 'score'

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Fresh AniList data (airing times, episode counts) for everything on the list. */
function useLiveMedia(ids: number[]): Map<number, Media> {
  const key = [...ids].sort((a, b) => a - b).join(',')
  const live = useAsync(
    (signal) => (key ? fetchMediaByIds(key.split(',').map(Number), { ttl: 30 * MINUTE, signal }) : Promise.resolve([])),
    [key],
  )
  useEffect(() => {
    if (live.data?.length) refreshSnapshots(live.data)
  }, [live.data])
  return useMemo(() => new Map((live.data ?? []).map((m) => [m.id, m])), [live.data])
}

export default function Tracker() {
  const entries = useList()
  const list = useMemo(() => Object.values(entries), [entries])
  const [query, setQuery] = useState('')
  const search = useDebounced(query.trim(), 400)

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ListStatus, number>
    list.forEach((e) => c[e.status]++)
    return c
  }, [list])

  const [filter, setFilter] = useState<ListStatus | 'ALL'>(() => (counts.WATCHING ? 'WATCHING' : 'ALL'))
  const [sort, setSort] = useState<Sort>('updated')
  const live = useLiveMedia(list.map((e) => e.media.id))

  const shown = useMemo(() => {
    const rows = list.filter((e) => filter === 'ALL' || e.status === filter)
    const byTitle = (a: ListEntry, b: ListEntry) => mediaTitle(a.media).localeCompare(mediaTitle(b.media))
    if (sort === 'title') return rows.sort(byTitle)
    if (sort === 'score') return rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || byTitle(a, b))
    return rows.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [list, filter, sort])

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">My List</h1>
        <p className="text-sm text-ink-500 dark:text-ink-300">{list.length} shows</p>
      </div>

      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anime to add…"
          className="w-full rounded-2xl border border-ink-900/10 bg-white py-3.5 pr-4 pl-11 text-base shadow-sm outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-900"
          aria-label="Search anime"
        />
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-lg">🔎</span>
      </div>

      {search ? (
        <SearchResults search={search} entries={entries} />
      ) : (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {(['ALL', ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  filter === s ? 'bg-brand-500 text-white' : 'bg-ink-900/5 dark:bg-white/10'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_LABEL[s]}
                <span className="ml-1.5 opacity-70">{s === 'ALL' ? list.length : counts[s]}</span>
              </button>
            ))}
          </div>

          {list.length > 0 && (
            <div className="flex justify-end">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-ink-500 dark:text-ink-300">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-lg border border-ink-900/10 bg-white px-2 py-1 font-semibold dark:border-white/10 dark:bg-ink-900"
                >
                  <option value="updated">Recently updated</option>
                  <option value="title">Title</option>
                  <option value="score">My score</option>
                </select>
              </label>
            </div>
          )}

          {shown.length ? (
            <ul className="space-y-3">
              {shown.map((e) => (
                <ListRow key={e.media.id} entry={e} live={live.get(e.media.id)} />
              ))}
            </ul>
          ) : (
            <EmptyList filter={filter} />
          )}
        </>
      )}
    </div>
  )
}

function EmptyList({ filter }: { filter: ListStatus | 'ALL' }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <p className="text-4xl">{filter === 'ALL' ? '📺' : '🫙'}</p>
      <p className="font-semibold">{filter === 'ALL' ? 'Your list is empty' : `Nothing in ${STATUS_LABEL[filter]}`}</p>
      <p className="text-sm text-ink-500 dark:text-ink-300">Search for a show above to add it.</p>
    </div>
  )
}

function ListRow({ entry, live }: { entry: ListEntry; live?: Media }) {
  const [open, setOpen] = useState(false)
  const m = entry.media
  const total = m.episodes
  const next = live?.nextAiringEpisode ?? null
  const aired = next ? next.episode - 1 : total
  const behind = entry.status === 'WATCHING' && aired ? aired - entry.progress : 0
  const pct = total ? Math.min(100, (entry.progress / total) * 100) : 0

  return (
    <li className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        <Link to={`/anime/${m.id}`} className="shrink-0">
          <div className="h-24 w-16 overflow-hidden rounded-xl" style={{ backgroundColor: m.color ?? undefined }}>
            {m.cover && <img src={m.cover} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <Link to={`/anime/${m.id}`} className="line-clamp-2 leading-tight font-semibold">
            {mediaTitle(m)}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`size-2 rounded-full ${STATUS_COLOR[entry.status]}`} />
            <span className="text-xs text-ink-500 dark:text-ink-300">{STATUS_LABEL[entry.status]}</span>
            {entry.score && <span className="text-xs font-semibold text-brand-500">★ {entry.score}</span>}
            {behind > 0 && <span className="chip bg-sun-400/25 text-amber-700 dark:text-sun-400">{behind} to catch up</span>}
            {entry.status !== 'COMPLETED' && entry.status !== 'DROPPED' && <Countdown next={next} />}
          </div>
          <div className="mt-auto pt-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="tabular-nums">
                Ep {entry.progress} / {total ?? '?'}
              </span>
              <button onClick={() => setOpen((o) => !o)} className="text-brand-500" aria-expanded={open}>
                {open ? 'Close' : 'Edit'}
              </button>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-900/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        {entry.status !== 'COMPLETED' && (
          <button
            onClick={() => incrementProgress(m.id)}
            disabled={!!total && entry.progress >= total}
            className="btn-primary w-16 shrink-0 self-stretch px-0 text-xl"
            aria-label={`Watched episode ${entry.progress + 1} of ${mediaTitle(m)}`}
          >
            +1
          </button>
        )}
      </div>
      {open && (
        <div className="border-t border-ink-900/10 p-4 dark:border-white/10">
          <ListEditor id={m.id} />
        </div>
      )}
    </li>
  )
}

function SearchResults({ search, entries }: { search: string; entries: Record<number, ListEntry> }) {
  const results = useAsync((signal) => searchAnime(search, { signal }), [search])

  if (results.status === 'error') return <ErrorMessage error={results.error} onRetry={results.retry} />
  if (results.status === 'loading')
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  if (!results.data.length)
    return (
      <div className="card p-8 text-center">
        <p className="text-4xl">🤷</p>
        <p className="mt-2 font-semibold">No anime found for “{search}”</p>
        <p className="text-sm text-ink-500 dark:text-ink-300">Try the Japanese or English title.</p>
      </div>
    )

  return (
    <ul className="space-y-3">
      {results.data.map((m) => (
        <SearchRow key={m.id} media={m} status={entries[m.id]?.status} />
      ))}
    </ul>
  )
}

function SearchRow({ media: m, status }: { media: Media; status?: ListStatus }) {
  const [picking, setPicking] = useState(false)
  const meta = [m.seasonYear, formatLabel(m.format), m.episodes && `${m.episodes} eps`].filter(Boolean).join(' · ')

  return (
    <li className="card p-3">
      <div className="flex items-center gap-3">
        <Link to={`/anime/${m.id}`} className="shrink-0">
          <div className="h-20 w-14 overflow-hidden rounded-lg" style={{ backgroundColor: m.coverImage.color ?? undefined }}>
            {m.coverImage.large && <img src={m.coverImage.large} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
        </Link>
        <Link to={`/anime/${m.id}`} className="min-w-0 flex-1">
          <p className="line-clamp-2 leading-tight font-semibold">{mediaTitle(m)}</p>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-300">{meta}</p>
        </Link>
        {status ? (
          <span className="chip shrink-0 bg-brand-500/15 text-brand-600 dark:text-brand-300">✓ {STATUS_LABEL[status]}</span>
        ) : (
          <button className="btn-primary shrink-0 px-3 py-2 text-sm" onClick={() => setPicking((p) => !p)}>
            {picking ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>
      {picking && !status && (
        <div className="mt-3">
          <StatusButtons
            onPick={(s) => {
              addEntry(m, s)
              setPicking(false)
            }}
          />
        </div>
      )}
    </li>
  )
}
