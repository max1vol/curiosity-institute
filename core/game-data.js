import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { outputDirectoryForAsset, walkFiles } from "./fs-utils.js";
import { CATEGORY_METADATA, ROOM_BLUEPRINTS, THEME_DEFINITIONS, TITLE_OVERRIDES } from "./game-content/catalog.js";
import { CALL_DECK, CURATOR_CHECK_DECK, ESTIMATION_DECK, MATCH_PAIRS_DECK } from "./game-content/challenges.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

function buildRoomPhotosphereMap(room, roomsById) {
  if (!room.photospherePath) {
    return null;
  }

  const nodeId = nodeIdForRoom(room.id);
  const edges = (room.immersiveNeighbors ?? [])
    .map((neighborId) => roomsById.get(neighborId))
    .filter((neighbor) => neighbor && neighbor.photospherePath)
    .map((neighbor) => {
      const headingDeg = normalizeHeading(headingBetweenRooms(room, neighbor));
      const returnHeadingDeg = normalizeHeading(headingBetweenRooms(neighbor, room) + 180);

      return {
        id: `${room.id}-to-${neighbor.id}`,
        toNodeId: nodeIdForRoom(neighbor.id),
        roomId: neighbor.id,
        label: neighbor.label,
        headingDeg,
        targetHeadingDeg: returnHeadingDeg,
        imagePath: neighbor.photospherePath,
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
        imagePath: room.photospherePath,
        sourcePath: room.photosphereSourcePath,
        metadataPath: room.photosphereMetadataPath,
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
    concept.photosphere?.imagePath ??
    concept.originalPath ??
    ""
  );
}

export async function buildGameData({ repoRoot = path.resolve(".") } = {}) {
  const conceptRoot = path.join(repoRoot, "docs", "concept-art");
  const renderRoot = path.join(repoRoot, "output", "renders");
  const photosphereRoot = path.join(repoRoot, "output", "photospheres");
  const reportPath = path.join(repoRoot, "output", "reports", "run-summary.json");
  const runSummary = await readJsonIfPresent(reportPath);

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

  const photospheresByAsset = new Map();

  for (const photospherePath of photosphereFiles) {
    const parsed = JSON.parse(await fs.readFile(photospherePath, "utf8"));
    const asset = toPosix(parsed.asset);
    const outputDirectory = outputDirectoryForAsset(asset);

    photospheresByAsset.set(asset, {
      asset,
      imagePath: publicPath("output", "photospheres", outputDirectory, parsed.imageFile),
      sourcePath: publicPath("output", "photospheres", outputDirectory, parsed.sourceFile),
      metadataPath: publicPath("output", "photospheres", outputDirectory, "photosphere.json"),
      profile: parsed.profile,
    });
  }

  const conceptFiles = (await walkFiles(conceptRoot))
    .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort();

  const conceptArt = conceptFiles.map((filePath) => {
    const relativePath = toPosix(path.relative(conceptRoot, filePath));
    const renderLibrary = renderLibrariesByAsset.get(relativePath) ?? null;
    const photosphere = photospheresByAsset.get(relativePath) ?? null;
    const originalPath = publicPath("docs", "concept-art", relativePath);

    return {
      id: toRelativeId(relativePath),
      asset: relativePath,
      label: titleFromFile(relativePath),
      category: relativePath.split("/")[0],
      displayPath:
        renderLibrary?.views[0]?.imagePath ??
        photosphere?.imagePath ??
        originalPath,
      originalPath,
      renderLibrary,
      photosphere,
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
      photosphereMap: null,
      photospherePath: concept?.photosphere?.imagePath ?? "",
      photosphereSourcePath: concept?.photosphere?.sourcePath ?? "",
      photosphereMetadataPath: concept?.photosphere?.metadataPath ?? "",
      previewPath: generatedDisplayPath(preview) || generatedDisplayPath(concept),
      previewRenderViews: preview?.renderLibrary?.views ?? [],
    };
  });

  const roomBlueprintsById = new Map(baseRoomBlueprints.map((room) => [room.id, room]));
  const roomBlueprints = baseRoomBlueprints.map((room) => ({
    ...room,
    photosphereMap: buildRoomPhotosphereMap(room, roomBlueprintsById),
  }));

  const miniGames = [
    {
      id: "study-quiz",
      label: "Call The Curator",
      roomId: "hotline-desk",
      artAsset: "side-games/mcq-mini-game.png",
      description: "Answer a live museum hotline question and keep the public engaged.",
      formatNote: "Randomized hotline styles with shuffled answers and expert distractors.",
      difficultyLabel: "Advanced + Expert",
      reward: { coins: 12, reputation: 6, curiosity: 8 },
    },
    {
      id: "estimation",
      label: "Estimation Lab",
      roomId: "coin-mint-lab",
      artAsset: "side-games/estimation-mini-game.png",
      description: "Estimate dates, visitor counts, or object weights for a quick income spike.",
      formatNote: "Rotating ranges and tighter clues pulled from the museum floor.",
      difficultyLabel: "Advanced Mixed",
      reward: { coins: 16, reputation: 4, curiosity: 6 },
    },
    {
      id: "curator-check",
      label: "Curator Check",
      roomId: "review-studio",
      artAsset: "side-games/curator-check-mini-game.png",
      description: "Make fast floor-management decisions when visitor flow or labels go sideways.",
      formatNote: "Higher-stakes triage scenarios with four plausible responses.",
      difficultyLabel: "Expert Leaning",
      reward: { coins: 10, reputation: 8, curiosity: 5 },
    },
    {
      id: "match-pairs",
      label: "Match Pairs",
      roomId: "curiosity-arcade",
      artAsset: "side-games/match-pairs-mini-game.png",
      description: "Run a memory-game attraction that boosts family traffic and coin pickups.",
      formatNote: "Eight shuffled pairs drawn from a much larger rotating museum deck.",
      difficultyLabel: "Expanded Deck",
      reward: { coins: 14, reputation: 5, curiosity: 7 },
    },
  ].map((miniGame) => {
    const concept = conceptArtByAsset.get(miniGame.artAsset);
    return {
      ...miniGame,
      artPath: generatedDisplayPath(concept),
      renderViews: concept?.renderLibrary?.views ?? [],
      photospherePath: concept?.photosphere?.imagePath ?? "",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      conceptArtCount: conceptArt.length,
      renderLibraryCount: renderLibraries.length,
      photosphereCount: photospheresByAsset.size,
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
    callDeck: CALL_DECK,
    estimationDeck: ESTIMATION_DECK,
    curatorCheckDeck: CURATOR_CHECK_DECK,
    matchPairsDeck: MATCH_PAIRS_DECK,
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
