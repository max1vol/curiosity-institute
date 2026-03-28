export type Subject = "science" | "english";
export type QuizRound = 1 | 2;
export type ComparisonDirection = "above" | "below";
export type QuizMode = "interval" | "signal";
export const confidenceOptions = [55, 65, 75, 85] as const;
export const confidenceLevels = confidenceOptions;
export type ConfidenceOption = (typeof confidenceOptions)[number];
export type ConfidenceLevel = ConfidenceOption;

export type DistrictPalette = {
  glow: string;
  accent: string;
  ground: string;
  stone: string;
  roof: string;
  left: string;
  right: string;
  trim: string;
};

export type DistrictPlot = {
  row: number;
  col: number;
};

export type District = {
  id: "observatory" | "conservatory" | "guildhall" | "harbour";
  name: string;
  subject: Subject;
  summary: string;
  tagline: string;
  lore: string;
  icon: string;
  mentor: string;
  palette: DistrictPalette;
  plot: DistrictPlot;
  sprite: string;
};

export type Quiz = {
  id: string;
  districtId: District["id"];
  title: string;
  prompt: string;
  question: string;
  unit: string;
  min: number;
  max: number;
  answer: number;
  anchors: string[];
  explanation: string;
  round: QuizRound;
  mode: QuizMode;
  comparisonValue?: number;
  comparisonAnswer?: ComparisonDirection;
  source: string;
  reward: string;
};

export type DistrictHistoryEntry = {
  quizId: string;
  points: number;
  accuracy: number;
};

export type DistrictProgressState = {
  unlocked: boolean;
  completed: number;
  stage: number;
  bestScore: number;
  history: DistrictHistoryEntry[];
};

export type DistrictProgress = DistrictProgressState;
export type DistrictProgressMap = Record<string, DistrictProgressState>;

export const districts: District[] = [
  {
    id: "observatory",
    name: "Observatory Rise",
    subject: "science",
    summary: "Space, time, and calibrated measurements repair the city clockwork.",
    tagline: "Space, forces, and careful measuring",
    lore:
      "Chart distances, temperatures, and time spans to repair the brass observatory above the town.",
    icon: "✦",
    mentor: "Astronomer Celia",
    palette: {
      glow: "rgba(255, 208, 133, 0.95)",
      accent: "#f2bd5d",
      ground: "#6b8255",
      stone: "#8a6945",
      roof: "#cf8d52",
      left: "#81542f",
      right: "#a86d43",
      trim: "#ffe0a4",
    },
    plot: { row: 2, col: 3 },
    sprite: "/art/observatory-rise.png",
  },
  {
    id: "conservatory",
    name: "Conservatory Vale",
    subject: "science",
    summary: "Plants, bodies, and habitats turn the greenhouse quarter alive again.",
    tagline: "Living things, habitats, and growth",
    lore:
      "Restore the greenhouse quarter by estimating facts about bodies, plants, and ecosystems.",
    icon: "❃",
    mentor: "Keeper Rowan",
    palette: {
      glow: "rgba(161, 235, 170, 0.95)",
      accent: "#66bb6a",
      ground: "#5a8b68",
      stone: "#547058",
      roof: "#79b367",
      left: "#437551",
      right: "#5b9768",
      trim: "#daf0c2",
    },
    plot: { row: 4, col: 6 },
    sprite: "/art/conservatory-vale.png",
  },
  {
    id: "guildhall",
    name: "Grammar Guildhall",
    subject: "english",
    summary: "Sentence craft and spelling engines restore the clerks' quarter.",
    tagline: "Word craft, clauses, and sentence shape",
    lore:
      "Tune grammar engines and sentence looms by estimating counts hidden inside polished prose.",
    icon: "✎",
    mentor: "Scribe Ada",
    palette: {
      glow: "rgba(174, 215, 255, 0.95)",
      accent: "#76a8ff",
      ground: "#5e6f88",
      stone: "#54637a",
      roof: "#7d92c6",
      left: "#46577f",
      right: "#6277aa",
      trim: "#d7e4ff",
    },
    plot: { row: 6, col: 3 },
    sprite: "/art/grammar-guildhall.png",
  },
  {
    id: "harbour",
    name: "Story Harbour",
    subject: "english",
    summary: "Reading fluency, imagery, and composition guide the harbour library.",
    tagline: "Reading, imagery, and expressive writing",
    lore:
      "Bring the harbour library back to life by estimating reading facts, vocabulary, and poetic details.",
    icon: "☀",
    mentor: "Navigator Mae",
    palette: {
      glow: "rgba(255, 179, 155, 0.95)",
      accent: "#ee8b6d",
      ground: "#836458",
      stone: "#78594f",
      roof: "#c67d5d",
      left: "#83503a",
      right: "#a8674b",
      trim: "#ffd8c6",
    },
    plot: { row: 7, col: 7 },
    sprite: "/art/story-harbour.png",
  },
];

