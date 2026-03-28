export type Subject = "english";
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
    name: "Grammar Hall",
    subject: "english",
    summary: "Sentence structure, punctuation, and verb patterns restore the academy core.",
    tagline: "Sentence craft, punctuation, and grammar cues",
    lore:
      "Estimate counts hidden inside polished sentences to rebuild the main grammar hall.",
    icon: "⌘",
    mentor: "Scribe Ada",
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
    name: "Word Library",
    subject: "english",
    summary: "Vocabulary, spelling, and syllables fill the shelves with stronger language.",
    tagline: "Word meaning, spelling, and sound patterns",
    lore:
      "Use estimation to notice letter counts, syllables, and useful word-building clues.",
    icon: "✦",
    mentor: "Archivist Noor",
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
    name: "Dialogue Dock",
    subject: "english",
    summary: "Polite requests, replies, and spoken rhythm reopen the harbour exchange.",
    tagline: "Useful phrases, questions, and spoken English",
    lore:
      "Rebuild the speaking quarter by estimating counts inside natural, everyday phrases.",
    icon: "⚑",
    mentor: "Coach Elian",
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
    name: "Story Garden",
    subject: "english",
    summary: "Reading fluency, imagery, and paragraph craft bring the final quarter into bloom.",
    tagline: "Reading clues, imagery, and short-story craft",
    lore:
      "Use careful estimation to notice how stories are built from words, details, and structure.",
    icon: "❖",
    mentor: "Guide Mae",
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
    title: "Routine Sentence",
    prompt: "Grammar Hall is calibrating a banner about daily habits.",
    question: 'Estimate how many words are in this sentence: "She walks to school every day before breakfast."',
    unit: "words",
    min: 3,
    max: 20,
    answer: 8,
    anchors: ["Count each separated word once.", "Do not count the full stop."],
    explanation: "She(1) walks(2) to(3) school(4) every(5) day(6) before(7) breakfast(8).",
  },
  {
    id: "obs-2",
    districtId: "observatory",
    title: "Conjunction Gear",
    prompt: "The hall's clause engine needs the exact size of a joining word.",
    question: "Estimate how many letters are in the conjunction 'although'.",
    unit: "letters",
    min: 3,
    max: 20,
    answer: 8,
    anchors: ["It begins with 'al'.", "It is shorter than 'extraordinary'."],
    explanation: "A-l-t-h-o-u-g-h has eight letters.",
  },
  {
    id: "obs-3",
    districtId: "observatory",
    title: "Comma Bell",
    prompt: "Editors are checking a list sentence before the noon lesson.",
    question:
      'Estimate how many commas appear in this sentence: "Pack a pencil, a ruler, a notebook, and a glue stick before class."',
    unit: "commas",
    min: 0,
    max: 8,
    answer: 3,
    anchors: ["The final item is linked with 'and'.", "Only punctuation marks count."],
    explanation: "There are three commas separating the listed items.",
  },
  {
    id: "obs-4",
    districtId: "observatory",
    title: "Verb Engine",
    prompt: "A sentence loom is sorting action words for the hall's next lesson.",
    question:
      'Estimate how many verbs appear in this sentence: "Mina opened the gate, waved to her cousin, and skipped inside."',
    unit: "verbs",
    min: 1,
    max: 10,
    answer: 3,
    anchors: ["Each action word counts once.", "The sentence lists several actions."],
    explanation: "The verbs are opened, waved, and skipped.",
  },
  {
    id: "obs-5",
    districtId: "observatory",
    title: "Prefix Lock",
    prompt: "The spelling lock opens only when the apprentices estimate a tricky word length.",
    question: "Estimate how many letters are in the word 'disappeared'.",
    unit: "letters",
    min: 4,
    max: 20,
    answer: 11,
    anchors: ["It begins with the prefix 'dis-'.", "It is longer than 'vanished'."],
    explanation: "D-i-s-a-p-p-e-a-r-e-d has 11 letters.",
  },
  {
    id: "con-1",
    districtId: "conservatory",
    title: "Giant Shelf",
    prompt: "The Word Library is labelling a giant-words shelf.",
    question: "Estimate how many letters are in the adjective 'enormous'.",
    unit: "letters",
    min: 3,
    max: 16,
    answer: 8,
    anchors: ["It starts with 'e'.", "It is longer than 'huge'."],
    explanation: "E-n-o-r-m-o-u-s has eight letters.",
  },
  {
    id: "con-2",
    districtId: "conservatory",
    title: "Borrow Ledger",
    prompt: "A librarian is recording a useful everyday verb.",
    question: "Estimate how many letters are in the word 'borrowed'.",
    unit: "letters",
    min: 4,
    max: 16,
    answer: 8,
    anchors: ["It begins with 'bor-'.", "It is longer than 'lend'."],
    explanation: "B-o-r-r-o-w-e-d has eight letters.",
  },
  {
    id: "con-3",
    districtId: "conservatory",
    title: "Syllable Stair",
    prompt: "The library's sound stair counts the beats inside longer words.",
    question: "Estimate how many syllables are in the word 'conversation'.",
    unit: "syllables",
    min: 2,
    max: 8,
    answer: 4,
    anchors: ["Say it slowly: con-ver-sa-tion.", "Each beat counts once."],
    explanation: "Con-ver-sa-tion has four syllables.",
  },
  {
    id: "con-4",
    districtId: "conservatory",
    title: "Reason Lantern",
    prompt: "The definition desk is checking a common linking word.",
    question: "Estimate how many letters are in the word 'because'.",
    unit: "letters",
    min: 3,
    max: 14,
    answer: 7,
    anchors: ["It begins with 'be-'.", "It is shorter than 'therefore'."],
    explanation: "B-e-c-a-u-s-e has seven letters.",
  },
  {
    id: "con-5",
    districtId: "conservatory",
    title: "Meaning Card",
    prompt: "A display card defines the word 'neighbour' for younger readers.",
    question: 'Estimate how many words are in this sentence: "A neighbour is a person who lives nearby."',
    unit: "words",
    min: 3,
    max: 16,
    answer: 8,
    anchors: ["Count each separated word once.", "The final full stop does not count."],
    explanation: "A(1) neighbour(2) is(3) a(4) person(5) who(6) lives(7) nearby(8).",
  },
  {
    id: "guild-1",
    districtId: "guildhall",
    title: "Polite Request",
    prompt: "Dialogue Dock is rehearsing a simple, polite sentence.",
    question: 'Estimate how many words are in this request: "Could I have some water, please?"',
    unit: "words",
    min: 2,
    max: 12,
    answer: 6,
    anchors: ["Ignore the comma and question mark.", "Count each word once."],
    explanation: "Could(1) I(2) have(3) some(4) water(5) please(6).",
  },
  {
    id: "guild-2",
    districtId: "guildhall",
    title: "Greeting Line",
    prompt: "The speaking coach is checking the length of a natural reply.",
    question: 'Estimate how many words are in this reply: "I am fine, thanks for asking."',
    unit: "words",
    min: 2,
    max: 12,
    answer: 6,
    anchors: ["Do not count punctuation.", "Thanks and asking are separate words."],
    explanation: "I(1) am(2) fine(3) thanks(4) for(5) asking(6).",
  },
  {
    id: "guild-3",
    districtId: "guildhall",
    title: "Question Gate",
    prompt: "A speaking banner needs the size of a key question word.",
    question: "Estimate how many letters are in the word 'polite'.",
    unit: "letters",
    min: 3,
    max: 12,
    answer: 6,
    anchors: ["It starts with 'po-'.", "It is longer than 'kind'."],
    explanation: "P-o-l-i-t-e has six letters.",
  },
  {
    id: "guild-4",
    districtId: "guildhall",
    title: "Question Marks",
    prompt: "Two speakers are practising short questions on the dock.",
    question:
      'Estimate how many question marks appear in this dialogue: "Are you ready?" asked Ella. "Can we begin?"',
    unit: "question marks",
    min: 0,
    max: 4,
    answer: 2,
    anchors: ["Each question sentence ends with its own mark.", "Only question marks count."],
    explanation: "There are two question marks, one after each spoken question.",
  },
  {
    id: "guild-5",
    districtId: "guildhall",
    title: "Apology Drum",
    prompt: "The dialogue tutor is tapping the beats inside a useful speaking word.",
    question: "Estimate how many syllables are in the word 'apologise'.",
    unit: "syllables",
    min: 2,
    max: 8,
    answer: 4,
    anchors: ["Say it slowly: a-pol-o-gise.", "Each clear beat counts."],
    explanation: "A-pol-o-gise has four syllables.",
  },
  {
    id: "har-1",
    districtId: "harbour",
    title: "Reason Branch",
    prompt: "Story Garden is tracing why a character woke early.",
    question:
      'Estimate how many words are in this sentence: "Lina woke early because she had a test."',
    unit: "words",
    min: 3,
    max: 16,
    answer: 8,
    anchors: ["Each separated word counts once.", "Because links the reason to the action."],
    explanation: "Lina(1) woke(2) early(3) because(4) she(5) had(6) a(7) test(8).",
  },
  {
    id: "har-2",
    districtId: "harbour",
    title: "Weather Detail",
    prompt: "Garden readers are studying a sentence about the weather.",
    question:
      'Estimate how many words are in this sentence: "Tom put on a coat because it was raining."',
    unit: "words",
    min: 3,
    max: 16,
    answer: 9,
    anchors: ["Count every separated word once.", "The full stop does not count."],
    explanation: "Tom(1) put(2) on(3) a(4) coat(5) because(6) it(7) was(8) raining(9).",
  },
  {
    id: "har-3",
    districtId: "harbour",
    title: "Title Stone",
    prompt: "A chapter arch needs the right count for a new book title.",
    question: 'Estimate how many words are in this title: "The Secret Lighthouse Key"',
    unit: "words",
    min: 1,
    max: 10,
    answer: 4,
    anchors: ["Each title word counts once.", "There is no punctuation."],
    explanation: "The title has four words: The, Secret, Lighthouse, Key.",
  },
  {
    id: "har-4",
    districtId: "harbour",
    title: "Description Trellis",
    prompt: "Readers are spotting describing words in a harbour sentence.",
    question:
      'Estimate how many adjectives appear in this sentence: "The small wooden boat drifted across the dark harbour."',
    unit: "adjectives",
    min: 1,
    max: 8,
    answer: 3,
    anchors: ["Look for words that describe nouns.", "Boat and harbour each have description words."],
    explanation: "The adjectives are small, wooden, and dark.",
  },
  {
    id: "har-5",
    districtId: "harbour",
    title: "Adventure Gate",
    prompt: "The final garden arch measures the beats in a story word.",
    question: "Estimate how many syllables are in the word 'adventure'.",
    unit: "syllables",
    min: 2,
    max: 8,
    answer: 3,
    anchors: ["Say it slowly: ad-ven-ture.", "Each beat counts once."],
    explanation: "Ad-ven-ture has three syllables.",
  },
];

const districtSources: Record<District["id"], string> = {
  observatory: "KS2 English grammar and punctuation conventions.",
  conservatory: "KS2 spelling, vocabulary, and phonics conventions.",
  guildhall: "KS2 spoken English and dialogue conventions.",
  harbour: "KS2 reading fluency and composition conventions.",
};

const districtRewards: Record<District["id"], [string, string]> = {
  observatory: ["Clause beacon", "Syntax loom"],
  conservatory: ["Prefix shelves", "Syllable lantern"],
  guildhall: ["Dialogue dais", "Politeness fountain"],
  harbour: ["Chapter arch", "Imagery arbor"],
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
  "Every district now teaches English, one careful estimate at a time.",
  "Grammar, vocabulary, dialogue, and stories all strengthen the same city.",
  "Closer estimates reveal how English is built from patterns and details.",
  "Round 1 rewards honest intervals; Round 2 rewards confident quick calls.",
  "Each restored quarter makes the language city brighter and more fluent.",
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
