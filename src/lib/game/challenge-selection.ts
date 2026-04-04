import type {
  FreeTextQuestion,
  GameContent,
  McqQuestion,
  QuestDefinition,
  QuestTrigger,
  QuizQuestion,
  StudyMode,
  MatchPairDefinition,
} from "./types";

interface DeckSelection<T> {
  item: T;
  recentIds: string[];
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function pickWeightedItem<T>(entries: Array<{ item: T; weight: number }>): T {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (totalWeight <= 0) {
    return entries[0].item;
  }

  let remaining = Math.random() * totalWeight;

  for (const entry of entries) {
    remaining -= Math.max(0, entry.weight);

    if (remaining <= 0) {
      return entry.item;
    }
  }

  return entries[entries.length - 1].item;
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

function pushRecentId(recentIds: string[], id: string, limit: number): string[] {
  return [...recentIds.filter((entry) => entry !== id), id].slice(-limit);
}

function pickFreshDeckItem<T extends { id: string }>(
  items: T[],
  recentIds: string[],
  getWeight: (item: T) => number = () => 1,
): T {
  const recent = new Set(recentIds);
  const freshItems = items.filter((item) => !recent.has(item.id));
  const pool = freshItems.length ? freshItems : items;

  return pickWeightedItem(
    pool.map((item) => ({
      item,
      weight: getWeight(item),
    })),
  );
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
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  programsHosted: number;
}): DeckSelection<McqQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.35 + programsHosted * 0.1;
  const question = pickFreshDeckItem(content.mcqDeck, recentIds, (item) =>
    item.difficulty === "Expert" ? expertBias + 0.9 : 1.25,
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
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  selectedRoomLevel: number;
}): DeckSelection<FreeTextQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.25 + selectedRoomLevel * 0.12;
  const question = pickFreshDeckItem(content.freeTextDeck, recentIds, (item) =>
    item.difficulty === "Expert" ? expertBias + 0.5 : 1.1,
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
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  reputation: number;
}): DeckSelection<QuizQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.4 + Math.max(0, (reputation - 50) / 25);
  const question = pickFreshDeckItem(content.quizDeck, recentIds, (item) =>
    item.difficulty === "Expert" ? expertBias + 0.75 : 1.15,
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
  const matching = content.questDeck.filter((quest) => quest.trigger === trigger);

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
