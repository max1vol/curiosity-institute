# Curiosity Institute

Curiosity Institute is a Year 6 learning game built around a direct-avatar 3D museum world.

The player pilots a navigator in real time through the route map, but the progression loop is still curriculum-led: plain study tests award paper, ink, and revision tokens, adaptive perfection quests react to each learner's performance, and final tests award diplomas that unlock new zones without being spent.

## Core Fantasy

The game should feel like:

- walking through a tactile 3D museum route map instead of navigating flat menus
- earning progress through hard Year 6 work rather than buying everything with currency
- unlocking study zones through diploma milestones while keeping coin pickups for ambient route energy
- turning mistakes into concrete follow-up quests such as rewriting on paper or reworking an answer you cannot edit again
- using immersive scenes and generated art to make the curriculum world feel alive

## Main Gameplay Loop

1. Guide the navigator through the Year 6 route map in a top-down 3D view.
2. Enter challenge currents or queued study alerts to launch a weighted random hard round.
3. Clear MCQ, quiz, free-text, and match-pairs activities to earn resources and strengthen topic performance.
4. Convert weak or promising topics into adaptive perfection quests, then pass the final test to earn the diploma.
5. Unlock new zones when you reach diploma gates; diplomas remain on your record and are never spent.
6. Use earned resources such as paper, ink, and revision tokens to upgrade zones and keep progression moving.

## Study System

Every prompted study round comes from the generated Year 6 curriculum deck with this weighted mix:

- `quiz`: 50%
- `free-text`: 25%
- `mcq`: 20%
- `match-pairs`: 5%

Failure and strong performance both feed adaptive perfection quests, including rewrite-on-paper style tasks and locked-topic recovery tasks that lead into final diploma tests. Plain test mode weights stay fixed, but the question picker now leans toward active weak subjects so the curriculum loop feels more coherent instead of fully random.

The quest deck now also separates plain resource tests, adaptive mastery quests, and final diploma tests. Resource tests earn paper, ink, and revision tokens. Mastery quests are meant to be personalized follow-ups based on the learner's performance. Final tests award the diploma when passed.

## Three Main 3D Gameplay Directions

These three concept images show the same gameplay idea with clearly different visual languages:

- portrait mobile framing
- direct control of the navigator
- floating coin pickups
- active immersive zone or public route space
- visible locked future expansion
- incoming public-question call event

### Direction 1: Kelp Bastion

- dark green striped walls
- pale parquet floors
- burgundy runner
- brass lamps and trim
- warm harbor-route atmosphere

![Direction 1: Kelp Bastion](docs/concept-art/gameplay-directions/direction-1-heritage-hall.png)

### Direction 2: Openwater Deck

- white stone and marble architecture
- skylit upper structure
- teal runner
- brighter daylight mood
- formal institutional feeling

![Direction 2: Openwater Deck](docs/concept-art/gameplay-directions/direction-2-marble-atrium.png)

### Direction 3: Coral Glass Bay

- brass-framed glass partitions
- terracotta and pale stone flooring
- indoor plants and warm daylight
- softer modern reef mood
- central rotunda hub instead of a straight corridor

![Direction 3: Coral Glass Bay](docs/concept-art/gameplay-directions/direction-3-glasshouse-museum.png)

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

This repo now contains a root-level SvelteKit app that turns the concept art, generated render libraries, and side-game ideas into a Year 6 Curiosity Institute game.

What it includes:

- direct navigator movement with `WASD`, arrow keys, or click-to-move
- hard Year 6 study rounds with weighted MCQ, quiz, free-text, and match-pairs formats
- diploma-gated zone unlocks and quest-resource-based upgrades
- optional Google account sign-in for per-account autosave slots on the same browser
- an in-game archive that exposes all tracked concept art plus every intersecting render library in `output/renders/`
- immersive zone scenes rendered from generated panorama textures in the 3D viewer
- an opaque, non-blurred interface so the deployed app stays readable instead of smearing the whole screen

## App Structure

- `src/` is the SvelteKit app
- `core/` contains the existing render-pipeline and content-generation modules
- `docs/` remains the source-of-truth for concept art
- `output/` remains the source-of-truth for generated render libraries and reports
- `static/` is build-time generated from those source directories for the app

## Immersive Scene Pipeline

This repo also contains an immersive-scene pipeline for the playable zones. The app now relies on generated panorama textures from `output/photospheres/` for the in-game viewer.

What it does:

- reads the zone-driving concept art from `docs/concept-art/`
- asks Google's Nano Banana image model path to produce a seamless 4:1 panoramic zone view for immersive coverage
- converts that panorama into a 2:1 viewer texture with `ffmpeg`
- retries Google failures up to five times per zone by default
- treats transient server-side model failures, including worker-branch fanout failures, with backoff and retry
- records attempt failures and deduplicated final failures in `output/photospheres/reports/`
- exposes panoramas through `static/output/photospheres/` so opening an unlocked zone loads the immersive viewer

Run it with:

```bash
KEYS_FILE=/absolute/path/to/keys.txt GOOGLE_AUTH_MODE=service-account npm run photospheres
```

For a no-network pass that keeps the same file layout:

```bash
npm run photospheres:dry
```

Override the retry budget with `--retries`, `PHOTOSPHERE_RETRY_LIMIT`, or the shared `RETRY_LIMIT` env var.

Legacy `npm run splats` wrappers remain in the repo for archived experiments, but the current app no longer depends on them.

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
