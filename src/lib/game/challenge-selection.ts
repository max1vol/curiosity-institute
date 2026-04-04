import type {
  FreeTextQuestion,
  GameContent,
  MatchPairDefinition,
  McqQuestion,
  QuestDefinition,
  QuestTrigger,
  QuizQuestion,
  StudyMode,
} from "./types";
import { pickFreshDeckItem, pickWeightedItem, pushRecentId, shuffle } from "./random";

interface DeckSelection<T> {
  item: T;
  recentIds: string[];
}

type WeightFn<T> = (item: T) => number;

type QuestionEntry = McqQuestion | QuizQuestion | FreeTextQuestion;

interface QuestionIndex<T extends QuestionEntry> {
  all: T[];
  bySubject: Map<string, T[]>;
  bySubjectTopic: Map<string, T[]>;
  expertBySubject: Map<string, T[]>;
  expertBySubjectTopic: Map<string, T[]>;
}

interface CurriculumIndex {
  mcq: QuestionIndex<McqQuestion>;
  quiz: QuestionIndex<QuizQuestion>;
  freeText: QuestionIndex<FreeTextQuestion>;
  matchPairsBySubject: Map<string, MatchPairDefinition[]>;
  questsByTrigger: Map<QuestTrigger, QuestDefinition[]>;
}

const curriculumIndexCache = new WeakMap<GameContent, CurriculumIndex>();

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleChoiceEntry<T extends { choices: string[]; correctIndex: number }>(entry: T): T {
  const annotated = entry.choices.map((choice, index) => ({
    choice,
    correct: index === entry.correctIndex,
  }));
  const shuffled = shuffle(annotated);

  return {
    ...entry,
    choices: shuffled.map((item) => item.choice),
    correctIndex: shuffled.findIndex((item) => item.correct),
  };
}

function subjectTopicKey(subject: string, topic: string): string {
  return `${subject}::${topic}`;
}

function appendMapArray<T>(map: Map<string, T[]>, key: string, item: T): void {
  const existing = map.get(key);

  if (existing) {
    existing.push(item);
    return;
  }

  map.set(key, [item]);
}

function buildQuestionIndex<T extends QuestionEntry>(items: T[]): QuestionIndex<T> {
  const bySubject = new Map<string, T[]>();
  const bySubjectTopic = new Map<string, T[]>();
  const expertBySubject = new Map<string, T[]>();
  const expertBySubjectTopic = new Map<string, T[]>();

  for (const item of items) {
    appendMapArray(bySubject, item.subject, item);
    appendMapArray(bySubjectTopic, subjectTopicKey(item.subject, item.topic), item);

    if (item.difficulty === "Expert") {
      appendMapArray(expertBySubject, item.subject, item);
      appendMapArray(expertBySubjectTopic, subjectTopicKey(item.subject, item.topic), item);
    }
  }

  return {
    all: items,
    bySubject,
    bySubjectTopic,
    expertBySubject,
    expertBySubjectTopic,
  };
}

function buildCurriculumIndex(content: GameContent): CurriculumIndex {
  const matchPairsBySubject = new Map<string, MatchPairDefinition[]>();
  const questsByTrigger = new Map<QuestTrigger, QuestDefinition[]>();

  for (const pair of content.matchPairDeck) {
    appendMapArray(matchPairsBySubject, pair.subject, pair);
  }

  for (const quest of content.questDeck) {
    appendMapArray(questsByTrigger, quest.trigger, quest);
  }

  return {
    mcq: buildQuestionIndex(content.mcqDeck),
    quiz: buildQuestionIndex(content.quizDeck),
    freeText: buildQuestionIndex(content.freeTextDeck),
    matchPairsBySubject,
    questsByTrigger,
  };
}

function getCurriculumIndex(content: GameContent): CurriculumIndex {
  let cached = curriculumIndexCache.get(content);

  if (!cached) {
    cached = buildCurriculumIndex(content);
    curriculumIndexCache.set(content, cached);
  }

  return cached;
}

