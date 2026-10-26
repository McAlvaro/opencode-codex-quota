# Implementation Roadmap & Planning

This document defines the strict, phased execution plan for **`opencode-codex-quota`**. Development follows Clean Architecture and strict Test-Driven Development (TDD) for business logic and data adapters.

---

## 1. Project Phases & Milestones

```
Phase 1 (Setup) ──> Phase 2 (Data & Auth) ──> Phase 3 (Actions) ──> Phase 4 (TUI Slot) ──> Phase 5 (Modals & CLI) ──> Phase 6 (E2E & Delivery)
```

---

### Phase 1: Environment & Project Foundation
* **Goal**: Scaffold package configuration, TypeScript compiler options, and testing harness.
* **Tasks**:
  - Initialize `package.json` with dependencies (`@opencode-ai/plugin`, `@opentui/core`, `@opentui/solid`, `zod`, `vitest`).
  - Configure `tsconfig.json` for ESM and JSX Solid support.
  - Setup Vitest test runner with fake timer support.
* **Deliverable**: Clean `npm test` passing with baseline sanity test.

---

### Phase 2: Auth Provider & Telemetry Client (TDD)
* **Goal**: Isolate and test credential ingestion and remote API polling.
* **Tasks**:
  - `src/auth/provider.ts`:
    - Read `~/.local/share/opencode/auth.json`.
    - Handle missing file, missing `.openai`, expired tokens, and valid credentials.
    - Comprehensive unit tests covering all filesystem edge cases.
  - `src/telemetry/client.ts`:
    - Implement `GET /backend-api/wham/usage` parser.
    - Implement `GET /backend-api/wham/rate-limit-reset-credits` parser.
    - In-memory cache with 60s TTL.
    - Unit tests mocking HTTP responses, 401s, 429s, and cache invalidation.
* **Deliverable**: 100% test coverage on Auth and Telemetry modules.

---

### Phase 3: Quota Reset Controller (TDD)
* **Goal**: Secure mutation logic for consuming banked resets.
* **Tasks**:
  - `src/actions/reset-controller.ts`:
    - Verify `available_count > 0` before making requests.
    - Generate deterministic `idempotency_key` timestamps.
    - Execute `POST /backend-api/wham/rate-limit-reset-credits/consume`.
    - Flush telemetry cache upon successful response.
    - Unit tests testing success, zero credits guard, and API errors.
* **Deliverable**: Fully tested reset business logic.

---

### Phase 4: Ambient TUI Slot Integration
* **Goal**: Render real-time indicators directly inside OpenCode's TUI.
* **Tasks**:
  - `src/tui/widget.tsx`:
    - Create Solid component for OpenTUI rendering quota percentage and time-to-reset.
    - Format compact string: `[Codex: 42% | ⏳ 2h 15m | ⚡ 1]`.
    - Apply conditional styling based on threshold (green < 70%, yellow 70-85%, red > 85%).
  - Connect widget to `sidebar_footer` or `session_prompt_right` slot via `api.slots.register`.
* **Deliverable**: Visual indicator visible in OpenCode's sidebar/prompt.

---

### Phase 5: Slash Command & Interactive Dialogs
* **Goal**: Give the developer direct control to inspect and trigger resets.
* **Tasks**:
  - `src/tui/commands.ts`:
    - Register `/codex-usage` slash command via `api.command.register`.
    - Connect command to `api.ui.DialogSelect` showing detailed breakdown (5h window, weekly window, reset credits).
  - `src/tui/reset-dialog.ts`:
    - If user selects "Redeem Reset", trigger `api.ui.DialogConfirm`.
    - Upon developer confirmation, invoke `ResetController.consume()`.
    - Display `api.ui.toast` with result.
* **Deliverable**: End-to-end interactive reset flow inside OpenCode.

---

### Phase 6: System Registration & End-to-End Verification
* **Goal**: Connect plugin to user's global OpenCode configuration.
* **Tasks**:
  - Build/bundle plugin into ESM distribution.
  - Register plugin path in `~/.config/opencode/tui.jsonc`.
  - Manual verification checklist:
    1. Launch OpenCode TUI.
    2. Confirm telemetry badge renders in `sidebar_footer`.
    3. Run `/codex-usage` in prompt.
    4. Verify dialog renders correct stats matching `curl`.
    5. Test graceful degradation when offline or unauthenticated.
* **Deliverable**: Production-ready, installed OpenCode plugin.

---

## 2. Testing & Quality Assurance Strategy

1. **Unit Tests (Vitest)**:
   - File system mocking for `auth.json`.
   - MSW (Mock Service Worker) or `fetch` mocking for ChatGPT backend endpoints.
   - Time-mocking with `vi.useFakeTimers()` to verify cache expiration and rolling reset window calculations.
2. **Type Safety**:
   - Zero `any` types; all API responses strictly validated or parsed via domain interfaces.
3. **No Regressions on OpenCode**:
   - TUI error boundaries wrapping the slot to ensure that even on catastrophic network failure, OpenCode's core editor and session remain 100% operational.
