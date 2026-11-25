## 0.7.3 — 2026-11-25

- Improve the on-screen UI: compact menu layout, debug panel, and debug report copy
- Add light/dark theme-aware styling for menu, panels, and buttons
- Add first-install onboarding modal explaining how unsending works
- Show removal-order badges on messages while unsending and lighten the blocking overlay
- Add DOM debugging tools: `window.__idmuDebug` helpers (snapshot, probe selectors, highlight action buttons, probe unsend menu) and live debug log
- Harden unsend flow: safer stale overlay dismissal, better confirm-button selection, case-insensitive action button fallback, scrollIntoView before hover, longer unsend validation delay, and stronger sent-by-current-user heuristics
- Document DOM debugging workflow in README and user manual

# Changelog

Shown in the "What's new" panel of the userscript.

## Unreleased — 2026-11-25
- The interface follows the page language and falls back to English; the "Unsend" menu label is recognised in more languages
- The status line shows live progress: unsent and failed counts during a run
- "What's new" button lists the changes of each version
