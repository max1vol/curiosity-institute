export type Subject = "science" | "dte" | "maths" | "english" | "history" | "geography";
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
  id: "laboratory" | "workshop" | "observatory" | "scriptorium" | "archive" | "harbour";
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
  cityProjectName: string;
  cityProjectSummary: string;
  cityProjectEffect: string;
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
    id: "laboratory",
    name: "Discovery Lab",
    subject: "science",
    summary: "Forces, circuits, life systems, and fair tests power the first research quarter.",
    tagline: "Experiments, evidence, and scientific systems",
    lore: "Review the investigation rule, adapt it to a new experiment, then clear the district's estimate test.",
    icon: "⚗",
    mentor: "Dr. Imani",
    palette: {
      glow: "rgba(129, 220, 238, 0.95)",
      accent: "#66c6da",
      ground: "#557d72",
      stone: "#4f6862",
      roof: "#5fa7b2",
      left: "#3f6560",
      right: "#5f8f90",
      trim: "#d2f5fb",
    },
    plot: { row: 2, col: 2 },
    sprite: "/art/discovery-lab.png",
  },
  {
    id: "workshop",
    name: "Makers Forge",
    subject: "dte",
    summary: "Materials, measuring, structures, and workshop planning rebuild the industrial yard.",
    tagline: "Design choices, tools, and construction logic",
    lore: "The forge teaches the build rule first, then checks whether you can apply it to a new making problem.",
    icon: "⚒",
    mentor: "Master Rowan",
    palette: {
      glow: "rgba(245, 193, 115, 0.95)",
      accent: "#dd9f4d",
      ground: "#816348",
      stone: "#74563e",
      roof: "#c67c44",
      left: "#844a25",
      right: "#a96434",
      trim: "#ffe0af",
    },
    plot: { row: 2, col: 6 },
    sprite: "/art/makers-forge.png",
  },
  {
    id: "observatory",
    name: "Number Observatory",
    subject: "maths",
    summary: "Number sense, shape facts, and angle logic align the central calculation engines.",
    tagline: "Patterns, measures, and mathematical structure",
    lore: "Count carefully, transfer the pattern to a fresh problem, and the observatory will open its estimate track.",
    icon: "∑",
    mentor: "Tutor Keira",
    palette: {
      glow: "rgba(188, 184, 255, 0.95)",
      accent: "#8e87ff",
      ground: "#5d6385",
      stone: "#555b78",
      roof: "#8476d7",
      left: "#4b4d80",
      right: "#686bab",
      trim: "#e1ddff",
    },
    plot: { row: 4, col: 1 },
    sprite: "/art/number-observatory.png",
  },
  {
    id: "scriptorium",
    name: "Scriptorium Hall",
    subject: "english",
    summary: "Sentence craft, punctuation, vocabulary, and reading clues restore the language quarter.",
    tagline: "Grammar, meaning, and literary precision",
    lore: "Study the rule sheet, adapt it in a fresh sentence, then prove it under estimation pressure.",
    icon: "✒",
    mentor: "Scribe Ada",
    palette: {
      glow: "rgba(160, 232, 173, 0.95)",
      accent: "#71bd70",
      ground: "#607f5a",
      stone: "#556a52",
      roof: "#7fb16a",
      left: "#4c7250",
      right: "#66936b",
      trim: "#dff3cf",
    },
    plot: { row: 4, col: 7 },
    sprite: "/art/scriptorium-hall.png",
  },
  {
    id: "archive",
    name: "Chronicle Archive",
    subject: "history",
    summary: "Timelines, periods, causes, and evidence recover the memory quarter of the city.",
    tagline: "Chronology, sources, and historical change",
    lore: "The archive checks that you can place events in order and use evidence before history tests are allowed.",
    icon: "⌛",
    mentor: "Curator Elowen",
    palette: {
      glow: "rgba(221, 164, 126, 0.95)",
      accent: "#d18f62",
      ground: "#7a6354",
      stone: "#6f594e",
      roof: "#b7744f",
      left: "#7d4f3e",
      right: "#9a654d",
      trim: "#f2d5c4",
    },
    plot: { row: 6, col: 2 },
    sprite: "/art/chronicle-archive.png",
  },
  {
    id: "harbour",
    name: "Atlas Harbour",
    subject: "geography",
    summary: "Maps, coasts, continents, climates, and direction keep the trade edge of the city alive.",
    tagline: "Maps, place knowledge, and physical systems",
    lore: "Harbour lessons teach the place rule first, then ask you to adapt it to a new route, map, or landform.",
    icon: "⚓",
    mentor: "Navigator Mae",
    palette: {
      glow: "rgba(118, 198, 255, 0.95)",
      accent: "#5aa8eb",
      ground: "#557085",
      stone: "#4d6270",
      roof: "#6390c6",
      left: "#426079",
      right: "#5f7ca4",
      trim: "#d6eaff",
    },
    plot: { row: 6, col: 6 },
    sprite: "/art/atlas-harbour.png",
  },
];

