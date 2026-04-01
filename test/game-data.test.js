import test from "node:test";
import assert from "node:assert/strict";

import { buildGameData } from "../core/game-data.js";

test("buildGameData discovers repo art, render libraries, and themes", async () => {
  const data = await buildGameData();

  assert.equal(data.summary.conceptArtCount, 16);
  assert.equal(data.summary.renderLibraryCount, 16);
  assert.equal(typeof data.summary.photosphereCount, "number");
  assert.equal(data.themes.length, 3);
  assert.equal(data.roomBlueprints.length, 9);
  assert.equal(data.miniGames.length, 4);
  assert.ok(data.callDeck.length >= 12);
  assert.ok(new Set(data.callDeck.map((question) => question.style)).size >= 6);
  assert.ok(data.estimationDeck.length >= 8);
  assert.ok(data.curatorCheckDeck.length >= 8);
  assert.ok(data.matchPairsDeck.length >= 18);

  for (const theme of data.themes) {
    assert.equal(theme.renderViews.length, 3);
    assert.ok(theme.heroImage.startsWith("/output/"));
  }

  for (const room of data.roomBlueprints) {
    assert.ok(Array.isArray(room.immersiveNeighbors));
    assert.ok(room.artPath.startsWith("/output/"));
    assert.ok(room.previewPath.startsWith("/output/"));
    assert.equal(typeof room.photospherePath, "string");
    assert.equal(typeof room.photosphereMetadataPath, "string");

    if (room.photospherePath) {
      assert.ok(room.photosphereMap);
      assert.equal(room.photosphereMap.roomId, room.id);
      assert.equal(room.photosphereMap.startNodeId, `${room.id}:anchor`);
      assert.ok(room.photosphereMap.nodes.length >= 1);

      for (const node of room.photosphereMap.nodes) {
        assert.equal(node.roomId, room.id);
        assert.ok(node.imagePath.startsWith("/output/photospheres/"));

        for (const edge of node.edges) {
          assert.ok(data.roomBlueprints.some((candidate) => candidate.id === edge.roomId));
          assert.ok(edge.toNodeId.endsWith(":anchor"));
          assert.equal(typeof edge.headingDeg, "number");
          assert.equal(typeof edge.targetHeadingDeg, "number");
        }
      }
    } else {
      assert.equal(room.photosphereMap, null);
    }
  }

  for (const miniGame of data.miniGames) {
    assert.ok(miniGame.formatNote.length > 0);
    assert.ok(miniGame.difficultyLabel.length > 0);
    assert.ok(miniGame.artPath.startsWith("/output/"));
  }

  for (const concept of data.conceptArt) {
    assert.equal(typeof concept.displayPath, "string");
    assert.ok(concept.originalPath.startsWith("/docs/concept-art/"));
    assert.ok(concept.displayPath.startsWith("/output/"));
  }

  for (const question of data.callDeck) {
    assert.ok(question.id.length > 0);
    assert.ok(question.context.length > 0);
    assert.ok(question.choices.length >= 4);
  }
});
