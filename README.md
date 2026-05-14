# Runware AI Generator — Eagle Plugin

An Eagle window plugin for generating images via the [Runware](https://runware.ai)
AI API. Submit a prompt (with optional reference images from your Eagle library,
uploads, or drag-and-drop), stream results, and save the picks back into Eagle
with tags, a folder destination, an annotation, and a star rating.

Built with Vite + React + TypeScript + Tailwind. Targets Eagle 4.0+ in
Developer Mode.

## Supported models

| Model           | AIR identifier     | Max refs | Max prompt |
|-----------------|--------------------|----------|------------|
| Nano Banana Pro | `google:4@2`       | 14       | 45 000 chars |
| GPT Image 2     | `openai:gpt-image@2` | 16     | 32 000 chars |

Output formats: PNG, WEBP, JPG. Number of results per job: 1–20.

- **Nano Banana Pro** uses preset resolutions (1K / 2K / 4K) and an aspect ratio
  (1:1 through 21:9). Extras: temperature, top‑P, safety tolerance, web search,
  system prompt.
- **GPT Image 2** uses explicit width × height, snapped to 16px and clamped to
  480–3840 with at most a 3:1 aspect ratio. Extras: quality, moderation.

Switching models preserves prompt, seed, and references; the reference cap is
re-evaluated and a warning fires if you would lose references on the new model.

## Install — from an `.eagleplugin` file

For end users who just want to run the plugin:

1. Download `eagle-runware-<version>.eagleplugin`.
2. Double-click it. Eagle will prompt to install — confirm. The plugin
   appears in Eagle's plugin list; launch it to open the window.

If double-click doesn't work (e.g. the file is associated with another app),
open Eagle and drag the `.eagleplugin` into the plugin window, or unzip it
manually (it's a zip archive) and follow the **Import Local Project** flow in
the next section.

## Install — from source

For development or a freshly cloned checkout:

```sh
npm install
npm run build
```

Then in Eagle:

1. **Eagle → Preferences → Plugins → Developer Mode** on.
2. **Import Local Project** → pick the project folder (the one with
   `manifest.json`).
3. Open the plugin from Eagle's plugin list.

`npm run build` writes self-contained output to `dist/` using relative asset
paths (`base: './'`) so the bundle loads under Electron's `file://` protocol.

### Develop

```sh
npm run dev
```

For UI iteration in a normal browser. The `eagle` global is only available
inside Eagle, so anything that calls it (library access, save-to-Eagle, folder
listing) is a no-op in a plain browser. For end-to-end work, run
`npm run build` and reload the plugin in Eagle's plugin manager.

## Where keys and settings live

The Runware API key, default model, default tags, default save folder, output
format, and number-of-results are stored in `localStorage` under
`runware-plugin:settings:v1`, scoped to the plugin window. The key is sent
directly to Runware and never leaves your machine otherwise.

To clear keys, open the Settings drawer (gear icon in the top bar) → **Clear**
next to the API key, then **Save**. To wipe everything, open DevTools (F12)
and run `localStorage.clear()`.

## Package for distribution

```sh
npm run package
```

This runs the production build and bundles just the runtime files
(`manifest.json`, `logo.png`, `dist/`) into
`eagle-runware-<version>.eagleplugin` (a zip archive with Eagle's extension).
`node_modules/`, `.git/`, sources, configs, and sourcemaps are excluded.

A consumer can double-click the `.eagleplugin` to install, or unzip it and
**Import Local Project** the folder — no build step required either way.

Requires the `zip` CLI on PATH (preinstalled on macOS and Linux; on Windows use
WSL or install a zip utility).

## Known limits

- Eagle's plugin window cannot be opened as multiple instances simultaneously
  (`manifest.json: multiple: false`). Jobs are scoped to that single window.
- Settings are per-window/library; the API key does not roam across machines.
- Reference images are sent as base64 data URIs, so very large uploads can
  bloat the request payload. Stick to reasonable source sizes.
- GPT Image 2 rejects extreme aspect ratios (>3:1) and non-16px dimensions —
  the UI snaps these but external requests passed through must comply.
- Cancelling a running job halts UI progress immediately, but Runware may have
  already started provider billing for partial results. The status bar shows
  what was delivered before the cancel.

## Troubleshooting

**Open DevTools.** With the plugin window focused, press `F12` (or `Cmd+Opt+I`
on macOS). The console is the fastest source of truth — every job logs its
request and result, and Eagle API calls log warnings on failure.

**"Set your Runware API key in Settings to generate."** — Settings drawer is
empty. Paste a key starting with `rw-…`, click **Test connection**, then
**Save**.

**"Invalid API key"** banner mid-generation — the key was wrong, revoked, or
the account is out of credits. The Settings drawer auto-opens the first time
this error fires for a job.

**"Rate limit or quota reached"** — Runware is throttling. The error banner
shows a retry hint; if a `retry-after` header was returned, retry is delayed
by that amount.

**"Network error" / generation hangs** — check Wi-Fi. The plugin retries
transient WebSocket failures and surfaces a reconnect message; once
connectivity is back, the **Retry** button on the error banner resubmits the
last job without losing prompt/refs/settings.

**Plugin window is blank** — open DevTools and check the Console for module
errors. The most common cause is opening the plugin without running
`npm run build` after a code change, leaving `dist/` stale or missing.

**"Eagle API not available — running outside Eagle"** — you opened
`dist/index.html` directly in a browser. The plugin only has access to the
Eagle library when launched through Eagle.

**Generated image didn't save to Eagle** — check the toast for the actual
error. Usually one of: chosen folder was deleted, Eagle ran out of disk space,
or the library was locked by another sync client.

## Manual E2E checklist

Run the full suite after any change that touches generation, saving, or
settings persistence. All steps assume the plugin loaded into Eagle in
Developer Mode with DevTools open.

1. **First-run setup**
   - Open the plugin → open Settings (gear).
   - Paste a valid Runware API key → click **Test connection** → expect
     `✓ Connected as <account>` (or equivalent success message).
   - **Save**. Confirm the gear's red dot disappears.

2. **Nano Banana Pro — prompt-only, 1K square**
   - Model: Nano Banana Pro. Resolution: 1K. Aspect: 1:1. Results: 1.
   - Enter a prompt (e.g. the smoke prompt in `App.tsx`).
   - **Generate**. Watch the status bar count `1/1`, see the image appear in
     the results grid.
   - Click the result → **Save to Eagle** → add 2–3 tags → 5★ rating → Save.
   - Verify in Eagle library: item exists, tags applied, rating = 5★,
     annotation contains the prompt + seed.

3. **Nano Banana Pro — 3 library refs + 1 uploaded ref, 2 results**
   - Select 3 images in the Eagle library, then in the plugin click
     **Add from library** → confirm 3 chips appear.
   - Drag-and-drop or **Upload** a 4th reference from disk.
   - Set results to 2, generate.
   - Confirm both results stream into the grid (one finishes first).
   - Save **both** to a non-default Eagle folder (pick from the folder
     dropdown). Verify both land in that folder.

4. **GPT Image 2 — 2560×1440 prompt-only**
   - Switch model to GPT Image 2. Width: 2560, Height: 1440. Results: 1.
   - Generate. Save the result.
   - Open the saved item's annotation in Eagle → confirm it contains the
     prompt and the seed value used.

5. **Switch models mid-session**
   - Start on Nano Banana Pro with a prompt, seed, and 14 references.
   - Switch to GPT Image 2.
   - Confirm: prompt preserved, seed preserved, params re-mapped (1K/aspect
     becomes width/height), reference cap warning if refs > 16 (n/a here),
     and the inverse case — load 16 refs on GPT Image 2 and switch back to
     Nano Banana Pro — fires the cap warning because 16 > 14.

6. **Invalid API key**
   - Settings → replace key with `rw-bogus-key` → Save.
   - Generate. Expect: red banner "Invalid API key", Settings drawer
     auto-opens. Console shows the auth error mapped to bucket `auth`. No
     uncaught exceptions.

7. **Network disconnect mid-job**
   - Submit a 4-result job. While it's running, disable Wi-Fi.
   - Expect: status bar transitions to a network/timeout error after retries
     are exhausted, banner offers **Retry**.
   - Re-enable Wi-Fi. Click **Retry**. Confirm the job resumes/restarts
     cleanly and partial results that were delivered earlier are still
     visible in the grid.

**Acceptance criteria for shipping**: a freshly cloned checkout can
`npm i && npm run build`, drag the resulting folder into Eagle's
**Import Local Project**, and complete steps 1–4 above without a single
red entry in DevTools' console.

## Project layout

```
manifest.json        # Eagle plugin manifest (window plugin, dist/index.html)
logo.png             # 128×128 plugin icon
index.html           # Vite entry — bundled into dist/index.html
src/
  main.tsx           # React entry
  App.tsx            # Root layout, job lifecycle, keyboard shortcuts
  eagle.d.ts         # Ambient types for the Eagle global
  components/        # TopBar, PromptPanel, ReferenceStrip, ResultsGrid, etc.
  lib/               # runware client, errors, models, settings, eagle bridge
  state/             # jobs + saves stores
scripts/package.mjs  # Builds eagle-runware-<version>.eagleplugin
vite.config.ts       # base: './', outDir: 'dist'
```

## References

- Plugin types: <https://developer.eagle.cool/plugin-api/get-started/plugin-types>
- Manifest: <https://developer.eagle.cool/plugin-api/tutorial/manifest>
- Debugging: <https://developer.eagle.cool/plugin-api/get-started/debugging>
- Runware API: <https://runware.ai/docs>
