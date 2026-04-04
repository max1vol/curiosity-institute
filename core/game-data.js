import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { outputDirectoryForAsset, walkFiles } from "./fs-utils.js";
import { CATEGORY_METADATA, ROOM_BLUEPRINTS, THEME_DEFINITIONS, TITLE_OVERRIDES } from "./game-content/catalog.js";
import {
  FREE_TEXT_DECK,
  MATCH_PAIR_DECK,
  MCQ_DECK,
  QUEST_DECK,
  QUIZ_DECK,
  STUDY_MODE_WEIGHTS,
} from "./game-content/challenges.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const SPLAT_EXTENSIONS = new Map([
  [".ksplat", "ksplat"],
  [".spz", "spz"],
  [".splat", "splat"],
  [".ply", "ply"],
]);

export { ROOM_BLUEPRINTS } from "./game-content/catalog.js";

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function titleFromFile(relativePath) {
  if (TITLE_OVERRIDES[relativePath]) {
    return TITLE_OVERRIDES[relativePath];
  }

  const parsed = path.parse(relativePath);
  return parsed.name
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function walkFilesIfPresent(directoryPath) {
  try {
    return await walkFiles(directoryPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function publicPath(...segments) {
  return `/${segments.join("/")}`;
}

function toRelativeId(relativePath) {
  return relativePath.replace(/\.[^.]+$/u, "");
}

function nodeIdForRoom(roomId) {
  return `${roomId}:anchor`;
}

function roomCenter(room) {
  return {
    x: room.position.x + room.position.width / 2,
    y: room.position.y + room.position.height / 2,
  };
}

function headingBetweenRooms(sourceRoom, targetRoom) {
  const source = roomCenter(sourceRoom);
  const target = roomCenter(targetRoom);
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  return normalizeHeading((Math.atan2(dx, -dy) * 180) / Math.PI);
}

function normalizeHeading(value) {
  return ((value % 360) + 360) % 360;
}

function supportedSplatFormat(filePath) {
  return SPLAT_EXTENSIONS.get(path.extname(filePath).toLowerCase()) ?? null;
}

function finiteNumberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseVector3Tuple(value) {
  if (Array.isArray(value) && value.length === 3) {
    const tuple = value.map((entry) => finiteNumberOrNull(entry));

    if (tuple.every((entry) => entry !== null)) {
      return tuple;
    }
  }

  if (value && typeof value === "object") {
    const x = finiteNumberOrNull(value.x);
    const y = finiteNumberOrNull(value.y);
    const z = finiteNumberOrNull(value.z);

    if (x !== null && y !== null && z !== null) {
      return [x, y, z];
    }
  }

  return undefined;
}

function buildRoomImmersiveMap(room, roomsById) {
  if (!room.panoramaPath && !room.splatPath) {
    return null;
  }

  const nodeId = nodeIdForRoom(room.id);
  const edges = (room.immersiveNeighbors ?? [])
    .map((neighborId) => roomsById.get(neighborId))
    .filter((neighbor) => neighbor && (neighbor.panoramaPath || neighbor.splatPath))
    .map((neighbor) => {
      const headingDeg = normalizeHeading(headingBetweenRooms(room, neighbor));
      const returnHeadingDeg = normalizeHeading(headingBetweenRooms(neighbor, room) + 180);

      return {
        id: `${room.id}-to-${neighbor.id}`,
        toNodeId: nodeIdForRoom(neighbor.id),
        roomId: neighbor.id,
        label: neighbor.label,
        panoramaPath: neighbor.panoramaPath,
        headingDeg,
        targetHeadingDeg: returnHeadingDeg,
        imagePath: neighbor.panoramaPath,
      };
    });

  return {
    roomId: room.id,
    startNodeId: nodeId,
    nodes: [
      {
        id: nodeId,
        roomId: room.id,
        label: room.label,
        panoramaPath: room.panoramaPath,
        panoramaSourcePath: room.panoramaSourcePath,
        panoramaMetadataPath: room.panoramaMetadataPath,
        imagePath: room.panoramaPath,
        sourcePath: room.panoramaSourcePath,
        metadataPath: room.panoramaMetadataPath,
        splatPath: room.splatPath,
        splatMetadataPath: room.splatMetadataPath,
        splatFormat: room.splatFormat,
        splatSceneCenter: room.splatSceneCenter,
        splatLookAt: room.splatLookAt,
        splatCameraUp: room.splatCameraUp,
        splatCameraRadius: room.splatCameraRadius,
        splatHeadingOffsetDeg: room.splatHeadingOffsetDeg,
        edges,
      },
    ],
  };
}

function generatedDisplayPath(concept, preferredViewIndex = 0) {
  if (!concept) {
    return "";
  }

  const renderViews = concept.renderLibrary?.views ?? [];

  return (
    renderViews[preferredViewIndex]?.imagePath ??
    renderViews[0]?.imagePath ??
    concept.panorama?.panoramaPath ??
    ""
  );
}

export async function buildGameData({ repoRoot = path.resolve(".") } = {}) {
  const conceptRoot = path.join(repoRoot, "docs", "concept-art");
  const renderRoot = path.join(repoRoot, "output", "renders");
  const photosphereRoot = path.join(repoRoot, "output", "photospheres");
  const splatRoot = path.join(repoRoot, "output", "splats");
  const reportPath = path.join(repoRoot, "output", "reports", "run-summary.json");
  const runSummary = await readJsonIfPresent(reportPath);
  const conceptFiles = (await walkFiles(conceptRoot))
    .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort();
  const assetByOutputDirectory = new Map(
    conceptFiles.map((filePath) => {
      const relativePath = toPosix(path.relative(conceptRoot, filePath));
      return [toPosix(outputDirectoryForAsset(relativePath)), relativePath];
    }),
  );

  const renderLibraryFiles = (await walkFilesIfPresent(renderRoot))
    .filter((filePath) => path.basename(filePath) === "library.json")
    .sort();

  const renderLibraries = [];
  const renderLibrariesByAsset = new Map();

  for (const libraryPath of renderLibraryFiles) {
    const parsed = JSON.parse(await fs.readFile(libraryPath, "utf8"));
    const asset = toPosix(parsed.asset);
    const library = {
      id: toRelativeId(asset),
      asset,
      label: titleFromFile(asset),
      category: asset.split("/")[0],
      manifestPath: publicPath("output", "renders", parsed.outputDirectory, "library.json"),
      readmePath: publicPath("output", "renders", parsed.outputDirectory, "README.md"),
      outputDirectory: publicPath("output", "renders", parsed.outputDirectory),
      coverageGoal: parsed.coverageGoal,
      renderProfile: parsed.renderProfileLabel,
      views: parsed.views.map((view) => ({
        id: view.id,
        label: view.label,
        slot: view.librarySlot,
        imagePath: publicPath("output", "renders", parsed.outputDirectory, view.imageFile),
        metadataPath: publicPath("output", "renders", parsed.outputDirectory, view.metadataFile),
        overlapInstruction: view.overlapInstruction,
        intersectsWith: view.intersectsWith,
      })),
    };

    renderLibraries.push(library);
    renderLibrariesByAsset.set(asset, library);
  }

  const photosphereFiles = (await walkFilesIfPresent(photosphereRoot))
    .filter((filePath) => path.basename(filePath) === "photosphere.json")
    .sort();

  const panoramasByAsset = new Map();

  for (const photospherePath of photosphereFiles) {
    const parsed = JSON.parse(await fs.readFile(photospherePath, "utf8"));
    const asset = toPosix(parsed.asset);
    const outputDirectory = outputDirectoryForAsset(asset);

    panoramasByAsset.set(asset, {
      asset,
      panoramaPath: publicPath("output", "photospheres", outputDirectory, parsed.imageFile),
      panoramaSourcePath: publicPath("output", "photospheres", outputDirectory, parsed.sourceFile),
      panoramaMetadataPath: publicPath("output", "photospheres", outputDirectory, "photosphere.json"),
      imagePath: publicPath("output", "photospheres", outputDirectory, parsed.imageFile),
      sourcePath: publicPath("output", "photospheres", outputDirectory, parsed.sourceFile),
      metadataPath: publicPath("output", "photospheres", outputDirectory, "photosphere.json"),
      profile: parsed.profile,
    });
  }

  const splatDirectories = new Map();
  for (const filePath of await walkFilesIfPresent(splatRoot)) {
    const relativeDirectory = toPosix(path.relative(splatRoot, path.dirname(filePath)));
    const entry = splatDirectories.get(relativeDirectory) ?? {
      manifestPath: null,
      splatFiles: [],
    };

    if (path.basename(filePath) === "splat.json") {
      entry.manifestPath = filePath;
    }

    if (supportedSplatFormat(filePath)) {
      entry.splatFiles.push(filePath);
    }

    splatDirectories.set(relativeDirectory, entry);
  }

  const splatsByAsset = new Map();

  for (const [relativeDirectory, entry] of splatDirectories) {
    let manifest = null;

    if (entry.manifestPath) {
      manifest = JSON.parse(await fs.readFile(entry.manifestPath, "utf8"));
    }

    const asset = toPosix(manifest?.asset ?? assetByOutputDirectory.get(relativeDirectory) ?? "");
    if (!asset) {
      continue;
    }

    const preferredFileName = manifest?.splatFile ?? manifest?.file ?? null;
    const preferredFilePath = preferredFileName
      ? path.join(splatRoot, relativeDirectory, preferredFileName)
      : null;
    const splatFilePath = preferredFilePath && entry.splatFiles.includes(preferredFilePath) && supportedSplatFormat(preferredFilePath)
      ? preferredFilePath
      : entry.splatFiles
        .slice()
        .sort((left, right) => {
          const leftRank = [".ksplat", ".spz", ".splat", ".ply"].indexOf(path.extname(left).toLowerCase());
          const rightRank = [".ksplat", ".spz", ".splat", ".ply"].indexOf(path.extname(right).toLowerCase());
          return leftRank - rightRank || left.localeCompare(right);
        })[0];

    if (!splatFilePath) {
      continue;
    }

    const format = supportedSplatFormat(splatFilePath);
    if (!format) {
      continue;
    }

    splatsByAsset.set(asset, {
      asset,
      splatPath: publicPath("output", "splats", relativeDirectory, path.basename(splatFilePath)),
      metadataPath: entry.manifestPath ? publicPath("output", "splats", relativeDirectory, path.basename(entry.manifestPath)) : "",
      format,
      sceneCenter: parseVector3Tuple(manifest?.sceneCenter ?? manifest?.center),
      lookAt: parseVector3Tuple(manifest?.lookAt ?? manifest?.target),
      cameraUp: parseVector3Tuple(manifest?.cameraUp ?? manifest?.up),
      cameraRadius:
        finiteNumberOrNull(manifest?.cameraRadius) ??
        finiteNumberOrNull(manifest?.radius) ??
        undefined,
      headingOffsetDeg:
        finiteNumberOrNull(manifest?.headingOffsetDeg) ??
        finiteNumberOrNull(manifest?.yawOffsetDeg) ??
        finiteNumberOrNull(manifest?.headingOffset) ??
        undefined,
    });
  }

  const conceptArt = conceptFiles.map((filePath) => {
    const relativePath = toPosix(path.relative(conceptRoot, filePath));
    const renderLibrary = renderLibrariesByAsset.get(relativePath) ?? null;
    const panorama = panoramasByAsset.get(relativePath) ?? null;
    const splat = splatsByAsset.get(relativePath) ?? null;
    const originalPath = publicPath("docs", "concept-art", relativePath);

    return {
      id: toRelativeId(relativePath),
      asset: relativePath,
      label: titleFromFile(relativePath),
      category: relativePath.split("/")[0],
      displayPath: generatedDisplayPath({ renderLibrary, panorama }),
      originalPath,
      renderLibrary,
      panorama,
      photosphere: panorama,
      splat,
    };
  });

  const conceptArtByAsset = new Map(conceptArt.map((item) => [item.asset, item]));
  const conceptGroups = Object.entries(
    conceptArt.reduce((groups, item) => {
      groups[item.category] ??= [];
      groups[item.category].push(item);
      return groups;
    }, {}),
  ).map(([category, items]) => ({
    id: category,
    label: CATEGORY_METADATA[category]?.label ?? titleFromFile(category),
    description: CATEGORY_METADATA[category]?.description ?? "",
    items,
  }));

  const themes = THEME_DEFINITIONS.map((definition) => {
    const concept = conceptArtByAsset.get(definition.asset);
    const renderLibrary = concept?.renderLibrary ?? null;

    return {
      ...definition,
      heroImage: generatedDisplayPath(concept, 1),
      renderViews: renderLibrary?.views ?? [],
      archiveAssetId: concept?.id ?? "",
    };
  });

  const baseRoomBlueprints = ROOM_BLUEPRINTS.map((room) => {
    const concept = conceptArtByAsset.get(room.artAsset);
    const preview = conceptArtByAsset.get(room.previewAsset);

    return {
      ...room,
      artPath: generatedDisplayPath(concept),
      renderViews: concept?.renderLibrary?.views ?? [],
      immersiveMap: null,
      panoramaPath: concept?.panorama?.panoramaPath ?? "",
      panoramaSourcePath: concept?.panorama?.panoramaSourcePath ?? "",
      panoramaMetadataPath: concept?.panorama?.panoramaMetadataPath ?? "",
      splatPath: concept?.splat?.splatPath,
      splatMetadataPath: concept?.splat?.metadataPath,
      splatFormat: concept?.splat?.format,
      splatSceneCenter: concept?.splat?.sceneCenter,
      splatLookAt: concept?.splat?.lookAt,
      splatCameraUp: concept?.splat?.cameraUp,
      splatCameraRadius: concept?.splat?.cameraRadius,
      splatHeadingOffsetDeg: concept?.splat?.headingOffsetDeg,
      photosphereMap: null,
      photospherePath: concept?.panorama?.panoramaPath ?? "",
      photosphereSourcePath: concept?.panorama?.panoramaSourcePath ?? "",
      photosphereMetadataPath: concept?.panorama?.panoramaMetadataPath ?? "",
      previewPath: generatedDisplayPath(preview) || generatedDisplayPath(concept),
      previewRenderViews: preview?.renderLibrary?.views ?? [],
    };
  });

  const roomBlueprintsById = new Map(baseRoomBlueprints.map((room) => [room.id, room]));
  const roomBlueprints = baseRoomBlueprints.map((room) => {
    const immersiveMap = buildRoomImmersiveMap(room, roomBlueprintsById);

    return {
      ...room,
      immersiveMap,
      photosphereMap: immersiveMap,
    };
  });

  const miniGames = [
    {
      id: "study-quiz",
      label: "Year 6 English Hub",
      roomId: "hotline-desk",
      subjectFocus: "English",
      artAsset: "side-games/mcq-mini-game.png",
      description: "Launch a weighted random English-heavy session with MCQ, free-text, quiz, and matching practice.",
      formatNote: "Weighted study mix: quiz 50%, free-text 25%, MCQ 20%, match pairs 5%.",
      difficultyLabel: "Advanced + Expert",
      reward: { diplomas: 2, paper: 1, ink: 1 },
    },
    {
      id: "estimation",
      label: "Year 6 Maths Hub",
      roomId: "coin-mint-lab",
      subjectFocus: "Maths",
      artAsset: "side-games/estimation-mini-game.png",
      description: "Practice hard Year 6 maths and reasoning through a weighted random challenge mix.",
      formatNote: "Every launch can become a quiz, free-text explanation, MCQ, or matching round.",
      difficultyLabel: "Advanced Mixed",
      reward: { diplomas: 2, paper: 2, revisionTokens: 1 },
    },
    {
      id: "curator-check",
      label: "Year 6 Science Hub",
      roomId: "review-studio",
      subjectFocus: "Science",
      artAsset: "side-games/curator-check-mini-game.png",
      description: "Push through harder science and reasoning prompts that award diplomas instead of spendable unlock currency.",
      formatNote: "Failure can create follow-up quests that reward paper, ink, and revision tokens.",
      difficultyLabel: "Expert Leaning",
      reward: { diplomas: 2, ink: 2, revisionTokens: 1 },
    },
    {
      id: "match-pairs",
      label: "Year 6 Humanities Hub",
      roomId: "curiosity-arcade",
      subjectFocus: "History & Geography",
      artAsset: "side-games/match-pairs-mini-game.png",
      description: "Mix history, geography, and vocabulary practice into the same weighted Year 6 study loop.",
      formatNote: "Matching rounds are rarer, but they still feed diploma progress and quest generation.",
      difficultyLabel: "Expanded Deck",
      reward: { diplomas: 1, paper: 1, ink: 1, revisionTokens: 1 },
    },
  ].map((miniGame) => {
    const concept = conceptArtByAsset.get(miniGame.artAsset);
    return {
      ...miniGame,
      artPath: generatedDisplayPath(concept),
      renderViews: concept?.renderLibrary?.views ?? [],
      panoramaPath: concept?.panorama?.panoramaPath ?? "",
      photospherePath: concept?.panorama?.panoramaPath ?? "",
    };
  });

  const immersiveCount = new Set([...panoramasByAsset.keys(), ...splatsByAsset.keys()]).size;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      conceptArtCount: conceptArt.length,
      renderLibraryCount: renderLibraries.length,
      immersiveCount,
      panoramaCount: panoramasByAsset.size,
      photosphereCount: panoramasByAsset.size,
      splatCount: splatsByAsset.size,
      themeCount: themes.length,
      roomCount: roomBlueprints.length,
      miniGameCount: miniGames.length,
    },
    renderLab: {
      profile: runSummary?.renderProfile ?? null,
      tricks: runSummary?.tricks ?? [],
    },
    themes,
    roomBlueprints,
    miniGames,
    conceptGroups,
    conceptArt,
    renderLibraries,
    mcqDeck: MCQ_DECK,
    quizDeck: QUIZ_DECK,
    freeTextDeck: FREE_TEXT_DECK,
    matchPairDeck: MATCH_PAIR_DECK,
    questDeck: QUEST_DECK,
    studyModeWeights: STUDY_MODE_WEIGHTS,
  };
}

export async function writeGameDataFile({
  repoRoot = path.resolve("."),
  outputFile = path.join(repoRoot, "static", "game", "data", "assets.json"),
} = {}) {
  const data = await buildGameData({ repoRoot });
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, JSON.stringify(data, null, 2) + "\n", "utf8");
  return {
    data,
    outputFile,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { data, outputFile } = await writeGameDataFile({ repoRoot });
  console.log(
    `Wrote ${outputFile} with ${data.summary.conceptArtCount} concept assets and ${data.summary.renderLibraryCount} render libraries.`,
  );
}
