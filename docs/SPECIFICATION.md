# Technical Specification & Data Contracts

## 1. Authentication Data Contract

### 1.1. Storage Location
* Primary Path: `$XDG_DATA_HOME/opencode/auth.json` (Defaults to `~/.local/share/opencode/auth.json`).
* Dynamic Resolution via OpenCode TUI SDK: `path.join(api.state.path.state, "auth.json")`.

### 1.2. OpenCode Auth Schema
```json
{
  "openai": {
    "type": "oauth",
    "access": "eyJhbGciOiJSUzI1NiIs...",
    "accountId": "646663a5-5858-4b7e-9fa5-fc427d62f4f8",
    "refresh": "v1.mc...",
    "expires": 1793285657079
  }
}
```

### 1.3. Validation Rules
- `type` must be `"oauth"`.
- `access` must be a non-empty string.
- `accountId` must be a valid UUID string (optional for personal profiles, mandatory for multi-tenant ChatGPT accounts).
- `expires` is an epoch millisecond timestamp. If `Date.now() >= expires - 30000`, the token is deemed expired/stale.

---

## 2. ChatGPT Backend API Contracts

### 2.1. Common Request Headers
Every request directed to `https://chatgpt.com/backend-api/*` must carry:
```http
Authorization: Bearer <access_token>
ChatGPT-Account-Id: <accountId>
User-Agent: codex
Accept: application/json
```

---

### 2.2. Endpoint: Get Quota & Usage
* **URL**: `GET https://chatgpt.com/backend-api/wham/usage`
* **Response Status**: `200 OK`
* **Response Body (Normalized Domain Shape)**:
```json
{
  "rate_limit": {
    "primary_window": {
      "name": "5-hour",
      "limit": 100,
      "used": 42.5,
      "remaining_percent": 57.5,
      "resets_at": 1792439656000
    },
    "weekly_window": {
      "name": "weekly",
      "limit": 1000,
      "used": 280,
      "remaining_percent": 72.0,
      "resets_at": 1792982400000
    }
  },
  "plan_type": "plus"
}
```

---

### 2.3. Endpoint: Get Rate Limit Reset Credits
* **URL**: `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`
* **Response Status**: `200 OK`
* **Response Body (Normalized Domain Shape)**:
```json
{
  "available_count": 1,
  "credits": [
    {
      "id": "crd_01hxyz...",
      "type": "weekly_reset",
      "expires_at": null,
      "status": "available"
    }
  ]
}
```

---

### 2.4. Endpoint: Consume Reset Credit
* **URL**: `POST https://chatgpt.com/backend-api/wham/rate-limit-reset-credits/consume`
* **Request Headers**:
  ```http
  Content-Type: application/json
  ```
* **Request Body**:
```json
{
  "idempotency_key": "consume-rate-limit-reset-1792430000000"
}
```
* **Response Status**:
  * `200 OK`: Reset redeemed successfully.
  * `400 Bad Request`: Invalid payload or no credits available.
  * `429 Too Many Requests`: Reset endpoint throttled.

---

## 3. TypeScript Domain Models

```typescript
export interface OpenCodeAuthStore {
  openai?: {
    type: string;
    access: string;
    accountId?: string;
    refresh?: string;
    expires: number;
  };
}

export interface QuotaWindow {
  name: string;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: number; // epoch ms
}

export interface QuotaTelemetry {
  primaryWindow?: QuotaWindow;
  weeklyWindow?: QuotaWindow;
  availableResetCredits: number;
  lastUpdated: number;
}

export interface ResetConsumptionResult {
  success: boolean;
  message?: string;
  error?: string;
}
```

---

## 4. Error Handling & Recovery Matrix

| Condition | Observed Error / Cause | Action Taken | UI Presentation |
|---|---|---|---|
| Missing Auth File | File not found at `path.state/auth.json` | Abort network calls; return `null` | Slot shows `[Codex: No Auth]` |
| Missing `.openai` key | User logged in with GitHub or other provider | Abort calls gracefully | Slot is hidden or shows `[Codex: Off]` |
| Expired Access Token | `Date.now() >= expires` | Prompt user to trigger a turn in OpenCode (which auto-refreshes token) | Slot shows `[Codex: Expired]` |
| Backend HTTP 401 | Invalid or revoked session token | Mark auth as invalid; back off polling | Toast: "OpenCode OpenAI session requires re-login" |
| Backend HTTP 429 | Rate limit hit on the telemetry endpoint itself | Exponential backoff (min 5 minutes) | Retain last valid snapshot; display stale icon |
| Zero Reset Credits | Developer clicks reset when `available_count === 0` | Disable confirmation button in UI | Dialog button disabled: "No reset credits available" |
