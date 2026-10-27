import { Link } from 'react-router-dom'
import { formatLabel, mediaTitle, type Media } from '../lib/anilist'

export default function MediaCard({ media }: { media: Media }) {
  const meta = [media.seasonYear, formatLabel(media.format), media.episodes && `${media.episodes} eps`].filter(Boolean)
  return (
    <Link to={`/anime/${media.id}`} className="group block">
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-2xl shadow-md"
        style={{ backgroundColor: media.coverImage.color ?? undefined }}
      >
        {media.coverImage.large && (
          <img
            src={media.coverImage.large}
            alt=""
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-105"
          />
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-tight">{mediaTitle(media)}</p>
      <p className="text-xs text-ink-500 dark:text-ink-300">{meta.join(' · ')}</p>
    </Link>
  )
}
