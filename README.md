## Portola Overview

`Portola` contains a Next.js app (`portala`) that simulates settlement activity with queued live updates and manual approval workflows.

### Project Structure

- `portala/app/` - UI routes, main dashboard page, app layout/providers
- `portala/context/` - React Context state container for transaction lifecycle
- `portala/lib/` - transaction/domain logic and mock API helpers
- `portala/scripts/` - Node + Faker data generators (including mixed amount profiles)
- `portala/tests/` - Vitest + RTL tests and Playwright checks
- `.specstory/` - AI session history and project-level interaction artifacts

### Approach (from `.specstory` sessions)

- Start with script-first data generation using Faker, then plug into UI state.
- Centralize transaction state in React Context for shared, testable behavior.
- Use staged live-ingest: queue incoming rows, show banner, apply only on user approval.
- Keep UX safe under live updates (scroll anchoring + explicit allow actions).
- Back behavior with focused tests for logic, context state, page UX, and generator output.

### Startup

1. `cd portala`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3000`

Optional commands:
- `npm run test` (Vitest suite)
- `npm run test:settlements` (Playwright settlement generator check)
- `npm run generate:settlements:mixed` (prints 50 mixed mock transactions)