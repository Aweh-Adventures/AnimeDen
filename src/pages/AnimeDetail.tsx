import { useParams } from 'react-router-dom'
import { ComingSoon, ErrorMessage, Skeleton } from '../components/Status'
import { fetchMediaDetail, formatLabel, mediaTitle } from '../lib/anilist'
import { useAsync } from '../lib/useAsync'

function stripHtml(s: string) {
  return new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n'), 'text/html').body.textContent?.replace(/\n{3,}/g, '\n\n').trim() ?? ''
}

export default function AnimeDetail() {
  const id = Number(useParams().id)
  const detail = useAsync((signal) => (Number.isInteger(id) ? fetchMediaDetail(id, { signal }) : Promise.resolve(null)), [id])

  if (detail.status === 'loading')
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 sm:h-64" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
      </div>
    )
  if (detail.status === 'error') return <ErrorMessage error={detail.error} onRetry={detail.retry} />
  const m = detail.data
  if (!m) return <ComingSoon emoji="🔍" title="Anime not found">That show doesn't exist or isn't available here.</ComingSoon>

  const facts = [
    formatLabel(m.format),
    m.season && m.seasonYear ? `${m.season[0]}${m.season.slice(1).toLowerCase()} ${m.seasonYear}` : m.seasonYear,
    m.episodes && `${m.episodes} episodes`,
    m.studios.nodes[0]?.name,
    m.averageScore && `★ ${m.averageScore}%`,
  ].filter(Boolean)

  return (
    <article>
      <div className="relative -mx-4 -mt-4 h-44 overflow-hidden sm:mx-0 sm:mt-0 sm:h-64 sm:rounded-3xl" style={{ backgroundColor: m.coverImage.color ?? '#ff3d7f' }}>
        {m.bannerImage && <img src={m.bannerImage} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-paper via-transparent dark:from-ink-950" />
      </div>
      <div className="relative -mt-20 flex gap-4 px-1 sm:px-6">
        {m.coverImage.large && (
          <img src={m.coverImage.extraLarge ?? m.coverImage.large} alt="" className="w-28 shrink-0 rounded-2xl shadow-xl ring-4 ring-paper sm:w-40 dark:ring-ink-950" />
        )}
        <div className="self-end pb-1">
          <h1 className="text-2xl leading-tight font-extrabold sm:text-4xl">{mediaTitle(m)}</h1>
          {m.title.native && <p className="text-sm text-ink-500 dark:text-ink-300">{m.title.native}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {facts.map((f) => (
          <span key={String(f)} className="chip bg-brand-500/15 text-brand-600 dark:text-brand-300">
            {f}
          </span>
        ))}
        {m.genres.map((g) => (
          <span key={g} className="chip bg-ink-900/5 dark:bg-white/10">
            {g}
          </span>
        ))}
      </div>
      {m.description && <p className="mt-4 leading-relaxed whitespace-pre-line text-ink-700 dark:text-ink-300">{stripHtml(m.description)}</p>}
      <a href={m.siteUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-6">
        View on AniList
      </a>
    </article>
  )
}
