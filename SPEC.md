# Anime Den: Build Spec

A free, shareable anime site for me and my friends with three parts:
1. **Tracker**: personal watchlist with progress and airing countdowns
2. **Notifier**: personal WhatsApp message when a new episode of something you watch airs
3. **Guess Game**: daily character guessing game with a shareable result, Wordle style

(Name is a placeholder, rename anytime.)

---

## Hard rules for the build

- **Zero running costs.** No paid APIs, no paid hosting, no database server.
- **No AI or LLM calls in the finished product.** Everything runs on plain code.
- **Only data source:** AniList GraphQL API (`https://graphql.anilist.co`), public, no key needed for reads.
- **Always filter adult content:** pass `isAdult: false` in every media query. This site gets shared with friends.
- Respect AniList rate limits (assume 30 requests/min to be safe). Batch queries, cache responses in `localStorage` with a timestamp, and back off on HTTP 429.
- Credit AniList in the footer ("Data from AniList").
- Mobile first. Most friends will open it on their phones.

## Stack

- Vite + React + TypeScript + Tailwind CSS
- React Router (hash routing so GitHub Pages works without server config)
- Hosted free on **GitHub Pages**, deployed by a GitHub Actions workflow on push to `main`
- Notifier runs as a **scheduled GitHub Actions workflow** in the same repo (Node script, no framework)

## Site structure

```
/              Home: today's game, "airing today" strip, links to tracker
/tracker       My list
/anime/:id     Anime detail page
/game          Daily guess game
/game/endless  Practice mode (unlimited rounds, not shareable)
/notify        How to get WhatsApp pings (instructions page)
```

Dark theme by default, with a light toggle. Bold, playful, anime poster feel. Use cover images and banner images from AniList generously.

---

## Part 1: Tracker

**Storage:** browser `localStorage` only. Each friend has their own list on their own device.

**Features**
- Search anime by title (debounced, 400 ms), results show cover, title (English, fall back to Romaji), year, format, episode count
- Add to list with a status: Watching, Plan to Watch, Completed, Dropped, On Hold
- Episode progress with a big **+1** button (main action on mobile)
- Personal score out of 10 and a short notes field
- **Airing countdown** on any currently airing show ("Ep 8 in 2d 4h"), using `nextAiringEpisode`
- Tabs or filter chips per status, sort by recently updated, title, or score
- "Airing today" section on the home page from the user's Watching list

**Sharing and backup**
- **Export / Import** list as a JSON file (so nobody loses their list)
- **Share my list:** generate a read-only link with the list encoded in the URL (compressed, e.g. with `lz-string`). A friend opening the link sees the list as a profile page with a "Copy to my list" button per show.

**Optional, build last:** "Connect AniList" login using AniList OAuth implicit grant (client ID only, no secret, no backend). If connected, sync the tracker with the user's real AniList list. This is also what lets the notifier know what they watch (see Part 2).

---

## Part 2: Episode Release Notifier

**Delivery:** personal WhatsApp messages via **CallMeBot's free WhatsApp API** (personal use tier). Each friend gets their own message in their own WhatsApp chat. No WhatsApp Business account, no paid API, no logged-in WhatsApp session to babysit.

**Important constraints of CallMeBot**
- Free API is for personal use and can only message the person who activated it. So every friend activates it themselves and gets their own API key.
- Send request: `GET https://api.callmebot.com/whatsapp.php?phone=[number]&text=[urlencoded message]&apikey=[key]`
- It is a beta service and messages can arrive up to a minute late. Wait about 3 seconds between sends and retry once on failure.
- Plain text only (WhatsApp formatting like `*bold*` works). No images.

**How it works**
- Friend list lives in a GitHub Actions secret `FRIENDS_JSON`, **not in the repo**, because it holds phone numbers and API keys:
  ```json
  [
    { "name": "Shakey", "anilist": "ShakeyUsername", "phone": "27821234567", "apikey": "123456" },
    { "name": "Friend", "anilist": "FriendUsername", "phone": "27831234567", "apikey": "654321" }
  ]
  ```
  (Phone with country code, no plus sign.)
