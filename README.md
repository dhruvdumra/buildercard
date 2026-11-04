# Builder Card

Type a GitHub username, get a profile card: **top repos, main languages and recent activity**.

**Live:** https://YOUR-APP.vercel.app &nbsp;·&nbsp; Shareable links: `/?u=torvalds`

![Builder Card screenshot (demo data)](docs/screenshot.png)

## Features

- **Profile** – avatar, bio, company, location, website, join year, repo / follower counts, total stars earned.
- **Top repositories** – your own (non-fork, non-archived) repos ranked by stars, then forks, then recency.
- **Main languages** – share of original repos by primary language, top 5 + "Other", as a bar and legend.
- **Recent activity** – the latest public events in plain English ("Merged PR #12 in …"), with repeated pushes collapsed (`×3`).
- Accepts `octocat`, `@octocat` or a full `https://github.com/octocat` URL. Works for organisations too.
- Avatar ring and card glow tinted by the user's language mix.
- Shareable URLs (`?u=`), back/forward navigation, copy-link, dark theme, mobile layout.

## Error handling

| Situation | What the user sees |
|---|---|
| Invalid username (spaces, `_`, too long) | Caught client-side before any API call, with the actual rule explained |
| User doesn't exist (404) | "User not found" with a hint about spelling |
| Rate limit (403 + `x-ratelimit-remaining: 0`, 429, secondary limit) | When the quota resets, as a local time and minutes from now |
| GitHub 5xx / network failure | Friendly message + **Try again** button |
| Activity endpoint fails but profile works | Card still renders; activity section says it's unavailable |
| User types fast / switches users mid-load | Stale requests are aborted (`AbortController`) so an old response never overwrites a newer one |

To avoid hitting limits in the first place, results are cached in `sessionStorage` for 10 minutes, and the footer shows remaining API quota.

## Approach

**Stack:** plain HTML, CSS and ES modules. No framework, no build step, no runtime dependencies. A profile card is three API calls and some rendering, and shipping no bundle keeps the app instant and the code easy to review.

```
index.html          markup
src/username.js     input normalisation and validation
src/errors.js       typed errors, GitHub status → error kind
src/shape.js        raw API data → card model (repos, languages, activity)
src/client.js       fetching: proxy detection, pagination, graceful degradation
src/render.js       card, loading and error views
src/app.js          wiring: form, URL state, caching, request cancellation
src/dom.js          tiny element helper (textContent only)
src/format.js       number/time/URL formatting
src/cache.js        sessionStorage cache with TTL
src/colors.js       language colours
src/styles.css      styles
api/github.js       optional Vercel serverless proxy
scripts/dev.js      zero-dependency local server (static + /api)
tests/              node:test unit tests, one file per module
```

**Data flow.** `fetchCard()` in `src/client.js` fetches the profile first. It fails fast on unknown users and returns `public_repos`, which decides how many repo pages to request (up to 300 repos). Repos and events are then fetched in parallel.

**Rate limits and the proxy.** Anonymous browser calls to GitHub get 60 requests/hour per IP. On Vercel, `api/github.js` proxies just three whitelisted, read-only endpoints. With a `GITHUB_TOKEN` env var it raises the limit to 5,000/hour without exposing the token, and responses are edge-cached for 5 minutes. The client auto-detects the proxy (via an `x-builder-proxy` header). On a purely static host (Netlify, GitHub Pages, or `file://`) it falls back to calling `api.github.com` directly, so the same code runs everywhere.

**Security.** All GitHub-supplied text is inserted with `textContent` (no `innerHTML`). The user's website link is validated to `http(s)` only. The proxy validates usernames and only allows fixed paths, so it can't be used as an open proxy.

**Trade-off: languages.** "Main languages" counts each repo's primary language. Byte-accurate stats would need one `/languages` call per repo (up to 100+ calls), which would burn the anonymous quota in a single lookup.

**Note on activity.** GitHub's Events API only covers public events from the last 90 days, and push events may not include a commit count. The card handles both cases ("Pushed to main in …").

## Run locally

Requires Node 18+. There's nothing to install.

```bash
npm run dev     # http://localhost:3000  (static app + /api/github proxy)
npm test        # unit tests
```

Optional: `GITHUB_TOKEN=ghp_xxx npm run dev` to use an authenticated quota. A fine-grained token with **no** scopes is enough, since only public data is read.

You can also open `index.html` through any static server (`npx serve .`). Without the proxy, it calls GitHub directly.

## Deploy

**Vercel (recommended):** import the repo. Framework preset "Other", no build command, no output directory. Optionally add `GITHUB_TOKEN` under Settings → Environment Variables.

**Netlify / GitHub Pages:** deploy the folder as-is. The app runs in direct mode (60 requests/hour per visitor).

## Time taken

_TODO: fill in._
