# Runware AI Generator — Eagle Plugin

An Eagle window plugin scaffold for generating images via the Runware AI API.

Built with Vite + React + TypeScript + Tailwind.

## Requirements

- Eagle 4.0+ (Developer Mode enabled)
- Node.js 18+
- npm 9+

## Setup

```sh
npm install
```

## Build

```sh
npm run build
```

Output is written to `dist/` with relative asset paths (`base: './'`) so it
loads correctly under Electron's `file://` protocol.

## Develop

For iterating on UI inside a normal browser:

```sh
npm run dev
```

For iterating inside Eagle, run `npm run build` and reload the plugin in
Eagle's plugin manager. Eagle's `eagle` global is only available when running
inside Eagle, so some features will no-op in a plain browser.

## Load into Eagle

1. Run `npm run build`.
2. Open **Eagle → Preferences → Plugins**.
3. Switch on **Developer Mode**.
4. Click **Import Local Project** and select this folder (the one containing
   `manifest.json`).
5. The plugin will appear in Eagle's plugin list. Open it to launch the
   window. Press **F12** to open DevTools.

You should see a window titled "Runware AI Generator" and a console log line
like `[Runware] Plugin created at <ISO timestamp>` once `eagle.onPluginCreate`
fires.

## Package for Distribution

```sh
npm run package
```

This runs the production build and zips `manifest.json`, `logo.png`,
`README.md`, and `dist/` into `runware-ai-generator-<version>.eagleplugin`,
ready to share. Requires the `zip` CLI on PATH (preinstalled on macOS and
Linux; on Windows use WSL or install a zip utility).

## Project Layout

```
manifest.json        # Eagle plugin manifest (window plugin)
logo.png             # 128x128 plugin icon
index.html           # Vite entry — loaded by Eagle as dist/index.html
src/
  main.tsx           # React entry
  App.tsx            # Root component + eagle.onPluginCreate heartbeat
  eagle.d.ts         # Minimal ambient types for the Eagle global
  index.css          # Tailwind base
scripts/package.mjs  # Builds the .eagleplugin archive
vite.config.ts       # base: './', outDir: 'dist'
tailwind.config.js
postcss.config.js
tsconfig.json
```

## References

- Plugin types: <https://developer.eagle.cool/plugin-api/get-started/plugin-types>
- Manifest: <https://developer.eagle.cool/plugin-api/tutorial/manifest>
- Debugging: <https://developer.eagle.cool/plugin-api/get-started/debugging>