- Workflow `.github/workflows/notify.yml` runs on cron **every hour**, plus `workflow_dispatch` for manual testing.
- Script `notifier/notify.mjs`:
  1. Parse `FRIENDS_JSON` from the environment
  2. For each friend, fetch their AniList `CURRENT` (watching) list by username (public lists only)
  3. Build a map of media ID to the friends watching it
  4. Query `airingSchedule` for those media IDs with `airingAt` between the last run time and now
  5. For each friend, send **one combined message per run** listing every new episode for them, e.g.:
     ```
     *Anime Den* 🔔
     New episodes out:
     • Frieren, Ep 8
     • Dandadan, Ep 5
     Track it: https://<site-url>/#/tracker
     ```
  6. Save the new "last run" timestamp to `notifier/state.json` and commit it, so cron delays never cause missed or duplicate pings
- Never log phone numbers or API keys. Mask them in any error output.
- If a friend fails (private list, typo, bad key), log the friend's name only and keep going.
- Optional: a `--test` flag that sends each friend a "You're set up for Anime Den pings" message, run via `workflow_dispatch`.

**Adding a friend:** on the `/notify` page they follow friendly steps:
1. Make a free AniList account and mark their shows as Watching (keep the list public)
2. Save the CallMeBot number in their contacts and send it the activation message from callmebot.com, then wait for their API key
3. Send me their AniList username, WhatsApp number and API key privately

I add their entry to the `FRIENDS_JSON` secret in GitHub settings. The page must show the CallMeBot steps clearly and link to the official CallMeBot page rather than hard coding the bot's number, in case it changes.

**Limits check:** hourly runs of about 30 seconds stay well inside the free GitHub Actions minutes even on a private repo. A public repo is unlimited.

---

## Part 3: Guess Game

**Daily mode (the shareable one)**
- One new puzzle per day, the **same puzzle for everyone**, picked with a seeded random generator using the date (Africa/Johannesburg midnight reset)
- Puzzle pool: top 1,000 characters by favourites from AniList (`Character` sorted `FAVOURITES_DESC`), only from non-adult media
- **5 rounds per day**, mixed types:
  - **Who is this?** Character image, pick from 4 names
  - **Which anime?** Character image, pick the anime they are from (4 options)
  - **Zoom in:** heavily zoomed and blurred image that reveals more with each wrong guess (type the name, fuzzy matching with autocomplete)
  - **Cover crop:** small crop of an anime cover, guess the title (type in, fuzzy match)
- Wrong options for multiple choice should come from similar popularity so it is not too easy
- Results screen with a **share button** that copies emoji text, for example:
  ```
  Anime Den #142  4/5
  🟩🟩🟥🟩🟨
  ```
  (🟨 = correct after a hint). Uses the Web Share API on phones, clipboard copy on desktop.
- Save daily result and streak in `localStorage`. Show current streak, best streak and a stats chart.
- After finishing, lock today's puzzle and show a countdown to the next one.

**Endless mode:** unlimited random rounds for practice, with a difficulty picker (Top 100 / Top 500 / Top 1000 characters). Not shareable.

**Performance:** prefetch the day's puzzle data in one batched query and cache it, so the game makes as few API calls as possible.

---

## Build phases (one Claude Code session each)

Run `/clear` between phases. Commit after each phase works.

1. **Scaffold:** Vite + React + TS + Tailwind, routing, layout, dark/light theme, AniList API helper with caching and rate limit backoff, GitHub Pages deploy workflow. Deploy a "hello" page.
2. **Tracker core:** search, add, statuses, +1 progress, scores, notes, countdowns, home "airing today".
3. **Tracker sharing:** export/import JSON, share-link profiles, copy to my list.
4. **Game daily mode:** seeded daily puzzle, 4 round types, fuzzy matching, results, emoji share, streaks.
5. **Game endless mode** plus final polish (loading skeletons, empty states, error messages).
6. **Notifier:** script, `FRIENDS_JSON` secret, state.json, hourly workflow, combined WhatsApp message via CallMeBot, `/notify` instructions page. Test with `workflow_dispatch` and the `--test` flag.
7. **Optional:** AniList OAuth login and two-way sync.

## Definition of done

- Site live on GitHub Pages and usable on a phone
- A friend can open the link, play today's game, share their score, and start a list without signing up
- Adding a friend to the `FRIENDS_JSON` secret gets them a WhatsApp ping within the hour of an episode airing
- No phone numbers or API keys anywhere in the repo or logs
- No API keys in the code, no paid services, no AI calls