function pickTargetedDeckPool<T extends QuestionEntry>(
  index: QuestionIndex<T>,
  subject: string,
  topic: string,
  expertOnly = false,
): T[] {
  const source = expertOnly
    ? {
        bySubject: index.expertBySubject,
        bySubjectTopic: index.expertBySubjectTopic,
      }
    : {
        bySubject: index.bySubject,
        bySubjectTopic: index.bySubjectTopic,
      };

  return (
    source.bySubjectTopic.get(subjectTopicKey(subject, topic)) ??
    source.bySubject.get(subject) ??
    index.all
  );
}

function pickFocusedDeckPool<T extends QuestionEntry>(index: QuestionIndex<T>, preferredSubjects?: string[]): T[] {
  if (!preferredSubjects?.length) {
    return index.all;
  }

  const focused = preferredSubjects.flatMap((subject) => index.bySubject.get(subject) ?? []);
  return focused.length ? focused : index.all;
}

function pickFocusedMatchPairs(content: GameContent, preferredSubjects?: string[]): MatchPairDefinition[] {
  if (!preferredSubjects?.length) {
    return content.matchPairDeck;
  }

  const matchPairsBySubject = getCurriculumIndex(content).matchPairsBySubject;
  const focused = preferredSubjects.flatMap((subject) => matchPairsBySubject.get(subject) ?? []);
  return focused.length ? focused : content.matchPairDeck;
}

export function selectStudyMode(content: GameContent): StudyMode {
  return pickWeightedItem(
    (Object.entries(content.studyModeWeights) as Array<[StudyMode, number]>).map(([item, weight]) => ({
      item,
      weight,
    })),
  );
}

export function selectMcqQuestion({
  content,
  recentIds,
  completedGoalsCount,
  programsHosted,
  preferredSubjects,
  focusWeight,
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  programsHosted: number;
  preferredSubjects?: string[];
  focusWeight?: WeightFn<McqQuestion>;
}): DeckSelection<McqQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.35 + programsHosted * 0.1;
  const question = pickFreshDeckItem(pickFocusedDeckPool(getCurriculumIndex(content).mcq, preferredSubjects), recentIds, (item) =>
    (item.difficulty === "Expert" ? expertBias + 0.9 : 1.25) * (focusWeight?.(item) ?? 1),
  );

  return {
    item: shuffleChoiceEntry(question),
    recentIds: pushRecentId(recentIds, question.id, 8),
  };
}

export function selectFreeTextQuestion({
  content,
  recentIds,
  completedGoalsCount,
  selectedRoomLevel,
  preferredSubjects,
  focusWeight,
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  selectedRoomLevel: number;
  preferredSubjects?: string[];
  focusWeight?: WeightFn<FreeTextQuestion>;
}): DeckSelection<FreeTextQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.25 + selectedRoomLevel * 0.12;
  const question = pickFreshDeckItem(pickFocusedDeckPool(getCurriculumIndex(content).freeText, preferredSubjects), recentIds, (item) =>
    (item.difficulty === "Expert" ? expertBias + 0.5 : 1.1) * (focusWeight?.(item) ?? 1),
  );

  return {
    item: question,
    recentIds: pushRecentId(recentIds, question.id, 6),
  };
}

export function selectQuizQuestion({
  content,
  recentIds,
  completedGoalsCount,
  reputation,
  preferredSubjects,
  focusWeight,
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  reputation: number;
  preferredSubjects?: string[];
  focusWeight?: WeightFn<QuizQuestion>;
}): DeckSelection<QuizQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.4 + Math.max(0, (reputation - 50) / 25);
  const question = pickFreshDeckItem(pickFocusedDeckPool(getCurriculumIndex(content).quiz, preferredSubjects), recentIds, (item) =>
    (item.difficulty === "Expert" ? expertBias + 0.75 : 1.15) * (focusWeight?.(item) ?? 1),
  );

  return {
    item: shuffleChoiceEntry(question),
    recentIds: pushRecentId(recentIds, question.id, 8),
  };
}

export function selectQuest({
  content,
  recentIds,
  trigger,
}: {
  content: GameContent;
  recentIds: string[];
  trigger: QuestTrigger;
}): DeckSelection<QuestDefinition> | null {
  const questsByTrigger = getCurriculumIndex(content).questsByTrigger;
  const matching = questsByTrigger.get(trigger) ?? [];

  if (!matching.length) {
    return null;
  }

  const quest = pickFreshDeckItem(matching, recentIds);

  return {
    item: quest,
    recentIds: pushRecentId(recentIds, quest.id, 10),
  };
}

