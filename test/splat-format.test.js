import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { writeAsciiPly } from "../core/splat-point-cloud.js";

test("writeAsciiPly emits vertex-only gaussian splat PLY without faces", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "curiosity-splats-"));
  const plyPath = path.join(tempDir, "sample-splat.ply");

  try {
    await writeAsciiPly(
      plyPath,
      [
        {
          x: 1.25,
          y: 2.5,
          z: 3.75,
          red: 120,
          green: 150,
          blue: 210,
          opacity: 0.82,
          scale: 0.03,
          rotation: [1, 0, 0, 0]
        }
      ],
      {
        asset: "test-room.png",
        sourceMode: "unit-test",
        generatedAt: "2026-04-06T00:00:00.000Z"
      }
    );

    const contents = await fs.readFile(plyPath, "utf8");

    assert.match(contents, /^ply\nformat ascii 1\.0\n/m);
    assert.match(contents, /comment topology vertex-only-gaussian-splats/);
    assert.match(contents, /element vertex 1/);
    assert.doesNotMatch(contents, /element face /);
    assert.match(contents, /property float scale_0/);
    assert.match(contents, /property float rot_3/);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("gaussian splat runtime keeps a point-cloud shader path and rejects face meshes", async () => {
  const source = await fs.readFile(path.resolve("src/lib/game/gaussian-splats.ts"), "utf8");

  assert.match(source, /new THREE\.Points\(/);
  assert.match(source, /gl_PointCoord/);
  assert.match(source, /element face /);
  assert.match(source, /Triangulated PLY meshes are not supported for gaussian splat rendering\./);
});
