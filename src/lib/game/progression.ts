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
  if (themeId === "heritage-hall") {
    return [
      buildGoal({
        id: "heritage-rewrite",
        kind: "free-text-completed",
        label: "Rewrite Your Essay On Paper",
        detail: "Finish 1 extended answer and redraft it carefully, as if edits are no longer available.",
        target: 1,
        reward: reward(2, 1, 1),
      }),
      buildGoal({
        id: "heritage-diplomas",
        kind: "diplomas-earned",
        label: "Earn Reading Diplomas",
        detail: "Secure 2 diplomas by finishing perfection quests and passing the final tests.",
        target: 2,
        reward: reward(1, 1, 2),
      }),
      buildGoal({
        id: "heritage-open-wing",
        kind: "rooms-opened",
        label: "Open A New Sea Route",
        detail: "Use your diplomas to unlock 1 new zone without spending them.",
        target: 1,
        reward: reward(1, 0, 2),
      }),
    ];
  }

  if (themeId === "marble-atrium") {
    return [
      buildGoal({
        id: "marble-working",
        kind: "quiz-completed",
        label: "Show The Working",
        detail: "Complete 2 harder quiz rounds and keep your method tidy enough to check again.",
        target: 2,
        reward: reward(2, 0, 1),
      }),
      buildGoal({
        id: "marble-diplomas",
        kind: "diplomas-earned",
        label: "Collect Maths Diplomas",
        detail: "Earn 3 diplomas from perfected topics and their final tests.",
        target: 3,
        reward: reward(1, 1, 2),
      }),
      buildGoal({
        id: "marble-match",
        kind: "challenge-completed",
        label: "Finish The Revision Circuit",
        detail: "Complete 3 study activities of any kind to build revision momentum.",
        target: 3,
        reward: reward(1, 2, 1),
      }),
    ];
  }

  if (themeId === "glasshouse-museum") {
    return [
      buildGoal({
        id: "glasshouse-redraft",
        kind: "free-text-completed",
        label: "If You Cannot Edit, Redraft",
        detail: "Complete 1 free-text answer and treat the rewrite on paper as the improvement step.",
        target: 1,
        reward: reward(2, 1, 2),
      }),
      buildGoal({
        id: "glasshouse-match",
        kind: "match-pairs-completed",
        label: "Lock The Vocabulary Pairs",
        detail: "Clear 1 match-pairs round from the Year 6 vocabulary and humanities deck.",
        target: 1,
        reward: reward(1, 1, 1),
      }),
      buildGoal({
        id: "glasshouse-immersive",
        kind: "immersive-scenes-visited",
        label: "Dive The Splat Zones",
        detail: "Enter 2 immersive splat spaces while building your diploma total.",
        target: 2,
        reward: reward(1, 0, 2),
      }),
    ];
  }

  return [
    buildGoal({
        id: "default-diplomas",
        kind: "diplomas-earned",
        label: "Earn Starter Diplomas",
        detail: "Collect 2 diplomas from completed perfection quests and final tests.",
      target: 2,
      reward: reward(1, 1, 1),
    }),
    buildGoal({
      id: "default-quiz",
      kind: "quiz-completed",
      label: "Complete Quick Quiz Rounds",
      detail: "Finish 2 quiz rounds from the weighted challenge pool.",
      target: 2,
      reward: reward(1, 0, 2),
    }),
    buildGoal({
      id: "default-room",
      kind: "rooms-opened",
      label: "Unlock The Next Zone",
      detail: "Use non-spendable diplomas to unlock 1 more Gocean zone.",
      target: 1,
      reward: reward(2, 1, 0),
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
