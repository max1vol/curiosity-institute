import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeGameDataFile } from "../core/game-data.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = path.join(repoRoot, "static");
const syncLockPath = path.join(repoRoot, ".tmp", "sync-game-assets.lock");

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function resetPath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function copyIntoStatic(sourceRelativePath, targetRelativePath = sourceRelativePath) {
  try {
    await fs.cp(path.join(repoRoot, sourceRelativePath), path.join(staticRoot, targetRelativePath), {
      recursive: true
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }

  return true;
}

async function withSyncLock(action, { timeoutMs = 30_000, pollMs = 200, staleAfterMs = timeoutMs } = {}) {
  await fs.mkdir(path.dirname(syncLockPath), { recursive: true });
  const startedAt = Date.now();

  for (;;) {
    try {
      await fs.mkdir(syncLockPath);
      break;
    } catch (error) {
      if (!error || error.code !== "EEXIST") {
        throw error;
      }

      try {
        const lockStat = await fs.stat(syncLockPath);

        if (Date.now() - lockStat.mtimeMs >= staleAfterMs) {
          await fs.rm(syncLockPath, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (!statError || statError.code !== "ENOENT") {
          throw statError;
        }
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for sync lock at ${syncLockPath}`);
      }

      await sleep(pollMs);
    }
  }

  try {
    return await action();
  } finally {
    await fs.rm(syncLockPath, { recursive: true, force: true });
  }
}

async function syncGameAssets() {
  return withSyncLock(async () => {
    await fs.mkdir(staticRoot, { recursive: true });

    await resetPath(path.join(staticRoot, "docs", "concept-art"));
    await resetPath(path.join(staticRoot, "output", "renders"));
    await resetPath(path.join(staticRoot, "output", "photospheres"));

    await copyIntoStatic("docs/concept-art", "docs/concept-art");
    await copyIntoStatic("output/renders", "output/renders");
    await copyIntoStatic("output/photospheres", "output/photospheres");

    const { data, outputFile } = await writeGameDataFile({
      repoRoot,
      outputFile: path.join(staticRoot, "game", "data", "assets.json")
    });

    return {
      data,
      outputFile
    };
  });
}

const { data, outputFile } = await syncGameAssets();

console.log(
  `Synced app assets into static/ and wrote ${outputFile} with ${data.summary.conceptArtCount} concept assets, ${data.summary.renderLibraryCount} render libraries, and ${data.summary.roomCount} playable rooms.`
);
