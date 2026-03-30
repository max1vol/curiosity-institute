import fs from "node:fs/promises";
import path from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function ensureDir(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

export async function walkFiles(directoryPath) {
  const directoryEntries = await fs.readdir(directoryPath, { withFileTypes: true });
  const nestedFiles = [];

  for (const entry of directoryEntries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      nestedFiles.push(...(await walkFiles(absolutePath)));
    } else {
      nestedFiles.push(absolutePath);
    }
  }

  return nestedFiles;
}

export async function listInputImages(inputDir) {
  try {
    const absoluteInputDir = path.resolve(inputDir);
    const files = await walkFiles(absoluteInputDir);

    return files
      .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
      .sort()
      .map((filePath) => {
        const relativePath = path.relative(absoluteInputDir, filePath);
        const parsed = path.parse(relativePath);
        return {
          absolutePath: filePath,
          relativePath,
          baseName: parsed.name,
        };
      });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function readFileBuffer(filePath) {
  return fs.readFile(filePath);
}

export async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function writeText(filePath, content) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeBuffer(filePath, buffer) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);
}

export function sanitizeFileStem(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function extensionFromMimeType(mimeType) {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}
