import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { outputDirectoryForAsset, walkFiles } from "./fs-utils.js";

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

export const ROOM_BLUEPRINTS = [
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
  buildChoiceChallenge({
    id: "roman-verism",
    style: "Artifact Read",
    difficulty: "Expert",
    category: "Roman Gallery",
    context: "A journalist challenges the wall text beside a heavily lined Roman portrait bust.",
    prompt: "Which answer best defends the label without oversimplifying the object?",
    correctChoice: "Roman patrons often prized visible age as evidence of service, authority, and lived experience.",
    wrongChoices: [
      "Age lines appeared because Roman sculptors could only carve shallow grooves into stone.",
      "Every bust copied a single imperial prototype, so wrinkles were legally required.",
      "The museum adds the wrinkles digitally to make the bust read better from a distance.",
    ],
    success: "The explanation lands cleanly. The caller quotes the museum back to their editor.",
    failure: "The answer sounds improvised, and the caller doubts the label.",
  }),
  buildChoiceChallenge({
    id: "curator-live-day",
    style: "Public Hotline",
    difficulty: "Advanced",
    category: "Museum Operations",
    context: "A school group wants to know what the curator is actually doing while the floor is live.",
    prompt: "Which response is the strongest short explanation?",
    correctChoice: "Balancing visitor flow, interpretation, object care, and programming decisions in real time.",
    wrongChoices: [
      "Mostly waiting in the back office until a damaged object needs repair.",
      "Rewriting every wall label by hand each time a new visitor arrives.",
      "Only opening rooms after every question in the museum has already been answered.",
    ],
    success: "The group gets it immediately and wants a guided return visit.",
    failure: "The caller hears a job title, not a real explanation, and interest drops.",
  }),
  buildChoiceChallenge({
    id: "staged-expansion",
    style: "Wayfinding Logic",
    difficulty: "Advanced",
    category: "Expansion Strategy",
    context: "A donor asks why some wings stay locked early instead of opening the whole floor at once.",
    prompt: "What is the best curator-grade answer?",
    correctChoice: "Expansion is staged so circulation, staffing, and funding stay readable instead of collapsing all at once.",
    wrongChoices: [
      "Locked wings are decorative and do not affect the museum experience either way.",
      "Museums only open one room at a time because fire codes forbid branching layouts.",
      "Every wing stays locked until all visitors have completed the memory game.",
    ],
    success: "The donor appreciates the operational discipline behind the floor plan.",
    failure: "The answer feels evasive, and the donor loses confidence in the expansion logic.",
  }),
  buildChoiceChallenge({
    id: "welcoming-exhibit",
    style: "Visitor Empathy",
    difficulty: "Advanced",
    category: "Interpretation",
    context: "A caller says museums often feel intimidating and asks what actually makes a room approachable.",
    prompt: "Which answer shows the strongest understanding of visitor comfort?",
    correctChoice: "Clear sightlines, paced labels, and enough orientation cues that visitors know how to begin.",
    wrongChoices: [
      "Keeping the room as dim and silent as possible so people feel they should whisper.",
      "Hiding the strongest objects at the end so only determined visitors find them.",
      "Making every label equally dense so no object appears more important than another.",
    ],
    success: "The caller says the museum sounds intentionally welcoming rather than merely decorative.",
    failure: "The response frames difficulty as prestige, and the caller checks out.",
  }),
  buildChoiceChallenge({
    id: "intersecting-library",
    style: "Render Lab",
    difficulty: "Expert",
    category: "3D Mapping",
    context: "A map designer asks why the render process creates intersecting oblique views instead of one hero image.",
    prompt: "Which answer is the best fit for the repo's rendering approach?",
    correctChoice: "Intersecting views preserve continuity, so camera height, scale, and landmark placement can be cross-checked across angles.",
    wrongChoices: [
      "Three views are only needed because Google models cannot generate a single coherent image.",
      "The extra views exist mainly so every building can use a different vanishing point.",
      "Intersecting libraries are decorative backups with no bearing on spatial consistency.",
    ],
    success: "The designer understands the logic and wants the library files, not just the hero shot.",
    failure: "The explanation makes the pipeline sound arbitrary instead of spatially disciplined.",
  }),
  buildChoiceChallenge({
    id: "photosphere-value",
    style: "Immersive Systems",
    difficulty: "Advanced",
    category: "Photospheres",
    context: "A visitor asks why the museum bothered generating photospheres when flat art already exists.",
    prompt: "Which answer best explains the point of the immersive rooms?",
    correctChoice: "They let visitors read atmosphere, orientation, and depth continuously instead of guessing from a single framed angle.",
    wrongChoices: [
      "They replace the need for room design because 360 imagery automatically fixes weak layouts.",
      "They exist only so the app can hide the regular room art after the first click.",
      "They are faster to make than flat concepts, so the team used them as a shortcut.",
    ],
    success: "The caller immediately understands why the immersive rooms feel more spatially convincing.",
    failure: "The photosphere work sounds redundant, and the visitor sees it as a gimmick.",
  }),
  buildChoiceChallenge({
    id: "raised-massing",
    style: "Spatial Read",
    difficulty: "Expert",
    category: "Raised 3D View",
    context: "A student asks what makes the repo's Google Maps-style renders feel raised instead of flat.",
    prompt: "Which answer is the strongest explanation?",
    correctChoice: "Angled views, cast shadows, terrain stepping, and believable building massing all reinforce vertical separation.",
    wrongChoices: [
      "Flat scenes look raised whenever the saturation is lowered and the sky is removed.",
      "Any top-down image looks 3D as long as the edges are sharpened after export.",
      "The trick is to crop out the ground plane so viewers never compare object heights.",
    ],
    success: "The student picks up the full logic instead of a single visual effect.",
    failure: "The explanation reduces 3D reading to a filter and misses the actual structure.",
  }),
  buildChoiceChallenge({
    id: "label-density",
    style: "Editorial Judgment",
    difficulty: "Expert",
    category: "Review Studio",
    context: "A visitor says the labels are so dense they are skipping the room entirely.",
    prompt: "Which response best preserves rigor while reducing friction?",
    correctChoice: "Keep the deep scholarship, but layer it behind a shorter highlight path and clearer entry labels.",
    wrongChoices: [
      "Delete every long label so the room feels lighter, even if interpretation collapses.",
      "Leave the labels untouched because serious visitors should adapt to the room, not the reverse.",
      "Move the object farther away so the text block feels visually smaller from the aisle.",
    ],
    success: "The caller hears a real editorial strategy rather than a defensive reaction.",
    failure: "The answer treats access and rigor as opposites, which loses the room.",
  }),
  buildChoiceChallenge({
    id: "sightline-stack",
    style: "Wayfinding Logic",
    difficulty: "Expert",
    category: "Foyer Layout",
    context: "A producer wants to know why the foyer concept spends so much effort on sightlines and lane clarity.",
    prompt: "Which answer best matches the museum-floor loop in this repo?",
    correctChoice: "Because the player is juggling movement, pickups, calls, and room choices, so weak sightlines would compound every task.",
    wrongChoices: [
      "Because foyers should always be empty so visitors never stop before the main galleries.",
      "Because the map only works when every room is visible in full from the entrance.",
      "Because sightlines matter for lighting design but not for visitor routing or decisions.",
    ],
    success: "The producer sees how the environment supports actual play, not just atmosphere.",
    failure: "The reply treats layout as wallpaper and misses the loop design.",
  }),
  buildChoiceChallenge({
    id: "immersive-onboarding",
    style: "Visitor Empathy",
    difficulty: "Advanced",
    category: "Room Viewer",
    context: "A parent asks how a first-time visitor should enter an immersive room without getting lost immediately.",
    prompt: "Which answer is the strongest onboarding principle?",
    correctChoice: "Give them a clear facing direction, a few obvious landmarks, and controls that invite gradual movement rather than a sudden spin.",
    wrongChoices: [
      "Rotate the camera quickly on entry so the whole room is shown before they can react.",
      "Hide movement controls until they have clicked at least three artworks.",
      "Start every immersive room facing a blank wall to avoid giving away the layout too soon.",
    ],
    success: "The caller understands why the viewer feels guided instead of chaotic.",
    failure: "The answer would make the immersive view harder to enter, not easier.",
  }),
  buildChoiceChallenge({
    id: "theme-identity",
    style: "Direction Read",
    difficulty: "Advanced",
    category: "Theme Selection",
    context: "A partner asks what actually distinguishes Heritage Hall from Marble Atrium beyond color alone.",
    prompt: "Which answer best captures that difference?",
    correctChoice: "Heritage Hall leans into warmth, striping, and brass density, while Marble Atrium stresses stone, skylight, and institutional clarity.",
    wrongChoices: [
      "Heritage Hall is the only direction with unlockable rooms, while Marble Atrium has none.",
      "Marble Atrium is a night map and Heritage Hall is a daytime map, so the content differs completely.",
      "The two directions use the same spatial language and only swap accent colors at export time.",
    ],
    success: "The partner hears a real design distinction and not just a palette swap.",
    failure: "The answer flattens the directions into cosmetic variants.",
  }),
  buildChoiceChallenge({
    id: "program-priority",
    style: "Priority Call",
    difficulty: "Expert",
    category: "Live Floor",
    context: "A caller asks what the curator should do first when an incoming question lands during active visitor flow.",
    prompt: "Which answer shows the best operational judgment?",
    correctChoice: "Stabilize the immediate floor state, then answer clearly before the delay erodes confidence or circulation.",
    wrongChoices: [
      "Ignore the call until every visitor has left so the answer can be perfectly polished.",
      "Answer instantly even if it means abandoning a bottleneck that is already forming.",
      "Close the nearest room whenever a hotline call appears so the floor has fewer variables.",
    ],
    success: "The caller hears a calm triage mindset rather than a rigid rule.",
    failure: "The response sounds brittle and unable to handle a live museum day.",
  }),
];

