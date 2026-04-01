import type { CallQuestion, CuratorCheckScenario, EstimationScenario, GameContent } from "./types";

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
    correct: index === entry.correctIndex
  }));
  const shuffled = shuffle(annotated);

  return {
    ...entry,
    choices: shuffled.map((item) => item.choice),
    correctIndex: shuffled.findIndex((item) => item.correct)
  };
}

function pushRecentId(recentIds: string[], id: string, limit: number): string[] {
  return [...recentIds.filter((entry) => entry !== id), id].slice(-limit);
}

function pickFreshDeckItem<T extends { id: string }>(
  items: T[],
  recentIds: string[],
  getWeight: (item: T) => number = () => 1
): T {
  const recent = new Set(recentIds);
  const freshItems = items.filter((item) => !recent.has(item.id));
  const pool = freshItems.length ? freshItems : items;

  return pickWeightedItem(
    pool.map((item) => ({
      item,
      weight: getWeight(item)
    }))
  );
}

export function selectCallQuestion({
  content,
  recentIds,
  completedGoalsCount,
  programsHosted
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  programsHosted: number;
}): DeckSelection<CallQuestion> {
  const expertBias = 1 + completedGoalsCount * 0.35 + programsHosted * 0.1;
  const question = pickFreshDeckItem(content.callDeck, recentIds, (item) =>
    item.difficulty === "Expert" ? expertBias + 0.9 : 1.25
  );

  return {
    item: shuffleChoiceEntry(question),
    recentIds: pushRecentId(recentIds, question.id, 7)
  };
}

export function selectEstimationScenario({
  content,
  recentIds,
  completedGoalsCount,
  selectedRoomLevel
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  selectedRoomLevel: number;
}): DeckSelection<EstimationScenario> {
  const expertBias = 1 + completedGoalsCount * 0.25 + selectedRoomLevel * 0.12;
  const scenario = pickFreshDeckItem(content.estimationDeck, recentIds, (item) =>
    item.difficulty === "Expert" ? expertBias + 0.5 : 1.1
  );

  return {
    item: scenario,
    recentIds: pushRecentId(recentIds, scenario.id, 5)
  };
}

export function selectCuratorScenario({
  content,
  recentIds,
  completedGoalsCount,
  reputation
}: {
  content: GameContent;
  recentIds: string[];
  completedGoalsCount: number;
  reputation: number;
}): DeckSelection<CuratorCheckScenario> {
  const expertBias = 1 + completedGoalsCount * 0.4 + Math.max(0, (reputation - 50) / 25);
  const scenario = pickFreshDeckItem(content.curatorCheckDeck, recentIds, (item) =>
    item.difficulty === "Expert" ? expertBias + 0.75 : 1.15
  );

  return {
    item: shuffleChoiceEntry(scenario),
    recentIds: pushRecentId(recentIds, scenario.id, 5)
  };
}

export function drawMatchPairsDeck(labels: string[], pairCount = 8): string[] {
  return shuffle(labels).slice(0, Math.min(pairCount, labels.length));
}

export function fallbackCallQuestion(content: GameContent): CallQuestion {
  return shuffleChoiceEntry(randomItem(content.callDeck));
}

export function fallbackEstimationScenario(content: GameContent): EstimationScenario {
  return randomItem(content.estimationDeck);
}

export function fallbackCuratorScenario(content: GameContent): CuratorCheckScenario {
  return shuffleChoiceEntry(randomItem(content.curatorCheckDeck));
}
