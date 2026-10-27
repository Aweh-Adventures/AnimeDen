// AniList GraphQL helper.
// - Caches responses in localStorage with a timestamp (per-call TTL).
// - Client-side rate limit: at most 30 requests per rolling minute.
// - Backs off and retries on HTTP 429 (honours Retry-After).
// - Dedupes identical in-flight requests.
// - Refuses media queries that don't filter adult content.

const ENDPOINT = 'https://graphql.anilist.co'
const CACHE_PREFIX = 'animeden:cache:'
const MAX_PER_MINUTE = 30
const MAX_RETRIES = 3

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export class AniListError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AniListError'
    this.status = status
  }
}

// ---------- adult content guard ----------

// Args that only exist on nested connections (e.g. Character.media), which
// have no isAdult argument. Those results must be filtered with dropAdult().
const CONNECTION_ARGS = new Set(['sort', 'type', 'onList', 'page', 'perPage'])

export function assertAdultFiltered(query: string) {
  const re = /\b(Media|media)\s*\(([^)]*)\)/g
  for (const m of query.matchAll(re)) {
    const args = m[2]
    if (/\bisAdult\s*:\s*false\b/.test(args)) continue
    const keys = [...args.matchAll(/(\w+)\s*:/g)].map((k) => k[1])
    if (m[1] === 'media' && keys.every((k) => CONNECTION_ARGS.has(k))) continue
    throw new AniListError(`Media query is missing "isAdult: false": ${m[0]}`)
  }
}

/** Filter out adult media from nested connections that can't take isAdult. */
export function dropAdult<T extends { isAdult?: boolean | null }>(items: (T | null | undefined)[]): T[] {
  return items.filter((m): m is T => !!m && m.isAdult !== true)
}

// ---------- cache ----------

interface CacheEntry<T> {
  t: number
  data: T
}

function hashKey(s: string): string {
  // FNV-1a 32-bit, plenty for cache keys.
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + s.length.toString(36)
}

function readCache<T>(key: string, ttl: number): T | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() - entry.t > ttl) return undefined
    return entry.data
  } catch {
    return undefined
  }
}

function writeCache<T>(key: string, data: T) {
  const value = JSON.stringify({ t: Date.now(), data } satisfies CacheEntry<T>)
  try {
    localStorage.setItem(CACHE_PREFIX + key, value)
  } catch {
    // Storage full: drop the oldest half of our cache entries and try once more.
    pruneCache(0.5)
    try {
      localStorage.setItem(CACHE_PREFIX + key, value)
    } catch {
      /* give up silently, caching is best effort */
    }
  }
}

export function pruneCache(fraction = 1) {
  try {
    const entries: { k: string; t: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(CACHE_PREFIX)) continue
      let t = 0
      try {
        t = (JSON.parse(localStorage.getItem(k) ?? '{}') as CacheEntry<unknown>).t ?? 0
      } catch {
        /* corrupt entry, remove first */
      }
      entries.push({ k, t })
    }
    entries.sort((a, b) => a.t - b.t)
    entries.slice(0, Math.ceil(entries.length * fraction)).forEach((e) => localStorage.removeItem(e.k))
  } catch {
    /* ignore */
  }
}

// ---------- rate limiter ----------

const sentAt: number[] = []
let pausedUntil = 0
let queue: Promise<void> = Promise.resolve()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Wait for a free slot. Calls are serialised through `queue` so slots are handed out in order. */
function acquireSlot(): Promise<void> {
  const next = queue.then(async () => {
    for (;;) {
      const now = Date.now()
      if (now < pausedUntil) {
        await sleep(pausedUntil - now)
        continue
      }
      while (sentAt.length && now - sentAt[0] >= MINUTE) sentAt.shift()
      if (sentAt.length < MAX_PER_MINUTE) {
        sentAt.push(now)
        return
      }
      await sleep(MINUTE - (now - sentAt[0]) + 50)
    }
  })
  queue = next.catch(() => {})
  return next
}

// ---------- request ----------

export interface QueryOptions {
  /** How long a cached response stays fresh. 0 disables caching. Default 1 hour. */
  ttl?: number
  signal?: AbortSignal
}

const inFlight = new Map<string, Promise<unknown>>()

