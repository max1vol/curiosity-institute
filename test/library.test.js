import test from "node:test";
import assert from "node:assert/strict";

import { buildAssetLibrary, renderAssetLibraryReadme } from "../core/library.js";
import { RAISED_RENDER_PROFILE } from "../core/render-profile.js";

test("buildAssetLibrary marks completed and missing intersecting views", () => {
  const library = buildAssetLibrary({
    asset: { relativePath: "docs/concept-art/example.png" },
    outputSubdirectory: "docs-concept-art/example",
    renderProfile: RAISED_RENDER_PROFILE,
    retryLimit: 3,
    persistedRenders: [
      {
        direction: "northwest-oblique",
        imageFile: "northwest-oblique.png",
        metadataFile: "northwest-oblique.json",
        attempt: 2,
      },
    ],
  });

  assert.equal(library.libraryType, "intersecting-oblique-map-views");
  assert.equal(library.totalViews, 3);
  assert.equal(library.completedViews, 1);
  assert.equal(library.outputDirectory, "docs-concept-art/example");
  assert.deepEqual(library.missingViews, ["northeast-oblique", "southwest-oblique"]);
  assert.equal(library.views[0].status, "completed");
  assert.equal(library.views[1].status, "missing");
});

test("renderAssetLibraryReadme describes overlap rules and missing views", () => {
  const library = buildAssetLibrary({
    asset: { relativePath: "docs/concept-art/example.png" },
    outputSubdirectory: "docs-concept-art/example",
    renderProfile: RAISED_RENDER_PROFILE,
    retryLimit: 3,
    persistedRenders: [],
  });

  const readme = renderAssetLibraryReadme(library);

  assert.match(readme, /Intersecting View Library/i);
  assert.match(readme, /Coverage goal:/i);
  assert.match(readme, /Intersects with:/i);
  assert.match(readme, /Missing views:/i);
});
