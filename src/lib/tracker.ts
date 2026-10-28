// Personal watchlist, stored only in this browser's localStorage.
import { useSyncExternalStore } from 'react'
import type { Media } from './anilist'

export const STATUSES = ['WATCHING', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'] as const
export type ListStatus = (typeof STATUSES)[number]

export const STATUS_LABEL: Record<ListStatus, string> = {
  WATCHING: 'Watching',
  PLANNING: 'Plan to Watch',
  COMPLETED: 'Completed',
  PAUSED: 'On Hold',
  DROPPED: 'Dropped',
}

export const STATUS_COLOR: Record<ListStatus, string> = {
  WATCHING: 'bg-emerald-500',
  PLANNING: 'bg-sky-500',
  COMPLETED: 'bg-brand-500',
  PAUSED: 'bg-amber-500',
  DROPPED: 'bg-ink-500',
}

/** The bits of the AniList media we keep so the list renders without a network call. */
export interface MediaSnapshot {
  id: number
  title: Media['title']
  cover: string | null
  color: string | null
  format: string | null
  episodes: number | null
  seasonYear: number | null
}

export interface ListEntry {
  media: MediaSnapshot
  status: ListStatus
  progress: number
  /** 1-10, or null when unscored. */
  score: number | null
  notes: string
  addedAt: number
  updatedAt: number
}

interface ListState {
  version: 1
  entries: Record<number, ListEntry>
}

const KEY = 'animeden:list'
const EMPTY: ListState = { version: 1, entries: {} }

let state: ListState = load()
const listeners = new Set<() => void>()

function load(): ListState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as ListState
    return parsed?.version === 1 && parsed.entries ? parsed : EMPTY
  } catch {
    return EMPTY
  }
}

function commit(next: ListState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or blocked: keep the in-memory copy for this visit */
  }
  listeners.forEach((l) => l())
}

// Keep tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    state = load()
    listeners.forEach((l) => l())
  })
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useList(): Record<number, ListEntry> {
  return useSyncExternalStore(subscribe, () => state.entries)
}

export function useEntry(id: number): ListEntry | undefined {
  return useSyncExternalStore(subscribe, () => state.entries[id])
}

export function snapshot(m: Media): MediaSnapshot {
  return {
    id: m.id,
    title: m.title,
    cover: m.coverImage.large,
    color: m.coverImage.color,
    format: m.format,
    episodes: m.episodes,
    seasonYear: m.seasonYear,
  }
}

export function addEntry(m: Media, status: ListStatus) {
  const now = Date.now()
  const existing = state.entries[m.id]
  const entry: ListEntry = existing
    ? { ...existing, media: snapshot(m), status, updatedAt: now }
    : { media: snapshot(m), status, progress: 0, score: null, notes: '', addedAt: now, updatedAt: now }
  if (status === 'COMPLETED' && m.episodes) entry.progress = m.episodes
  commit({ ...state, entries: { ...state.entries, [m.id]: entry } })
}

export function updateEntry(id: number, patch: Partial<Omit<ListEntry, 'media' | 'addedAt' | 'updatedAt'>>) {
  const e = state.entries[id]
  if (!e) return
  const next: ListEntry = { ...e, ...patch, updatedAt: Date.now() }
  const total = next.media.episodes
  next.progress = Math.max(0, total ? Math.min(next.progress, total) : next.progress)
  if (patch.status === 'COMPLETED' && total) next.progress = total
  commit({ ...state, entries: { ...state.entries, [id]: next } })
}

/** Refresh stored titles, covers and episode counts from fresher AniList data. */
export function refreshSnapshots(media: Media[]) {
  let changed = false
  const entries = { ...state.entries }
  for (const m of media) {
    const e = entries[m.id]
    if (!e) continue
    const snap = snapshot(m)
    if (JSON.stringify(snap) !== JSON.stringify(e.media)) {
      entries[m.id] = { ...e, media: snap }
      changed = true
    }
  }
  if (changed) commit({ ...state, entries })
}

/**
 * The +1 action. Moves "Plan to Watch" and "On Hold" into "Watching", and marks the
 * show Completed when its final episode is reached.
 */
export function incrementProgress(id: number) {
  const e = state.entries[id]
  if (!e) return
  const total = e.media.episodes
  if (total && e.progress >= total) return
  const progress = e.progress + 1
  let status = e.status
  if (status === 'PLANNING' || status === 'PAUSED') status = 'WATCHING'
  if (total && progress >= total) status = 'COMPLETED'
  updateEntry(id, { progress, status })
}

export function removeEntry(id: number) {
  const entries = { ...state.entries }
  delete entries[id]
  commit({ ...state, entries })
}
