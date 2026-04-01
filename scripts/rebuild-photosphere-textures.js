import path from "node:path";

import { walkFiles } from "../core/fs-utils.js";
import { stretchPanoramaToPhotosphere } from "../core/photosphere-utils.js";

const outputRoot = path.resolve("output/photospheres");

const sourceFiles = (await walkFiles(outputRoot))
  .filter((filePath) => path.basename(filePath).startsWith("photosphere-source."))
  .sort();

let rebuiltCount = 0;

for (const sourcePath of sourceFiles) {
  const outputPath = path.join(path.dirname(sourcePath), "photosphere.png");
  await stretchPanoramaToPhotosphere({
    inputPath: sourcePath,
    outputPath
  });
  rebuiltCount += 1;
}

console.log(`Rebuilt ${rebuiltCount} photosphere textures in ${outputRoot}.`);
