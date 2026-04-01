import test from "node:test";
import assert from "node:assert/strict";

import { DIRECTIONS } from "../core/directions.js";
import { build3DMapPrompt } from "../core/prompts.js";

test("3D prompt includes raised-map tricks", () => {
  const prompt = build3DMapPrompt({
    assetName: "museum-square",
    direction: DIRECTIONS[0],
  });

  assert.match(prompt, /strong downward tilt/i);
  assert.match(prompt, /intersecting google maps-style oblique library/i);
  assert.match(prompt, /camera height, lens feel, landmark placement, and scale consistent/i);
  assert.match(prompt, /shadow/i);
  assert.match(prompt, /land-height/i);
  assert.match(prompt, /3d building models/i);
  assert.match(prompt, /raised above the ground plane/i);
});
