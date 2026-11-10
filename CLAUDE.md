# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (root `web/`, port 5173). Proxies `/api` and `/ws` to `localhost:3000`. Default API is the **mock** (`api.mock.ts`), so the server isn't needed unless `VITE_API=real`.
- `npm start` — Fastify server via `tsx server/index.ts` (port `$PORT` or 3000). Serves `dist/` if built.
- `npm run build` — `tsc --noEmit && VITE_API=real vite build` → `dist/`. This is the typecheck; there is no linter.
- `npm test` — vitest (`server/api.test.ts`, `web/src/timeline.test.ts`, `web/src/planner.test.ts`). Single file: `npx vitest run --root . server/api.test.ts`; single test: add `-t "name"`.
- `npm run geo` — regenerate `web/src/data/japan.json` from world-atlas (`scripts/build-japan.ts`).
- `scripts/*.mjs` are Playwright e2e/screenshot scripts; they expect a server already running (e.g. `e2e.mjs` hits `localhost:3200`).

## Architecture

Collaborative 3D trip planner for Japan: React Three Fiber diorama on the client, Fastify + SQLite + WebSocket on the server. Node >=22.

- **`shared/`** — `types.ts` (`TripData`: trip, stops, legs, activities, flights, hotels…) and `api.ts` (`ApiClient`, `WsMessage`, `Collection`). Imported as `@shared/*` by both sides; the contract between client and server.
- **`server/`** — `index.ts` `buildApp()` (REST under `/api`, `/ws`, static `dist/` with SPA fallback; also the `isMain` entrypoint), `db.ts` (better-sqlite3), `realtime.ts` (`Hub`: in-memory broadcast + presence + heartbeat), `weather.ts`, `seed.ts`. Auth is a shared passphrase + session cookie. In production `SESSION_SECRET`, `TRIP_PASSPHRASE` and `DB_PATH` (volume path, e.g. `/data/trip.db`) are required or startup throws; `TRAVELLER_NAMES` is comma-separated.
- **`web/src/api.ts`** picks `realApi` or `mockApi` on `VITE_API === 'real'`. `realtime.ts` and `api.real.ts` also no-op unless it's `real`. `store.ts` (zustand) holds `data: TripData` (seeded from `data/seed.ts`), selection/camera flags (`fitNonce`, `focusNonce` → `CameraRig`), `plannerOpen` (persisted in localStorage), and is exposed as `window.__store`. WS events call `upsert`/`removeEntity` on it.
- **Timeline** (`timeline.ts`, pure and tested): `stateAt(data, hours)` → position/vehicle/stop for a given hour since `trip.startDate` 00:00 JST, plus day helpers (`dayInfo`, `stopSpans`…). There is no playback: nothing advances time, and the old `tripHours`/play/follow state is gone. Heading convention is documented at the top of the file.
- **Trip planner** (`ui/TripPlanner.tsx`, pure logic in `planner.ts`, tested): the static, collapsible bottom bar (`T` toggles). A fixed ruler for `trip.startDate`→`trip.endDate` with a block per stop; dragging the handle between two blocks moves the shared depart/arrive date (min one night each side) and saves both stops. Clicking a block calls `store.focusStop`. City selection from the map, labels and planner goes through `store.selectStop`/`focusStop` (bumps `selectNonce`, which reopens a hidden city panel even when the same stop is re-selected). Drag previews write both stops in one `store.upsertMany`; `ui/saveStops.ts` then saves them one at a time and rolls back only a stop whose save failed. The header's Calendar button sets `plannerExpanded` (full-screen on phones, taller bar on desktop, Esc closes) and shows `PlannerCalendar.tsx`: month grids (`monthGrid`, `stopsForDay` in `planner.ts`), a day-detail card, and `panel/StopEditor` (add/reorder/remove stops). The store sets `<html data-planner>` (`open`/`closed`/`expanded`). `planner.css` owns `--tl-h` (bar height) which city panels reserve; it switches on `<html data-planner>`.
- **Scene** (`web/src/scene/`): `Diorama` composes `Terrain` (+ `terrain/Sky.tsx` atmosphere, fixed midday sun in `terrain/sun.ts` — no day/night cycle), `Cities`, `Transport`, `CameraRig`, `Presence`. `Transport/` draws `Rails` (network from `data/rails.ts`, routed with `routes.ts` `legRoute`), day-trip `Branches`, and one `ActiveVehicle`: a shinkansen that continuously ping-pongs along the route through all stops, independent of `tripHours`. Geography goes through `geo.ts` `toWorld(lat,lng)` (x east, z south).
- **Transport workspace** (`web/src/ui/transport/`): `/transport` and `/transport/journeys/<encoded-key>` are dedicated intercity-only pages. `transport/viewModel.ts` supplies the same saved services, transfer times, booking details and arrangement status to the workspace, Today and city arrival panels. `JourneyEditor` handles explicit saves and dirty/conflict guards; `nav.ts` guards internal and browser Back navigation. Airport/day-trip/pass records remain stored but are excluded from workspace tasks. See `transport/README.md` for behavior and browser checks.
- **UI** (`web/src/ui/`): overlays/panels (city panel, logistics drawer, trip planner) over the canvas. `?play=<part>` (`dev/Playground.tsx`, `transport`, `cities`) renders a part in isolation for development.

## Deploy

Deploys are manual and never part of the agent workflow — do not run `railway up` or any other deploy command unless explicitly asked. Git remote `origin` is the project's GitHub repo.

## Workflow (required)

For every new piece of work:

1. Before making any changes, create a new branch off an up-to-date `main` (or a worktree on a new branch). Never commit directly to `main`.
2. When the work is complete, run `npm run build` (typecheck + build) and `npm test`.
3. Commit, push the branch to `origin`, and open a pull request into `main` (`gh pr create --base main`). Don't wait to be asked.

Never push to `main`, force-push, or merge the PR yourself. If the branch falls behind, merge `origin/main` into it (resolve conflicts, re-run the build) and push again.
