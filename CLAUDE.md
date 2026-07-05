# Project: TODO by TEAMBATTLE

## Stack
- React 18 + Vite + inline styles (no Tailwind)
- Supabase (realtime database, auth, storage)
- Shared Supabase project `ilbjytyukicbssqftmma` with FLOW app
- Hosted at Netlify

## Key conventions
- All UI in Danish (da-DK locale)
- Single-file architecture: most components live in `src/App.tsx`
- Hooks per data domain: `useTodos`, `usePhoneCalls`, `useShopping`, `useTransport`, `useSkilte`, `useLists`, `useSessionJobs`, `useSessionTemplates`
- Inline styles using color constants from `const C = {...}` at top of App.tsx
- Realtime subscriptions on all Supabase tables via `postgres_changes`
- Dark theme only, no light mode
- Git: always commit freely, but ONLY `git push` or deploy when explicitly asked — otherwise just commit
- Dev server: `npm run dev` (Vite, port 5174, falls back to 5175 if taken)

## Shared database tables
- `skilte` table is shared between TODO and FLOW apps (synced view)
- `task_jobs` table is shared with FLOW — used by Sessions view (read-only, 99 columns)
- `activities` table is shared with FLOW — activity definitions (A1=TeamChallenge, A2=TeamLazer, etc.)
- `session_todo_templates` table stores per-activity todo checklists that auto-insert when a job is accepted
- DB trigger `handle_session_todo` on `task_jobs`: auto-creates template todos on status→accepteret, deletes on afvist/deleted, syncs on activity changes
- All other tables (`todos`, `phone_calls`, `todo_shopping`, `transport_items`, `custom_lists`, `list_sections`) are TODO-specific

## Active patterns
- Built-in views: today, week, upcoming, inbox, thomas, maria, crew, phone, skilte, code, repair, transport, shop, ideas, sessions
- Custom lists stored in `custom_lists` table, items are `todos` with `category = "custom:{list_id}"`
- View state managed via `nuqs` (URL query params)
- QuickCreate modal (Ctrl+K or plain N) for fast task creation
- QuickCall modal for fast phone call creation

## Known issues / gotchas
- Vite has port 5174 hardcoded in `vite.config.ts`, `.claude/launch.json` uses port 5175 as fallback
- Old "SKILTE MANGLER" custom list may still exist alongside the new built-in `skilte` view — user should delete the custom list manually
- FLOW's Excel-sync creates `task_jobs` with status `scheduled`/`active` (English) — the DB trigger `handle_session_todo` still only fires on status→`accepteret`, so template todos are NOT auto-created for Excel-synced jobs (pending decision)
- Dates: ALWAYS use `localDateStr()` from `lib/utils` for YYYY-MM-DD strings — `toISOString().slice(0,10)` gives the UTC date and is wrong between midnight and 01/02 Danish time
- ESLint has ~84 pre-existing errors (`no-explicit-any`, strict `react-hooks` rules) — the deploy gate is `npm run build` (tsc + vite), which must be green

## Recent decisions
- Session-todos (`category = "session:*"`) and ideas are EXCLUDED from the generic views (I dag / Denne uge / Kommende / Indbakke) — they live in their own views; shared predicate `isPlainTask` in App.tsx
- Sessions view shows statuses `scheduled`/`active` (FLOW's current vocabulary) plus legacy `sendt`/`accepteret`/`aktiv`/`confirmed`
- Table conversions (todo↔shop↔call↔transport) pass the modal's current draft values and never delete the original row if the insert failed
- Sessions view reads from `task_jobs` table (shared with FLOW), todos stored in `todos` table with `category = "session:{job_id}"`
- Sessions view groups jobs by ISO week, auto-collapses past weeks, search by client/job-ID/location/date
- Skilte mangler view reads directly from `skilte` table (shared with FLOW) instead of using custom list todos
- PhoneCallCard displays `created_at` timestamp
- QuickCall button added to sidebar above Tilføj Opgave

## Self-maintenance instructions

After completing any significant task, automatically update this CLAUDE.md file if:
- A new pattern, convention, or architectural decision was established
- A recurring problem was solved in a way worth remembering
- A new tool, library, or integration was added to the project
- You discovered something about the codebase structure worth noting

Keep entries concise. Remove outdated entries. Never ask for permission to update this file.

## URL-tilstand: nuqs som standard

Brug **nuqs** som standardvalg til al "URL-værdig" tilstand i alle projekter
(React + Vite / React Router). Wrap app'en i den rette NuqsAdapter.

✅ BRUG nuqs til: filtre, faner, søgeord, paginering, valgt element, wizard-trin
   → så links kan deles/bogmærkes, tilbage-knappen virker, og reload bevarer tilstanden.

❌ BRUG IKKE nuqs til:
   - Flygtig UI-tilstand (åben menu, hover, uafsendt formular) → lokal state (useState).
   - Server-data (Supabase) → dataLaget/React Query, ikke URL.
   - Følsomme data → ALDRIG i URL'en (logges/deles = privacy-fælde).
   - Realtids/tunge data (fx GPS-spillets live-position, svar, billeder, videoklip)
     → gentagne URL-opdateringer giver performance-problemer. Hold det ude af URL'en.

Tommelfinger: skal tilstanden kunne deles via et link og overleve en reload?
→ nuqs. Ellers ikke.

## Datahentning fra Supabase

Hent ALTID data gennem et data-lag (TanStack/React Query) — aldrig løse fetch-kald
spredt i komponenterne. Det giver caching, automatisk genhentning og ét sted at rette.

✅ ALTID:
   - Vis tydelig loading- OG fejl-tilstand. Intet må "hænge" uden feedback til brugeren.
   - Hent kun de kolonner/rækker der bruges (undgå SELECT *), og undgå N+1 (hent i ét kald).
   - Stol på RLS som sikkerhedslag — filtrér ikke kun i frontend.
   - Brug realtime/subscriptions sparsomt — kun hvor live-opdatering giver reel værdi.

❌ ALDRIG:
   - Læg forretningslogik/adgangskontrol i frontend alene.
   - Hent hele tabeller for at filtrere i browseren.

Tommelfinger: én kilde til data (query-laget), tydelige tilstande, mindst mulig data hentet.
