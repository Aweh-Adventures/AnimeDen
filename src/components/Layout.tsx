import { NavLink, Outlet, Link } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { BellIcon, GameIcon, HomeIcon, ListIcon, MoonIcon, SunIcon } from './Icons'

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/tracker', label: 'My List', icon: ListIcon, end: false },
  { to: '/game', label: 'Guess', icon: GameIcon, end: false },
  { to: '/notify', label: 'Pings', icon: BellIcon, end: false },
]

export default function Layout() {
  const { theme, toggle } = useTheme()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-paper/80 backdrop-blur-md dark:border-white/10 dark:bg-ink-950/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link to="/" className="font-display text-xl font-extrabold tracking-tight">
            Anime<span className="text-brand-500">Den</span>
          </Link>
          <nav className="ml-4 hidden gap-1 sm:flex">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isActive ? 'bg-brand-500 text-white' : 'hover:bg-ink-900/5 dark:hover:bg-white/10'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={toggle}
            className="ml-auto rounded-full p-2 transition hover:bg-ink-900/5 dark:hover:bg-white/10"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-28 sm:pb-12">
        <Outlet />
      </main>

      <footer className="hidden border-t border-ink-900/10 py-6 text-center text-sm text-ink-500 sm:block dark:border-white/10 dark:text-ink-300">
        <FooterText />
      </footer>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-900/10 bg-paper/90 backdrop-blur-md sm:hidden dark:border-white/10 dark:bg-ink-950/90"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
                  isActive ? 'text-brand-500' : 'text-ink-500 dark:text-ink-300'
                }`
              }
            >
              <Icon className="size-6" />
              {label}
            </NavLink>
          ))}
        </div>
        <p className="pb-1 text-center text-[10px] text-ink-500 dark:text-ink-300">
          <FooterText />
        </p>
      </nav>
    </div>
  )
}

function FooterText() {
  return (
    <>
      Data from{' '}
      <a href="https://anilist.co" target="_blank" rel="noreferrer" className="font-semibold underline-offset-2 hover:underline">
        AniList
      </a>
      {' · '}Made for friends, free forever
    </>
  )
}
