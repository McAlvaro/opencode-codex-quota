# OpenCode Codex Quota Plugin (`opencode-codex-quota`)

A native OpenCode TUI plugin to monitor ChatGPT Codex subscription quota, 5-hour rolling windows, weekly limits, and trigger on-demand rate-limit resets directly from OpenCode.

## Overview

When using OpenCode with ChatGPT / OpenAI Codex subscription credentials, agentic workloads can rapidly consume 5-hour rolling windows. This plugin bridges OpenCode's internal OAuth session with ChatGPT's backend telemetry, presenting real-time quota rings in the TUI statusline/sidebar and providing interactive commands for on-demand resets.

## Key Features

- **Passive Quota Telemetry**: Live indicators in the OpenCode TUI (`sidebar_footer` / `session_prompt_right`) displaying the 5-hour window consumption percentage, time to reset, and available reset credits.
- **Self-Contained Authentication**: Reads directly from OpenCode's own state store (`~/.local/share/opencode/auth.json`), eliminating external dependencies on Codex CLI or manual token copying.
- **On-Demand Quota Resets**: Interactive `/codex-usage` slash command and modal dialogs to inspect granular metrics and redeem banked rate-limit reset credits safely.
- **Proactive Notifications**: Toast alerts when consumption reaches configurable thresholds (e.g., 85% and 95%).

## Documentation

- [Architecture & Design](docs/ARCHITECTURE.md)
- [Technical Specification & API Contracts](docs/SPECIFICATION.md)
- [Implementation Roadmap & Tasks](docs/PLANNING.md)

## Installation

Add the plugin to your OpenCode configuration file (typically located at `~/.config/opencode/opencode.json`):

### Direct from GitHub

#### OpenCode V1:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codex-quota@github:McAlvaro/opencode-codex-quota"]
}
```

#### OpenCode V2:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-codex-quota@github:McAlvaro/opencode-codex-quota"]
}
```

---

### From npm (once published)

#### OpenCode V1:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codex-quota@latest"]
}
```

#### OpenCode V2:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-codex-quota@latest"]
}
```

---

### Local / Manual Installation

If you prefer to clone and link locally:

```bash
git clone https://github.com/McAlvaro/opencode-codex-quota.git ~/.config/opencode/plugins/opencode-codex-quota
cd ~/.config/opencode/plugins/opencode-codex-quota
npm install
npm run build
```

Then register it in your `~/.config/opencode/tui.jsonc`:
```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugins": [
    "file://~/.config/opencode/plugins/opencode-codex-quota/dist/index.js"
  ]
}
```

### 3. Usage
- **Ambient Indicator**: Appears automatically in the sidebar footer and session prompt right displaying `[Codex: 42% | ⏳ 2h 15m | ⚡ 1]`.
- **Slash Command**: Type `/codex-usage` (or `/quota`) in any prompt to inspect metrics or redeem banked rate-limit resets.
