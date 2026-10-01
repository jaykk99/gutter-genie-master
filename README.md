# gutter-genie-master

Gutter Genie Master App — business hub for the Gutter Genie gutter-cleaning
business (Winnipeg / Steinbach / Grunthal). Jay's daily-driver dashboard.

**Live site:** https://guttergenie.vercel.app

Pure static HTML — no build step, no dependencies to install. Vercel serves
`index.html` directly.

## Pages

- `index.html` — Business Hub. Home view with live job stats (skeleton
  loaders, last-synced timestamp, refresh, error state with retry), quick
  actions (call, email, new quote, upload job photos, call console shortcut,
  new job), app cards with per-app link-health status dots
  (reachable / unreachable / unknown), and a Services list (cleaning,
  downspout clearing, guard install, hanger/clip repair, replacement, free
  inspections) plus contact info (204-972-0325, guttergeinie@gmail.com).
  Sidebar nav loads each app in a sandboxed iframe with a loading spinner
  and a "taking too long" error bar (retry + open-in-new-tab).
  Online/offline indicator in the topbar. Mobile-first layout.
- `jobs.html` — Jobs Tracker. Searchable job log (customer, address, zone,
  phone, status, quote, notes) reading the `gg_projects` Supabase table, with
  realtime updates, CSV export, tappable phone numbers, and a Notion link.
  Offline mode: every successful cloud load refreshes a localStorage cache;
  jobs added while offline are queued and auto-synced to the cloud on the
  next successful load (marked "unsynced" until then). Table shows skeleton
  rows while loading, a last-synced timestamp, and a retry button on errors.

## Data

Both pages use a public Supabase **anon key** (embedded, safe for browsers —
it is rate-limited by Row Level Security). No API keys or secrets are required
to run the app.

## Local run

Serve the folder (recommended — some features assume http):

```bash
python3 -m http.server 8080
# then open http://localhost:8080/
```

## Tests

`node --check` on both pages' inline scripts, plus a Node harness that stubs
the DOM/Supabase/fetch and exercises the real page logic:
stats rendering + error states, link-health checks, offline cache writes,
offline job queueing, and pending-sync flush on reconnect. (Harness is
throwaway — kept in /tmp during development, not committed.)

## Notes

- Gallery before/after photo tagging is not implemented yet (follow-up — needs
  a `tag` column on the `gg_media_files` table in Supabase first).
