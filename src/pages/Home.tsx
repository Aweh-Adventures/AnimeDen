import { Link } from 'react-router-dom'
import AiringToday from '../components/AiringToday'
import MediaCard from '../components/MediaCard'
import { ErrorMessage, Skeleton } from '../components/Status'
import { fetchTrending } from '../lib/anilist'
import { useAsync } from '../lib/useAsync'

export default function Home() {
  const trending = useAsync((signal) => fetchTrending({ signal }), [])
  const banner = trending.data?.find((m) => m.bannerImage)?.bannerImage

  return (
    <div className="space-y-8">
      <section className="relative -mx-4 overflow-hidden sm:mx-0 sm:rounded-3xl">
        {banner && <img src={banner} alt="" className="absolute inset-0 size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/95 via-brand-500/80 to-ink-950/70" />
        <div className="relative px-5 py-10 text-white sm:px-10 sm:py-14">
          <p className="chip bg-white/20 backdrop-blur">Daily puzzle</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-none sm:text-6xl">
            Who's that
            <br />
            character?
          </h1>
          <p className="mt-3 max-w-sm text-white/85">Five rounds. Same puzzle for everyone. Brag in the group chat.</p>
          <Link to="/game" className="btn mt-6 bg-white text-brand-600 shadow-[0_4px_0_0] shadow-ink-950/40">
            Play today's game
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold">Airing today</h2>
          <Link to="/tracker" className="text-sm font-semibold text-brand-500">
            My list →
          </Link>
        </div>
        <AiringToday />
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-extrabold">Trending now</h2>
        {trending.status === 'error' ? (
          <ErrorMessage error={trending.error} onRetry={trending.retry} />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {trending.status === 'loading'
              ? Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className="aspect-[2/3]" />)
              : trending.data.map((m) => <MediaCard key={m.id} media={m} />)}
          </div>
        )}
      </section>
    </div>
  )
}
