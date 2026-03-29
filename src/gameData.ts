export type Subject = "english";
export type QuizRound = 1 | 2;
export type ComparisonDirection = "above" | "below";
export type QuizMode = "interval" | "signal";
export const confidenceOptions = [55, 65, 75, 85] as const;
export type ConfidenceOption = (typeof confidenceOptions)[number];

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

export type DistrictId = District["id"];

export type Quiz = {
  id: string;
  districtId: DistrictId;
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

export type LessonCard = {
  title: string;
  summary: string;
  bullets: string[];
  example: string;
};

export type PracticeOption = {
  id: string;
  label: string;
  correct: boolean;
  feedback: string;
};

export type PracticePrompt = {
  id: string;
  title: string;
  situation: string;
  question: string;
  options: PracticeOption[];
};

export type DistrictLearningPlan = {
  districtId: DistrictId;
  primerTitle: string;
  primerGoal: string;
  memoryPrompt: string;
  adaptationHint: string;
  testBrief: string;
  masteryReward: string;
  studyCards: LessonCard[];
  practicePrompts: PracticePrompt[];
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

export type DistrictProgressMap = Record<DistrictId, DistrictProgressState>;

export const districts: District[] = [
  {
    id: "observatory",
    name: "Grammar Hall",
    subject: "english",
    summary: "Sentence structure, punctuation, and verb patterns restore the academy core.",
    tagline: "Sentence craft, punctuation, and grammar cues",
    lore: "Study the rule sheet, adapt it to a fresh sentence, then prove it in the estimation test.",
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
    lore: "Use the sheet to memorise useful patterns, then adapt them to unfamiliar words before testing.",
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
    lore: "The dock teaches the pattern first, then asks you to use it correctly in a new speaking situation.",
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
    lore: "Review the story sheet, remember the clue, then adapt it to a different sentence before you test.",
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
) as Record<DistrictId, District>;

export const learningPlans: Record<DistrictId, DistrictLearningPlan> = {
  observatory: {
    districtId: "observatory",
    primerTitle: "Grammar Hall Study Sheet",
    primerGoal: "Notice exactly what the question is counting: words, punctuation marks, or sentence jobs.",
    memoryPrompt: "Remember the rule before you estimate: count only the target unit and ignore everything else.",
    adaptationHint: "The practice check changes the sentence, so you must transfer the rule instead of copying the example.",
    testBrief: "The hall only unlocks its estimate test after you show that you can apply the rule to a fresh sentence.",
    masteryReward: "Syntax beacon",
    studyCards: [
      {
        title: "Count the written unit",
        summary: "A test can ask for words, commas, or letters. Count only what the question names.",
        bullets: [
          "Words are separated by spaces.",
          "Punctuation marks are only counted when the question asks for punctuation.",
          "A spoken pause is not the same as a comma on the page.",
        ],
        example: 'In "Pack a ruler, a pen, and a map," there are two commas, not three pauses.',
      },
      {
        title: "Spot the job word",
        summary: "Some grammar questions ask for verbs or adjectives rather than total words.",
        bullets: [
          "A verb shows the action or state.",
          "An adjective describes a noun.",
          "Read the whole sentence before deciding which words belong to that job.",
        ],
        example: 'In "The small boat drifted slowly," the adjective is "small" and the verb is "drifted."',
      },
    ],
    practicePrompts: [
      {
        id: "obs-pr-1",
        title: "Comma transfer",
        situation: 'A fresh note says: "Bring a torch, a coat and a map."',
        question: "If the task is to count commas, which answer applies the rule correctly?",
        options: [
          {
            id: "a",
            label: "Two, because there are three items and every pause counts.",
            correct: false,
            feedback: "Count visible comma marks, not spoken pauses. This sentence only shows one comma.",
          },
          {
            id: "b",
            label: "One, because there is only one comma mark on the page.",
            correct: true,
            feedback: "Right. The rule transfers even though the sentence changed.",
          },
          {
            id: "c",
            label: "Three, because each object needs its own comma.",
            correct: false,
            feedback: "That would describe a different sentence. Use the punctuation that is actually written.",
          },
        ],
      },
      {
        id: "obs-pr-2",
        title: "Verb transfer",
        situation: 'A builder writes: "Nora waved, laughed, and hurried inside."',
        question: "Which answer adapts the verb rule correctly?",
        options: [
          {
            id: "a",
            label: "There are two verbs: waved and hurried.",
            correct: false,
            feedback: "Laughed is also an action word, so it counts too.",
          },
          {
            id: "b",
            label: "There are three verbs: waved, laughed, and hurried.",
            correct: true,
            feedback: "Right. You adapted the rule to a new sentence and counted each action once.",
          },
          {
            id: "c",
            label: "There are four verbs because and is doing a joining job.",
            correct: false,
            feedback: "And joins the list, but it is not a verb.",
          },
        ],
      },
    ],
  },
  conservatory: {
    districtId: "conservatory",
    primerTitle: "Word Library Study Sheet",
    primerGoal: "Memorise how letters, syllables, and common prefixes behave so you can estimate unfamiliar words.",
    memoryPrompt: "Remember the structure, not just the answer: sounds and word parts help when the exact word changes.",
    adaptationHint: "The practice drill swaps in new words, so you need the pattern and not the old example.",
    testBrief: "The library only releases the estimate test after you prove you can use the pattern on a different word.",
    masteryReward: "Syllable lantern",
    studyCards: [
      {
        title: "Letters stay visible",
        summary: "When counting letters, look at every written character in the word and keep repeated letters.",
        bullets: [
          "Double letters count twice.",
          "Prefixes such as dis- or re- still count as part of the whole word.",
          "Estimate by chunking a long word into smaller parts.",
        ],
        example: 'In "borrowed", both r letters count, so the total is eight.',
      },
      {
        title: "Syllables are sound beats",
        summary: "A syllable is one spoken beat, not one written letter group.",
        bullets: [
          "Say the word slowly.",
          "Clap or tap each beat once.",
          "Longer spelling does not always mean more syllables.",
        ],
        example: '"Conversation" has four beats: con-ver-sa-tion.',
      },
    ],
    practicePrompts: [
      {
        id: "con-pr-1",
        title: "Double-letter transfer",
        situation: 'You now face the word "runner".',
        question: "Which choice shows the right way to adapt the letter-count rule?",
        options: [
          {
            id: "a",
            label: "Five letters, because the double n acts like one sound.",
            correct: false,
            feedback: "Letter counts follow what is written, not just what you hear. Both n letters stay in the total.",
          },
          {
            id: "b",
            label: "Six letters, because each written letter still counts.",
            correct: true,
            feedback: "Right. The rule transfers because repeated letters still count separately.",
          },
          {
            id: "c",
            label: "Seven letters, because the suffix adds an extra hidden beat.",
            correct: false,
            feedback: "There is no hidden letter to add. Count only the letters on the page.",
          },
        ],
      },
      {
        id: "con-pr-2",
        title: "Beat transfer",
        situation: 'A new apprentice says the word "elephant".',
        question: "Which answer applies the syllable rule correctly?",
        options: [
          {
            id: "a",
            label: "Three syllables: el-e-phant.",
            correct: true,
            feedback: "Right. You counted the spoken beats, not the number of letters.",
          },
          {
            id: "b",
            label: "Five syllables because the word has many letters.",
            correct: false,
            feedback: "Syllables are sound beats, so many letters do not automatically mean many syllables.",
          },
          {
            id: "c",
            label: "Two syllables because the middle sound is too short to count.",
            correct: false,
            feedback: "A short sound can still be a full syllable if it creates its own beat.",
          },
        ],
      },
    ],
  },
  guildhall: {
    districtId: "guildhall",
    primerTitle: "Dialogue Dock Study Sheet",
    primerGoal: "Use polite spoken patterns and question forms correctly before the dock allows a test run.",
    memoryPrompt: "Remember the speaking pattern, then fit it to a new situation instead of repeating the example word for word.",
    adaptationHint: "The dock checks whether you can choose the right phrase in context, not whether you memorised one line.",
    testBrief: "The dock keeps the test locked until your practice choice shows the right phrase for the right moment.",
    masteryReward: "Dialogue fountain",
    studyCards: [
      {
        title: "Polite requests use helpful framing",
        summary: "Useful phrases such as could I, please, and thank you make a request sound respectful.",
        bullets: [
          "A polite question usually begins with a helper such as could or can.",
          "Please softens the request.",
          "Short answers still need the right tone for the situation.",
        ],
        example: '"Could I have some water, please?" sounds more respectful than a bare demand.',
      },
      {
        title: "Question marks belong to full questions",
        summary: "Count the end mark for each written question, not for every speaker line.",
        bullets: [
          "A statement after the dialogue tag does not create a new question mark.",
          "Each separate written question ends with its own mark.",
          "Ignore commas unless the task asks for them.",
        ],
        example: '"Are you ready?" asked Ella. "Can we begin?" uses two question marks.',
      },
    ],
    practicePrompts: [
      {
        id: "guild-pr-1",
        title: "Tone transfer",
        situation: "You need to ask a teacher for a pencil in class.",
        question: "Which reply adapts the polite-speaking rule best?",
        options: [
          {
            id: "a",
            label: "Give me a pencil now.",
            correct: false,
            feedback: "The message is clear, but the tone ignores the polite framing the dock expects.",
          },
          {
            id: "b",
            label: "Could I borrow a pencil, please?",
            correct: true,
            feedback: "Right. You kept the request respectful and suitable for the situation.",
          },
          {
            id: "c",
            label: "Pencil?",
            correct: false,
            feedback: "That is too incomplete for the context. The practice sheet wants the full polite pattern.",
          },
        ],
      },
      {
        id: "guild-pr-2",
        title: "Question-mark transfer",
        situation: 'A new script reads: "Did you pack the map?" asked Sam. "Shall we leave?"',
        question: "How should the dock count question marks here?",
        options: [
          {
            id: "a",
            label: "One, because the same speaker is talking.",
            correct: false,
            feedback: "Each separate written question still needs its own end mark.",
          },
          {
            id: "b",
            label: "Two, because both spoken lines are complete questions.",
            correct: true,
            feedback: "Right. You adapted the rule to a different dialogue without changing the logic.",
          },
          {
            id: "c",
            label: "Three, because the dialogue tag also needs a mark.",
            correct: false,
            feedback: "The dialogue tag is not a question, so it does not add an extra question mark.",
          },
        ],
      },
    ],
  },
  harbour: {
    districtId: "harbour",
    primerTitle: "Story Garden Study Sheet",
    primerGoal: "Read for reasons, describing words, and title structure so you can adapt story clues under pressure.",
    memoryPrompt: "Remember what the clue does in the sentence, then apply that role in a new story line.",
    adaptationHint: "The garden changes the sentence before the test, so you need understanding rather than a copied answer.",
    testBrief: "The story test opens only after you show that you can move the reading clue into a new context.",
    masteryReward: "Imagery arbor",
    studyCards: [
      {
        title: "Reason words link cause and action",
        summary: "Words such as because explain why something happened.",
        bullets: [
          "Read both sides of the reason word.",
          "The first part is usually the action.",
          "The second part gives the cause or explanation.",
        ],
        example: 'In "Lina woke early because she had a test," the reason is "she had a test."',
      },
      {
        title: "Descriptions belong to nouns",
        summary: "An adjective gives extra detail about a person, place, or thing.",
        bullets: [
          "Look for the noun first.",
          "Then find the word telling you more about that noun.",
          "A sentence can describe more than one noun.",
        ],
        example: 'In "The small wooden boat drifted across the dark harbour," the adjectives are small, wooden, and dark.',
      },
    ],
    practicePrompts: [
      {
        id: "har-pr-1",
        title: "Reason transfer",
        situation: 'A new line reads: "Amir carried an umbrella because dark clouds gathered above him."',
        question: "Which answer adapts the reason-rule correctly?",
        options: [
          {
            id: "a",
            label: "The reason is that dark clouds gathered above him.",
            correct: true,
            feedback: "Right. You followed the because-link to the cause in the new sentence.",
          },
          {
            id: "b",
            label: "The reason is that Amir carried an umbrella.",
            correct: false,
            feedback: "That is the action, not the cause explaining it.",
          },
          {
            id: "c",
            label: "There is no reason because the sentence only has one event.",
            correct: false,
            feedback: "Because clearly introduces the cause here, so the sentence does contain a reason.",
          },
        ],
      },
      {
        id: "har-pr-2",
        title: "Description transfer",
        situation: 'You inspect the line: "The bright lantern hung beside the narrow gate."',
        question: "Which answer uses the adjective rule correctly?",
        options: [
          {
            id: "a",
            label: "There is one adjective: bright.",
            correct: false,
            feedback: "Narrow also describes a noun, so the sentence contains more than one adjective.",
          },
          {
            id: "b",
            label: "There are two adjectives: bright and narrow.",
            correct: true,
            feedback: "Right. Each describing word is attached to its own noun.",
          },
          {
            id: "c",
            label: "There are three adjectives because hung is also descriptive.",
            correct: false,
            feedback: "Hung tells what happened, so it works as a verb rather than an adjective.",
          },
        ],
      },
    ],
  },
};

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
    question: 'Estimate how many words are in this sentence: "Lina woke early because she had a test."',
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
    question: 'Estimate how many words are in this sentence: "Tom put on a coat because it was raining."',
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

const districtSources: Record<DistrictId, string> = {
  observatory: "KS2 English grammar and punctuation conventions.",
  conservatory: "KS2 spelling, vocabulary, and phonics conventions.",
  guildhall: "KS2 spoken English and dialogue conventions.",
  harbour: "KS2 reading fluency and composition conventions.",
};

const districtRewards: Record<DistrictId, [string, string]> = {
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
) as Record<DistrictId, Quiz[]>;

export const worldMessages = [
  "Each district now teaches first, checks memory next, and only then unlocks the estimate test.",
  "Study sheets explain the base knowledge; practice sheets force you to adapt that knowledge to new sentences.",
  "A test stays locked until the district trusts that you can use the rule rather than repeat it.",
  "Round 1 still rewards careful estimation intervals, while Round 2 rewards confident quick calls.",
  "The city grows fastest when lessons, practice, and tests all strengthen one another.",
];

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
