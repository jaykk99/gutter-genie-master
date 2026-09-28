# gutter-genie-master

Gutter Genie Master App — unified hub for the Gutter Genie gutter-cleaning
business (Winnipeg / Steinbach / Grunthal).

**Live site:** https://guttergenie.vercel.app

Pure static HTML — no build step, no dependencies to install. Vercel serves
`index.html` directly.

## Pages

- `index.html` — Master Dashboard. Sidebar nav with live app cards; loads each
  app in a sandboxed iframe. Home view shows live job stats from Supabase.
- `jobs.html` — Jobs Tracker. Searchable job log (customer, address, zone,
  phone, status, quote, notes) reading the `gg_projects` Supabase table, with
  realtime updates, CSV export, and a Notion link. Falls back to an offline
  local-storage mode when the cloud is unreachable.

## Data

Both pages use a public Supabase **anon key** (embedded, safe for browsers —
it is rate-limited by Row Level Security). No API keys or secrets are required
to run the app.

## Local run

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

## Notes

- Gallery before/after photo tagging is not implemented yet (follow-up — needs
  a `tag` column on the `gg_media_files` table in Supabase first).

