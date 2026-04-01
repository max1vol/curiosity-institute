import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { walkFiles } from "./fs-utils.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

const CATEGORY_METADATA = {
  "detail-sheets": {
    label: "Detail Sheets",
    description: "Props, review boards, and art-language sheets that define museum surfaces and objects.",
  },
  "developed-views": {
    label: "Developed Views",
    description: "Focused environment mockups that show specific loops and room interactions.",
  },
  "gameplay-directions": {
    label: "Gameplay Directions",
    description: "The three major visual directions for the playable museum floor.",
  },
  "main-views": {
    label: "Main Views",
    description: "High-level room concepts for the foyer and the Roman gallery.",
  },
  references: {
    label: "References",
    description: "Character and layout anchors used to keep the curator and flow readable.",
  },
  "side-games": {
    label: "Side Games",
    description: "Lightweight museum mini-game concepts for trivia, estimation, and curator checks.",
  },
};

const TITLE_OVERRIDES = {
  "detail-sheets/museum-style-details.png": "Museum Style Details",
  "detail-sheets/review-board-development-cards.png": "Review Board Development Cards",
  "detail-sheets/roman-gallery-prop-sheet.png": "Roman Gallery Prop Sheet",
  "developed-views/coin-mint-demo-day2.png": "Coin Mint Demo Day 2",
  "developed-views/level-2-map-gallery-clean.png": "Level 2 Map Gallery",
  "gameplay-directions/direction-1-heritage-hall.png": "Heritage Hall",
  "gameplay-directions/direction-2-marble-atrium.png": "Marble Atrium",
  "gameplay-directions/direction-3-glasshouse-museum.png": "Glasshouse Museum",
  "main-views/dusty-foyer-start.png": "Dusty Foyer Start",
  "main-views/roman-gallery-open-day1.png": "Roman Gallery Open Day 1",
  "references/curator-style-anchor.png": "Curator Style Anchor",
  "references/foyer-layout-anchor.png": "Foyer Layout Anchor",
  "side-games/curator-check-mini-game.png": "Curator Check Mini Game",
  "side-games/estimation-mini-game.png": "Estimation Mini Game",
  "side-games/match-pairs-mini-game.png": "Match Pairs Mini Game",
  "side-games/mcq-mini-game.png": "MCQ Mini Game",
};

const THEME_DEFINITIONS = [
  {
    id: "heritage-hall",
    label: "Heritage Hall",
    asset: "gameplay-directions/direction-1-heritage-hall.png",
    starterRoomId: "heritage-hall",
    description:
      "Dark green stripes, parquet flooring, and brass warmth for a classic heritage-museum mood.",
    palette: {
      accent: "#c79f58",
      deep: "#17352f",
      highlight: "#f4ead9",
      shadow: "#092017",
    },
  },
  {
    id: "marble-atrium",
    label: "Marble Atrium",
    asset: "gameplay-directions/direction-2-marble-atrium.png",
    starterRoomId: "marble-atrium",
    description:
      "Bright stone surfaces, skylit space, and teal accents for a formal institutional wing.",
    palette: {
      accent: "#4aa8a7",
      deep: "#194250",
      highlight: "#eef4f5",
      shadow: "#0d2630",
    },
  },
  {
    id: "glasshouse-museum",
    label: "Glasshouse Museum",
    asset: "gameplay-directions/direction-3-glasshouse-museum.png",
    starterRoomId: "glasshouse-rotunda",
    description:
      "Glass partitions, plants, terracotta surfaces, and a softer modern museum atmosphere.",
    palette: {
      accent: "#d17d43",
      deep: "#21433f",
      highlight: "#fbf1dd",
      shadow: "#122725",
    },
  },
];