export const districtOrder = districts.map((district) => district.id);

export const districtsById = Object.fromEntries(
  districts.map((district) => [district.id, district]),
) as Record<DistrictId, District>;

export const learningPlans: Record<DistrictId, DistrictLearningPlan> = {
  laboratory: {
    districtId: "laboratory",
    primerTitle: "Discovery Lab Study Sheet",
    primerGoal: "Notice what the test is counting in a science system: parts, stages, or measured results.",
    memoryPrompt: "Hold the rule steady: in science, change one thing at a time and count only the named part of the system.",
    adaptationHint: "The lab swaps in a fresh experiment, so you must transfer the rule instead of copying the example.",
    testBrief: "The lab only opens its estimate line after you show that you can use scientific thinking in a new setup.",
    masteryReward: "Research charter",
    cityProjectName: "Greenhouse Court",
    cityProjectSummary:
      "Raise a glasshouse court with specimen tables, weather gauges, and experiment benches beside the lab.",
    cityProjectEffect:
      "Adds planters, instrument stands, and lit experiment stations around Discovery Lab.",
    studyCards: [
      {
        title: "Fair tests change one variable",
        summary: "A fair test keeps most conditions the same so you can trust what caused the result.",
        bullets: [
          "Change one factor deliberately.",
          "Keep the others as similar as possible.",
          "Measure the result in the same way each time.",
        ],
        example:
          "If you are testing which paper aeroplane flies furthest, keep the throw the same and only change the design.",
      },
      {
        title: "Systems have countable parts",
        summary: "Circuits, life cycles, and body systems can be broken into named parts or stages.",
        bullets: [
          "Read the full system before counting.",
          "Do not add invisible or guessed parts.",
          "Count only the stage or component the question asks for.",
        ],
        example:
          "A simple circuit with one cell, one bulb, and one switch has three listed components.",
      },
    ],
    practicePrompts: [
      {
        id: "lab-pr-1",
        title: "Variable transfer",
        situation: "Two seedlings get the same soil and water, but only one is put in sunlight.",
        question: "Which choice applies the fair-test rule correctly?",
        options: [
          {
            id: "a",
            label: "It is fair because only the sunlight has changed.",
            correct: true,
            feedback: "Right. One variable changed while the other conditions stayed the same.",
          },
          {
            id: "b",
            label: "It is unfair because both plants are different heights.",
            correct: false,
            feedback: "The rule is about what the test changes on purpose, not whether the plants started perfectly identical.",
          },
          {
            id: "c",
            label: "It is fair because every experiment should change two things at once.",
            correct: false,
            feedback: "Changing two variables at once makes it harder to know what caused the result.",
          },
        ],
      },
      {
        id: "lab-pr-2",
        title: "System transfer",
        situation: "A torch diagram lists one cell, one bulb, and one switch.",
        question: "How should the lab apply the counting rule?",
        options: [
          {
            id: "a",
            label: "Count three components because only the named parts are included.",
            correct: true,
            feedback: "Right. The rule transfers because you count the listed components and nothing extra.",
          },
          {
            id: "b",
            label: "Count four components because the wire should always be guessed as hidden.",
            correct: false,
            feedback: "Only count what the question names or shows clearly.",
          },
          {
            id: "c",
            label: "Count two components because a switch only matters when it is on.",
            correct: false,
            feedback: "A switch is still a component whether it is open or closed.",
          },
        ],
      },
    ],
  },
  workshop: {
    districtId: "workshop",
    primerTitle: "Makers Forge Study Sheet",
    primerGoal: "Use the right measure, material, and structure before you estimate a build quantity.",
    memoryPrompt: "Remember the making rule: match the tool, unit, or material to the job instead of guessing by appearance.",
    adaptationHint: "The forge changes the product brief, so you need the principle rather than the old answer.",
    testBrief: "The forge keeps its estimate workbench locked until you can apply the making rule to a fresh design problem.",
    masteryReward: "Prototype seal",
    cityProjectName: "Workshop Yard",
    cityProjectSummary:
      "Open a workshop yard with timber racks, drafting tables, and testing frames around the forge.",
    cityProjectEffect:
      "Adds saw horses, blueprint stations, and stacked materials around Makers Forge.",
    studyCards: [
      {
        title: "Measure with the correct unit",
        summary: "Design work depends on using the right unit before any cutting or joining begins.",
        bullets: [
          "Use millimetres for small precise parts.",
          "Use centimetres or metres for larger pieces.",
          "Convert carefully before you total a build plan.",
        ],
        example: "Three centimetres is 30 millimetres, so a small bracket plan must use 30 mm, not 3 mm.",
      },
      {
        title: "Structures rely on shape",
        summary: "Designers use stable shapes and repeated parts to keep objects strong and safe.",
        bullets: [
          "Triangles resist wobble in frames.",
          "Rectangles contain four right angles.",
          "A count should follow the actual design, not the material name.",
        ],
        example: "A rectangular frame still has four right angles even if it is made from wood instead of metal.",
      },
    ],
    practicePrompts: [
      {
        id: "work-pr-1",
        title: "Unit transfer",
        situation: "A bracket drawing says the strip must be 3 centimetres long.",
        question: "Which answer adapts the measuring rule correctly?",
        options: [
          {
            id: "a",
            label: "30 millimetres, because each centimetre contains 10 millimetres.",
            correct: true,
            feedback: "Right. You converted the unit before using the measurement.",
          },
          {
            id: "b",
            label: "3 millimetres, because the number stays the same when the unit changes.",
            correct: false,
            feedback: "The unit changes the size of the measure, so the number must change too.",
          },
          {
            id: "c",
            label: "300 millimetres, because adding a zero makes the design stronger.",
            correct: false,
            feedback: "A stronger design still needs an accurate conversion.",
          },
        ],
      },
      {
        id: "work-pr-2",
        title: "Structure transfer",
        situation: "A safety frame is described as a rectangle with braces fitted inside it.",
        question: "Which choice uses the structure rule properly?",
        options: [
          {
            id: "a",
            label: "The outer frame has four right angles because it is rectangular.",
            correct: true,
            feedback: "Right. The material or brace does not change the rectangle's angle count.",
          },
          {
            id: "b",
            label: "The frame has three right angles because one corner holds a screw.",
            correct: false,
            feedback: "Adding a screw does not remove a corner angle from the rectangle.",
          },
          {
            id: "c",
            label: "The frame has five right angles because braces create extra corners automatically.",
            correct: false,
            feedback: "Braces may add shapes inside, but the outer rectangle still contains four right angles.",
          },
        ],
      },
    ],
  },
  observatory: {
    districtId: "observatory",
    primerTitle: "Number Observatory Study Sheet",
    primerGoal: "Track the exact quantity being asked for: sides, angles, factors, turns, or time.",
    memoryPrompt: "Hold the maths pattern in memory: identify the structure first, then count or convert the correct quantity.",
    adaptationHint: "The observatory shifts the numbers and shapes, so you need the pattern and not a memorised surface answer.",
    testBrief: "The observatory only opens its estimate lens after you can adapt the pattern to a new number problem.",
    masteryReward: "Proof beacon",
    cityProjectName: "Measure Plaza",
    cityProjectSummary:
      "Build a plaza with counting rails, angle stones, and giant number dials under the observatory.",
    cityProjectEffect:
      "Adds abacus arches, angle markers, and number mosaics around Number Observatory.",
    studyCards: [
      {
        title: "Name the mathematical object",
        summary: "A maths question usually depends on recognising the object before you count it.",
        bullets: [
          "An octagon has eight sides because oct- means eight.",
          "A right angle always measures 90 degrees.",
          "A cube has 12 edges even though it only has six faces.",
        ],
        example: "If the object is a cube, count edges only when the question asks for edges, not faces or corners.",
      },
      {
        title: "Convert and compare carefully",
        summary: "Time and measure questions need exact conversions before estimation stays sensible.",
        bullets: [
          "Three quarters of an hour equals 45 minutes.",
          "A full turn equals 360 degrees.",
          "Factors are numbers that divide exactly with no remainder.",
        ],
        example: "The factors of 24 are 1, 2, 3, 4, 6, 8, 12, and 24, so there are eight in total.",
      },
    ],
    practicePrompts: [
      {
        id: "math-pr-1",
        title: "Shape transfer",
        situation: "A fresh challenge asks about the edges on a cube model.",
        question: "Which answer adapts the counting rule correctly?",
        options: [
          {
            id: "a",
            label: "A cube has 12 edges because each square face shares its sides with others.",
            correct: true,
            feedback: "Right. You counted the edges of the 3D shape rather than the number of faces.",
          },
          {
            id: "b",
            label: "A cube has 6 edges because it has six faces.",
            correct: false,
            feedback: "Faces and edges are different features of the solid.",
          },
          {
            id: "c",
            label: "A cube has 8 edges because it has eight corners.",
            correct: false,
            feedback: "Corners are vertices, not edges.",
          },
        ],
      },
      {
        id: "math-pr-2",
        title: "Conversion transfer",
        situation: "The clock line asks for three quarters of an hour in minutes.",
        question: "Which choice uses the time rule correctly?",
        options: [
          {
            id: "a",
            label: "45 minutes, because one quarter of 60 is 15 and three quarters is 45.",
            correct: true,
            feedback: "Right. You broke the hour into equal quarters and scaled it correctly.",
          },
          {
            id: "b",
            label: "34 minutes, because three quarters is slightly more than half.",
            correct: false,
            feedback: "The reasoning is too loose. A quarter-hour is a fixed amount, not an estimate.",
          },
          {
            id: "c",
            label: "75 minutes, because you add 15 to each quarter.",
            correct: false,
            feedback: "An hour only contains 60 minutes, so three quarters cannot exceed that.",
          },
        ],
      },
    ],
  },
  scriptorium: {
    districtId: "scriptorium",
    primerTitle: "Scriptorium Hall Study Sheet",
    primerGoal: "Notice the exact language feature being counted: words, commas, letters, adjectives, or syllables.",
    memoryPrompt: "Remember the language rule before you estimate: count only the named feature and ignore the rest.",
    adaptationHint: "The hall changes the sentence or word, so you must transfer the rule rather than repeat an old answer.",
    testBrief: "The language quarter only opens its estimate line after you prove that you can adapt the rule correctly.",
    masteryReward: "Story lantern",
    cityProjectName: "Scriptorium Square",
    cityProjectSummary:
      "Turn the forecourt into a public writing square with lesson stalls, banner rails, and reading benches.",
    cityProjectEffect:
      "Adds writing desks, word banners, and reading lamps around Scriptorium Hall.",
    studyCards: [
      {
        title: "Count the written feature",
        summary: "A language question may ask for words, commas, or letters. Count only the feature that is named.",
        bullets: [
          "Words are separated by spaces.",
          "Punctuation only counts when the question asks for punctuation.",
          "Repeated letters still count separately.",
        ],
        example: 'In "Pack a ruler, a pen, and a map," there are three commas to count only if the question asks for commas.',
      },
      {
        title: "Match grammar to meaning",
        summary: "Grammar questions often depend on the job each word is doing in the sentence.",
        bullets: [
          "An adjective describes a noun.",
          "A syllable is a spoken beat, not a letter.",
          "A conjunction links ideas together.",
        ],
        example: 'In "The small wooden boat drifted slowly," the adjectives are "small" and "wooden."',
      },
    ],
    practicePrompts: [
      {
        id: "eng-pr-1",
        title: "Comma transfer",
        situation: 'A fresh note says: "Bring a torch, a coat, a map, and a drink."',
        question: "Which answer applies the punctuation rule correctly?",
        options: [
          {
            id: "a",
            label: "Three commas, because there are three comma marks on the page.",
            correct: true,
            feedback: "Right. You counted the visible punctuation marks rather than the pauses in speech.",
          },
          {
            id: "b",
            label: "Four commas, because each item needs a comma after it.",
            correct: false,
            feedback: "That would describe a different sentence. Count only the punctuation that is written.",
          },
          {
            id: "c",
            label: "One comma, because the word and removes the others.",
            correct: false,
            feedback: "The conjunction does not erase punctuation that is already present.",
          },
        ],
      },
      {
        id: "eng-pr-2",
        title: "Adjective transfer",
        situation: 'You inspect the line: "The bright lantern hung beside the narrow gate."',
        question: "Which answer uses the grammar rule correctly?",
        options: [
          {
            id: "a",
            label: "Two adjectives: bright and narrow.",
            correct: true,
            feedback: "Right. Both words describe nouns in the sentence.",
          },
          {
            id: "b",
            label: "One adjective: lantern.",
            correct: false,
            feedback: "Lantern is the noun being described, not the adjective.",
          },
          {
            id: "c",
            label: "Three adjectives: bright, narrow, and hung.",
            correct: false,
            feedback: "Hung tells the action, so it works as a verb rather than an adjective.",
          },
        ],
      },
    ],
  },
  archive: {
    districtId: "archive",
    primerTitle: "Chronicle Archive Study Sheet",
    primerGoal: "Read dates, periods, and evidence carefully before you estimate a historical quantity.",
    memoryPrompt: "Remember the history rule: place events in order first, then count years or people with evidence.",
    adaptationHint: "The archive replaces the example with a new event line, so you must transfer the chronology rule to a fresh case.",
    testBrief: "The archive only opens its estimate record after you show that you can use chronology and evidence properly.",
    masteryReward: "Chronicle seal",
    cityProjectName: "Memory Cloister",
    cityProjectSummary:
      "Restore a cloister of record walls, timeline arches, and source tables beside the archive.",
    cityProjectEffect:
      "Adds timeline banners, memorial stones, and source cabinets around Chronicle Archive.",
    studyCards: [
      {
        title: "History depends on sequence",
        summary: "A timeline question only works when you place the earlier and later events correctly first.",
        bullets: [
          "Find the earlier year.",
          "Find the later year.",
          "Subtract carefully to get the gap between them.",
        ],
        example: "The gap from 1066 to 1215 is 149 years because 1215 minus 1066 equals 149.",
      },
      {
        title: "Evidence limits the claim",
        summary: "A source tells you what is supported, not what you want to imagine around it.",
        bullets: [
          "Count only the people, dates, or objects the source gives.",
          "Do not add guesses as if they were evidence.",
          "Use period knowledge to check whether a claim makes sense.",
        ],
        example: "If a source names six wives of Henry VIII, the count stays six whether you like one more or less.",
      },
    ],
    practicePrompts: [
      {
        id: "hist-pr-1",
        title: "Timeline transfer",
        situation: "A new plaque compares the years 1485 and 1603.",
        question: "Which answer applies the chronology rule correctly?",
        options: [
          {
            id: "a",
            label: "118 years, because the later year minus the earlier year gives the span.",
            correct: true,
            feedback: "Right. You placed the dates in order and subtracted correctly.",
          },
          {
            id: "b",
            label: "12 years, because both dates begin with the number 1.",
            correct: false,
            feedback: "Shared leading digits do not determine the span between dates.",
          },
          {
            id: "c",
            label: "218 years, because you add the final two digits together.",
            correct: false,
            feedback: "History spans come from subtraction, not by combining digits.",
          },
        ],
      },
      {
        id: "hist-pr-2",
        title: "Evidence transfer",
        situation: "A display card states that Henry VIII had six wives.",
        question: "Which answer uses the source rule properly?",
        options: [
          {
            id: "a",
            label: "Keep the count at six because the card gives the evidence directly.",
            correct: true,
            feedback: "Right. The count should stay with the source, not drift into guesswork.",
          },
          {
            id: "b",
            label: "Raise the count to seven because kings usually marry more than once.",
            correct: false,
            feedback: "Historical claims must follow evidence, not assumptions.",
          },
          {
            id: "c",
            label: "Lower the count to five because one marriage ended early.",
            correct: false,
            feedback: "The duration of a marriage does not remove it from the count.",
          },
        ],
      },
    ],
  },
  harbour: {
    districtId: "harbour",
    primerTitle: "Atlas Harbour Study Sheet",
    primerGoal: "Use place knowledge, direction, and map structure before you estimate a geographic quantity.",
    memoryPrompt: "Remember the geography rule: identify the landform, region, or direction first, then count only the named feature.",
    adaptationHint: "The harbour swaps the route or region, so you need to adapt the place rule to a fresh map situation.",
    testBrief: "Atlas Harbour only opens its estimate route after you show that you can apply map knowledge correctly.",
    masteryReward: "Survey charter",
    cityProjectName: "Survey Wharf",
    cityProjectSummary:
      "Extend the quay with map tables, compass posts, and cargo masts linked to the atlas quarter.",
    cityProjectEffect:
      "Adds survey docks, compass markers, and extra boats around Atlas Harbour.",
    studyCards: [
      {
        title: "Physical and human features are different",
        summary: "Geography asks you to separate natural features from places humans built or changed.",
        bullets: [
          "Rivers, mountains, and coasts are physical features.",
          "Roads, ports, and bridges are human features.",
          "Count only the feature type the question names.",
        ],
        example: "A harbour may sit beside a coast, but the coast is physical while the harbour is human.",
      },
      {
        title: "Direction and world structure matter",
        summary: "Map questions depend on recognised direction systems and place groupings.",
        bullets: [
          "The basic compass rose has eight main points.",
          "Earth is usually taught as seven continents and five oceans.",
          "A full world time-zone rotation spans 24 hours.",
        ],
        example: "If a route turns from north to east, that is a right-angle change in direction, not a new continent.",
      },
    ],
    practicePrompts: [
      {
        id: "geo-pr-1",
        title: "Feature transfer",
        situation: "A route card mentions a cliff, a river, and a bridge.",
        question: "Which choice applies the feature rule properly?",
        options: [
          {
            id: "a",
            label: "Two physical features, because the cliff and river are natural while the bridge is human-made.",
            correct: true,
            feedback: "Right. You separated natural features from built infrastructure.",
          },
          {
            id: "b",
            label: "Three physical features, because everything appears on the map.",
            correct: false,
            feedback: "Being on a map does not make a feature physical.",
          },
          {
            id: "c",
            label: "One physical feature, because rivers are the only natural things that matter.",
            correct: false,
            feedback: "Cliffs are also physical features.",
          },
        ],
      },
      {
        id: "geo-pr-2",
        title: "Direction transfer",
        situation: "A sailor follows north, then east, then south on a harbour chart.",
        question: "Which answer uses the direction rule correctly?",
        options: [
          {
            id: "a",
            label: "The chart uses recognised compass directions, so each turn must follow the named points.",
            correct: true,
            feedback: "Right. The map rule depends on the actual compass points rather than vague left-right guesses.",
          },
          {
            id: "b",
            label: "The route has no direction because sailors can face any way they choose.",
            correct: false,
            feedback: "Compass directions still apply regardless of where the sailor is standing.",
          },
          {
            id: "c",
            label: "The route uses only two directions because east and south are the same corner of the map.",
            correct: false,
            feedback: "East and south are separate compass points.",
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
    id: "lab-1",
    districtId: "laboratory",
    title: "Circuit Frame",
    prompt: "Discovery Lab is checking the core pieces of a simple torch circuit.",
    question: "Estimate how many listed components are in a circuit with one cell, one bulb, and one switch.",
    unit: "components",
    min: 1,
    max: 8,
    answer: 3,
    anchors: ["Count only the named parts.", "Do not invent hidden pieces."],
    explanation: "The listed components are one cell, one bulb, and one switch, so the total is three.",
  },
  {
    id: "lab-2",
    districtId: "laboratory",
    title: "Planet Track",
    prompt: "The star table is restoring the solar-system display.",
    question: "Estimate how many planets are in the Solar System.",
    unit: "planets",
    min: 4,
    max: 12,
    answer: 8,
    anchors: ["Pluto is classed as a dwarf planet.", "The count includes Earth."],
    explanation: "The Solar System has eight planets.",
  },
  {
    id: "lab-3",
    districtId: "laboratory",
    title: "Insect Study",
    prompt: "A specimen board is checking a common animal fact before pupils arrive.",
    question: "Estimate how many legs an adult insect has.",
    unit: "legs",
    min: 2,
    max: 10,
    answer: 6,
    anchors: ["An insect has three pairs of legs.", "Do not count wings or antennae."],
    explanation: "Adult insects have six legs.",
  },
  {
    id: "lab-4",
    districtId: "laboratory",
    title: "Skeleton Vault",
    prompt: "The anatomy cabinet needs the total for a standard adult skeleton.",
    question: "Estimate how many bones are in an adult human body.",
    unit: "bones",
    min: 150,
    max: 260,
    answer: 206,
    anchors: ["The answer is just over two hundred.", "Use the adult count, not a baby's count."],
    explanation: "A typical adult human skeleton has 206 bones.",
  },
  {
    id: "lab-5",
    districtId: "laboratory",
    title: "Water Cycle Ring",
    prompt: "The climate rig is counting the main stages in a simple water-cycle model.",
    question: "Estimate how many main stages are usually named in the simple water cycle: evaporation, condensation, precipitation, and collection.",
    unit: "stages",
    min: 2,
    max: 8,
    answer: 4,
    anchors: ["The named stages are listed in the prompt.", "Count each stage once."],
    explanation: "The simple model names four stages: evaporation, condensation, precipitation, and collection.",
  },
  {
    id: "work-1",
    districtId: "workshop",
    title: "Bolt Head",
    prompt: "Makers Forge is checking a common fastener shape before metalwork begins.",
    question: "Estimate how many sides a standard hexagonal bolt head has.",
    unit: "sides",
    min: 4,
    max: 10,
    answer: 6,
    anchors: ["Hex means six.", "Count the outer edges only."],
    explanation: "A hexagonal bolt head has six sides.",
  },
  {
    id: "work-2",
    districtId: "workshop",
    title: "Bracket Measure",
    prompt: "A draft card converts a small bracket length from centimetres to millimetres.",
    question: "Estimate how many millimetres are in 3 centimetres.",
    unit: "millimetres",
    min: 10,
    max: 60,
    answer: 30,
    anchors: ["Each centimetre contains 10 millimetres.", "Multiply by three."],
    explanation: "Three centimetres equals 30 millimetres.",
  },
  {
    id: "work-3",
    districtId: "workshop",
    title: "Frame Corners",
    prompt: "A safety frame diagram shows a simple rectangle for the outer support.",
    question: "Estimate how many right angles the rectangular outer frame has.",
    unit: "right angles",
    min: 2,
    max: 8,
    answer: 4,
    anchors: ["All rectangle corners are right angles.", "Count the outer frame only."],
    explanation: "A rectangle has four right angles.",
  },
  {
    id: "work-4",
    districtId: "workshop",
    title: "Materials Order",
    prompt: "A bench order lists three side rails, three cross braces, and four seat slats.",
    question: "Estimate how many timber pieces are listed altogether.",
    unit: "pieces",
    min: 6,
    max: 16,
    answer: 10,
    anchors: ["Add each group in the order.", "Do not double-count the labels."],
    explanation: "Three side rails plus three cross braces plus four seat slats equals 10 pieces.",
  },
  {
    id: "work-5",
    districtId: "workshop",
    title: "Fixing Plate",
    prompt: "A drilling plate is arranged in three rows with two holes in each row.",
    question: "Estimate how many holes are on the plate.",
    unit: "holes",
    min: 2,
    max: 12,
    answer: 6,
    anchors: ["Three groups of two holes.", "Multiply rows by holes per row."],
    explanation: "Three rows times two holes equals six holes.",
  },
  {
    id: "math-1",
    districtId: "observatory",
    title: "Octagon Lens",
    prompt: "Number Observatory is aligning a shape chart for the lower gallery.",
    question: "Estimate how many sides an octagon has.",
    unit: "sides",
    min: 4,
    max: 12,
    answer: 8,
    anchors: ["Oct- means eight.", "Count the straight outer edges."],
    explanation: "An octagon has eight sides.",
  },
  {
    id: "math-2",
    districtId: "observatory",
    title: "Right-Angle Dial",
    prompt: "The angle dial needs a known benchmark before the next lesson.",
    question: "Estimate how many degrees are in a right angle.",
    unit: "degrees",
    min: 30,
    max: 140,
    answer: 90,
    anchors: ["A right angle forms a square corner.", "It is one quarter of a full turn."],
    explanation: "A right angle measures 90 degrees.",
  },
  {
    id: "math-3",
    districtId: "observatory",
    title: "Quarter-Hour Gate",
    prompt: "A time machine in the observatory converts fractions of an hour into minutes.",
    question: "Estimate how many minutes are in three quarters of an hour.",
    unit: "minutes",
    min: 15,
    max: 80,
    answer: 45,
    anchors: ["One hour contains 60 minutes.", "One quarter-hour is 15 minutes."],
    explanation: "Three quarters of an hour is 45 minutes.",
  },
  {
    id: "math-4",
    districtId: "observatory",
    title: "Factor Chamber",
    prompt: "The factor engine is sorting the numbers that divide 24 exactly.",
    question: "Estimate how many positive factors the number 24 has.",
    unit: "factors",
    min: 4,
    max: 12,
    answer: 8,
    anchors: ["List them in pairs.", "Use exact divisors only."],
    explanation: "The positive factors of 24 are 1, 2, 3, 4, 6, 8, 12, and 24, so there are eight.",
  },
  {
    id: "math-5",
    districtId: "observatory",
    title: "Cube Frame",
    prompt: "A geometric frame model is being repaired in the upper dome.",
    question: "Estimate how many edges a cube has.",
    unit: "edges",
    min: 6,
    max: 18,
    answer: 12,
    anchors: ["A cube has six faces and eight vertices.", "Count the line segments where faces meet."],
    explanation: "A cube has 12 edges.",
  },
  {
    id: "eng-1",
    districtId: "scriptorium",
    title: "Routine Sentence",
    prompt: "Scriptorium Hall is calibrating a banner about daily habits.",
    question: 'Estimate how many words are in this sentence: "She walks to school every day before breakfast."',
    unit: "words",
    min: 3,
    max: 20,
    answer: 8,
    anchors: ["Count each separated word once.", "Do not count the full stop."],
    explanation: "She(1) walks(2) to(3) school(4) every(5) day(6) before(7) breakfast(8).",
  },
  {
    id: "eng-2",
    districtId: "scriptorium",
    title: "Comma Bell",
    prompt: "Editors are checking a list sentence before the noon lesson.",
    question:
      'Estimate how many commas appear in this sentence: "Pack a pencil, a ruler, a notebook, and a glue stick before class."',
    unit: "commas",
    min: 0,
    max: 8,
    answer: 3,
    anchors: ["The final item is linked with and.", "Only punctuation marks count."],
    explanation: "There are three commas separating the listed items.",
  },
  {
    id: "eng-3",
    districtId: "scriptorium",
    title: "Conjunction Lock",
    prompt: "The spelling lock opens only when the apprentices estimate a tricky word length.",
    question: "Estimate how many letters are in the word 'because'.",
    unit: "letters",
    min: 4,
    max: 12,
    answer: 7,
    anchors: ["It begins with be-.", "It is shorter than therefore."],
    explanation: "B-e-c-a-u-s-e has seven letters.",
  },
  {
    id: "eng-4",
    districtId: "scriptorium",
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
    id: "eng-5",
    districtId: "scriptorium",
    title: "Adventure Gate",
    prompt: "The upper scriptorium arch measures the beats in a story word.",
    question: "Estimate how many syllables are in the word 'adventure'.",
    unit: "syllables",
    min: 2,
    max: 8,
    answer: 3,
    anchors: ["Say it slowly: ad-ven-ture.", "Each spoken beat counts once."],
    explanation: "Adventure has three syllables.",
  },
  {
    id: "hist-1",
    districtId: "archive",
    title: "Decade Stone",
    prompt: "Chronicle Archive is repairing a timeline marker for a basic time unit.",
    question: "Estimate how many years are in a decade.",
    unit: "years",
    min: 5,
    max: 20,
    answer: 10,
    anchors: ["A decade is a standard ten-year block.", "Do not confuse it with a century."],
    explanation: "A decade contains 10 years.",
  },
  {
    id: "hist-2",
    districtId: "archive",
    title: "Century Arch",
    prompt: "A museum arch labels the next larger unit on the historical timeline.",
    question: "Estimate how many years are in a century.",
    unit: "years",
    min: 50,
    max: 150,
    answer: 100,
    anchors: ["A century is larger than a decade.", "Think of one hundred-year periods."],
    explanation: "A century contains 100 years.",
  },
  {
    id: "hist-3",
    districtId: "archive",
    title: "Tudor Court",
    prompt: "The Tudor gallery is checking a well-known royal fact.",
    question: "Estimate how many wives Henry VIII had.",
    unit: "wives",
    min: 2,
    max: 10,
    answer: 6,
    anchors: ["The number is more than four.", "It is often remembered as a rhyme."],
    explanation: "Henry VIII had six wives.",
  },
  {
    id: "hist-4",
    districtId: "archive",
    title: "Magna Carta Gap",
    prompt: "The archive compares the Battle of Hastings and Magna Carta on one long timeline.",
    question: "Estimate how many years passed between 1066 and 1215.",
    unit: "years",
    min: 100,
    max: 180,
    answer: 149,
    anchors: ["Use subtraction from the later year to the earlier year.", "The answer is just under one hundred and fifty."],
    explanation: "1215 minus 1066 equals 149 years.",
  },
  {
    id: "hist-5",
    districtId: "archive",
    title: "Tudor Span",
    prompt: "The period wall shows the start and end dates of Tudor rule.",
    question: "Estimate how many years passed between 1485 and 1603.",
    unit: "years",
    min: 90,
    max: 140,
    answer: 118,
    anchors: ["Subtract the start year from the end year.", "The answer is a little over one hundred and fifteen."],
    explanation: "1603 minus 1485 equals 118 years.",
  },
  {
    id: "geo-1",
    districtId: "harbour",
    title: "Continent Ledger",
    prompt: "Atlas Harbour is restoring its world map labels.",
    question: "Estimate how many continents are usually taught on Earth.",
    unit: "continents",
    min: 4,
    max: 10,
    answer: 7,
    anchors: ["The count includes Antarctica.", "It is more than five."],
    explanation: "Earth is commonly taught as having seven continents.",
  },
  {
    id: "geo-2",
    districtId: "harbour",
    title: "Ocean Roll",
    prompt: "A dock chart is counting the named oceans before the lesson fleet leaves.",
    question: "Estimate how many oceans are usually named on Earth.",
    unit: "oceans",
    min: 3,
    max: 8,
    answer: 5,
    anchors: ["The answer is fewer than the continents.", "Count the named global oceans."],
    explanation: "The five oceans are Pacific, Atlantic, Indian, Southern, and Arctic.",
  },
  {
    id: "geo-3",
    districtId: "harbour",
    title: "Union Chart",
    prompt: "The harbour atlas is marking the countries of the United Kingdom.",
    question: "Estimate how many countries make up the United Kingdom.",
    unit: "countries",
    min: 2,
    max: 6,
    answer: 4,
    anchors: ["Think of England, Scotland, Wales, and Northern Ireland.", "Count each country once."],
    explanation: "The United Kingdom is made up of four countries.",
  },
  {
    id: "geo-4",
    districtId: "harbour",
    title: "Compass Post",
    prompt: "A survey mast is repainting the main directions on a basic compass rose.",
    question: "Estimate how many main points are on the basic compass rose.",
    unit: "points",
    min: 4,
    max: 12,
    answer: 8,
    anchors: ["Include north-east, south-east, south-west, and north-west.", "Count the cardinal and intercardinal points."],
    explanation: "A basic compass rose has eight main points.",
  },
  {
    id: "geo-5",
    districtId: "harbour",
    title: "Time-Zone Wheel",
    prompt: "The navigation table is aligning the world time-zone wheel.",
    question: "Estimate how many hours a full world time-zone rotation spans.",
    unit: "hours",
    min: 12,
    max: 30,
    answer: 24,
    anchors: ["Earth completes one full daily rotation in one day.", "Think of the number of hours in a day."],
    explanation: "A full world time-zone rotation spans 24 hours.",
  },
];

const districtSources: Record<DistrictId, string> = {
  laboratory: "KS2 science knowledge and investigation conventions.",
  workshop: "KS2 design and technology measuring and making conventions.",
  observatory: "KS2 mathematics number, measure, and shape conventions.",
  scriptorium: "KS2 English grammar, vocabulary, and reading conventions.",
  archive: "KS2 history chronology and evidence conventions.",
  harbour: "KS2 geography maps, places, and physical systems conventions.",
};

const districtRewards: Record<DistrictId, [string, string]> = {
  laboratory: ["Field station", "Research charter"],
  workshop: ["Prototype bench", "Forge crane"],
  observatory: ["Abacus arch", "Proof beacon"],
  scriptorium: ["Grammar banners", "Story lantern"],
  archive: ["Timeline wall", "Chronicle seal"],
  harbour: ["Survey quay", "Atlas beacon"],
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
  "The academy now runs six base subjects: science, DTE, maths, English, history, and geography.",
  "Every district teaches the rule first, checks whether you can adapt it, and only then unlocks the estimate test.",
  "Study sheets explain the base knowledge; practice sheets force you to use that knowledge in a fresh situation.",
  "Round 1 rewards careful intervals, while Round 2 rewards faster Above or Below decisions.",
  "The city grows fastest when all six subject districts are teaching, testing, and building at once.",
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
