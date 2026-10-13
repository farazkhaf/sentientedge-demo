# SentientEdge

SentientEdge is a desktop urban intelligence frontend for Miami, presenting a preserved May 2026 data snapshot. Geographic profiles, neighborhood briefings, recorded developments, community perspectives, and area comparisons share one analytical environment.

This repository contains the frontend application, its presentation APIs, optional snapshot-based AI assistant, and the data needed to run it locally.

## Run locally

Requires **Node.js 22.15 or newer**.

```sh
npm ci
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). The initial database state pauses AI while keeping the workspace usable. Browsing needs no account or external data-processing service. The styled basemap needs internet access.

For AI, copy `.env.example` to `.env.local`, set your server-side `OPENAI_API_KEY`, and generate `SESSION_SECRET` using the command in that file. Then run `npm run demo:on` and reload the page. The default model is `gpt-5.4-mini`. Each installation uses its own credentials.

```sh
npm run demo:pause   # Pause AI; retain browsing
npm run demo:off     # Display the offline notice
npm run demo:on      # Enable AI when credentials are configured
```

These commands change persistent local database settings. An optional `DEMO_STATE` environment override takes precedence. Restart the server after changing environment variables; reload an open page after changing the demo state.

```sh
npm test
npm run check
npm run build
npm start
```

## Workspace

- **Home:** Miami-wide briefing and themes, geographic preview, neighborhood highlights ranked by the current blend, recent explorations, saved areas, and an investigation assistant.
- **Explore:** Miami map with adjustable dimension weights and exclusive Profile, Places & amenities, and Building permits modes. One closable panel shows the selected area, place, or permit activity. Mode-specific previews avoid duplicating open details. News and community summaries expand into source-backed themes and records.
- **Compare:** two to four neighborhoods with aligned indices, income, density, walkability, permit activity, and related briefings.
- **Ask:** one contextual conversation with briefings, comparison tables, charts, timelines, source evidence, and map actions. Actions apply when clicked. The assistant searches the included data; it performs no live web research or automatic map commands.

Saved areas and recent explorations persist in the browser. Conversations last for the current page session. The interface targets desktop analysis.

## Data and architecture

The application reads the included snapshot from SQLite locally. A Cloudflare D1 adapter uses the same schema and data-access layer. The database contains profiles, source records, prepared summaries, permits, and places. `lib/data/` remains a reproducible public seed input; it is not the runtime measurement store. Rerunning the seed updates snapshot rows without resetting owner controls or usage counters.

Geographic assets use GeoJSON. MapLibre renders 23 analytical areas over OpenFreeMap. The areas are this project's analytical geography; official boundary equivalence is not asserted. Attribution stays visible.

The preserved May 2026 snapshot includes 67 news records, 89 community records, and 171 place clusters. Numeric profiles and histories are illustrative fixtures. Source links remain attached to records. The Demo snapshot control explains the distinct score meanings and scales. Included records are not deduplicated events or a representative community survey.

City and neighborhood briefings are included in the snapshot and load without model calls. The optional AI assistant retrieves those briefings and source records to answer questions and display artifacts.

## Demo controls

The assistant uses signed anonymous cookies plus keyed IP digests. Persistent database reservations enforce session, IP, concurrency, and global daily limits before model calls. Missing credentials, unavailable storage, or a paused/offline state block AI requests. There is no signup or verified identity requirement.

Default limits are 5 investigations per session and 8 per IP in 10 minutes, 50 globally per UTC day, 2 concurrent investigations, and a conservative 1,000,000-token daily allowance. Each investigation has at most 4 model rounds, bounded input/output, and a 55-second server deadline. Unknown provider usage remains charged at the full reserved amount. These are application quotas; provider-wide usage and billing remain separate.

## Repository guide

- `components/intelligence/`: active interface.
- `lib/intelligence/`: score presentation, briefings, tools, and artifact contracts.
- `lib/storage/`: shared database access, snapshot reconstruction, availability, and AI usage controls.
- `migrations/` and `scripts/seed*`: schema and reproducible initialization.
- `tests/`: data parity, scoring, artifacts, presentation, and persistent control checks.

Local databases, credentials, generated map workers, and build output are ignored by Git. Public snapshot seed files are included so a clone can initialize its own database.