const ESTIMATION_DECK = [
  {
    id: "ritual-vessel-date",
    style: "Chronology Estimate",
    difficulty: "Expert",
    category: "Ancient Objects",
    clue: "The vessel predates the Roman gallery and belongs closer to the late pre-imperial world than to modern display culture.",
    prompt: "Estimate the year of a bronze ritual vessel on loan to the museum.",
    min: -600,
    max: 120,
    value: -220,
    unit: "year",
  },
  {
    id: "saturday-footfall",
    style: "Traffic Forecast",
    difficulty: "Advanced",
    category: "Visitor Operations",
    clue: "Assume a strong weekend, three upgraded rooms, and no major queue collapse.",
    prompt: "Estimate the peak visitor count for a strong Saturday afternoon.",
    min: 180,
    max: 760,
    value: 420,
    unit: "visitors",
  },
  {
    id: "marble-torso-weight",
    style: "Object Handling",
    difficulty: "Advanced",
    category: "Installation",
    clue: "Think denser than plaster, lighter than a full block, and still heavy enough to reshape staffing.",
    prompt: "Estimate the weight of a marble torso waiting for installation.",
    min: 60,
    max: 320,
    value: 160,
    unit: "kg",
  },
  {
    id: "label-edit-pass",
    style: "Editorial Timing",
    difficulty: "Expert",
    category: "Review Studio",
    clue: "The room needs triage, not a full rewrite, but the edit still spans multiple labels and sign-offs.",
    prompt: "Estimate the hours needed for a serious label-tightening pass in one dense gallery.",
    min: 2,
    max: 18,
    value: 9,
    unit: "hours",
  },
  {
    id: "photosphere-stitch-time",
    style: "Pipeline Estimate",
    difficulty: "Expert",
    category: "Photospheres",
    clue: "Include generation, seam checking, and normalization to exact 2:1 output.",
    prompt: "Estimate the minutes needed to cleanly prep one photosphere texture for in-app use.",
    min: 8,
    max: 90,
    value: 34,
    unit: "minutes",
  },
  {
    id: "guided-tour-length",
    style: "Program Design",
    difficulty: "Advanced",
    category: "Tours",
    clue: "Long enough to feel substantive, short enough to keep floor momentum.",
    prompt: "Estimate the ideal length of a compact curator-led gallery tour.",
    min: 6,
    max: 40,
    value: 18,
    unit: "minutes",
  },
  {
    id: "foyer-crossing-distance",
    style: "Spatial Read",
    difficulty: "Advanced",
    category: "Wayfinding",
    clue: "The player route needs to feel short enough for quick responses but not toy-sized.",
    prompt: "Estimate the effective cross-floor distance from the foyer entry to the far side of the stage.",
    min: 12,
    max: 85,
    value: 41,
    unit: "meters",
  },
  {
    id: "coin-mint-yield",
    style: "Revenue Forecast",
    difficulty: "Expert",
    category: "Coin Mint Lab",
    clue: "Assume a clean run with high accuracy, not a perfect one.",
    prompt: "Estimate the coin yield from a strong estimation-lab session.",
    min: 8,
    max: 40,
    value: 24,
    unit: "coins",
  },
];