export const districtOrder = districts.map((district) => district.id);
export const districtsById = Object.fromEntries(
  districts.map((district) => [district.id, district]),
) as Record<string, District>;
type BaseQuiz = Omit<
  Quiz,
  "round" | "mode" | "comparisonValue" | "comparisonAnswer" | "source" | "reward"
>;

const rawQuizzes: BaseQuiz[] = [
  {
    id: "obs-1",
    districtId: "observatory",
    title: "Daywheel",
    prompt: "The astronomers need a fresh timing gear for the city clock.",
    question: "Estimate how many minutes Earth takes to spin once on its axis.",
    unit: "minutes",
    min: 60,
    max: 3000,
    answer: 1440,
    anchors: ["An hour has 60 minutes.", "A day has 24 hours."],
    explanation: "24 hours multiplied by 60 minutes gives 1,440 minutes.",
  },
  {
    id: "obs-2",
    districtId: "observatory",
    title: "Heat Gauge",
    prompt: "A laboratory kettle is being calibrated for a Year 5 investigation.",
    question: "Estimate the temperature at which pure water boils at sea level.",
    unit: "°C",
    min: 20,
    max: 150,
    answer: 100,
    anchors: ["Ice melts near 0°C.", "An oven for baking is far hotter than boiling water."],
    explanation: "Water boils at 100°C at normal sea-level pressure.",
  },
  {
    id: "obs-3",
    districtId: "observatory",
    title: "Planet Ledger",
    prompt: "A brass mobile of the Solar System needs the right number of spheres.",
    question: "Estimate how many planets orbit the Sun in our Solar System.",
    unit: "planets",
    min: 1,
    max: 20,
    answer: 8,
    anchors: ["Mercury is closest to the Sun.", "Neptune is the furthest planet."],
    explanation: "The Solar System has eight planets: Mercury to Neptune.",
  },
  {
    id: "obs-4",
    districtId: "observatory",
    title: "Moon Counterweight",
    prompt:
      "An orrery bridge needs to know how long a lunar trip would feel compared with a school week.",
    question: "Estimate how many days it takes the Moon to orbit Earth once.",
    unit: "days",
    min: 1,
    max: 60,
    answer: 27,
    anchors: ["It takes longer than a week.", "It takes less than a school term."],
    explanation: "The Moon completes an orbit in roughly 27.3 days.",
  },
  {
    id: "obs-5",
    districtId: "observatory",
    title: "Speed Tally",
    prompt: "A rocket postcard in the observatory lists everyday travel facts.",
    question: "Estimate how many metres a sound wave travels in one second through air.",
    unit: "metres",
    min: 10,
    max: 1000,
    answer: 343,
    anchors: ["It is much faster than a running child.", "It is slower than light by a huge amount."],
    explanation: "Sound travels at about 343 metres per second in air at room temperature.",
  },
  {
    id: "con-1",
    districtId: "conservatory",
    title: "Skeleton Arch",
    prompt: "The conservatory gate is decorated with carved bones and needs an accurate count.",
    question: "Estimate how many bones are in an adult human body.",
    unit: "bones",
    min: 50,
    max: 400,
    answer: 206,
    anchors: ["It is more than 100.", "It is less than 300."],
    explanation: "A typical adult human skeleton has 206 bones.",
  },
  {
    id: "con-2",
    districtId: "conservatory",
    title: "Ivy Ladder",
    prompt: "Young botanists are comparing plant growth over a sunny month.",
    question: "Estimate how many days are in four weeks of growth notes.",
    unit: "days",
    min: 7,
    max: 60,
    answer: 28,
    anchors: ["One week is 7 days.", "Four weeks is slightly shorter than many calendar months."],
    explanation: "4 multiplied by 7 equals 28 days.",
  },
  {
    id: "con-3",
    districtId: "conservatory",
    title: "Pollinator Map",
    prompt: "The greenhouse keeps a fact board about insect body parts.",
    question: "Estimate how many legs an adult insect has.",
    unit: "legs",
    min: 2,
    max: 20,
    answer: 6,
    anchors: ["Spiders have more than insects.", "Insects have three body sections."],
    explanation: "All insects have six legs.",
  },
  {
    id: "con-4",
    districtId: "conservatory",
    title: "Leaf Vein Meter",
    prompt: "A Year 4 field guide compares the size of leaves picked on a nature walk.",
    question: "Estimate how many millimetres are in one centimetre.",
    unit: "millimetres",
    min: 2,
    max: 50,
    answer: 10,
    anchors: ["A ruler labels both centimetres and millimetres.", "Millimetres are smaller than centimetres."],
    explanation: "One centimetre is made of 10 millimetres.",
  },
  {
    id: "con-5",
    districtId: "conservatory",
    title: "Food Chain Bell",
    prompt: "The animal keepers are timing a heartbeat experiment after gentle exercise.",
    question: "Estimate how many chambers the human heart has.",
    unit: "chambers",
    min: 1,
    max: 10,
    answer: 4,
    anchors: ["There are separate sides for oxygen-rich and oxygen-poor blood.", "The chambers include atria and ventricles."],
    explanation: "The human heart has four chambers.",
  },
  {
    id: "guild-1",
    districtId: "guildhall",
    title: "Sentence Loom",
    prompt: "The guildhall is weaving one sentence onto a banner for the town square.",
    question:
      'Estimate how many words are in this sentence: "The silver rocket skimmed above the whispering waves before landing beside the lighthouse."',
    unit: "words",
    min: 4,
    max: 30,
    answer: 12,
    anchors: ["Count each separated word once.", "Hyphenated forms count as one word here."],
    explanation: "The sentence contains 12 words in total.",
  },
  {
    id: "guild-2",
    districtId: "guildhall",
    title: "Clause Engine",
    prompt: "A grammar machine sorts conjunctions used in upper-KS2 writing.",
    question: "Estimate how many letters are in the conjunction 'although'.",
    unit: "letters",
    min: 3,
    max: 20,
    answer: 8,
    anchors: ["It starts with 'al'.", "It is shorter than 'extraordinary'."],
    explanation: "A-l-t-h-o-u-g-h has eight letters.",
  },
  {
    id: "guild-3",
    districtId: "guildhall",
    title: "Comma Press",
    prompt: "Editors are checking a short list sentence for punctuation marks.",
    question:
      'Estimate how many commas appear in this sentence: "Pack a torch, a map, a notebook, and a water bottle before dusk."',
    unit: "commas",
    min: 0,
    max: 8,
    answer: 3,
    anchors: ["The final item is linked with 'and'.", "Only the list punctuation counts."],
    explanation: "There are three commas separating the listed items.",
  },
  {
    id: "guild-4",
    districtId: "guildhall",
    title: "Verb Forge",
    prompt: "The scribes are sorting verb tenses for a mechanical storybook.",
    question:
      'Estimate how many verbs appear in this sentence: "Lena packed her compass, opened the gate, and sprinted across the bridge."',
    unit: "verbs",
    min: 1,
    max: 10,
    answer: 3,
    anchors: ["Each action word counts once.", "The sentence contains a list of actions."],
    explanation: "The verbs are packed, opened, and sprinted.",
  },
  {
    id: "guild-5",
    districtId: "guildhall",
    title: "Prefix Vault",
    prompt: "A spelling vault opens only when the apprentices estimate the word length correctly.",
    question: "Estimate how many letters are in the word 'disappeared'.",
    unit: "letters",
    min: 4,
    max: 20,
    answer: 11,
    anchors: ["It begins with the prefix 'dis-'.", "It is longer than 'vanished'."],
    explanation: "D-i-s-a-p-p-e-a-r-e-d has 11 letters.",
  },
  {
    id: "har-1",
    districtId: "harbour",
    title: "Poet's Pier",
    prompt: "A harbour poet is shaping a line for the sunset lantern ceremony.",
    question: 'Estimate how many syllables are in this line: "Golden gulls circle over quiet water."',
    unit: "syllables",
    min: 3,
    max: 20,
    answer: 11,
    anchors: ["Circle has two syllables.", "Quiet is counted here as two syllables."],
    explanation: "Gol-den(2) gulls(1) cir-cle(2) o-ver(2) qui-et(2) wa-ter(2) = 11 syllables.",
  },
  {
    id: "har-2",
    districtId: "harbour",
    title: "Reading Lantern",
    prompt: "The librarian is timing a dramatic reading for a class assembly.",
    question: "Estimate how many words a confident Year 5 reader might read in one minute.",
    unit: "words",
    min: 40,
    max: 250,
    answer: 130,
    anchors: ["It is more than 60.", "It is less than 200 for most children this age."],
    explanation:
      "A fluent Year 5 pace is often around 120 to 140 words per minute, so 130 is a fair estimate.",
  },
  {
    id: "har-3",
    districtId: "harbour",
    title: "Chapter Crane",
    prompt: "Dockworkers are shelving a classic chapter book beside the sea wall.",
    question: "Estimate how many chapters are in a short middle-grade novel.",
    unit: "chapters",
    min: 4,
    max: 40,
    answer: 16,
    anchors: ["It is usually more than 10.", "It is not as many as a school week of lessons."],
    explanation:
      "Many short novels for this age range sit around 12 to 20 chapters, so 16 is a reasonable centre.",
  },
  {
    id: "har-4",
    districtId: "harbour",
    title: "Metaphor Beacon",
    prompt: "A beacon plaque compares storm clouds to something much darker.",
    question: 'Estimate how many words are in this simile: "as dark as a cave at midnight"',
    unit: "words",
    min: 2,
    max: 12,
    answer: 7,
    anchors: ["Every separated word counts.", "The repeated 'as' matters twice."],
    explanation: "The simile contains seven words.",
  },
  {
    id: "har-5",
    districtId: "harbour",
    title: "Story Compass",
    prompt:
      "The story cartographers are planning a neat paragraph with enough detail to paint the scene.",
    question: "Estimate how many sentences make a tidy single paragraph in many KS2 stories.",
    unit: "sentences",
    min: 1,
    max: 10,
    answer: 4,
    anchors: ["It is usually more than one sentence.", "It is often fewer than six in a short story paragraph."],
    explanation:
      "A concise KS2 paragraph often lands around three to five sentences, so four is a useful target.",
  },
];