export async function anilist<T>(
  query: string,
  variables: Record<string, unknown> = {},
  { ttl = HOUR, signal }: QueryOptions = {},
): Promise<T> {
  assertAdultFiltered(query)
  const body = JSON.stringify({ query, variables })
  const key = hashKey(body)

  if (ttl > 0) {
    const cached = readCache<T>(key, ttl)
    if (cached !== undefined) return cached
  }

  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>

  const p = (async () => {
    for (let attempt = 0; ; attempt++) {
      await acquireSlot()
      signal?.throwIfAborted()

      let res: Response
      try {
        res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body,
          signal,
        })
      } catch (e) {
        if (signal?.aborted) throw e
        if (attempt >= MAX_RETRIES) throw new AniListError('Could not reach AniList. Check your connection.')
        await sleep(1000 * 2 ** attempt)
        continue
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const wait = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 0) || 2000 * 2 ** attempt
        pausedUntil = Math.max(pausedUntil, Date.now() + wait)
        if (attempt >= MAX_RETRIES) throw new AniListError('AniList is busy right now. Try again in a minute.', 429)
        continue
      }

      const json = (await res.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null
      if (!res.ok || !json || json.errors?.length || !json.data) {
        if (res.status >= 500 && attempt < MAX_RETRIES) {
          await sleep(1000 * 2 ** attempt)
          continue
        }
        throw new AniListError(json?.errors?.[0]?.message ?? `AniList request failed (${res.status})`, res.status)
      }

      if (ttl > 0) writeCache(key, json.data)
      return json.data
    }
  })()

  inFlight.set(key, p)
  try {
    return await p
  } finally {
    inFlight.delete(key)
  }
}

// ---------- shared types and helpers ----------

export type MediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'

export interface MediaTitle {
  romaji: string | null
  english: string | null
  native: string | null
}

export interface Media {
  id: number
  title: MediaTitle
  coverImage: { large: string | null; extraLarge: string | null; color: string | null }
  bannerImage: string | null
  format: string | null
  status: MediaStatus | null
  episodes: number | null
  seasonYear: number | null
  averageScore: number | null
  genres: string[]
  isAdult: boolean
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null
}

export const MEDIA_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge color }
  bannerImage
  format
  status
  episodes
  seasonYear
  averageScore
  genres
  isAdult
  nextAiringEpisode { episode airingAt timeUntilAiring }
`

export function mediaTitle(m: { title: MediaTitle }): string {
  return m.title.english || m.title.romaji || m.title.native || 'Untitled'
}

export function formatLabel(format: string | null): string {
  if (!format) return ''
  const map: Record<string, string> = { TV_SHORT: 'TV Short', MOVIE: 'Movie', SPECIAL: 'Special', MUSIC: 'Music' }
  return map[format] ?? format
}

/** Fetch many media by id in batches of 50 (one request per batch). */
export async function fetchMediaByIds(ids: number[], opts: QueryOptions = {}): Promise<Media[]> {
  const unique = [...new Set(ids)]
  const out: Media[] = []
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50)
    const data = await anilist<{ Page: { media: Media[] } }>(
      `query ($ids: [Int]) {
        Page(perPage: 50) {
          media(id_in: $ids, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
        }
      }`,
      { ids: chunk },
      opts,
    )
    out.push(...data.Page.media)
  }
  return out
}

export async function fetchTrending(opts: QueryOptions = {}): Promise<Media[]> {
  const data = await anilist<{ Page: { media: Media[] } }>(
    `query {
      Page(perPage: 12) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    {},
    { ttl: 6 * HOUR, ...opts },
  )
  return data.Page.media
}

export interface MediaDetail extends Media {
  description: string | null
  season: string | null
  studios: { nodes: { name: string }[] }
  siteUrl: string
}

export async function fetchMediaDetail(id: number, opts: QueryOptions = {}): Promise<MediaDetail | null> {
  const data = await anilist<{ Media: MediaDetail | null }>(
    `query ($id: Int) {
      Media(id: $id, type: ANIME, isAdult: false) {
        ${MEDIA_FIELDS}
        description(asHtml: false)
        season
        studios(isMain: true) { nodes { name } }
        siteUrl
      }
    }`,
    { id },
    { ttl: 6 * HOUR, ...opts },
  ).catch((e: unknown) => {
    // AniList answers 404 for unknown ids and for adult titles we filter out.
    if (e instanceof AniListError && e.status === 404) return { Media: null }
    throw e
  })
  return data.Media
}
