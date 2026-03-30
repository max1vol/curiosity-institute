import test from "node:test";
import assert from "node:assert/strict";

import { DIRECTIONS } from "../src/directions.js";

test("pipeline defines exactly three distinct render directions", () => {
  assert.equal(DIRECTIONS.length, 3);
  assert.equal(new Set(DIRECTIONS.map((direction) => direction.id)).size, 3);
});
