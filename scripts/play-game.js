import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { writeGameDataFile } from "../src/game-data.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function safePathname(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");

  if (url.pathname === "/") {
    return "/game/index.html";
  }

  if (url.pathname === "/game") {
    return "/game/index.html";
  }

  return decodeURIComponent(url.pathname);
}

function resolveFilePath(pathname) {
  const normalized = path.normalize(path.join(repoRoot, pathname));
  if (!normalized.startsWith(repoRoot)) {
    return null;
  }
  return normalized;
}

async function serve(request, response) {
  const pathname = safePathname(request.url ?? "/");
  const filePath = resolveFilePath(pathname);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const content = await fs.readFile(finalPath);
    const extension = path.extname(finalPath).toLowerCase();

    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(content);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(500);
    response.end(error instanceof Error ? error.message : String(error));
  }
}

await writeGameDataFile({ repoRoot });

const server = http.createServer(serve);

server.listen(port, () => {
  console.log(`Curiosity Institute is playable at http://localhost:${port}`);
});
