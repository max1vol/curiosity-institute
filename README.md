# The Curiosity Institute

The Curiosity Institute is now a Year 6 learning game built on top of the same direct-avatar museum floor.

The player is still the curator moving in real time through the building, but the progression loop is now curriculum-led: hard study rounds award diplomas, diplomas unlock new rooms without being spent, and failed work can create rewrite quests that reward paper, ink, and revision tokens.

## Core Fantasy

The game should feel like:

- walking through a tactile 3D school-museum hybrid instead of navigating flat menus
- earning progress through hard Year 6 work rather than buying everything with currency
- unlocking study wings through diploma milestones while keeping coin pickups for ambient floor energy
- turning mistakes into concrete follow-up quests such as rewriting on paper or reworking an answer you cannot edit again
- using immersive splat rooms and generated art to make the curriculum world feel alive

## Main Gameplay Loop

1. Guide the curator through the Year 6 floor in a top-down 3D view.
2. Enter challenge hubs or queued study alerts to launch a weighted random hard round.
3. Clear MCQ, quiz, free-text, and match-pairs activities to earn diplomas and reputation.
4. Unlock new rooms when you reach diploma gates; diplomas remain on your record and are never spent.
5. Use quest rewards such as paper, ink, and revision tokens to upgrade rooms and keep progression moving.

## Study System

Every prompted study round comes from the generated Year 6 curriculum deck with this weighted mix:

- `quiz`: 50%
- `free-text`: 25%
- `mcq`: 20%
- `match-pairs`: 5%

Failure paths can generate quests based on the work that went wrong, including rewrite-on-paper style tasks and locked-topic recovery tasks.

The quest deck now also separates plain resource tests, adaptive mastery quests, and final diploma tests. Resource tests earn paper, ink, and revision tokens. Mastery quests are meant to be personalized follow-ups based on the learner's performance. Final tests award the diploma when passed.

## Three Main 3D Gameplay Directions

These three concept images show the same gameplay idea with clearly different visual languages:

- portrait mobile framing
- direct control of the curator
- floating coin pickups
- active exhibit or public room space
- visible locked future expansion
- incoming public-question call event

### Direction 1: Heritage Hall

- dark green striped walls
- pale parquet floors
- burgundy runner
- brass lamps and trim
- warm heritage-museum atmosphere

![Direction 1: Heritage Hall](docs/concept-art/gameplay-directions/direction-1-heritage-hall.png)

### Direction 2: Marble Atrium

- white stone and marble architecture
- skylit upper structure
- teal runner
- brighter daylight mood
- formal institutional feeling

![Direction 2: Marble Atrium](docs/concept-art/gameplay-directions/direction-2-marble-atrium.png)

### Direction 3: Glasshouse Museum

- brass-framed glass partitions
- terracotta and pale stone flooring
- indoor plants and warm daylight
- softer modern museum mood
- central rotunda hub instead of a straight corridor

![Direction 3: Glasshouse Museum](docs/concept-art/gameplay-directions/direction-3-glasshouse-museum.png)

## 3D Render Pipeline

This repo also contains a runnable Node pipeline that takes the tracked concept art in `docs/concept-art/`, sends each piece to a Google Gemini image model, and produces a three-view intersecting oblique 3D-map library per source image.

What it does:

- reads all concept-art images under `docs/concept-art/`
- generates exactly three directional outputs per image:
  - `northwest-oblique`
  - `northeast-oblique`
  - `southwest-oblique`
- keeps those three outputs aligned as intersecting views of the same place, like a reusable shared 3D map capture set
- pushes the model toward stronger 3D cues with angled views, cast shadows, inferred land-height data, terraces, retaining walls, and explicit 3D building massing
- retries failed generations up to three times
- uses stronger exponential backoff for transient Google failures such as timeouts and quota exhaustion
- fails fast on non-retryable auth and safety errors instead of wasting all three attempts
- writes every failed attempt to `output/reports/attempt-failures.json`
- deduplicates repeated final failures in `output/reports/deduplicated-failures.json`
- writes a repo-visible Markdown summary of unique failures to `output/reports/README.md`
- saves per-render metadata next to each generated image
- writes `library.json` and `README.md` in each asset output directory so the intersecting view set can be reused later

### Model Choice

The default model is `gemini-3-pro-image-preview`. You can override it with `GEMINI_MODEL` or `GOOGLE_IMAGE_MODEL`.

Supported auth modes:

- Vertex AI via `GOOGLE_SERVICE_ACCOUNT_JSON`
- Gemini Developer API with `GEMINI_API_KEY`
- Vertex AI REST with `GOOGLE_ACCESS_TOKEN`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`

### Usage

1. Copy `.env.example` to `.env`.
2. Set your Google credentials.
3. Run `npm run render`.

You can also keep credentials outside the repo in a shell-style keys file and run with `KEYS_FILE=/absolute/path/to/keys.txt npm run render`.
The curriculum generator follows the same pattern, so `KEYS_FILE=../keys.txt node scripts/generate-year6-curriculum.js` will load local Google credentials when present.

If that keys file contains `GOOGLE_SERVICE_ACCOUNT_JSON`, you can force Vertex-style auth with `GOOGLE_AUTH_MODE=service-account`.

If Google is slow in your environment, you can raise the per-request timeout with `GOOGLE_REQUEST_TIMEOUT_MS`.

For a no-network pipeline pass that preserves directory layout and writes placeholder outputs:

```bash
npm run render:dry
```

### Output Layout

- `output/renders/<concept-art-relative-path>/<direction>.<ext>`
- `output/renders/<concept-art-relative-path>/<direction>.json`
- `output/renders/<concept-art-relative-path>/library.json`
- `output/renders/<concept-art-relative-path>/README.md`
- `output/reports/run-summary.json`
- `output/reports/attempt-failures.json`
- `output/reports/deduplicated-failures.json`
- `output/reports/deduplicated-failures.md`
- `output/reports/README.md`

## Files

Main gameplay directions live in:

- `docs/concept-art/gameplay-directions/direction-1-heritage-hall.png`
- `docs/concept-art/gameplay-directions/direction-2-marble-atrium.png`
- `docs/concept-art/gameplay-directions/direction-3-glasshouse-museum.png`

Pipeline entrypoint:

- `scripts/render-concept-art-3d.js`

## Playable App

This repo now contains a root-level SvelteKit app that turns the concept art, generated render libraries, and side-game ideas into a Year 6 learning game.

What it includes:

- direct curator movement with `WASD`, arrow keys, or click-to-move
- hard Year 6 study rounds with weighted MCQ, quiz, free-text, and match-pairs formats
- diploma-gated room unlocks and quest-resource-based upgrades
- optional Google account sign-in for per-account autosave slots on the same browser
- an in-game archive that exposes all tracked concept art plus every intersecting render library in `output/renders/`
- immersive room scenes that prefer Gaussian splats and fall back to panorama textures in the 3D viewer
- an opaque, non-blurred interface so the deployed app stays readable instead of smearing the whole screen

## App Structure

- `src/` is the SvelteKit app
- `core/` contains the existing render-pipeline and content-generation modules
- `docs/` remains the source-of-truth for concept art
- `output/` remains the source-of-truth for generated render libraries and reports
- `static/` is build-time generated from those source directories for the app

## Immersive Scene Pipeline

This repo also contains an immersive-scene pipeline for the playable rooms. The app now prefers Gaussian splat assets from `output/splats/` whenever they exist, and falls back to generated panorama textures from `output/photospheres/` when a room does not have a splat scene yet.

What it does:

- reads the room-driving concept art from `docs/concept-art/`
- discovers splat assets under `output/splats/` and wires them into the game automatically
- asks Google's Nano Banana image model path to produce a seamless 4:1 panoramic room view for fallback coverage
- converts that panorama into a 2:1 viewer texture with `ffmpeg`
- retries Google failures up to five times per room by default
- treats transient server-side model failures, including worker-branch fanout failures, with backoff and retry
- records attempt failures and deduplicated final failures in `output/photospheres/reports/`
- exposes splats through `static/output/splats/` and fallback panoramas through `static/output/photospheres/` so opening an unlocked room loads the immersive viewer

Run it with:

```bash
KEYS_FILE=/absolute/path/to/keys.txt GOOGLE_AUTH_MODE=service-account npm run splats
```

For a no-network pass that keeps the same file layout:

```bash
npm run splats:dry
```

Override the retry budget with `--retries`, `SPLAT_RETRY_LIMIT`, `PHOTOSPHERE_RETRY_LIMIT`, or the shared `RETRY_LIMIT` env var.

Legacy compatibility wrappers remain available through `npm run photospheres` and `npm run photospheres:dry`.

## Local Development

SvelteKit now requires a newer Node runtime than the original prototype. Use Node `^20.19 || ^22.12 || >=24`.

To sync the repo assets into the app and start the local dev server:

```bash
npm run dev
```

To enable Google sign-in in the client UI, set `PUBLIC_GOOGLE_CLIENT_ID` to a Google OAuth web client ID before starting the app.

The repo `prepare` step also enables `.githooks/`, which auto-normalizes legacy local branch prefixes to `max1vol/*`.

The app sync happens automatically before `dev`, `build`, `preview`, and `check`.

If you want to manually refresh the static app assets first:

```bash
npm run app:sync
```

If you only want to refresh the raw asset manifest under `static/game/data/assets.json`, run:

```bash
npm run game:data
```

To produce a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

The app loads concept art from `/docs/concept-art/`, render libraries from `/output/renders/`, and the generated manifest from `/game/data/assets.json`, all served from SvelteKit `static/` after the sync step.
