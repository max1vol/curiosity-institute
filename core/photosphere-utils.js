import { spawn } from "node:child_process";
import path from "node:path";

import { ensureDir } from "./fs-utils.js";

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}.`));
    });
  });
}

export async function stretchPanoramaToPhotosphere({ inputPath, outputPath }) {
  await ensureDir(path.dirname(outputPath));

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    "crop='trunc(min(iw,ih*4)/2)*2':ih,scale='trunc(iw/2)*2':'trunc(ih*2/2)*2':flags=lanczos,setsar=1",
    outputPath
  ]);
}