const districtSources: Record<District["id"], string> = {
  observatory: "KS2 science reference facts and standard classroom measures.",
  conservatory: "KS2 science life-processes and measurement reference facts.",
  guildhall: "KS2 English grammar and spelling conventions.",
  harbour: "KS2 English reading fluency and composition conventions.",
};

const districtRewards: Record<District["id"], [string, string]> = {
  observatory: ["Clockwork lens", "Signal telescope"],
  conservatory: ["Greenhouse arch", "Surveyor's herbarium"],
  guildhall: ["Syntax loom", "Clause beacon"],
  harbour: ["Lantern stacks", "Navigator's story map"],
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildBenchmark = (quiz: BaseQuiz, districtIndex: number, quizIndex: number) => {
  const offsets = [0.72, 1.28, 0.82, 1.18];
  const offset = offsets[(districtIndex + quizIndex) % offsets.length];
  return clamp(Math.round(quiz.answer * offset), quiz.min + 1, quiz.max - 1);
};

export const quizzes: Quiz[] = districtOrder.flatMap((districtId, districtIndex) =>
  rawQuizzes
    .filter((quiz) => quiz.districtId === districtId)
    .map((quiz, quizIndex) => ({
      ...quiz,
      round: quizIndex < 3 ? 1 : 2,
      mode: quizIndex < 3 ? "interval" : "signal",
      comparisonValue: quizIndex < 3 ? undefined : buildBenchmark(quiz, districtIndex, quizIndex),
      comparisonAnswer:
        quizIndex < 3
          ? undefined
          : quiz.answer >= buildBenchmark(quiz, districtIndex, quizIndex)
            ? "above"
            : "below",
      source: districtSources[districtId],
      reward: districtRewards[districtId][quizIndex < 3 ? 0 : 1],
    })),
);

export const quizzesByDistrict = Object.fromEntries(
  districtOrder.map((districtId) => [
    districtId,
    quizzes.filter((quiz) => quiz.districtId === districtId),
  ]),
) as Record<string, Quiz[]>;

export const worldMessages = [
  "The brass surveyor wants exact-ish answers, not perfect certainty.",
  "Closer estimates forge stronger buildings.",
  "Science restores the city clockwork; English restores its stories.",
  "Each district unlocks a brighter, busier skyline.",
  "Round 1 rewards honest intervals; Round 2 rewards calibrated confidence.",
];

export const totalQuizCount = quizzes.length;

export function buildInitialDistrictState(): DistrictProgressMap {
  return districtOrder.reduce(
    (accumulator, districtId, index) => {
      accumulator[districtId] = {
        unlocked: index === 0,
        completed: 0,
        stage: 0,
        bestScore: 0,
        history: [],
      };
      return accumulator;
    },
    {} as DistrictProgressMap,
  );
}
