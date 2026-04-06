import type { DailyGoal, GameSession, QuestResourceReward } from "./types";

export const MAX_ROOM_LEVEL = 3;

function buildGoal(definition: Omit<DailyGoal, "completed">): DailyGoal {
  return {
    ...definition,
    completed: false,
  };
}

function reward(paper: number, ink: number, revisionTokens: number): QuestResourceReward {
  return { paper, ink, revisionTokens };
}

export function buildDailyGoals(themeId: string): DailyGoal[] {
  return [
    buildGoal({
      id: themeId === "blockstorm-island" ? "dropzone-open" : "default-room",
      kind: "rooms-opened",
      label: "Capture A New Island Zone",
      detail: "Use non-spendable diplomas to unlock 1 new zone and widen the island route.",
      target: 1,
      reward: reward(2, 1, 0),
    }),
    buildGoal({
      id: themeId === "blockstorm-island" ? "storm-circuit" : "default-quiz",
      kind: "challenge-completed",
      label: "Clear The Storm Circuit",
      detail: "Finish 3 study activities from the weighted Year 6 mix to keep resources flowing.",
      target: 3,
      reward: reward(1, 1, 2),
    }),
    buildGoal({
      id: themeId === "blockstorm-island" ? "diploma-rush" : "default-diplomas",
      kind: "diplomas-earned",
      label: "Secure Diploma Drops",
      detail: "Earn 2 diplomas by finishing perfection quests and passing the final tests.",
      target: 2,
      reward: reward(1, 0, 2),
    }),
  ];
}

export function formatRewardLabel(rewardValue: QuestResourceReward): string {
  const parts: string[] = [];

  if (rewardValue.paper) {
    parts.push(`${rewardValue.paper} paper`);
  }

  if (rewardValue.ink) {
    parts.push(`${rewardValue.ink} ink`);
  }

  if (rewardValue.revisionTokens) {
    parts.push(`${rewardValue.revisionTokens} revision token${rewardValue.revisionTokens === 1 ? "" : "s"}`);
  }

  return parts.join(" · ");
}

export function goalProgressForGame(game: GameSession | null, goal: DailyGoal): number {
  if (!game) {
    return 0;
  }

  switch (goal.kind) {
    case "rooms-opened":
      return game.roomsOpenedToday;
    case "diplomas-earned":
      return game.diplomas;
    case "challenge-completed":
      return game.programsHosted;
    case "mcq-completed":
      return game.completedMcqCount;
    case "quiz-completed":
      return game.completedQuizCount;
    case "free-text-completed":
      return game.completedFreeTextCount;
    case "match-pairs-completed":
      return game.completedMatchPairsCount;
    case "immersive-scenes-visited":
      return game.immersiveVisits;
    case "quests-completed":
      return game.questsCompleted;
    default:
      return 0;
  }
}
