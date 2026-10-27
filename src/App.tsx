import { createHashRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import AnimeDetail from './pages/AnimeDetail'
import Home from './pages/Home'
import { Game, GameEndless, Notify, NotFound, Tracker } from './pages/Placeholders'

// Hash routing so GitHub Pages serves every route from index.html.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/tracker', element: <Tracker /> },
      { path: '/anime/:id', element: <AnimeDetail /> },
      { path: '/game', element: <Game /> },
      { path: '/game/endless', element: <GameEndless /> },
      { path: '/notify', element: <Notify /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
