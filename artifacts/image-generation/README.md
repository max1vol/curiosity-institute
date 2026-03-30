# Image Generation Inventory

This folder tracks the district art assets already referenced by the app and a safe filename convention for generating variants without touching app code.

## Source Mapping

The app currently expects these sprite paths in `src/gameData.ts`:

- `laboratory` -> `/art/discovery-lab.png`
- `workshop` -> `/art/makers-forge.png`
- `observatory` -> `/art/number-observatory.png`
- `scriptorium` -> `/art/scriptorium-hall.png`
- `archive` -> `/art/chronicle-archive.png`
- `harbour` -> `/art/atlas-harbour.png`

## Recommended Layout

Keep generated work in district subfolders, then copy the chosen final into the flat path the app already uses.

```text
art/
  laboratory/
    direction-a.png
    direction-b.png
    direction-c.png
    final.png
  workshop/
    direction-a.png
    direction-b.png
    direction-c.png
    final.png
  observatory/
    direction-a.png
    direction-b.png
    direction-c.png
    final.png
  scriptorium/
    direction-a.png
    direction-b.png
    direction-c.png
    final.png
  archive/
    direction-a.png
    direction-b.png
    direction-c.png
    final.png
  harbour/
    direction-a.png
    direction-b.png
    direction-c.png
    final.png
```

Recommended selection rule:

- `direction-a`: closest to the current visual language, but pushed more 3D
- `direction-b`: stronger miniature/toy-like 3D treatment
- `direction-c`: more dramatic lighting or painterly 3D treatment
- `final.png`: selected winner for the current district

For app consumption, copy the chosen `final.png` to the existing sprite path, for example:

- `art/laboratory/final.png` -> `public/art/discovery-lab.png`

## District Inventory

See `district-art-inventory.json` for the machine-readable palette and naming data.
