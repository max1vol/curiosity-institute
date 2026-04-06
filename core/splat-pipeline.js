import fs from "node:fs/promises";
import path from "node:path";

import { ROOM_BLUEPRINTS } from "./game-content/catalog.js";
import { ensureDir, extensionFromMimeType, outputDirectoryForAsset, readFileBuffer, resetDir, walkFiles, writeBuffer, writeJson, writeText } from "./fs-utils.js";
import { generateEditedImage } from "./google-image-client.js";
import { FailureCollector, renderDeduplicatedFailuresMarkdown } from "./reporting.js";
import { classifyRetryDecision } from "./retry-policy.js";
import { buildGaussianSplatPoints, imageMimeTypeForPath, readRgbaPixels, writeAsciiPly } from "./splat-point-cloud.js";
import { SPLAT_PROFILE, buildSplatReadmeLines, buildSplatViewPrompt, viewDefinitionForIndex, yawDegForExistingRenderView } from "./splat-prompts.js";

const DEFAULT_SCENE_CENTER = [0, 1.4, 0];
const DEFAULT_LOOK_AT = [0, 1.4, 0];
const DEFAULT_CAMERA_UP = [0, 1, 0];
const DEFAULT_CAMERA_RADIUS = 12;

function sleep(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function roomAssetSet() {
  return new Set(ROOM_BLUEPRINTS.map((room) => room.artAsset));
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function titleFromAsset(relativePath) {
  return path
    .parse(relativePath)
    .name
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function trimPointBudget(points, targetCount) {
  if (points.length <= targetCount) {
    return points;
  }

  const keepEvery = Math.ceil(points.length / targetCount);
  return points.filter((_, index) => index % keepEvery === 0).slice(0, targetCount);
}

async function discoverRenderLibraries(renderRoot) {
  let files = [];

  try {
    files = await walkFiles(renderRoot);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const roomAssets = roomAssetSet();
  const libraries = files
    .filter((filePath) => path.basename(filePath) === "library.json")
    .sort();

  const manifests = [];

  for (const libraryPath of libraries) {
    const manifest = JSON.parse(await fs.readFile(libraryPath, "utf8"));

    if (!roomAssets.has(toPosix(manifest.asset))) {
      continue;
    }

    manifests.push({
      libraryPath,
      manifest,
    });
  }

  return manifests;
}

async function persistSourceView({ sourceBuffer, sourceMimeType, outputDirectory, viewId, metadata }) {
  const extension = extensionFromMimeType(sourceMimeType);
  const imageFile = `${viewId}${extension}`;
  const imagePath = path.join(outputDirectory, "views", imageFile);
  const metadataFile = `${viewId}.json`;
  const metadataPath = path.join(outputDirectory, "views", metadataFile);

  await writeBuffer(imagePath, sourceBuffer);
  await writeJson(metadataPath, metadata);

  return {
    ...metadata,
    imageFile,
    imagePath,
    metadataFile,
    metadataPath,
  };
}

async function generateViewWithRetries({
  asset,
  assetLabel,
  config,
  failureCollector,
  referenceImages,
  consistencyAnchorLabel,
  outputDirectory,
  viewIndex,
}) {
  const view = viewDefinitionForIndex(viewIndex);
  const prompt = buildSplatViewPrompt({
    assetLabel,
    assetRelativePath: asset,
    viewIndex,
    viewCount: config.viewCount,
    referenceKind: "tracked source concept art",
    referenceLabel: assetLabel,
    consistencyAnchorLabel,
    supportingReferenceLabels: referenceImages.slice(1).map((reference) => reference.label),
  });

  let lastError = null;

  for (let attempt = 1; attempt <= config.retryLimit; attempt += 1) {
    try {
      const result = await generateEditedImage({
        auth: config.auth,
        model: config.model,
        projectId: config.projectId,
        location: config.location,
        prompt,
        imageBuffer: referenceImages[0]?.imageBuffer,
        mimeType: referenceImages[0]?.mimeType,
        referenceImages,
        dryRun: config.dryRun,
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          candidateCount: 1,
          imageConfig: {
            imageSize: config.imageSize,
          },
        },
      });

      return persistSourceView({
        sourceBuffer: result.imageBuffer,
        sourceMimeType: result.mimeType,
        outputDirectory,
        viewId: view.id,
        metadata: {
          id: view.id,
          label: view.label,
          yawDeg: view.cameraYawDeg,
          sourceMode: "nano-banana",
          prompt,
          attempt,
          generatedAt: new Date().toISOString(),
          model: config.model,
          referenceImageCount: referenceImages.length,
          referenceImageLabels: referenceImages.map((reference) => reference.label),
          modelText: result.modelText,
          modelResponse: result.responseMeta,
        },
      });
    } catch (error) {
      lastError = error;
      const retryDecision = classifyRetryDecision(error, attempt);

      failureCollector.recordAttempt(
        {
          asset,
          direction: `view:${view.id}`,
          retryLimit: config.retryLimit,
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

  throw lastError ?? new Error(`Unable to generate ${view.id} for ${asset}`);
}

async function buildFreshReferenceImages({ manifest, conceptFilePath, config }) {
  const references = [];
  const conceptBuffer = await readFileBuffer(conceptFilePath);
  references.push({
    label: "concept-art",
    mimeType: imageMimeTypeForPath(conceptFilePath),
    imageBuffer: conceptBuffer,
  });

  for (const view of manifest.views) {
    if (references.length >= config.maxReferenceImages) {
      break;
    }

    const sourcePath = path.join(config.renderRoot, manifest.outputDirectory, view.imageFile);

    try {
      references.push({
        label: view.label ?? view.id,
        mimeType: imageMimeTypeForPath(sourcePath),
        imageBuffer: await readFileBuffer(sourcePath),
      });
    } catch {
      // Skip missing render-library references and continue with the references we do have.
    }
  }

  return references;
}

async function promoteGeneratedConsistencyAnchor({ referenceImages, generatedView, config }) {
  const conceptReference = referenceImages[0];
  if (!conceptReference) {
    return referenceImages;
  }

  const anchorReference = {
    label: `${generatedView.label} anchor`,
    mimeType: imageMimeTypeForPath(generatedView.imagePath),
    imageBuffer: await readFileBuffer(generatedView.imagePath),
  };
  const remainingReferences = referenceImages.slice(1).filter((reference) => reference.label !== anchorReference.label);

  return [conceptReference, anchorReference, ...remainingReferences].slice(0, config.maxReferenceImages);
}

async function generateFreshViews({
  manifest,
  asset,
  assetLabel,
  conceptFilePath,
  config,
  failureCollector,
  outputDirectory,
}) {
  let referenceImages = await buildFreshReferenceImages({
    manifest,
    conceptFilePath,
    config,
  });
  const views = [];
  let consistencyAnchorLabel = null;

  for (let viewIndex = 0; viewIndex < config.viewCount; viewIndex += 1) {
    const generatedView =
      await generateViewWithRetries({
        asset,
        assetLabel,
        config,
        failureCollector,
        referenceImages,
        consistencyAnchorLabel,
        outputDirectory,
        viewIndex,
      });
    views.push(generatedView);

    if (!consistencyAnchorLabel) {
      referenceImages = await promoteGeneratedConsistencyAnchor({
        referenceImages,
        generatedView,
        config,
      });
      consistencyAnchorLabel = referenceImages.find((reference) => reference.label.endsWith(" anchor"))?.label ?? null;
    }
  }

  return views;
}

async function copyRenderLibraryViews({ manifest, config, outputDirectory }) {
  const views = [];

  for (const view of manifest.views.slice(0, config.viewCount)) {
    const sourcePath = path.join(config.renderRoot, manifest.outputDirectory, view.imageFile);
    const sourceBuffer = await readFileBuffer(sourcePath);
    const sourceMimeType = imageMimeTypeForPath(sourcePath);

    views.push(
      await persistSourceView({
        sourceBuffer,
        sourceMimeType,
        outputDirectory,
        viewId: view.id,
        metadata: {
          id: view.id,
          label: view.label,
          yawDeg: yawDegForExistingRenderView(view.id),
          sourceMode: "render-library",
          sourceImagePath: sourcePath,
          sourceMetadataPath: path.join(config.renderRoot, manifest.outputDirectory, view.metadataFile),
          generatedAt: new Date().toISOString(),
        },
      }),
    );
  }

  return views;
}

async function buildSourceViews({ manifest, config, failureCollector, outputDirectory }) {
  const asset = toPosix(manifest.asset);
  const assetLabel = titleFromAsset(asset);
  const conceptFilePath = path.join(config.inputDir, asset);

  if (config.refreshViews) {
    try {
      return await generateFreshViews({
        manifest,
        asset,
        assetLabel,
        conceptFilePath,
        config,
        failureCollector,
        outputDirectory,
      });
    } catch (error) {
      failureCollector.recordAttempt(
        {
          asset,
          direction: "view-fallback",
          retryLimit: config.retryLimit,
          retryable: false,
          retryCategory: "fallback",
          retryDelayMs: 0,
        },
        new Error(
          `${error instanceof Error ? error.message : String(error)} Falling back to existing render-library angles.`
        ),
        config.retryLimit,
      );
    }
  }

  return copyRenderLibraryViews({ manifest, config, outputDirectory });
}

async function buildPointsFromViews(views, config) {
  const imageViews = [];

  for (const view of views) {
    const rgba = await readRgbaPixels(view.imagePath);
    imageViews.push({
      id: view.id,
      yawDeg: typeof view.yawDeg === "number" ? view.yawDeg : 0,
      ...rgba,
    });
  }

  const points = buildGaussianSplatPoints({
    imageViews,
    sceneCenter: { x: DEFAULT_SCENE_CENTER[0], y: DEFAULT_SCENE_CENTER[1], z: DEFAULT_SCENE_CENTER[2] },
    lookAt: { x: DEFAULT_LOOK_AT[0], y: DEFAULT_LOOK_AT[1], z: DEFAULT_LOOK_AT[2] },
    radius: DEFAULT_CAMERA_RADIUS,
    pointsPerView: config.pointsPerView,
  });

  return trimPointBudget(points, config.pointsPerAsset);
}

function buildSplatManifest({ asset, views, pointCount, config }) {
  return {
    asset,
    format: "ply",
    profile: SPLAT_PROFILE.id,
    label: SPLAT_PROFILE.label,
    sourceMode: views[0]?.sourceMode ?? "render-library",
    model: views[0]?.sourceMode === "nano-banana" ? config.model : null,
    splatFile: "splat.ply",
    generatedAt: new Date().toISOString(),
    pointCount,
    sceneCenter: DEFAULT_SCENE_CENTER,
    lookAt: DEFAULT_LOOK_AT,
    cameraUp: DEFAULT_CAMERA_UP,
    cameraRadius: DEFAULT_CAMERA_RADIUS,
    headingOffsetDeg: 0,
    views: views.map((view) => ({
      id: view.id,
      label: view.label,
      yawDeg: view.yawDeg,
      imageFile: view.imageFile,
      metadataFile: view.metadataFile,
      sourceMode: view.sourceMode,
    })),
  };
}

async function compileLibraryToSplat({ manifest, config, failureCollector }) {
  const asset = toPosix(manifest.asset);
  const outputDirectory = path.join(config.outputDir, outputDirectoryForAsset(asset));
  await resetDir(outputDirectory);
  await ensureDir(path.join(outputDirectory, "views"));

  const views = await buildSourceViews({
    manifest,
    config,
    failureCollector,
    outputDirectory,
  });

  if (!views.length) {
    throw new Error(`No source views were available for ${asset}.`);
  }

  const points = await buildPointsFromViews(views, config);
  if (!points.length) {
    throw new Error(`No gaussian splat points were synthesized for ${asset}.`);
  }

  await writeAsciiPly(path.join(outputDirectory, "splat.ply"), points, {
    asset,
    sourceMode: views[0]?.sourceMode ?? "render-library",
  });

  const manifestJson = buildSplatManifest({
    asset,
    views,
    pointCount: points.length,
    config,
  });

  await writeJson(path.join(outputDirectory, "splat.json"), manifestJson);
  await writeText(
    path.join(outputDirectory, "README.md"),
    [
      ...buildSplatReadmeLines({
        asset,
        viewCount: views.length,
        pointCount: points.length,
        sourceMode: manifestJson.sourceMode,
        model: manifestJson.model ?? "existing render-library views",
      }),
      "",
      ...views.map((view) => `- View ${view.id}: \`views/${view.imageFile}\` (${view.sourceMode})`),
      "",
      `- Profile tricks: ${SPLAT_PROFILE.tricks.join(" ")}`,
      "",
    ].join("\n"),
  );

  return {
    asset,
    outputSubdirectory: outputDirectoryForAsset(asset),
    pointCount: points.length,
    splatFile: "splat.ply",
    sourceMode: manifestJson.sourceMode,
  };
}

function renderSplatFailureReadme({ uniqueFailures, summary }) {
  const lines = [
    "# Gaussian Splat Build Report",
    "",
    "This file is generated by the multi-view gaussian-splat pipeline.",
    "",
    `- Input art root: ${summary.inputDir}`,
    `- Render root: ${summary.renderRoot}`,
    `- Output dir: ${summary.outputDir}`,
    `- Refresh views with Nano Banana: ${summary.refreshViews ? "yes" : "no"}`,
    `- Model: ${summary.model}`,
    `- Points per view target: ${summary.pointsPerView}`,
    `- Points per asset cap: ${summary.pointsPerAsset}`,
    `- Libraries discovered: ${summary.librariesDiscovered}`,
    `- Splats written: ${summary.splatsWritten}`,
    "",
  ];

  if (!uniqueFailures.length) {
    lines.push("No unique failures were recorded in the most recent run.");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(`Unique failures recorded: ${uniqueFailures.length}`);
  lines.push("");

  for (const failure of uniqueFailures) {
    lines.push(`## ${failure.representativeMessage}`);
    lines.push("");
    lines.push(`- Occurrences: ${failure.occurrences}`);
    lines.push(`- Normalized key: \`${failure.normalizedMessage}\``);
    lines.push("- Affected assets:");
    for (const target of failure.targets) {
      lines.push(`  - ${target.asset} :: ${target.direction}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function runSplatPipeline(config) {
  await ensureDir(config.outputDir);
  await ensureDir(config.reportsDir);

  const libraries = await discoverRenderLibraries(config.renderRoot);
  const failureCollector = new FailureCollector();
  const completedSplats = [];
  const usableLibraries = config.assetLimit == null ? libraries : libraries.slice(0, config.assetLimit);

  for (const { manifest } of usableLibraries) {
    try {
      completedSplats.push(
        await compileLibraryToSplat({
          manifest,
          config,
          failureCollector,
        }),
      );
    } catch (error) {
      failureCollector.recordFinalFailure(
        {
          asset: manifest.asset,
          direction: "gsplat",
          retryLimit: config.retryLimit,
        },
        error,
        config.retryLimit,
      );
    }
  }

  const deduplicatedFailures = Array.from(failureCollector.uniqueFailures.values());
  const summary = {
    dryRun: config.dryRun,
    inputDir: config.inputDir,
    renderRoot: config.renderRoot,
    outputDir: config.outputDir,
    reportsDir: config.reportsDir,
    refreshViews: config.refreshViews,
    model: config.model,
    retryLimit: config.retryLimit,
    pointsPerView: config.pointsPerView,
    pointsPerAsset: config.pointsPerAsset,
    librariesDiscovered: libraries.length,
    splatsWritten: completedSplats.length,
    uniqueFailures: deduplicatedFailures.length,
    profile: SPLAT_PROFILE.id,
    tricks: SPLAT_PROFILE.tricks,
    completedSplats,
    generatedAt: new Date().toISOString(),
  };

  await writeJson(path.join(config.reportsDir, "run-summary.json"), summary);
  await writeJson(path.join(config.reportsDir, "attempt-failures.json"), failureCollector.attemptFailures);
  await writeJson(path.join(config.reportsDir, "deduplicated-failures.json"), deduplicatedFailures);
  await writeText(
    path.join(config.reportsDir, "deduplicated-failures.md"),
    renderDeduplicatedFailuresMarkdown(deduplicatedFailures),
  );
  await writeText(
    path.join(config.reportsDir, "README.md"),
    renderSplatFailureReadme({
      uniqueFailures: deduplicatedFailures,
      summary,
    }),
  );

  return summary;
}
