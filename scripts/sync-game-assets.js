import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeGameDataFile } from "../core/game-data.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = path.join(repoRoot, "static");

async function resetPath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function copyIntoStatic(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  await fs.cp(path.join(repoRoot, sourceRelativePath), path.join(staticRoot, targetRelativePath), {
    recursive: true
  });
}

async function syncGameAssets() {
  await fs.mkdir(staticRoot, { recursive: true });

  await resetPath(path.join(staticRoot, "docs", "concept-art"));
  await resetPath(path.join(staticRoot, "output", "renders"));

  await copyIntoStatic("docs/concept-art", "docs/concept-art");
  await copyIntoStatic("output/renders", "output/renders");

  const { data, outputFile } = await writeGameDataFile({
    repoRoot,
    outputFile: path.join(staticRoot, "game", "data", "assets.json")
  });

  return {
    data,
    outputFile
  };
}

const { data, outputFile } = await syncGameAssets();

console.log(
  `Synced app assets into static/ and wrote ${outputFile} with ${data.summary.conceptArtCount} concept assets, ${data.summary.renderLibraryCount} render libraries, and ${data.summary.roomCount} playable rooms.`
);