const CURATOR_CHECK_DECK = [
  buildCuratorScenario({
    id: "corridor-block",
    style: "Flow Triage",
    difficulty: "Advanced",
    category: "Wayfinding",
    context: "A family stops in a narrow corridor to read a label while a school tour stacks behind them.",
    prompt: "What is the best immediate response?",
    correctChoice: "Open a side route, acknowledge both groups, and guide the larger queue around the bottleneck.",
    wrongChoices: [
      "Turn off the label light so the family has to move on.",
      "Freeze the whole corridor until the school group becomes quiet again.",
      "Send the school group back to the foyer without explanation.",
    ],
  }),
  buildCuratorScenario({
    id: "dense-labels",
    style: "Editorial Triage",
    difficulty: "Expert",
    category: "Interpretation",
    context: "Visitors say the room feels smart but exhausting and they are skipping half the labels.",
    prompt: "Which fix is strongest?",
    correctChoice: "Offer a shorter highlight path now and schedule a layered label revision for the room.",
    wrongChoices: [
      "Replace every detailed label with one sentence so no one feels challenged.",
      "Ignore the feedback because dense labels prove the gallery is serious.",
      "Move the labels higher on the wall so visitors notice them less often.",
    ],
  }),
  buildCuratorScenario({
    id: "coin-queue-split",
    style: "Priority Stack",
    difficulty: "Expert",
    category: "Live Floor",
    context: "Coins are piling up near a gallery while the queue at the foyer starts thickening.",
    prompt: "What is the best sequence?",
    correctChoice: "Collect the nearby coins quickly, then reopen circulation toward the foyer before the queue hardens.",
    wrongChoices: [
      "Ignore the foyer entirely and farm the richest coin cluster first.",
      "Lock the gallery immediately so no more coins appear.",
      "Wait until both problems worsen so one decisive reset feels justified.",
    ],
  }),
  buildCuratorScenario({
    id: "photosphere-entry",
    style: "Immersive UX",
    difficulty: "Advanced",
    category: "Room Viewer",
    context: "First-time players enter a 3D room and overspin before they can orient themselves.",
    prompt: "Which change is best aligned with the current viewer?",
    correctChoice: "Bias the entry angle toward a readable landmark and keep movement prompts visible at first contact.",
    wrongChoices: [
      "Increase the rotation speed so they can scan the room before they feel lost.",
      "Hide the movement controls until they have clicked on a render thumbnail.",
      "Start the camera facing the darkest part of the room so the reveal feels dramatic.",
    ],
  }),
  buildCuratorScenario({
    id: "theme-overload",
    style: "Direction Discipline",
    difficulty: "Expert",
    category: "Theme Selection",
    context: "A stakeholder wants to mix Heritage Hall striping, Marble Atrium stone, and Glasshouse plants all into the same starting wing.",
    prompt: "What is the strongest curator response?",
    correctChoice: "Protect a clear primary direction so the room reads intentionally before borrowing only a few secondary notes.",
    wrongChoices: [
      "Accept every motif because more variety always increases perceived depth.",
      "Ban all cross-theme references, even subtle ones, so nothing can be misread.",
      "Keep adding elements until one direction naturally dominates by volume.",
    ],
  }),
  buildCuratorScenario({
    id: "render-seam",
    style: "Render QA",
    difficulty: "Expert",
    category: "Photospheres",
    context: "A newly generated photosphere has a convincing room but the seam visibly pulls at one wall plaque.",
    prompt: "What is the best call?",
    correctChoice: "Keep the useful image, note the seam artifact, and rebuild or rerender the texture before presenting it as final.",
    wrongChoices: [
      "Ship it immediately because any 360 image will always have a major seam somewhere.",
      "Delete the room from the game so the seam can never be noticed again.",
      "Crop the sphere into a flat postcard so the seam technically disappears.",
    ],
  }),
  buildCuratorScenario({
    id: "hotline-vs-tour",
    style: "Program Triage",
    difficulty: "Advanced",
    category: "Hotline Desk",
    context: "A guided tour is halfway through a room when a hotline question comes in and visitor attention starts splitting.",
    prompt: "Which action best protects both experiences?",
    correctChoice: "Land the tour's current point, then answer the hotline cleanly before the delay turns into confusion.",
    wrongChoices: [
      "Drop the tour mid-sentence and improvise an answer while walking away.",
      "Ignore the hotline entirely because tours always outrank public questions.",
      "End the tour on the spot and send everyone back to the foyer.",
    ],
  }),
  buildCuratorScenario({
    id: "memory-game-pressure",
    style: "Audience Design",
    difficulty: "Advanced",
    category: "Curiosity Arcade",
    context: "The memory game is attracting families, but some younger players are bouncing after one failed attempt.",
    prompt: "What is the strongest adjustment?",
    correctChoice: "Keep the challenge, but frame the deck as a rotating museum set so failure feels like a replay invitation instead of a wall.",
    wrongChoices: [
      "Reduce the deck to two pairs so every player wins immediately.",
      "Remove the family focus and market the game only to expert visitors.",
      "Hide the attempt counter so players cannot tell whether they are improving.",
    ],
  }),
];

