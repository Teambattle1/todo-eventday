# Project: TODO by TEAMBATTLE

## Stack
- React 18 + Vite + inline styles (no Tailwind)
- Supabase (realtime database, auth, storage)
- Shared Supabase project `ilbjytyukicbssqftmma` with FLOW app
- Hosted at Netlify

## Key conventions
- All UI in Danish (da-DK locale)
- Single-file architecture: most components live in `src/App.tsx`
- Hooks per data domain: `useTodos`, `usePhoneCalls`, `useShopping`, `useTransport`, `useSkilte`, `useLists`
- Inline styles using color constants from `const C = {...}` at top of App.tsx
- Realtime subscriptions on all Supabase tables via `postgres_changes`
- Dark theme only, no light mode
- Git: always commit freely, but ONLY `git push` or deploy when explicitly asked — otherwise just commit
- Dev server: `npm run dev` (Vite, port 5174, falls back to 5175 if taken)

## Shared database tables
- `skilte` table is shared between TODO and FLOW apps (synced view)
- All other tables (`todos`, `phone_calls`, `todo_shopping`, `transport_items`, `custom_lists`, `list_sections`) are TODO-specific

## Active patterns
- Built-in views: today, week, upcoming, inbox, thomas, maria, crew, phone, skilte, code, repair, transport, shop, ideas
- Custom lists stored in `custom_lists` table, items are `todos` with `category = "custom:{list_id}"`
- View state managed via `nuqs` (URL query params)
- QuickCreate modal (Ctrl+N) for fast task creation
- QuickCall modal for fast phone call creation

## Known issues / gotchas
- Vite has port 5174 hardcoded in `vite.config.ts`, `.claude/launch.json` uses port 5175 as fallback
- Old "SKILTE MANGLER" custom list may still exist alongside the new built-in `skilte` view — user should delete the custom list manually

## Recent decisions
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
