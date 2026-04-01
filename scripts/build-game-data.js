import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeGameDataFile } from "../core/game-data.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { data, outputFile } = await writeGameDataFile({ repoRoot });

console.log(
  `Wrote ${outputFile} with ${data.summary.conceptArtCount} concept assets, ${data.summary.renderLibraryCount} render libraries, and ${data.summary.roomCount} playable rooms.`,
);