const ROOM_BLUEPRINTS = [
  {
    id: "foyer",
    label: "Dusty Foyer",
    artAsset: "main-views/dusty-foyer-start.png",
    previewAsset: "references/foyer-layout-anchor.png",
    blurb: "The opening lobby where the curator grabs early ticket income and sets the day's route.",
    cost: 0,
    startUnlocked: true,
    requiredRoomIds: [],
    position: { x: 54, y: 278, width: 178, height: 138 },
    rewardRate: 1,
  },
  {
    id: "heritage-hall",
    label: "Heritage Hall Wing",
    artAsset: "gameplay-directions/direction-1-heritage-hall.png",
    previewAsset: "main-views/roman-gallery-open-day1.png",
    blurb: "A warm heritage corridor with coins, locked future space, and dense visitor circulation.",
    cost: 34,
    startUnlocked: false,
    requiredRoomIds: ["foyer"],
    position: { x: 258, y: 226, width: 214, height: 146 },
    rewardRate: 2,
  },
  {
    id: "marble-atrium",
    label: "Marble Atrium",
    artAsset: "gameplay-directions/direction-2-marble-atrium.png",
    previewAsset: "developed-views/level-2-map-gallery-clean.png",
    blurb: "A brighter, more formal route with skylight volume and clear long-range sightlines.",
    cost: 38,
    startUnlocked: false,
    requiredRoomIds: ["foyer"],
    position: { x: 258, y: 392, width: 214, height: 146 },
    rewardRate: 2,
  },
  {
    id: "glasshouse-rotunda",
    label: "Glasshouse Rotunda",
    artAsset: "gameplay-directions/direction-3-glasshouse-museum.png",
    previewAsset: "references/curator-style-anchor.png",
    blurb: "A softer glass-and-plant hub that branches into modern exhibits and side activities.",
    cost: 42,
    startUnlocked: false,
    requiredRoomIds: ["foyer"],
    position: { x: 486, y: 308, width: 220, height: 160 },
    rewardRate: 2,
  },
  {
    id: "roman-gallery",
    label: "Roman Gallery",
    artAsset: "main-views/roman-gallery-open-day1.png",
    previewAsset: "detail-sheets/roman-gallery-prop-sheet.png",
    blurb: "A higher-value exhibit hall with stronger prop language and richer guided-tour rewards.",
    cost: 58,
    startUnlocked: false,
    requiredRoomIds: ["heritage-hall"],
    position: { x: 722, y: 204, width: 212, height: 146 },
    rewardRate: 3,
  },
  {
    id: "coin-mint-lab",
    label: "Coin Mint Lab",
    artAsset: "developed-views/coin-mint-demo-day2.png",
    previewAsset: "side-games/estimation-mini-game.png",
    blurb: "A hands-on room where estimation rounds turn curiosity into money and reputation.",
    cost: 46,
    startUnlocked: false,
    requiredRoomIds: ["marble-atrium"],
    position: { x: 720, y: 384, width: 214, height: 146 },
    rewardRate: 3,
    miniGameId: "estimation",
  },
  {
    id: "hotline-desk",
    label: "Call The Curator Desk",
    artAsset: "references/curator-style-anchor.png",
    previewAsset: "side-games/mcq-mini-game.png",
    blurb: "A public hotline station for answering museum questions without dropping the floor loop.",
    cost: 28,
    startUnlocked: false,
    requiredRoomIds: ["foyer"],
    position: { x: 54, y: 92, width: 178, height: 136 },
    rewardRate: 2,
    miniGameId: "study-quiz",
  },
  {
    id: "review-studio",
    label: "Review Studio",
    artAsset: "detail-sheets/review-board-development-cards.png",
    previewAsset: "side-games/curator-check-mini-game.png",
    blurb: "A design review room for curator checks and visitor-response triage.",
    cost: 52,
    startUnlocked: false,
    requiredRoomIds: ["roman-gallery"],
    position: { x: 952, y: 108, width: 140, height: 148 },
    rewardRate: 4,
    miniGameId: "curator-check",
  },
  {
    id: "curiosity-arcade",
    label: "Curiosity Arcade",
    artAsset: "detail-sheets/museum-style-details.png",
    previewAsset: "side-games/match-pairs-mini-game.png",
    blurb: "A family-friendly memory space that converts playful side-games into museum buzz.",
    cost: 54,
    startUnlocked: false,
    requiredRoomIds: ["glasshouse-rotunda"],
    position: { x: 952, y: 432, width: 140, height: 148 },
    rewardRate: 4,
    miniGameId: "match-pairs",
  },
];

const CALL_DECK = [
  {
    prompt: "A caller asks why Roman portrait busts often exaggerate age lines. What is the best short answer?",
    choices: [
      "Because realism and experience signaled status and virtue.",
      "Because stone could only be carved with straight lines.",
      "Because all portraits copied one emperor's face.",
    ],
    correctIndex: 0,
    success: "The caller loves the answer and shares the museum hotline with friends.",
    failure: "The caller leaves confused, and the queue loses confidence for a moment.",
  },
  {
    prompt: "A school group asks what a curator actually does during a live museum day.",
    choices: [
      "Balance visitor care, display decisions, and collection storytelling in real time.",
      "Mostly polish the floors before visitors arrive.",
      "Only answer questions after the museum closes.",
    ],
    correctIndex: 0,
    success: "The school group books another visit and your reputation rises.",
    failure: "The explanation lands flat, and curiosity dips slightly.",
  },
  {
    prompt: "A visitor asks why some galleries stay partially locked early in the game.",
    choices: [
      "Because expansion is staged so the museum can fund each wing responsibly.",
      "Because museums are only open one room at a time.",
      "Because every locked room is under construction forever.",
    ],
    correctIndex: 0,
    success: "The visitor appreciates the transparent plan and tips generously.",
    failure: "The answer sounds evasive, and the crowd gets impatient.",
  },
  {
    prompt: "A caller asks what makes an exhibit feel welcoming instead of intimidating.",
    choices: [
      "Clear sightlines, approachable labels, and good pacing through the room.",
      "Making every room as dark and silent as possible.",
      "Keeping the best objects hidden until the end.",
    ],
    correctIndex: 0,
    success: "The caller praises the museum's tone and your curiosity meter climbs.",
    failure: "The caller hangs up unconvinced.",
  },
];

