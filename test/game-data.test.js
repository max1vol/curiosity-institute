import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildGameData } from "../core/game-data.js";

test("buildGameData discovers repo art, render libraries, and themes", async () => {
  const data = await buildGameData();

  assert.equal(data.summary.conceptArtCount, 16);
  assert.equal(data.summary.renderLibraryCount, 16);
  assert.equal(typeof data.summary.immersiveCount, "number");
  assert.equal(typeof data.summary.panoramaCount, "number");
  assert.equal(data.summary.photosphereCount, data.summary.panoramaCount);
  assert.equal(typeof data.summary.splatCount, "number");
  assert.equal(data.themes.length, 3);
  assert.equal(data.roomBlueprints.length, 9);
  assert.equal(data.miniGames.length, 4);
  assert.ok(data.mcqDeck.length >= 12);
  assert.ok(new Set(data.mcqDeck.map((question) => question.style)).size >= 6);
  assert.ok(data.quizDeck.length >= 8);
  assert.ok(data.freeTextDeck.length >= 8);
  assert.ok(data.matchPairDeck.length >= 12);
  assert.ok(data.questDeck.length >= 8);
  assert.deepEqual(data.studyModeWeights, {
    quiz: 50,
    "free-text": 25,
    mcq: 20,
    "match-pairs": 5,
  });

  for (const theme of data.themes) {
    assert.equal(theme.renderViews.length, 3);
    assert.ok(theme.heroImage.startsWith("/output/"));
  }

  for (const room of data.roomBlueprints) {
    assert.ok(Array.isArray(room.immersiveNeighbors));
    assert.ok(room.artPath.startsWith("/output/"));
    assert.ok(room.previewPath.startsWith("/output/"));
    assert.equal(typeof room.panoramaPath, "string");
    assert.equal(typeof room.panoramaMetadataPath, "string");
    assert.equal(room.photosphereMap, room.immersiveMap);

    if (room.panoramaPath || room.splatPath) {
      assert.ok(room.immersiveMap);
      assert.equal(room.immersiveMap.roomId, room.id);
      assert.equal(room.immersiveMap.startNodeId, `${room.id}:anchor`);
      assert.ok(room.immersiveMap.nodes.length >= 1);

      for (const node of room.immersiveMap.nodes) {
        assert.equal(node.roomId, room.id);
        assert.ok(
          (node.panoramaPath && node.panoramaPath.startsWith("/output/photospheres/")) ||
            (node.splatPath && node.splatPath.startsWith("/output/splats/")),
        );

        for (const edge of node.edges) {
          assert.ok(data.roomBlueprints.some((candidate) => candidate.id === edge.roomId));
          assert.ok(edge.toNodeId.endsWith(":anchor"));
          assert.equal(typeof edge.headingDeg, "number");
          assert.equal(typeof edge.targetHeadingDeg, "number");
        }
      }
    } else {
      assert.equal(room.immersiveMap, null);
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
    assert.ok(concept.panorama === concept.photosphere);
  }

  for (const question of data.mcqDeck) {
    assert.ok(question.id.length > 0);
    assert.ok(question.context.length > 0);
    assert.ok(question.choices.length >= 4);
  }

  for (const question of data.freeTextDeck) {
    assert.ok(question.acceptedAnswers.length >= 2);
    assert.ok(question.modelAnswer.length > 0);
  }

  for (const quest of data.questDeck) {
    assert.ok(quest.title.length > 0);
    assert.ok(quest.resourceReward.paper + quest.resourceReward.ink + quest.resourceReward.revisionTokens > 0);
  }
});

test("buildGameData discovers splat-backed immersive rooms", async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ci-splats-"));

  try {
    await fs.mkdir(path.join(repoRoot, "docs", "concept-art", "main-views"), { recursive: true });
    await fs.writeFile(path.join(repoRoot, "docs", "concept-art", "main-views", "dusty-foyer-start.png"), "");

    await fs.mkdir(path.join(repoRoot, "output", "splats", "main-views", "dusty-foyer-start"), { recursive: true });
    await fs.writeFile(path.join(repoRoot, "output", "splats", "main-views", "dusty-foyer-start", "scene.ksplat"), "");
    await fs.writeFile(
      path.join(repoRoot, "output", "splats", "main-views", "dusty-foyer-start", "splat.json"),
      JSON.stringify({
        asset: "main-views/dusty-foyer-start.png",
        splatFile: "scene.ksplat",
        sceneCenter: [1, 2, 3],
        lookAt: { x: 1, y: 1, z: 0 },
        cameraUp: [0, 1, 0],
        cameraRadius: 5.5,
        headingOffsetDeg: 25,
      }),
    );

    const data = await buildGameData({ repoRoot });
    const room = data.roomBlueprints.find((entry) => entry.id === "foyer");

    assert.ok(room);
    assert.equal(room.splatPath, "/output/splats/main-views/dusty-foyer-start/scene.ksplat");
    assert.equal(room.splatFormat, "ksplat");
    assert.deepEqual(room.splatSceneCenter, [1, 2, 3]);
    assert.deepEqual(room.splatLookAt, [1, 1, 0]);
    assert.deepEqual(room.splatCameraUp, [0, 1, 0]);
    assert.equal(room.splatCameraRadius, 5.5);
    assert.equal(room.splatHeadingOffsetDeg, 25);
    assert.equal(room.immersiveMap?.nodes[0]?.splatPath, "/output/splats/main-views/dusty-foyer-start/scene.ksplat");
    assert.deepEqual(room.immersiveMap?.nodes[0]?.splatSceneCenter, [1, 2, 3]);
    assert.equal(room.immersiveMap?.nodes[0]?.splatHeadingOffsetDeg, 25);
    assert.equal(data.summary.splatCount, 1);
    assert.equal(data.summary.immersiveCount, 1);
  } finally {
    await fs.rm(repoRoot, { recursive: true, force: true });
  }
});
