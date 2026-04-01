import test from "node:test";
import assert from "node:assert/strict";

import { DIRECTIONS } from "../core/directions.js";

test("pipeline defines exactly three distinct render directions", () => {
  assert.equal(DIRECTIONS.length, 3);
  assert.equal(new Set(DIRECTIONS.map((direction) => direction.id)).size, 3);
});

test("each direction carries camera, overlap, shadow, terrain, and building instructions", () => {
  const directionIds = new Set(DIRECTIONS.map((direction) => direction.id));

  for (const direction of DIRECTIONS) {
    assert.equal(typeof direction.librarySlot, "string");
    assert.equal(Array.isArray(direction.intersectsWith), true);
    assert.equal(typeof direction.overlapInstruction, "string");
    assert.equal(typeof direction.cameraInstruction, "string");
    assert.equal(typeof direction.shadowInstruction, "string");
    assert.equal(typeof direction.terrainInstruction, "string");
    assert.equal(typeof direction.buildingInstruction, "string");
    assert.ok(direction.librarySlot.length > 0);
    assert.ok(direction.intersectsWith.length > 0);
    assert.ok(direction.intersectsWith.every((directionId) => directionIds.has(directionId)));
    assert.ok(direction.intersectsWith.every((directionId) => directionId !== direction.id));
    assert.ok(direction.overlapInstruction.length > 0);
    assert.ok(direction.cameraInstruction.length > 0);
    assert.ok(direction.shadowInstruction.length > 0);
    assert.ok(direction.terrainInstruction.length > 0);
    assert.ok(direction.buildingInstruction.length > 0);
  }
});
