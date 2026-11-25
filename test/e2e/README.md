# E2E snapshot workflow

Fast, deterministic e2e tests against real Instagram DOM snapshots in a real browser (Chromium), without hitting live Instagram.

## Why

Live Instagram testing is slow, flaky, rate-limited, and requires auth. Instead:

1. **Capture a snapshot manually** while logged into Instagram in a normal browser session.
2. **Replay the snapshot locally** with a cached replay server.
3. **Run the userscript in a real Chromium** via CDP and assert behavior.

## Capture a snapshot

### With browser-ctl (convenient, auto-detect)

```sh
node test/e2e/capture-snapshot.mjs --name dm-thread-sample
```

By default it auto-detects browser-ctl sessions, prefers one with an Instagram Messages tab, archives the active tab, and copies the latest archive. You can also pass `--session <id>` or `--tab <tabId>`.

### Without browser-ctl (manual/portable)

Provide any snapshot directory containing `meta.json`, `page.html`, and `resources/` (the browser-ctl archive format):

```sh
node test/e2e/capture-snapshot.mjs --from /path/to/archive-dir --name dm-thread-sample
```

You can create the archive dir manually, from browser-ctl on another machine, or by copying an existing archive. Snapshots must live inside the repository. Only commit sanitized/synthetic snapshots; never commit personal DMs or private data.

## Run e2e against a snapshot

```sh
npm run build
node test/e2e/run-snapshot.mjs --snapshot test/fixtures/instagram-snapshots/<name> --userscript dist/idmu.user.js
```

Options / env:
- `--artifacts-dir <dir>` - where failure artifacts are saved (default: `test/e2e/artifacts/`)
- `CHROME_BIN` - Chromium binary (default: `chromium`)

On failure, the runner saves `meta.json`, `debug-log.txt`, `state.json`, `dom.html`, and `screenshot.png` to the artifacts dir.

## What it checks (MVP)

- Replay server serves snapshot on the original DM path.
- Userscript injects and renders IDMU menu/status/debug controls.
- `window.__idmuDebug` is installed.
- Onboarding modal appears on first run.

Extend `run-snapshot.mjs` with scenario-specific assertions as snapshots are added.

## Files

- `capture-snapshot.mjs` - copies browser-ctl archive into fixtures.
- `replay-server.mjs` - local cached replay server (rewrites resource URLs to local snapshot files).
- `cdp.mjs` - minimal CDP client.
- `run-snapshot.mjs` - launches Chromium, injects userscript, runs checks.
