import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'success'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: Error }

/** Run an async loader when deps change. The signal aborts when deps change or on unmount. */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]): AsyncState<T> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState({ status: 'loading' })
    load(ctrl.signal).then(
      (data) => !ctrl.signal.aborted && setState({ status: 'success', data }),
      (error: unknown) =>
        !ctrl.signal.aborted && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    )
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt])

  return { ...state, retry: () => setAttempt((a) => a + 1) }
}
