import type { DailyGoal, GameSession } from "./types";

export const MAX_ROOM_LEVEL = 3;

function buildGoal(definition: Omit<DailyGoal, "completed">): DailyGoal {
  return {
    ...definition,
    completed: false
  };
}

export function buildDailyGoals(themeId: string): DailyGoal[] {
  if (themeId === "heritage-hall") {
    return [
      buildGoal({
        id: "heritage-visitors",
        kind: "visitors-served",
        label: "Welcome The Morning Crowd",
        detail: "Guide at least 8 visitors cleanly through the floor.",
        target: 8,
        reward: { coins: 24, reputation: 5, curiosity: 3 }
      }),
      buildGoal({
        id: "heritage-expansion",
        kind: "rooms-opened",
        label: "Reopen New Wings",
        detail: "Unlock 2 additional rooms during the day.",
        target: 2,
        reward: { coins: 18, reputation: 4, curiosity: 4 }
      }),
      buildGoal({
        id: "heritage-programs",
        kind: "programs-hosted",
        label: "Keep The Floor Active",
        detail: "Host 3 tours, mini-games, or immersive view sessions.",
        target: 3,
        reward: { coins: 16, reputation: 4, curiosity: 6 }
      })
    ];
  }

  if (themeId === "marble-atrium") {
    return [
      buildGoal({
        id: "marble-revenue",
        kind: "revenue-earned",
        label: "Hit Institutional Revenue",
        detail: "Generate 120 coins from guests, pickups, and programs.",
        target: 120,
        reward: { coins: 28, reputation: 4, curiosity: 3 }
      }),
      buildGoal({
        id: "marble-expansion",
        kind: "rooms-opened",
        label: "Broaden The Route",
        detail: "Unlock 2 new spaces to raise throughput.",
        target: 2,
        reward: { coins: 20, reputation: 5, curiosity: 4 }
      }),
      buildGoal({
        id: "marble-programs",
        kind: "programs-hosted",
        label: "Program The Day",
        detail: "Complete 4 tours, mini-games, or immersive view sessions.",
        target: 4,
        reward: { coins: 18, reputation: 6, curiosity: 5 }
      })
    ];
  }

  if (themeId === "glasshouse-museum") {
    return [
      buildGoal({
        id: "glasshouse-immersive",
        kind: "photospheres-visited",
        label: "Walk The Atmosphere",
        detail: "Enter 2 unique immersive room views.",
        target: 2,
        reward: { coins: 18, reputation: 3, curiosity: 8 }
      }),
      buildGoal({
        id: "glasshouse-curiosity",
        kind: "curiosity",
        label: "Raise Wonder",
        detail: "Push museum curiosity to 65 or higher.",
        target: 65,
        reward: { coins: 20, reputation: 4, curiosity: 6 }
      }),
      buildGoal({
        id: "glasshouse-programs",
        kind: "programs-hosted",
        label: "Keep It Lively",
        detail: "Deliver 4 tours, mini-games, or immersive view sessions.",
        target: 4,
        reward: { coins: 16, reputation: 4, curiosity: 7 }
      })
    ];
  }

  return [
    buildGoal({
      id: "default-visitors",
      kind: "visitors-served",
      label: "Welcome Visitors",
      detail: "Serve 8 visitors during the day.",
      target: 8,
      reward: { coins: 20, reputation: 4, curiosity: 3 }
    }),
    buildGoal({
      id: "default-programs",
      kind: "programs-hosted",
      label: "Run Public Programs",
      detail: "Complete 3 tours, mini-games, or immersive visits.",
      target: 3,
      reward: { coins: 18, reputation: 4, curiosity: 5 }
    }),
    buildGoal({
      id: "default-expansion",
      kind: "rooms-opened",
      label: "Open More Of The Floor",
      detail: "Unlock 2 new rooms.",
      target: 2,
      reward: { coins: 16, reputation: 3, curiosity: 5 }
    })
  ];
}

export function formatRewardLabel(reward: DailyGoal["reward"]): string {
  const parts: string[] = [];

  if (reward.coins) {
    parts.push(`${reward.coins} coins`);
  }

  if (reward.reputation) {
    parts.push(`${reward.reputation}% reputation`);
  }

  if (reward.curiosity) {
    parts.push(`${reward.curiosity}% curiosity`);
  }

  return parts.join(" · ");
}

export function goalProgressForGame(game: GameSession | null, goal: DailyGoal): number {
  if (!game) {
    return 0;
  }

  switch (goal.kind) {
    case "visitors-served":
      return game.visitorsServed;
    case "revenue-earned":
      return game.revenueEarned;
    case "rooms-opened":
      return game.roomsOpenedToday;
    case "programs-hosted":
      return game.programsHosted;
    case "photospheres-visited":
      return game.photospheresVisited;
    case "reputation":
      return game.reputation;
    case "curiosity":
      return game.curiosity;
    default:
      return 0;
  }
}
