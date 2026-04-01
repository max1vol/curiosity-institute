import path from "node:path";

import { DIRECTIONS } from "./directions.js";
import { listInputImages, ensureDir, resetDir, readFileBuffer, writeJson, writeText, writeBuffer, outputDirectoryForAsset, extensionFromMimeType } from "./fs-utils.js";
import { generateEditedImage } from "./google-image-client.js";
import { buildAssetLibrary, libraryFilePaths, renderAssetLibraryReadme } from "./library.js";
import { build3DMapPrompt } from "./prompts.js";
import { FailureCollector, renderDeduplicatedFailuresMarkdown, renderFailureReadme } from "./reporting.js";
import { RAISED_RENDER_PROFILE } from "./render-profile.js";
import { classifyRetryDecision } from "./retry-policy.js";

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
  let lastAttempt = 0;

  for (let attempt = 1; attempt <= config.retryLimit; attempt += 1) {
    lastAttempt = attempt;

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
      const retryDecision = classifyRetryDecision(error, attempt);

      failureCollector.recordAttempt(
        {
          ...context,
          retryable: retryDecision.retryable,
          retryCategory: retryDecision.category,
          retryDelayMs: retryDecision.delayMs,
        },
        error,
        attempt,
      );

      if (attempt < config.retryLimit && retryDecision.retryable) {
        await sleep(retryDecision.delayMs);
        continue;
      }

      break;
    }
  }

  failureCollector.recordFinalFailure(context, lastError, lastAttempt);

  return {
    success: false,
    error: lastError,
    prompt,
  };
}

async function persistRender({ asset, direction, renderResult, outputDir }) {
  const assetDirectory = path.join(outputDir, outputDirectoryForAsset(asset.relativePath));
  const imageExtension = extensionFromMimeType(renderResult.mimeType);
  const imageFile = `${direction.id}${imageExtension}`;
  const metadataFile = `${direction.id}.json`;
  const imagePath = path.join(assetDirectory, imageFile);
  const metadataPath = path.join(assetDirectory, metadataFile);

  await writeBuffer(imagePath, renderResult.imageBuffer);
  await writeJson(metadataPath, {
    asset: asset.relativePath,
    direction: direction.id,
    directionLabel: direction.label,
    librarySlot: direction.librarySlot,
    intersectsWith: direction.intersectsWith,
    overlapInstruction: direction.overlapInstruction,
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
    directionLabel: direction.label,
    librarySlot: direction.librarySlot,
    intersectsWith: direction.intersectsWith,
    imagePath,
    metadataPath,
    imageFile,
    metadataFile,
    attempt: renderResult.attempt,
  };
}

async function persistAssetLibrary({ asset, persistedRenders, outputDir, retryLimit }) {
  const assetWithOutput = {
    ...asset,
    outputSubdirectory: outputDirectoryForAsset(asset.relativePath),
  };
  const { assetDirectory, manifestPath, readmePath } = libraryFilePaths({
    outputDir,
    asset: assetWithOutput,
  });
  const library = buildAssetLibrary({
    asset,
    outputSubdirectory: assetWithOutput.outputSubdirectory,
    renderProfile: RAISED_RENDER_PROFILE,
    retryLimit,
    persistedRenders,
  });

  await writeJson(manifestPath, library);
  await writeText(readmePath, renderAssetLibraryReadme(library));

  return {
    asset: asset.relativePath,
    assetDirectory,
    manifestPath,
    readmePath,
    completedViews: library.completedViews,
    missingViews: library.missingViews,
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
  const assetLibraries = [];

  for (const asset of assets) {
    await resetDir(path.join(config.outputDir, outputDirectoryForAsset(asset.relativePath)));

    const persistedRenders = [];

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

      const persistedRender = await persistRender({
        asset,
        direction,
        renderResult,
        outputDir: config.outputDir,
      });

      persistedRenders.push(persistedRender);
      completedRenders.push(persistedRender);
    }

    assetLibraries.push(
      await persistAssetLibrary({
        asset,
        persistedRenders,
        outputDir: config.outputDir,
        retryLimit: config.retryLimit,
      }),
    );
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
    librariesWritten: assetLibraries.length,
    rendersCompleted: completedRenders.length,
    uniqueFailures: deduplicatedFailures.length,
    assetLibraries,
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
