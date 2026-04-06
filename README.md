# Curiosity Institute

Curiosity Institute is a Year 6 learning game built as one large playable 3D island. The presentation now leans into a blocky Minecraft-meets-Fortnite feel, but the curriculum loop stays intact: plain tests earn paper, ink, and revision tokens, adaptive perfection quests react to performance, and final tests award diplomas that unlock more of the island without being spent.

## Core Fantasy

The game should feel like:

- dropping into one shared island instead of picking between three separate routes
- moving through a real-time 3D world rather than a flat menu map
- seeing each major zone marked by gaussian-splat landmarks generated from tracked concept art
- earning progress through hard Year 6 work rather than buying advancement outright
- turning weak topics into concrete follow-up quests and final diploma pushes

## Main Gameplay Loop

1. Move through the island in real time and focus different study zones.
2. Launch weighted Year 6 rounds from the active zone or the study drop board.
3. Earn paper, ink, revision tokens, coins, and stronger performance records.
4. Convert weak or promising topics into adaptive perfection quests.
5. Pass final tests to bank diplomas.
6. Use diplomas to unlock more zones while keeping the diploma count on record.

## Study System

The weighted plain-test mix is unchanged:

- `quiz`: 50%
- `free-text`: 25%
- `mcq`: 20%
- `match-pairs`: 5%

Plain tests earn resources. Improvement quests are personalised follow-ups based on failures or mastery. Final tests award diplomas. Diplomas unlock new island zones and are never spent.

## Playable App

The SvelteKit app now includes:

- a real Three.js island stage for the main world
- live movement with `WASD`, arrow keys, or click-to-move
- blocky room landmarks, pickups, NPC traffic, and splat beacons
- diploma-gated zones and resource-based upgrades
- Year 6 curriculum modals for MCQ, quiz, free-text, and match-pairs play
- optional Google sign-in for local save slots tied to the same browser session

## Gaussian Splat Pipeline

The repo now has a real room-splat pipeline under `npm run splats`.

What it does:

- reads the room-driving render libraries in `output/renders/`
- refreshes source angles with Google's current Gemini image models when Google credentials are available
- feeds the image model multiple references for the same zone: the authoritative concept art, tracked overlap views, and a generated consistency anchor when available
- otherwise falls back to the tracked multi-angle render-library images already in the repo
- reconstructs a point-based gaussian splat cloud from multiple views
- writes ASCII `.ply` splat assets plus `splat.json` metadata under `output/splats/`
- keeps per-view source images and metadata in `output/splats/<asset>/views/`

Default image model for fresh splat-source angles:

- `gemini-3.1-flash-image-preview`

Quality defaults for fresh splat-source angles:

- 6 orbit views
- 2K image size
- 4 reference images max per generation request
- higher point budgets for more detailed reconstructed scenery

Run it with:

```bash
npm run splats
```

For a no-network pass that reuses tracked render-library views:

```bash
npm run splats:dry
```

## Supporting Pipelines

The repo still keeps the other generation passes:

- `npm run render` builds the tracked multi-angle render libraries in `output/renders/`
- `npm run photospheres` builds panorama fallbacks in `output/photospheres/`
- `npm run game:data` rebuilds the static asset manifest consumed by the app

## Local Development

Use Node `^20.19 || ^22.12 || >=24`.

Start the app:

```bash
npm run dev
```

Run verification:

```bash
npm run check
npm run test
npm run build
```