const MATCH_PAIRS_DECK = [
  "Bust and Pedestal",
  "Coin and Mint",
  "Map and Compass",
  "Lamp and Runner",
  "Glass and Brass",
  "Marble and Skylight",
  "Archive Card and Pin",
  "Relief and Plinth",
  "Label Rail and Caption",
  "Guide Rope and Stanchion",
  "Atrium Bench and Planter",
  "Torch and Mosaic",
  "Lantern and Wayfinder",
  "Scroll and Seal",
  "Vault Door and Key",
  "Terrace and Retaining Wall",
  "Rotunda and Oculus",
  "Casework and Drawer",
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

function buildChoiceChallenge({
  id,
  style,
  difficulty,
  category,
  context,
  prompt,
  correctChoice,
  wrongChoices,
  success,
  failure,
}) {
  return {
    id,
    style,
    difficulty,
    category,
    context,
    prompt,
    choices: [correctChoice, ...wrongChoices],
    correctIndex: 0,
    success,
    failure,
  };
}

function buildCuratorScenario({
  id,
  style,
  difficulty,
  category,
  context,
  prompt,
  correctChoice,
  wrongChoices,
}) {
  return {
    id,
    style,
    difficulty,
    category,
    context,
    prompt,
    choices: [correctChoice, ...wrongChoices],
    correctIndex: 0,
  };
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

    return {
      id: toRelativeId(relativePath),
      asset: relativePath,
      label: titleFromFile(relativePath),
      category: relativePath.split("/")[0],
      originalPath: publicPath("docs", "concept-art", relativePath),
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
      photospherePath: concept?.photosphere?.imagePath ?? "",
      photosphereSourcePath: concept?.photosphere?.sourcePath ?? "",
      photosphereMetadataPath: concept?.photosphere?.metadataPath ?? "",
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
      artPath: concept?.originalPath ?? "",
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