export function drawMatchPairsDeck(pairs: MatchPairDefinition[], pairCount = 8): MatchPairDefinition[] {
  return shuffle(pairs).slice(0, Math.min(pairCount, pairs.length));
}

export function fallbackMcqQuestion(content: GameContent): McqQuestion {
  return shuffleChoiceEntry(randomItem(content.mcqDeck));
}

export function fallbackFreeTextQuestion(content: GameContent): FreeTextQuestion {
  return randomItem(content.freeTextDeck);
}

export function fallbackQuizQuestion(content: GameContent): QuizQuestion {
  return shuffleChoiceEntry(randomItem(content.quizDeck));
}

export function selectTargetedMcqQuestion({
  content,
  recentIds,
  subject,
  topic,
  focusWeight,
}: {
  content: GameContent;
  recentIds: string[];
  subject: string;
  topic: string;
  focusWeight?: WeightFn<McqQuestion>;
}): DeckSelection<McqQuestion> {
  const index = getCurriculumIndex(content).mcq;
  const targetedPool = pickTargetedDeckPool(index, subject, topic);
  const expertPool = pickTargetedDeckPool(index, subject, topic, true);
  const question = pickFreshDeckItem(expertPool.length ? expertPool : targetedPool, recentIds, (item) =>
    (item.difficulty === "Expert" ? 2.4 : 1) * (focusWeight?.(item) ?? 1)
  );

  return {
    item: shuffleChoiceEntry(question),
    recentIds: pushRecentId(recentIds, question.id, 8)
  };
}

export function selectTargetedFreeTextQuestion({
  content,
  recentIds,
  subject,
  topic,
  focusWeight,
}: {
  content: GameContent;
  recentIds: string[];
  subject: string;
  topic: string;
  focusWeight?: WeightFn<FreeTextQuestion>;
}): DeckSelection<FreeTextQuestion> {
  const index = getCurriculumIndex(content).freeText;
  const targetedPool = pickTargetedDeckPool(index, subject, topic);
  const expertPool = pickTargetedDeckPool(index, subject, topic, true);
  const question = pickFreshDeckItem(expertPool.length ? expertPool : targetedPool, recentIds, (item) =>
    (item.difficulty === "Expert" ? 2.2 : 1) * (focusWeight?.(item) ?? 1)
  );

  return {
    item: question,
    recentIds: pushRecentId(recentIds, question.id, 6)
  };
}

export function selectTargetedQuizQuestion({
  content,
  recentIds,
  subject,
  topic,
  focusWeight,
}: {
  content: GameContent;
  recentIds: string[];
  subject: string;
  topic: string;
  focusWeight?: WeightFn<QuizQuestion>;
}): DeckSelection<QuizQuestion> {
  const index = getCurriculumIndex(content).quiz;
  const targetedPool = pickTargetedDeckPool(index, subject, topic);
  const expertPool = pickTargetedDeckPool(index, subject, topic, true);
  const question = pickFreshDeckItem(expertPool.length ? expertPool : targetedPool, recentIds, (item) =>
    (item.difficulty === "Expert" ? 2.5 : 1) * (focusWeight?.(item) ?? 1)
  );

  return {
    item: shuffleChoiceEntry(question),
    recentIds: pushRecentId(recentIds, question.id, 8)
  };
}

export function selectTargetedMatchPairs({
  content,
  subject,
  pairCount = 8
}: {
  content: GameContent;
  subject: string;
  pairCount?: number;
}): MatchPairDefinition[] {
  const matching = getCurriculumIndex(content).matchPairsBySubject.get(subject) ?? [];
  return drawMatchPairsDeck(matching.length ? matching : content.matchPairDeck, pairCount);
}

export function selectFocusedMatchPairs({
  content,
  preferredSubjects,
  pairCount = 8
}: {
  content: GameContent;
  preferredSubjects?: string[];
  pairCount?: number;
}): MatchPairDefinition[] {
  return drawMatchPairsDeck(pickFocusedMatchPairs(content, preferredSubjects), pairCount);
}
