# Portola Operations Dashboard

A high-performance React dashboard built with Next.js to handle live financial transaction streams, batch settlements, and administrative safety gating.

## Technical Highlights

### 1. UX Stability

To prevent accidental clicks during live updates, I implemented a buffered ingest model:

- New transactions are held in `queuedIncomingTransactions` instead of auto-inserting into the grid.
- A non-blocking notification surfaces queued activity until the operator approves insertion.
- This keeps row positions stable and prevents viewport/click-target jumps during active operations.

### 2. Concurrency and Resilience

Batch settlement uses resilient parallel processing:

- `Promise.allSettled()` is used instead of `Promise.all()`.
- **TanStack Query** is used to provide a stack for resolving transaction errors. 
- Partial failures from simulated chaos do not stop successful rows from completing.
- Each row preserves independent status and retryability.

### 3. Super Admin Safety Model

High-value transactions are explicitly gated:

- Transactions at or above `$10,000` are marked as high-value and locked by default.
- A global `superAdminEnabled` toggle is required to unlock those clear actions.
- The UI guard is enforced in both single-row actions and batch/selection behavior.

### 4. Reliability Lesson: DataGrid Interaction Bug

A live interaction bug was resolved in the action cell layer:

- Root cause: DataGrid event propagation/focus movement could cause adjacent-row side effects.
- Fix: action-cell event isolation for pointer, mouse, touch, and keyboard interactions.
- Additional safeguard: per-transaction dedupe/in-flight lock in `clearFunds` prevents rapid duplicate API calls.

## Stack Experience

This project demonstrates hands-on use of:

- **Next.js 16 + React 19 + TypeScript**
- **MUI X Data Grid** for operational table workflows and row-level actions
- **TanStack Query** (`useMutation`) for async mutation state and error flows
- **React Context** for transaction lifecycle/state orchestration
- **Tailwind CSS** for dashboard styling
- **Vitest + Testing Library** for logic/context/UI test coverage
- **Playwright** for settlement script verification
- **Faker** for realistic mixed transaction data generation

## Parallel AI Workflow

Development used a parallel AI worker model for velocity:

1. Frontend worker: UI scaffolding, styling, interaction behavior, and live-feed buffering UX.
2. Backend/state worker: transaction lifecycle logic, settlement orchestration, and resilience controls.
3. Testing worker: parallel regression coverage in Vitest and Playwright.
4. Branching variants: separate branches explored alternate UI layout/interaction designs using my custom built tool.


## Technical Velocity with AI

I used AI tooling (Cursor/Copilot-style workflows) as a force multiplier:

- Rapidly scaffolded baseline Next.js structures and repetitive component wiring.
- Accelerated mock-data and test scaffolding so iteration loops stayed short.
- Focused human time on critical logic: batch resilience (`allSettled`), Super Admin safety gating, DataGrid interaction correctness, and failure handling.

## Setup and Commands

### Prerequisites

- Node.js v18+
- npm

### Installation

```bash
cd portala
npm install
npm run dev
```

App URL: `http://localhost:3000`

### Scripts

- `npm run test`: Run Vitest tests (logic, context, page behavior).
- `npm run test:settlements`: Run Playwright settlement-generator check.
- `npm run generate:settlements:mixed`: Generate 50 realistic mixed transactions via Faker.

## Project Structure

- `app/`: Dashboard UI and layout
- `context/`: Transaction lifecycle state management
- `lib/`: Domain logic and mock API helpers
- `scripts/`: Settlement/data generation scripts
- `tests/`: Vitest and Playwright test coverage
