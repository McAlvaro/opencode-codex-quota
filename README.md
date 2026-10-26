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

## Installation & Setup

### Option 1: Install into OpenCode Plugins Directory (Recommended)

1. Clone the repository into your OpenCode plugins folder:
   ```bash
   git clone https://github.com/McAlvaro/opencode-codex-quota.git ~/.config/opencode/plugins/opencode-codex-quota
   ```

2. Install dependencies and build:
   ```bash
   cd ~/.config/opencode/plugins/opencode-codex-quota
   npm install
   npm run build
   ```

3. Register the plugin in `~/.config/opencode/tui.jsonc` (or project-level `.opencode/tui.jsonc`):
   ```jsonc
   {
     "$schema": "https://opencode.ai/tui.json",
     "plugins": [
       "file://~/.config/opencode/plugins/opencode-codex-quota/dist/index.js"
     ]
   }
   ```

*(Note: Replace `~` with your absolute home path if your environment requires absolute URIs, e.g. `file:///home/username/...`)*

### Option 2: Clone Anywhere & Link

If you already cloned the repository elsewhere:

```bash
git clone https://github.com/McAlvaro/opencode-codex-quota.git
cd opencode-codex-quota
npm install
npm run build
```

Then add the absolute path to your `dist/index.js` into `tui.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugins": [
    "file:///absolute/path/to/opencode-codex-quota/dist/index.js"
  ]
}
```

### 3. Usage
- **Ambient Indicator**: Appears automatically in the sidebar footer and session prompt right displaying `[Codex: 42% | ⏳ 2h 15m | ⚡ 1]`.
- **Slash Command**: Type `/codex-usage` (or `/quota`) in any prompt to inspect metrics or redeem banked rate-limit resets.
