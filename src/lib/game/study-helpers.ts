import type {
  FreeTextQuestion,
  MatchCard,
  MatchPairDefinition,
  RewardBundle,
  StudyMode,
  StudyResources,
} from "./types";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "then",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "why",
  "with",
]);

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  mcq: "MCQ",
  quiz: "Quiz",
  "free-text": "Free Text",
  "match-pairs": "Match Pairs",
};

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenizeAnswer(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function formatStudyModeLabel(mode: StudyMode | null | undefined): string {
  return mode ? STUDY_MODE_LABELS[mode] : "Study";
}

export function formatCompactReward(rewards: RewardBundle): string {
  const parts: string[] = [];

  if (rewards.diplomas) {
    parts.push(`${rewards.diplomas} diploma${rewards.diplomas === 1 ? "" : "s"}`);
  }

  if (rewards.paper) {
    parts.push(`${rewards.paper} paper`);
  }

  if (rewards.ink) {
    parts.push(`${rewards.ink} ink`);
  }

  if (rewards.revisionTokens) {
    parts.push(`${rewards.revisionTokens} token${rewards.revisionTokens === 1 ? "" : "s"}`);
  }

  if (rewards.coins) {
    parts.push(`${rewards.coins} coins`);
  }

  if (rewards.reputation) {
    parts.push(`${rewards.reputation}% rep`);
  }

  if (rewards.curiosity) {
    parts.push(`${rewards.curiosity}% curiosity`);
  }

  return parts.join(" / ");
}

export function formatStudyResources(resources: StudyResources): string {
  return `${resources.paper} paper · ${resources.ink} ink · ${resources.revisionTokens} tokens`;
}

export function evaluateFreeTextAnswer(answer: string, question: FreeTextQuestion): boolean {
  const normalizedAnswer = normalizeText(answer);

  if (!normalizedAnswer) {
    return false;
  }

  const exactMatch = question.acceptedAnswers.some((entry) => {
    const normalizedEntry = normalizeText(entry);
    return normalizedAnswer.includes(normalizedEntry) || normalizedEntry.includes(normalizedAnswer);
  });

  if (exactMatch) {
    return true;
  }

  const answerTokens = new Set(tokenizeAnswer(answer));

  if (answerTokens.size < 4) {
    return false;
  }

  const bestCoverage = Math.max(
    ...question.acceptedAnswers.map((entry) => {
      const referenceTokens = new Set(tokenizeAnswer(entry));

      if (!referenceTokens.size) {
        return 0;
      }

      let overlap = 0;

      for (const token of answerTokens) {
        if (referenceTokens.has(token)) {
          overlap += 1;
        }
      }

      return overlap / referenceTokens.size;
    }),
    0,
  );

  return bestCoverage >= 0.45;
}

export function buildMatchCards(pairs: MatchPairDefinition[]): MatchCard[] {
  return shuffle(
    pairs.flatMap((pair) => [
      {
        id: `${pair.id}-left`,
        pair: pair.id,
        label: pair.left,
      },
      {
        id: `${pair.id}-right`,
        pair: pair.id,
        label: pair.right,
      },
    ]),
  ).map((card) => ({
    ...card,
    matched: false,
    revealed: false,
  }));
}
