import path from "node:path";

import { DIRECTIONS } from "./directions.js";
import { listInputImages, ensureDir, readFileBuffer, writeJson, writeText, writeBuffer, outputDirectoryForAsset, extensionFromMimeType } from "./fs-utils.js";
import { generateEditedImage } from "./google-image-client.js";
import { build3DMapPrompt } from "./prompts.js";
import { FailureCollector, renderDeduplicatedFailuresMarkdown, renderFailureReadme } from "./reporting.js";
import { RAISED_RENDER_PROFILE } from "./render-profile.js";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function detectMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  throw new Error(`Unsupported image extension: ${extension}`);
}

async function renderDirection({ asset, direction, config, failureCollector }) {
  const imageBuffer = await readFileBuffer(asset.absolutePath);
  const mimeType = detectMimeType(asset.absolutePath);
  const prompt = build3DMapPrompt({
    assetName: asset.baseName,
    direction,
  });

  const context = {
    asset: asset.relativePath,
    direction: direction.id,
    retryLimit: config.retryLimit,
  };

  let lastError = null;

  for (let attempt = 1; attempt <= config.retryLimit; attempt += 1) {
    try {
      const result = await generateEditedImage({
        auth: config.auth,
        model: config.model,
        projectId: config.projectId,
        location: config.location,
        prompt,
        imageBuffer,
        mimeType,
        dryRun: config.dryRun,
      });

      return {
        success: true,
        attempt,
        prompt,
        ...result,
      };
    } catch (error) {
      lastError = error;
      failureCollector.recordAttempt(context, error, attempt);

      if (attempt < config.retryLimit) {
        await sleep(500 * attempt);
      }
    }
  }

  failureCollector.recordFinalFailure(context, lastError);

  return {
    success: false,
    error: lastError,
    prompt,
  };
}

async function persistRender({ asset, direction, renderResult, outputDir }) {
  const assetDirectory = path.join(outputDir, outputDirectoryForAsset(asset.relativePath));
  const imageExtension = extensionFromMimeType(renderResult.mimeType);
  const imagePath = path.join(assetDirectory, `${direction.id}${imageExtension}`);
  const metadataPath = path.join(assetDirectory, `${direction.id}.json`);

  await writeBuffer(imagePath, renderResult.imageBuffer);
  await writeJson(metadataPath, {
    asset: asset.relativePath,
    direction: direction.id,
    prompt: renderResult.prompt,
    renderProfile: RAISED_RENDER_PROFILE.id,
    tricks: RAISED_RENDER_PROFILE.tricks,
    modelText: renderResult.modelText,
    modelResponse: renderResult.responseMeta,
    generatedAt: new Date().toISOString(),
    attempt: renderResult.attempt,
    dryRun: Boolean(renderResult.responseMeta?.dryRun),
  });

  return {
    asset: asset.relativePath,
    direction: direction.id,
    imagePath,
    metadataPath,
    attempt: renderResult.attempt,
  };
}

export async function runPipeline(config) {
  await ensureDir(config.outputDir);
  await ensureDir(config.reportsDir);

  const assets = await listInputImages(config.inputDir);
  if (assets.length === 0 && !config.allowEmpty) {
    throw new Error(`No concept-art images found in ${config.inputDir}`);
  }

  const failureCollector = new FailureCollector();
  const completedRenders = [];

  for (const asset of assets) {
    for (const direction of DIRECTIONS) {
      const renderResult = await renderDirection({
        asset,
        direction,
        config,
        failureCollector,
      });

      if (!renderResult.success) {
        continue;
      }

      completedRenders.push(
        await persistRender({
          asset,
          direction,
          renderResult,
          outputDir: config.outputDir,
        }),
      );
    }
  }

  const deduplicatedFailures = Array.from(failureCollector.uniqueFailures.values());
  const summary = {
    model: config.model,
    dryRun: config.dryRun,
    inputDir: config.inputDir,
    outputDir: config.outputDir,
    reportsDir: config.reportsDir,
    renderProfile: RAISED_RENDER_PROFILE.id,
    tricks: RAISED_RENDER_PROFILE.tricks,
    assetsDiscovered: assets.length,
    directionsPerAsset: DIRECTIONS.length,
    rendersCompleted: completedRenders.length,
    uniqueFailures: deduplicatedFailures.length,
    completedRenders,
    generatedAt: new Date().toISOString(),
  };

  await writeJson(path.join(config.reportsDir, "run-summary.json"), summary);
  await writeJson(
    path.join(config.reportsDir, "attempt-failures.json"),
    failureCollector.attemptFailures,
  );
  await writeJson(
    path.join(config.reportsDir, "deduplicated-failures.json"),
    deduplicatedFailures,
  );
  await writeText(
    path.join(config.reportsDir, "deduplicated-failures.md"),
    renderDeduplicatedFailuresMarkdown(deduplicatedFailures),
  );
  await writeText(
    path.join(config.reportsDir, "README.md"),
    renderFailureReadme({
      retryLimit: config.retryLimit,
      profileLabel: RAISED_RENDER_PROFILE.label,
      uniqueFailures: deduplicatedFailures,
    }),
  );

  return summary;
}
