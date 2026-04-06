import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildOutputDir = path.join(repoRoot, ".svelte-kit", "output");

await fs.rm(buildOutputDir, { recursive: true, force: true });
