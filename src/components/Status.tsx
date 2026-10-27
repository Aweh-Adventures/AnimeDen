import type { ReactNode } from 'react'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ink-900/10 dark:bg-white/10 ${className}`} />
}

export function ErrorMessage({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-3xl">😵</p>
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm text-ink-500 dark:text-ink-300">{error.message}</p>
      {onRetry && (
        <button className="btn-ghost" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function ComingSoon({ title, emoji, children }: { title: string; emoji: string; children?: ReactNode }) {
  return (
    <div className="card mx-auto mt-8 flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <p className="text-5xl">{emoji}</p>
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="text-ink-500 dark:text-ink-300">{children ?? 'Coming soon. We are cooking.'}</p>
    </div>
  )
}
