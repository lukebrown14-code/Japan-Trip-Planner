# Between-city transport

The manual transport workspace lives at `/transport`; journey links use `/transport/journeys/<encoded-key>`. It includes only consecutive city-to-city journeys. Airport, day-trip, flight and pass records are retained and excluded from its counts and booking tasks. There is no live route, fare or timetable search.

`viewModel.ts` is the shared presentation model for the workspace, Today, city arrival cards and booking links. Saved service arrays are authoritative, including an explicitly empty array. Legacy records without a service array fall back to leg details, without inventing service times from the scene rail graph. Arrangement status is separate from missing travel details; changed itinerary snapshots require explicit review.

Services store optional references, seats, instructions, an editable HTTP(S) booking URL and explicit departure/arrival day offsets. Booking and ticket links open the operator website in a new tab; they do not imply a reservation has been made. Offsets default to zero for existing records; known legacy overnight legs receive a derived following-day arrival. Transfer intervals are calculated only from saved times/days. Unknown times stay unknown, and overlapping connections receive a warning. Optional fields are additive inside the existing segment JSON, so no destructive database migration is needed.

The editor saves explicitly through the existing REST/WebSocket collections. Failed saves keep drafts. Dirty navigation offers Save, Discard or Keep editing, and native refresh uses the browser's unsaved-change prompt. Incoming booking or itinerary updates preserve drafts and require an explicit reload/overwrite choice. Ordinary editing does not silently acknowledge changed bookings. Removing all services or clearing optional details does not restore stale leg data.

`planner.ts` retains the broader journey/pass helpers for compatibility; maintained operator advice in `catalogue.ts` is not rendered as a timetable or route recommendation by this workspace. `progress.ts` generates intercity-only booking tasks, retaining unmatched city bookings for review.

Validation:

- `npm run build` and `npm test`.
- Start mock Vite on port 5180 and run `node scripts/transport-check.mjs` (override `TRANSPORT_PREVIEW_URL`) for responsive layouts, draft guards, retry, persistence, conflict and removed-journey checks.
- Start a real built server on port 3218 with an **isolated temporary database**, passphrase `transport-local-check`, and travellers Luke/Partner; run `node scripts/transport-live-check.mjs`. Override `TRANSPORT_LIVE_URL` and `TRANSPORT_TEST_PASSPHRASE` as needed. This check edits test bookings; never run it against a real trip database.

The October 2026 reservation import runs once for matching existing itineraries, both in SQLite on server startup and in cached mock trips. It includes all supplied bookings and the final Hakone → Tokyo journey on 5 November. The import preserves unrelated trip data and uses a persistent version marker so subsequent edits and deletions are not undone on restart. This is separate from new-trip seeding; existing trips do not need to be reset or manually re-entered.
