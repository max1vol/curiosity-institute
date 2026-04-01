import test from "node:test";
import assert from "node:assert/strict";

import { buildGameData } from "../core/game-data.js";

test("buildGameData discovers repo art, render libraries, and themes", async () => {
  const data = await buildGameData();

  assert.equal(data.summary.conceptArtCount, 16);
  assert.equal(data.summary.renderLibraryCount, 16);
  assert.equal(data.themes.length, 3);
  assert.equal(data.roomBlueprints.length, 9);
  assert.equal(data.miniGames.length, 4);

  for (const theme of data.themes) {
    assert.equal(theme.renderViews.length, 3);
    assert.ok(theme.heroImage.startsWith("/docs/concept-art/"));
  }
});
