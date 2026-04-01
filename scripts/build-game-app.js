import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeGameDataFile } from "../src/game-data.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");

async function copyIntoDist(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  await fs.cp(
    path.join(repoRoot, sourceRelativePath),
    path.join(distRoot, targetRelativePath),
    { recursive: true },
  );
}

async function build() {
  await fs.rm(distRoot, { recursive: true, force: true });
  await fs.mkdir(distRoot, { recursive: true });

  await writeGameDataFile({
    repoRoot,
    outputFile: path.join(repoRoot, "game", "data", "assets.json"),
  });

  await copyIntoDist("game", "game");
  await copyIntoDist("docs/concept-art", "docs/concept-art");
  await copyIntoDist("output/renders", "output/renders");

  const sourceIndexPath = path.join(repoRoot, "game", "index.html");
  const distIndexPath = path.join(distRoot, "index.html");
  await fs.copyFile(sourceIndexPath, distIndexPath);

  return {
    distRoot,
  };
}

const { distRoot: outputDir } = await build();
console.log(`Built playable app bundle in ${outputDir}`);
