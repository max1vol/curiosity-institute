# Curiosity Institute 3D Concept Pipeline

This repository now contains a reproducible pipeline that turns concept art into three 3D-style renders per image using Google's image-capable Gemini models.

## What it does

- Reads source art from `input/concept-art/`
- Produces three camera directions for every asset:
  - `northwest-oblique`
  - `northeast-oblique`
  - `birdseye-oblique`
- Retries each failed render up to three times
- Publishes every failed attempt to JSON logs
- Publishes deduplicated failure summaries so the same mistake is only reported once
- Saves per-render metadata alongside generated image files

## Model choice

The pipeline defaults to `gemini-2.5-flash-image` for the broadest compatibility. If you have preview access, set `GOOGLE_IMAGE_MODEL=gemini-3-pro-image-preview` in `.env`.

Authentication options:

- `GEMINI_API_KEY` for the Gemini Developer API
- `GOOGLE_ACCESS_TOKEN` plus `GOOGLE_CLOUD_PROJECT` for Vertex AI

## Usage

1. Copy `.env.example` to `.env` and set your Google credentials.
2. Put concept art images into `input/concept-art/`.
3. Run:

```bash
npm run render
```

For a local non-network verification run:

```bash
npm run render -- --dry-run --allow-empty
```

## Output layout

- `output/renders/<asset>/<direction>.<ext>`
- `output/renders/<asset>/<direction>.json`
- `output/reports/run-summary.json`
- `output/reports/attempt-failures.json`
- `output/reports/deduplicated-failures.json`
- `output/reports/deduplicated-failures.md`

## Important note

At the time this automation was added, the `main` checkout contained no concept-art assets beyond `.gitignore`. The pipeline is ready, but you still need to add the source images before it can render them.