const ESTIMATION_DECK = [
  {
    prompt: "Estimate the year of a bronze ritual vessel on loan to the museum.",
    min: -500,
    max: 2026,
    value: -220,
    unit: "year",
  },
  {
    prompt: "Estimate the peak visitor count for a strong Saturday afternoon.",
    min: 50,
    max: 800,
    value: 420,
    unit: "visitors",
  },
  {
    prompt: "Estimate the weight of a marble torso waiting for installation.",
    min: 20,
    max: 500,
    value: 160,
    unit: "kg",
  },
];

const CURATOR_CHECK_DECK = [
  {
    prompt: "A family is blocking a corridor to read a label while a school tour piles up behind them.",
    choices: ["Open a side route and guide the tour around.", "Turn off the label light.", "Close the whole room."],
    correctIndex: 0,
  },
  {
    prompt: "A visitor says the object labels feel dense and they are skipping the room.",
    choices: ["Offer a shorter highlight path and update the label plan.", "Tell them to read faster.", "Move the visitor to the exit."],
    correctIndex: 0,
  },
  {
    prompt: "Coins are piling up near an exhibit while the queue near the foyer grows.",
    choices: ["Collect nearby coins, then reopen circulation toward the foyer.", "Ignore the queue forever.", "Lock the exhibit immediately."],
    correctIndex: 0,
  },
];

const MATCH_PAIRS_DECK = [
  "Bust and Pedestal",
  "Coin and Mint",
  "Map and Compass",
  "Lamp and Runner",
  "Glass and Brass",
  "Marble and Skylight",
];

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

function publicPath(...segments) {
  return `/${segments.join("/")}`;
}

function toRelativeId(relativePath) {
  return relativePath.replace(/\.[^.]+$/u, "");
}

export async function buildGameData({ repoRoot = path.resolve(".") } = {}) {
  const conceptRoot = path.join(repoRoot, "docs", "concept-art");
  const renderRoot = path.join(repoRoot, "output", "renders");
  const reportPath = path.join(repoRoot, "output", "reports", "run-summary.json");
  const runSummary = await readJsonIfPresent(reportPath);

  const renderLibraryFiles = (await walkFiles(renderRoot))
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

  const conceptFiles = (await walkFiles(conceptRoot))
    .filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
    .sort();

  const conceptArt = conceptFiles.map((filePath) => {
    const relativePath = toPosix(path.relative(conceptRoot, filePath));
    const renderLibrary = renderLibrariesByAsset.get(relativePath) ?? null;

    return {
      id: toRelativeId(relativePath),
      asset: relativePath,
      label: titleFromFile(relativePath),
      category: relativePath.split("/")[0],
      originalPath: publicPath("docs", "concept-art", relativePath),
      renderLibrary,
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
      heroImage: concept?.originalPath ?? "",
      renderViews: renderLibrary?.views ?? [],
      archiveAssetId: concept?.id ?? "",
    };
  });

  const roomBlueprints = ROOM_BLUEPRINTS.map((room) => {
    const concept = conceptArtByAsset.get(room.artAsset);
    const preview = conceptArtByAsset.get(room.previewAsset);

    return {
      ...room,
      artPath: concept?.originalPath ?? "",
      renderViews: concept?.renderLibrary?.views ?? [],
      previewPath: preview?.originalPath ?? concept?.originalPath ?? "",
      previewRenderViews: preview?.renderLibrary?.views ?? [],
    };
  });

  const miniGames = [
    {
      id: "study-quiz",
      label: "Call The Curator",
      roomId: "hotline-desk",
      artAsset: "side-games/mcq-mini-game.png",
      description: "Answer a live museum hotline question and keep the public engaged.",
      reward: { coins: 12, reputation: 6, curiosity: 8 },
    },
    {
      id: "estimation",
      label: "Estimation Lab",
      roomId: "coin-mint-lab",
      artAsset: "side-games/estimation-mini-game.png",
      description: "Estimate dates, visitor counts, or object weights for a quick income spike.",
      reward: { coins: 16, reputation: 4, curiosity: 6 },
    },
    {
      id: "curator-check",
      label: "Curator Check",
      roomId: "review-studio",
      artAsset: "side-games/curator-check-mini-game.png",
      description: "Make fast floor-management decisions when visitor flow or labels go sideways.",
      reward: { coins: 10, reputation: 8, curiosity: 5 },
    },
    {
      id: "match-pairs",
      label: "Match Pairs",
      roomId: "curiosity-arcade",
      artAsset: "side-games/match-pairs-mini-game.png",
      description: "Run a memory-game attraction that boosts family traffic and coin pickups.",
      reward: { coins: 14, reputation: 5, curiosity: 7 },
    },
  ].map((miniGame) => {
    const concept = conceptArtByAsset.get(miniGame.artAsset);
    return {
      ...miniGame,
      artPath: concept?.originalPath ?? "",
      renderViews: concept?.renderLibrary?.views ?? [],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      conceptArtCount: conceptArt.length,
      renderLibraryCount: renderLibraries.length,
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
  outputFile = path.join(repoRoot, "game", "data", "assets.json"),
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
