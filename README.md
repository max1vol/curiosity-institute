# Curiosity Institute 3D Concept Pipeline

This repo now contains a runnable Node pipeline that takes concept art, sends it to a Google Gemini image model, and renders three distinct oblique 3D-map-style directions for each asset.

## What It Does

- Reads source images from `input/concept-art/`
- Generates exactly three direction variants per asset:
  - `northwest-oblique`
  - `northeast-oblique`
  - `southwest-oblique`
- Retries failed generations up to three times
- Records every failed attempt in `attempt-failures.json`
- Deduplicates repeated final failures in `deduplicated-failures.json` and `deduplicated-failures.md`
- Writes per-render metadata next to each generated image

## Model Choice

The default model is `gemini-3-pro-image-preview`, which matches the request to use one of Google's dev or preview image models. You can override it with either `GEMINI_MODEL` or `GOOGLE_IMAGE_MODEL`.

The implementation currently supports:

- Gemini Developer API with `GEMINI_API_KEY`
- Vertex AI REST with `GOOGLE_ACCESS_TOKEN`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION`

## Usage

1. Copy `.env.example` to `.env`.
2. Put source concept art into `input/concept-art/`.
3. Run `npm run render`.

For a no-network validation run against the current empty repo state:

```bash
npm run render:dry
```

## Output Layout

- `output/renders/<asset-path>/<direction>.<ext>`
- `output/renders/<asset-path>/<direction>.json`
- `output/reports/run-summary.json`
- `output/reports/attempt-failures.json`
- `output/reports/deduplicated-failures.json`
- `output/reports/deduplicated-failures.md`

If two source assets share the same filename but live in different subdirectories, the output structure keeps them separate.

## Important Note

When this pipeline was added, the repository did not contain any tracked concept-art images. The automation is ready, but you still need to add the source art before it can render final 3D outputs.
