import { useState } from 'react'
import type { Media } from '../lib/anilist'
import {
  STATUS_LABEL,
  STATUSES,
  addEntry,
  incrementProgress,
  removeEntry,
  updateEntry,
  useEntry,
  type ListStatus,
} from '../lib/tracker'

export function StatusButtons({ value, onPick }: { value?: ListStatus; onPick: (s: ListStatus) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
            value === s ? 'bg-brand-500 text-white' : 'bg-ink-900/5 hover:bg-ink-900/10 dark:bg-white/10 dark:hover:bg-white/15'
          }`}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  )
}

/** Add/edit controls for one show. `media` is only needed for adding. */
export default function ListEditor({ id, media }: { id: number; media?: Media }) {
  const entry = useEntry(id)
  const [confirmRemove, setConfirmRemove] = useState(false)

  if (!entry) {
    if (!media) return null
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">Add to my list</p>
        <StatusButtons onPick={(s) => addEntry(media, s)} />
      </div>
    )
  }

  const total = entry.media.episodes
  const done = !!total && entry.progress >= total

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-semibold">Status</p>
        <StatusButtons value={entry.status} onPick={(status) => updateEntry(id, { status })} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Episodes watched</p>
        <div className="flex items-center gap-3">
          <button
            className="btn-ghost size-11 p-0 text-xl"
            onClick={() => updateEntry(id, { progress: entry.progress - 1 })}
            disabled={entry.progress <= 0}
            aria-label="Minus one episode"
          >
            −
          </button>
          <p className="min-w-20 text-center text-2xl font-extrabold tabular-nums">
            {entry.progress}
            <span className="text-base font-semibold text-ink-500 dark:text-ink-300"> / {total ?? '?'}</span>
          </p>
          <button className="btn-primary flex-1 py-3 text-lg" onClick={() => incrementProgress(id)} disabled={done}>
            +1 episode
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex justify-between text-sm font-semibold">
          <span>My score</span>
          <span className="text-brand-500">{entry.score ? `${entry.score} / 10` : 'Not scored'}</span>
        </p>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={entry.score ?? 0}
          onChange={(e) => updateEntry(id, { score: Number(e.target.value) || null })}
          className="w-full accent-brand-500"
          aria-label="Score out of 10"
        />
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Notes</span>
        <textarea
          value={entry.notes}
          maxLength={500}
          rows={2}
          placeholder="Where you left off, who recommended it..."
          onChange={(e) => updateEntry(id, { notes: e.target.value })}
          className="w-full rounded-xl border border-ink-900/10 bg-paper p-3 text-sm outline-none focus:border-brand-500 dark:border-white/10 dark:bg-ink-950"
        />
      </label>

      {confirmRemove ? (
        <div className="flex items-center gap-2 text-sm">
          <span>Remove from your list?</span>
          <button className="btn bg-red-600 px-3 py-1.5 text-white" onClick={() => removeEntry(id)}>
            Remove
          </button>
          <button className="btn-ghost px-3 py-1.5" onClick={() => setConfirmRemove(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button className="text-sm font-semibold text-red-500" onClick={() => setConfirmRemove(true)}>
          Remove from list
        </button>
      )}
    </div>
  )
}
