import { useEffect, useState } from 'react'

/** Current time in ms, re-rendering every `intervalMs`. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** "2d 4h", "3h 12m", "8m", or "now". */
export function formatDuration(ms: number): string {
  if (ms <= 60_000) return 'now'
  const mins = Math.floor(ms / 60_000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  if (d) return h ? `${d}d ${h}h` : `${d}d`
  if (h) return m ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

export function formatClock(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Start and end of the local day containing `now`, as unix seconds. */
export function localDayBounds(now = Date.now()): [number, number] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return [Math.floor(start.getTime() / 1000), Math.floor(end.getTime() / 1000)]
}
