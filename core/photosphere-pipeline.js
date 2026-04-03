import path from "node:path";

import { ROOM_BLUEPRINTS } from "./game-data.js";
import { listInputImages, ensureDir, resetDir, readFileBuffer, writeBuffer, writeJson, writeText, outputDirectoryForAsset, extensionFromMimeType } from "./fs-utils.js";
import { generateEditedImage } from "./google-image-client.js";
import { buildPhotospherePrompt, PHOTOSPHERE_PROFILE } from "./photosphere-prompt.js";
import { stretchPanoramaToPhotosphere } from "./photosphere-utils.js";
import { FailureCollector, renderDeduplicatedFailuresMarkdown, renderFailureReadme } from "./reporting.js";
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

function roomAssetSet() {
  return new Set(ROOM_BLUEPRINTS.map((room) => room.artAsset));
}

async function renderPhotosphere({ asset, config, failureCollector }) {
  const imageBuffer = await readFileBuffer(asset.absolutePath);
  const mimeType = detectMimeType(asset.absolutePath);
  const prompt = buildPhotospherePrompt({
    assetName: asset.baseName
  });
  const context = {
    asset: asset.relativePath,
    direction: "photosphere",
    retryLimit: config.retryLimit
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
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          candidateCount: 1,
          imageConfig: {
            aspectRatio: config.aspectRatio,
            imageSize: config.imageSize
          }
        }
      });

      return {
        success: true,
        attempt,
        prompt,
        ...result
      };
    } catch (error) {
      lastError = error;
      const retryDecision = classifyRetryDecision(error, attempt);

      failureCollector.recordAttempt(
        {
          ...context,
          retryable: retryDecision.retryable,
          retryCategory: retryDecision.category,
          retryDelayMs: retryDecision.delayMs
        },
        error,
        attempt
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
    prompt
  };
}

async function persistPhotosphere({ asset, renderResult, outputDir, imageSize, aspectRatio }) {
  const assetDirectory = path.join(outputDir, outputDirectoryForAsset(asset.relativePath));
  const rawExtension = extensionFromMimeType(renderResult.mimeType);
  const sourceFile = `photosphere-source${rawExtension}`;
  const sourcePath = path.join(assetDirectory, sourceFile);
  const imageFile = "photosphere.png";
  const imagePath = path.join(assetDirectory, imageFile);
  const metadataFile = "photosphere.json";
  const metadataPath = path.join(assetDirectory, metadataFile);

  await writeBuffer(sourcePath, renderResult.imageBuffer);

  if (renderResult.responseMeta?.dryRun) {
    await writeBuffer(imagePath, renderResult.imageBuffer);
  } else {
    await stretchPanoramaToPhotosphere({
      inputPath: sourcePath,
      outputPath: imagePath
    });
  }

  await writeJson(metadataPath, {
    asset: asset.relativePath,
    profile: PHOTOSPHERE_PROFILE.id,
    prompt: renderResult.prompt,
    modelText: renderResult.modelText,
    modelResponse: renderResult.responseMeta,
    imageSize,
    aspectRatio,
    generatedAt: new Date().toISOString(),
    attempt: renderResult.attempt,
    sourceFile,
    imageFile
  });

  return {
    asset: asset.relativePath,
    outputSubdirectory: outputDirectoryForAsset(asset.relativePath),
    sourceFile,
    imageFile,
    metadataFile,
    sourcePath,
    imagePath,
    metadataPath,
    attempt: renderResult.attempt
  };
}

export async function runPhotospherePipeline(config) {
  await ensureDir(config.outputDir);
  await ensureDir(config.reportsDir);

  const roomAssets = roomAssetSet();
  const assets = (await listInputImages(config.inputDir)).filter((asset) => roomAssets.has(asset.relativePath));
  const failureCollector = new FailureCollector();
  const completedPhotospheres = [];

  for (const asset of assets) {
    await resetDir(path.join(config.outputDir, outputDirectoryForAsset(asset.relativePath)));

    const renderResult = await renderPhotosphere({
      asset,
      config,
      failureCollector
    });

    if (!renderResult.success) {
      continue;
    }

    try {
      completedPhotospheres.push(
        await persistPhotosphere({
          asset,
          renderResult,
          outputDir: config.outputDir,
          imageSize: config.imageSize,
          aspectRatio: config.aspectRatio
        })
      );
    } catch (error) {
      failureCollector.recordFinalFailure(
        {
          asset: asset.relativePath,
          direction: "photosphere",
          retryLimit: config.retryLimit
        },
        error,
        renderResult.attempt
      );
    }
  }

  const deduplicatedFailures = Array.from(failureCollector.uniqueFailures.values());
  const summary = {
    model: config.model,
    dryRun: config.dryRun,
    retryLimit: config.retryLimit,
    inputDir: config.inputDir,
    outputDir: config.outputDir,
    reportsDir: config.reportsDir,
    profile: PHOTOSPHERE_PROFILE.id,
    tricks: PHOTOSPHERE_PROFILE.tricks,
    assetsDiscovered: assets.length,
    photospheresCompleted: completedPhotospheres.length,
    uniqueFailures: deduplicatedFailures.length,
    completedPhotospheres,
    generatedAt: new Date().toISOString()
  };

  await writeJson(path.join(config.reportsDir, "run-summary.json"), summary);
  await writeJson(path.join(config.reportsDir, "attempt-failures.json"), failureCollector.attemptFailures);
  await writeJson(path.join(config.reportsDir, "deduplicated-failures.json"), deduplicatedFailures);
  await writeText(
    path.join(config.reportsDir, "deduplicated-failures.md"),
    renderDeduplicatedFailuresMarkdown(deduplicatedFailures)
  );
  await writeText(
    path.join(config.reportsDir, "README.md"),
    renderFailureReadme({
      retryLimit: config.retryLimit,
      profileLabel: PHOTOSPHERE_PROFILE.label,
      uniqueFailures: deduplicatedFailures
    })
  );

  return summary;
}
