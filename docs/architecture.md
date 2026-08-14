# Architecture

SignalDesk is a deliberately server-light analytics product. Next.js renders the product shell and metadata; a typed client module generates and analyzes a fixed synthetic snapshot after hydration.

## Boundaries

| Boundary | Responsibility |
|---|---|
| `src/lib/analytics.ts` | schema, deterministic generator, filtering, KPI formulas, trends, team summaries, insights, CSV serialization |
| `src/components/dashboard.tsx` | state machine, URL synchronization, controls, charts, table, export, and recovery interactions |
| `src/app/page.tsx` | validates incoming URL parameters before the interactive boundary |
| `src/app/*` metadata files | canonical URL, search metadata, robots, sitemap, icon, and generated social image |

The analytical module has no React dependency. It can be tested as a pure TypeScript library and moved behind an API or worker without rewriting KPI rules.

## Runtime sequence

1. The server validates `period`, `team`, `category`, and optional demo-state parameters.
2. The browser renders a loading contract before beginning CPU work.
3. A seeded PRNG creates 100,000 typed tickets with no free text or identity fields.
4. A single filter pass selects the active slice; metric and grouping passes derive the evidence shown.
5. Filter changes update the address bar with `history.replaceState`, so the view remains copyable without filling browser history.
6. Table pagination limits rendered nodes. CSV export serializes every row in the current slice only when requested.

## Complexity and performance

- Generation: `O(n)` time and memory.
- Filtering: `O(n)` per filter change.
- KPI aggregation: `O(m)`, where `m` is the selected slice.
- Resolution median: `O(m log m)` because the selected resolution values are sorted.
- Evidence sort: `O(m log m)` only when the table sort changes.
- DOM: at most 10 evidence rows are mounted per page.

CI measures the most demanding built-in path: generation plus a 180-day aggregation over all 100,000 rows. The test budget is 2.5 seconds on a shared GitHub runner; the UI also reports actual generation and aggregation times to make performance visible rather than implied.

## State and failure model

The dashboard has four explicit states:

- `loading`: generation has not completed;
- `ready`: a non-empty analytical slice is available;
- `empty`: filters are valid but no rows match;
- `error`: generation failed and partial metrics are withheld.

The “Preview resilience states” control is part of the public case study. It serializes `demo=empty` or `demo=error`, allowing reviewers to inspect these contracts directly. Retrying the error state clears any partial collection and starts the generator again.

## Security posture

- No authentication, cookies, analytics SDK, API key, or server data store.
- No arbitrary query or expression execution.
- No HTML injection path; insight strings are derived from fixed enum values and numbers.
- Response headers deny framing, disable camera/microphone/location, prevent MIME sniffing, and use a strict referrer policy.
- CSV is composed from typed enums, booleans, numbers, dates, and generated IDs; no spreadsheet formula prefix can enter the dataset.

## Deployment

Vercel runs the standard `next build` output. There are no production environment variables. A deployment can be recreated from a clean clone with `npm ci && npm run build`.
