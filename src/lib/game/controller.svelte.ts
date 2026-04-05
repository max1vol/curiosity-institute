import type {
  ActivityEntry,
  ConceptAsset,
  DailyGoal,
  DailyGoalView,
  FinalTestState,
  FloorCoin,
  FreeTextQuestion,
  GameContent,
  GameSession,
  ImmersiveEdge,
  ImmersiveNode,
  McqQuestion,
  MiniGameDefinition,
  MiniGameId,
  ModalState,
  ObjectivePill,
  PerformanceRecord,
  Point,
  QuestState,
  QuestTrigger,
  RewardBundle,
  RoomAction,
  RoomBlueprint,
  RoomDetail,
  StatCard,
  StudyMode,
  StudyStage,
  StudyResources,
  ThemeDefinition,
  ViewerState,
  VisitorState,
  QuizQuestion
} from "./types";
import {
  drawMatchPairsDeck,
  fallbackFreeTextQuestion,
  fallbackMcqQuestion,
  fallbackQuizQuestion,
  selectFocusedMatchPairs,
  selectFreeTextQuestion,
  selectMcqQuestion,
  selectQuest,
  selectTargetedMatchPairs,
  selectTargetedFreeTextQuestion,
  selectTargetedMcqQuestion,
  selectTargetedQuizQuestion,
  selectQuizQuestion,
  selectStudyMode
} from "./challenge-selection";
import {
  buildAdaptiveQuestState,
  buildFinalTestState,
  finalTestModeForQuest,
  shouldOfferMasteryQuest,
  summarizePerformance,
  updatePerformanceRecords
} from "./diploma-flow";
import { buildDailyGoals, formatRewardLabel, goalProgressForGame, MAX_ROOM_LEVEL } from "./progression";
import {
  buildMatchCards,
  evaluateFreeTextAnswer,
  formatCompactReward,
  formatStudyModeLabel,
  formatStudyResources
} from "./study-helpers";
import { pickWeightedItem } from "./random";
import { buildStudyRoundFeedback } from "./study-flow";

export const WORLD = {
  width: 1100,
  height: 640
} as const;

const MOVEMENT_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"]);
const STORAGE_KEY_PREFIX = "curiosity-institute-save-v5";
const LEGACY_STORAGE_KEY = "curiosity-institute-save-v4";
const SAVE_INTERVAL_MS = 2500;
const MIN_QUESTION_COINS = 1;
const MATCH_PAIR_ATTEMPT_LIMIT = 9;
const MATCH_PAIR_DECK_SIZE = 6;
const ACTIVITY_LOG_LIMIT = 8;
const ACTIVE_QUEST_LIMIT = 4;
const QUEST_TRIGGER_BY_MODE: Record<StudyMode, QuestTrigger> = {
  mcq: "mcq-failure",
  quiz: "quiz-failure",
  "free-text": "free-text-failure",
  "match-pairs": "match-pairs-failure"
};
const QUEST_MASTERY_TRIGGER_BY_MODE: Record<StudyMode, QuestTrigger> = {
  mcq: "mcq-mastery",
  quiz: "quiz-mastery",
  "free-text": "free-text-mastery",
  "match-pairs": "match-pairs-mastery"
};

interface SavedGamePayload {
  version: number;
  selectedThemeId: string;
  savedAt: string;
  game: GameSession;
}

interface MuseumGameControllerOptions {
  saveSlotId?: string;
}

type StudyQuestionLike = Pick<McqQuestion | QuizQuestion | FreeTextQuestion, "id" | "subject" | "topic" | "prompt">;
type QuestionStudyMode = "mcq" | "quiz" | "free-text";
type StudyRoundStage = StudyStage;
type MatchRoundStage = Exclude<StudyStage, "final-test">;
type QuestionRound = McqQuestion | QuizQuestion | FreeTextQuestion;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roomCenter(room: RoomBlueprint): Point {
  return {
    x: room.position.x + room.position.width / 2,
    y: room.position.y + room.position.height / 2
  };
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function moveToward(entity: Point, target: Point, speed: number, deltaSeconds: number): boolean {
  const dx = target.x - entity.x;
  const dy = target.y - entity.y;
  const distanceToTarget = Math.hypot(dx, dy);

  if (distanceToTarget < 1) {
    entity.x = target.x;
    entity.y = target.y;
    return true;
  }

  const travel = Math.min(speed * deltaSeconds, distanceToTarget);
  entity.x += (dx / distanceToTarget) * travel;
  entity.y += (dy / distanceToTarget) * travel;
  return distanceToTarget - travel <= 1;
}

function createRoomNumberMap(rooms: RoomBlueprint[], initialValue = 0): Record<string, number> {
  const result: Record<string, number> = {};

  for (const room of rooms) {
    result[room.id] = initialValue;
  }

  return result;
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function asNumberRecord(value: unknown, rooms: RoomBlueprint[]): Record<string, number> {
  const fallback = createRoomNumberMap(rooms, 0);

  if (!value || typeof value !== "object") {
    return fallback;
  }

  for (const room of rooms) {
    const nextValue = asFiniteNumber((value as Record<string, unknown>)[room.id], 0);
    fallback[room.id] = Math.max(0, nextValue);
  }

  return fallback;
}

function formatRelativeSave(isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return "Autosave starts after your first day begins.";
  }

  const elapsedMs = Date.now() - Date.parse(isoTimestamp);

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return "Local autosave is ready.";
  }

  const elapsedMinutes = Math.floor(elapsedMs / 60_000);

  if (elapsedMinutes < 1) {
    return "Autosaved just now.";
  }

  if (elapsedMinutes < 60) {
    return `Autosaved ${elapsedMinutes}m ago.`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `Autosaved ${elapsedHours}h ago.`;
  }

  return `Autosaved ${Math.floor(elapsedHours / 24)}d ago.`;
}

function normalizeHeading(value: number): number {
  return ((value % 360) + 360) % 360;
}

function headingDelta(from: number, to: number): number {
  return Math.abs((((to - from) % 360) + 540) % 360 - 180);
}

function createStudyResources(): StudyResources {
  return {
    paper: 0,
    ink: 0,
    revisionTokens: 0
  };
}

function isStudyMode(value: unknown): value is StudyMode {
  return value === "mcq" || value === "quiz" || value === "free-text" || value === "match-pairs";
}

function normalizeQuestTrigger(value: unknown): QuestTrigger {
  return value === "mcq-failure" ||
    value === "mcq-mastery" ||
    value === "quiz-failure" ||
    value === "quiz-mastery" ||
    value === "free-text-failure" ||
    value === "free-text-mastery" ||
    value === "locked-submission" ||
    value === "match-pairs-failure" ||
    value === "match-pairs-mastery" ||
    value === "mastery-review" ||
    value === "final-diploma-test"
    ? value
    : "locked-submission";
}

function isQuestStage(value: unknown): value is QuestState["stage"] {
  return value === "improvement" || value === "final-ready";
}

export class MuseumGameController {
  readonly content: GameContent;
  readonly saveSlotId: string;

  selectedThemeId = $state("");
  game = $state<GameSession | null>(null);
  viewerState = $state<ViewerState | null>(null);
  savedGameAvailable = $state(false);
  lastSavedAt = $state<string | null>(null);

  private readonly keys = new Set<string>();
  private readonly storageKey: string;
  private readonly fallbackStorageKeys: string[];
  private viewerHistory: string[] = [];
  private animationFrame = 0;
  private lastFrame = 0;
  private lastPersistAt = 0;
  private mounted = false;

  constructor(content: GameContent, options: MuseumGameControllerOptions = {}) {
    this.content = content;
    this.saveSlotId = options.saveSlotId ?? "guest";
    this.storageKey = `${STORAGE_KEY_PREFIX}:${this.saveSlotId}`;
    this.fallbackStorageKeys = this.saveSlotId === "guest" ? [this.storageKey, LEGACY_STORAGE_KEY] : [this.storageKey];
    this.selectedThemeId = content.themes[0]?.id ?? "";
  }

  get activeTheme(): ThemeDefinition | undefined {
    return this.content.themes.find((theme) => theme.id === this.selectedThemeId) ?? this.content.themes[0];
  }

  get selectedRoom(): RoomBlueprint | undefined {
    if (!this.game) {
      return undefined;
    }

    return this.findRoom(this.game.selectedRoomId);
  }

  get viewerRoom(): RoomBlueprint | undefined {
    const roomId = this.viewerNode?.roomId;

    if (!roomId) {
      return undefined;
    }

    return this.findRoom(roomId);
  }

  get viewerNode(): ImmersiveNode | undefined {
    if (!this.viewerState) {
      return undefined;
    }

    return this.findImmersiveNode(this.viewerState.nodeId);
  }

  get viewerBackEdge(): ImmersiveEdge | undefined {
    const currentNode = this.viewerNode;
    const previousNodeId = this.previousViewerNodeId();

    if (!currentNode || !previousNodeId) {
      return undefined;
    }

    return currentNode.edges.find((edge) => edge.toNodeId === previousNodeId);
  }

  get viewerForwardEdge(): ImmersiveEdge | undefined {
    if (!this.viewerNode || !this.viewerState) {
      return undefined;
    }

    return this.preferredForwardEdge(this.viewerNode, this.previousViewerNodeId(), this.viewerState.yaw, {
      preferTraversable: true
    });
  }

  get canMoveViewerBack(): boolean {
    return Boolean(this.viewerBackEdge);
  }

  get canMoveViewerForward(): boolean {
    return this.canTraverseViewerEdge(this.viewerForwardEdge);
  }

  get viewerRoomLevel(): number {
    if (!this.viewerRoom) {
      return 0;
    }

    return this.roomLevel(this.viewerRoom.id);
  }

  get viewerRoomMaxLevel(): number {
    return MAX_ROOM_LEVEL;
  }

  get viewerRoomTierLabel(): string {
    return `Tier ${this.viewerRoomLevel + 1} of ${this.viewerRoomMaxLevel + 1}`;
  }

  get viewerRoomProgressText(): string {
    const room = this.viewerRoom;

    if (!room) {
      return "No immersive zone is open.";
    }

    if (this.viewerRoomLevel >= this.viewerRoomMaxLevel) {
      return "This zone is already at max tier.";
    }

    const cost = this.viewerRoomUpgradeCost;

    if (cost === null) {
      return "Upgrade unavailable.";
    }

    const nextTier = this.viewerRoomLevel + 2;
    return `Upgrade to Tier ${nextTier} for ${cost} resources.`;
  }

  get viewerRoomUpgradeCost(): number | null {
    const room = this.viewerRoom;

    if (!room || !this.isRoomUnlocked(room.id) || this.viewerRoomLevel >= this.viewerRoomMaxLevel) {
      return null;
    }

    return this.roomUpgradeCost(room);
  }

  get viewerRoomCanUpgrade(): boolean {
    const room = this.viewerRoom;

    if (!room) {
      return false;
    }

    return this.canUpgradeRoom(room);
  }

  get viewerRoomUpgradeLabel(): string {
    const room = this.viewerRoom;

    if (!room) {
      return "Upgrade Zone";
    }

    if (this.viewerRoomLevel >= this.viewerRoomMaxLevel) {
      return "Max Tier Reached";
    }

    const nextTier = this.viewerRoomLevel + 2;
    const cost = this.viewerRoomUpgradeCost;

    if (cost === null) {
      return "Upgrade Unavailable";
    }

    if (!this.viewerRoomCanUpgrade) {
      return `Need ${Math.max(0, cost - this.totalResources())} resources for Tier ${nextTier}`;
    }

    return `Upgrade To Tier ${nextTier} (${cost} Resources)`;
  }

  get canResumeSavedGame(): boolean {
    return this.savedGameAvailable;
  }

  get saveSummary(): string {
    return formatRelativeSave(this.lastSavedAt);
  }

  get completedGoalsCount(): number {
    return this.dailyGoals.filter((goal) => goal.completed).length;
  }

  get museumGrade(): string {
    if (!this.game) {
      return "Preview";
    }

    const score =
      this.game.reputation * 0.42 +
      this.game.curiosity * 0.34 +
      this.game.unlockedRoomIds.length * 4 +
      this.completedGoalsCount * 8 +
      this.game.programsHosted * 2.5;

    if (score >= 90) {
      return "A";
    }
    if (score >= 80) {
      return "A-";
    }
    if (score >= 70) {
      return "B+";
    }
    if (score >= 60) {
      return "B";
    }
    if (score >= 50) {
      return "C+";
    }

    return "C";
  }

  get gradeSummary(): string {
    if (!this.game) {
      return "Choose a route, then start or resume a Year 6 voyage.";
    }

    if (this.completedGoalsCount === this.dailyGoals.length) {
      return "Core goals complete. Keep farming resources with plain tests and convert polished topics into diplomas.";
    }

    if (this.game.activeQuests.some((quest) => quest.stage === "final-ready")) {
      return "A diploma final is ready. Pass it to add a diploma without spending your resources.";
    }

    if (this.game.activeQuests.length) {
      return "A personalised perfection quest is waiting. Finish it, then take the final diploma test.";
    }

    if (this.game.pendingCall) {
      return `A ${formatStudyModeLabel(this.game.pendingCall)} resource test is waiting. Clear it to stock paper, ink, and revision tokens.`;
    }

    return "Use plain tests to stock resources, perfect weak topics through quests, and pass finals to grow your diploma record.";
  }

  get dailyGoals(): DailyGoalView[] {
    const goals = this.game?.dailyGoals ?? buildDailyGoals(this.activeTheme?.id ?? "");

    return goals.map((goal) => ({
      ...goal,
      progress: Math.min(this.goalProgress(goal), goal.target),
      rewardLabel: formatRewardLabel(goal.reward)
    }));
  }

  get selectedRoomLevel(): number {
    if (!this.selectedRoom) {
      return 0;
    }

    return this.roomLevel(this.selectedRoom.id);
  }

  get maxRoomLevel(): number {
    return MAX_ROOM_LEVEL;
  }

  get selectedRoomDetails(): RoomDetail[] {
    const room = this.selectedRoom;

    if (!room) {
      return [];
    }

    const level = this.roomLevel(room.id);
    const visitCount = this.game?.roomVisitCounts[room.id] ?? 0;
    const upgradeCost = level < MAX_ROOM_LEVEL ? this.roomUpgradeCost(room) : null;

    return [
      {
        label: "Route Tier",
        value: `Tier ${level + 1}/${MAX_ROOM_LEVEL + 1}`,
        accent: true
      },
      {
        label: "Available Reward",
        value: this.roomRewardPreview(room)
      },
      {
        label: "Drop Yield",
        value: `~${this.roomCoinValue(room)} coins`
      },
      {
        label: "Traffic",
        value: `${visitCount} routed`
      },
      {
        label: "Immersive Scene",
        value: room.immersiveMap?.nodes[0]?.edges.length
          ? `${room.immersiveMap.nodes[0].edges.length} connected routes`
          : this.hasImmersiveScene(room)
            ? "Standalone zone"
            : "Not generated"
      },
      {
        label: this.isRoomUnlocked(room.id) ? "Next Upgrade" : "Diploma Gate",
        value: this.isRoomUnlocked(room.id) ? (upgradeCost ? `${upgradeCost} resources` : "Max tier") : `${room.diplomaRequirement} diplomas`
      }
    ];
  }

  get stats(): StatCard[] {
    if (!this.game) {
      return [
        { label: "Coins", value: 0 },
        { label: "Diplomas", value: 0 },
        { label: "Resources", value: "0 paper · 0 ink · 0 tokens" },
        { label: "Reputation", value: "0%" },
        { label: "Curiosity", value: "0%" },
        { label: "Crews Guided", value: 0 },
        { label: "Zones Open", value: `0/${this.content.roomBlueprints.length}` }
      ];
    }

    return [
      { label: "Coins", value: this.game.coins },
      { label: "Diplomas", value: this.game.diplomas },
      { label: "Resources", value: formatStudyResources(this.game.resources) },
      { label: "Reputation", value: `${this.game.reputation}%` },
      { label: "Curiosity", value: `${this.game.curiosity}%` },
      { label: "Crews Guided", value: this.game.visitorsServed },
      { label: "Zones Open", value: `${this.game.unlockedRoomIds.length}/${this.content.roomBlueprints.length}` }
    ];
  }

  get currentObjective(): string {
    if (!this.game) {
      return "Start a voyage, pick a route, and begin unlocking Year 6 zones.";
    }

    if (this.game.pendingCall) {
      return `Open the queued ${formatStudyModeLabel(this.game.pendingCall)} resource test to keep your materials stocked.`;
    }

    const finalReadyQuest = this.game.activeQuests.find((quest) => quest.stage === "final-ready");

    if (finalReadyQuest) {
      return `${finalReadyQuest.title}: final test ready in ${finalReadyQuest.topic}. Pass it to earn the diploma.`;
    }

    if (this.game.activeQuests.length) {
      const quest = this.game.activeQuests[0];
      return `${quest.title}: ${quest.detail}`;
    }

    const nextGoal = this.dailyGoals.find((goal) => !goal.completed);

    if (nextGoal) {
      return `${nextGoal.label}: ${nextGoal.progress}/${nextGoal.target}. ${nextGoal.detail}`;
    }

    const lockedRooms = this.content.roomBlueprints.filter((room) => !this.isRoomUnlocked(room.id));
    const unlockable = lockedRooms.find((room) => this.canUnlockRoom(room));

    if (unlockable) {
      return `Mission board complete. Use your diplomas to open ${unlockable.label}.`;
    }

    return "All core missions are complete. Keep running plain tests until the next perfection quest appears.";
  }

  get objectivePills(): ObjectivePill[] {
    const themeLabel = this.activeTheme?.label ?? "Route";

    if (!this.game) {
      return [
        { label: "Route", value: themeLabel },
        { label: "Rank", value: "Preview" },
        { label: "Quests", value: `0/${buildDailyGoals(this.activeTheme?.id ?? "").length}` },
        { label: "Autosave", value: this.savedGameAvailable ? "Ready" : "None" }
      ];
    }

    return [
      { label: "Route", value: themeLabel },
      { label: "Rank", value: this.museumGrade },
      { label: "Diplomas", value: String(this.game.diplomas) },
      { label: "Quests", value: `${this.completedGoalsCount}/${this.dailyGoals.length}` },
      { label: "Autosave", value: "Live" }
    ];
  }

  get roomActions(): RoomAction[] {
    const room = this.selectedRoom;

    if (!this.game || !room) {
      return [];
    }

    const actions: RoomAction[] = [];

    if (!this.isRoomUnlocked(room.id)) {
      const prerequisitesMet = room.requiredRoomIds.every((requiredId) => this.isRoomUnlocked(requiredId));

      if (this.canUnlockRoom(room) && prerequisitesMet) {
        actions.push({
          id: `${room.id}-unlock`,
          action: "unlock",
          label: `Open At ${room.diplomaRequirement} Diplomas`,
          primary: true,
          tone: "glow"
        });
      } else {
        actions.push({
          id: `${room.id}-blocked`,
          action: "unlock",
          label: !prerequisitesMet
            ? `Open ${room.requiredRoomIds.map((requiredId) => this.findRoom(requiredId)?.label ?? requiredId).join(" and ")} first`
            : `Need ${Math.max(0, room.diplomaRequirement - this.game.diplomas)} more diplomas`,
          disabled: true,
          tone: "dim"
        });
      }
    } else {
      if (this.hasImmersiveScene(room)) {
        actions.push({
          id: `${room.id}-viewer`,
          action: "viewer",
          label: "Enter Immersive Scene",
          primary: true,
          tone: "glow"
        });
      }

      if (room.miniGameId) {
        const miniGame = this.findMiniGame(room.miniGameId);

        actions.push({
          id: `${room.id}-mini-game`,
          action: "mini-game",
          label: `Play ${miniGame?.label ?? "Mini Game"}${miniGame ? ` (${formatCompactReward(miniGame.reward)})` : ""}`,
          primary: !this.hasImmersiveScene(room)
        });
      } else {
        actions.push({
          id: `${room.id}-tour`,
          action: "tour",
          label: `Run Drift Route (+${this.roomTourRewardValue(room)} coins)`,
          primary: !this.hasImmersiveScene(room)
        });
      }

      const level = this.roomLevel(room.id);

      if (level < MAX_ROOM_LEVEL) {
        const nextTier = level + 2;
        const upgradeCost = this.roomUpgradeCost(room);
        const canAfford = this.canUpgradeRoom(room);

        actions.push({
          id: `${room.id}-upgrade`,
          action: "upgrade",
          label: canAfford ? `Upgrade To Tier ${nextTier} (${upgradeCost} Resources)` : `Need ${Math.max(0, upgradeCost - this.totalResources())} resources for Tier ${nextTier}`,
          disabled: !canAfford,
          tone: canAfford ? "glow" : "dim"
        });
      }
    }

    actions.push({
      id: `${room.id}-move`,
      action: "move",
      label: "Navigate Here"
    });

    return actions;
  }

  get selectedRoomRenderViews() {
    const room = this.selectedRoom;

    if (!room) {
      return [];
    }

    return (room.previewRenderViews.length ? room.previewRenderViews : room.renderViews).slice(0, 3);
  }

  get themeStyle(): string {
    const theme = this.activeTheme;

    if (!theme) {
      return "";
    }

    return [
      `--accent:${theme.palette.accent}`,
      `--deep:${theme.palette.deep}`,
      `--highlight:${theme.palette.highlight}`,
      `--shadow-color:${theme.palette.shadow}`
    ].join(";");
  }

  private canRunSimulation(): boolean {
    if (!this.mounted || !this.game) {
      return false;
    }

    if (typeof document !== "undefined" && document.hidden) {
      return false;
    }

    return !this.game.activeModal && !this.viewerState;
  }

  private stopSimulationLoop(): void {
    if (typeof window === "undefined" || !this.animationFrame) {
      return;
    }

    window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
  }

  private scheduleSimulationLoop(): void {
    if (typeof window === "undefined" || this.animationFrame || !this.canRunSimulation()) {
      return;
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  private syncSimulationLoop(resetFrame = false): void {
    if (resetFrame) {
      this.lastFrame = 0;
    }

    if (!this.canRunSimulation()) {
      this.stopSimulationLoop();
      return;
    }

    this.scheduleSimulationLoop();
  }

  mount(): void {
    if (this.mounted || typeof window === "undefined") {
      return;
    }

    this.mounted = true;
    this.refreshSavedGameAvailability();
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.syncSimulationLoop(true);
  }

  destroy(): void {
    if (!this.mounted || typeof window === "undefined") {
      return;
    }

    this.persistGameSnapshot();
    this.mounted = false;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.stopSimulationLoop();
    this.lastFrame = 0;
    this.keys.clear();
  }

  selectTheme(themeId: string): void {
    if (!this.content.themes.some((theme) => theme.id === themeId)) {
      return;
    }

    this.selectedThemeId = themeId;
  }

  startGame(): void {
    const theme = this.activeTheme;

    if (!theme) {
      return;
    }

    this.game = this.createGameSession(theme);
    this.closeRoomViewer();
    this.logEvent(`The ${theme.label} voyage begins.`);
    this.checkGoals();
    this.persistGameSnapshot();
    this.syncSimulationLoop(true);
  }

  resumeSavedGame(): void {
    const snapshot = this.readSavedSnapshot();

    if (!snapshot) {
      this.refreshSavedGameAvailability();
      return;
    }

    if (this.content.themes.some((theme) => theme.id === snapshot.selectedThemeId)) {
      this.selectedThemeId = snapshot.selectedThemeId;
    }

    const restored = this.normalizeSavedGame(snapshot.game, this.selectedThemeId);

    if (!restored) {
      this.clearSavedGame();
      return;
    }

    this.game = restored;
    this.closeRoomViewer();
    this.lastSavedAt = snapshot.savedAt;
    this.savedGameAvailable = true;
    this.logEvent("Resumed a saved voyage.");
    this.checkGoals();
    this.persistGameSnapshot();
    this.syncSimulationLoop(true);
  }

  clearSavedGame(): void {
    if (typeof window === "undefined") {
      return;
    }

    for (const key of this.fallbackStorageKeys) {
      window.localStorage.removeItem(key);
    }

    this.savedGameAvailable = false;
    this.lastSavedAt = null;
  }

  ensureGameStarted(): void {
    if (!this.game) {
      this.startGame();
    }
  }

  openArchive(): void {
    this.ensureGameStarted();
    this.openArchiveModal();
  }

  openArchiveAsset(assetId: string): void {
    this.ensureGameStarted();
    this.openArchiveModal(assetId);
  }

  openHotline(): void {
    this.ensureGameStarted();
    this.closeRoomViewer();

    if (!this.game) {
      return;
    }

    this.openStudyMode(this.game.pendingCall ?? this.nextStudyMode(), this.findMiniGame("study-quiz") ?? null);
  }

  openMiniGame(miniGameId: MiniGameId): void {
    this.ensureGameStarted();
    this.closeRoomViewer();

    if (!this.game) {
      return;
    }

    const miniGame = this.findMiniGame(miniGameId);

    if (!miniGame) {
      return;
    }

    this.openStudyMode(this.nextStudyMode(), miniGame);
  }

  handleRoomNodeClick(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room) {
      return;
    }

    this.game.selectedRoomId = room.id;

    if (!this.isRoomUnlocked(room.id) && this.canUnlockRoom(room)) {
      this.unlockRoom(room.id);
      return;
    }

    if (!this.isRoomUnlocked(room.id)) {
      this.logEvent(`${room.label} is still locked. Earn more diplomas or clear the prerequisite routes.`);
      return;
    }

    if (this.hasImmersiveScene(room)) {
      this.openRoomViewer(room.id);
      return;
    }

    this.setCuratorTarget(roomCenter(room));
  }

  moveCuratorToPointer(event: MouseEvent, worldElement: HTMLElement): void {
    if (!this.game) {
      return;
    }

    const bounds = worldElement.getBoundingClientRect();
    const target = {
      x: ((event.clientX - bounds.left) / bounds.width) * WORLD.width,
      y: ((event.clientY - bounds.top) / bounds.height) * WORLD.height
    };

    this.setCuratorTarget(target);
  }

  handleRoomAction(action: RoomAction["action"], roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room) {
      return;
    }

    if (action === "unlock") {
      this.unlockRoom(roomId);
      return;
    }

    if (action === "viewer") {
      this.openRoomViewer(roomId);
      return;
    }

    if (action === "upgrade") {
      this.upgradeRoom(roomId);
      return;
    }

    if (action === "mini-game" && room.miniGameId) {
      this.openMiniGame(room.miniGameId);
      return;
    }

    if (action === "tour") {
      this.tourRoom(roomId);
      return;
    }

    this.setCuratorTarget(roomCenter(room));
  }

  closeModal(): void {
    if (!this.game) {
      return;
    }

    this.game.activeModal = null;
    this.clearMovementKeys();
    this.syncSimulationLoop(true);
  }

  completeQuest(questId: string): void {
    if (!this.game) {
      return;
    }

    const quest = this.game.activeQuests.find((entry) => entry.id === questId);

    if (!quest) {
      return;
    }

    if (quest.stage === "final-ready") {
      this.startFinalTest(questId);
      return;
    }

    this.startQuestPractice(questId);
  }

  questActionLabel(quest: QuestState): string {
    if (quest.stage === "final-ready") {
      return "Take Final Test";
    }

    return quest.currentSuccesses > 0 ? "Continue Improvement" : "Start Improvement";
  }

  questProgressLabel(quest: QuestState): string {
    if (quest.stage === "final-ready") {
      return `Final ${finalTestModeForQuest(quest.sourceMode).replace("-", " ")} ready`;
    }

    return `${quest.currentSuccesses}/${quest.requiredSuccesses} focused wins`;
  }

  private preferredSubjectsForMiniGame(miniGame: MiniGameDefinition | null | undefined): string[] {
    const focus = miniGame?.subjectFocus?.trim();
    const adaptiveSubjects = this.preferredStudySubjects();

    if (!focus) {
      return adaptiveSubjects;
    }

    return Array.from(
      new Set([
        ...focus
          .split(/[,&/]/)
          .map((entry) => entry.trim())
          .filter(Boolean),
        ...adaptiveSubjects
      ])
    ).slice(0, 4);
  }

  private miniGameForMode(mode: StudyMode): MiniGameDefinition | null {
    switch (mode) {
      case "mcq":
        return this.findMiniGame("study-quiz") ?? null;
      case "quiz":
        return this.findMiniGame("curator-check") ?? this.findMiniGame("study-quiz") ?? null;
      case "free-text":
        return this.findMiniGame("estimation") ?? this.findMiniGame("study-quiz") ?? null;
      case "match-pairs":
        return this.findMiniGame("match-pairs") ?? this.findMiniGame("study-quiz") ?? null;
    }
  }

  private nextQuestionForMode(mode: QuestionStudyMode, preferredSubjects?: string[]): QuestionRound {
    switch (mode) {
      case "mcq":
        return this.nextMcqQuestion(preferredSubjects);
      case "quiz":
        return this.nextQuizQuestion(preferredSubjects);
      case "free-text":
        return this.nextFreeTextQuestion(preferredSubjects);
    }
  }

  private nextTargetedQuestionForMode(
    mode: QuestionStudyMode,
    subject: string,
    topic: string,
    finalTest: boolean
  ): QuestionRound {
    switch (mode) {
      case "mcq":
        return this.nextTargetedMcqQuestion(subject, topic, finalTest);
      case "quiz":
        return this.nextTargetedQuizQuestion(subject, topic, finalTest);
      case "free-text":
        return this.nextTargetedFreeTextQuestion(subject, topic, finalTest);
    }
  }

  private openStudyRoundModal({
    mode,
    stage,
    questId = null,
    miniGame = null,
    subject,
    topic,
    preferredSubjects
  }: {
    mode: StudyMode;
    stage: StudyRoundStage;
    questId?: string | null;
    miniGame?: MiniGameDefinition | null;
    subject?: string;
    topic?: string;
    preferredSubjects?: string[];
  }): void {
    if (!this.game) {
      return;
    }

    const resolvedMiniGame = miniGame ?? this.miniGameForMode(mode);

    if (mode === "match-pairs") {
      this.setActiveModal(
        this.createMatchPairsModal(resolvedMiniGame, {
          questId,
          stage: stage === "final-test" ? "quest-test" : stage,
          subject,
          topic,
          preferredSubjects
        })
      );
      return;
    }

    const question =
      subject && topic
        ? this.nextTargetedQuestionForMode(mode, subject, topic, stage === "final-test")
        : this.nextQuestionForMode(mode, preferredSubjects);

    switch (mode) {
      case "mcq":
        this.setActiveModal({
          type: "mcq",
          stage,
          questId,
          miniGame: resolvedMiniGame,
          question: question as McqQuestion
        });
        return;
      case "quiz":
        this.setActiveModal({
          type: "quiz",
          stage,
          questId,
          miniGame: resolvedMiniGame,
          question: question as QuizQuestion
        });
        return;
      case "free-text":
        this.setActiveModal({
          type: "free-text",
          stage,
          questId,
          miniGame: resolvedMiniGame,
          question: question as FreeTextQuestion,
          answer: ""
        });
        return;
    }
  }

  private startQuestPractice(questId: string): void {
    if (!this.game) {
      return;
    }

    const quest = this.game.activeQuests.find((entry) => entry.id === questId);

    if (!quest || quest.stage !== "improvement") {
      return;
    }

    this.closeRoomViewer();
    this.openStudyRoundModal({
      mode: quest.sourceMode,
      stage: "quest-test",
      questId: quest.id,
      subject: quest.subject,
      topic: quest.topic
    });
  }

  startFinalTest(questId: string): void {
    if (!this.game) {
      return;
    }

    const quest = this.game.activeQuests.find((entry) => entry.id === questId);

    if (!quest || quest.stage !== "final-ready") {
      return;
    }

    const existingFinal = this.game.activeFinalTests.find((entry) => entry.questId === quest.id);
    const finalTest = existingFinal ?? buildFinalTestState(quest);

    if (!existingFinal) {
      this.game.activeFinalTests = [...this.game.activeFinalTests, finalTest];
    }

    this.closeRoomViewer();
    this.openStudyRoundModal({
      mode: finalTest.mode,
      stage: "final-test",
      questId: quest.id,
      subject: finalTest.subject,
      topic: finalTest.topic
    });
  }

  openRoomViewer(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);
    const startNode = room ? this.startImmersiveNode(room) : undefined;

    if (!room || !startNode || !this.isRoomUnlocked(room.id)) {
      return;
    }

    this.game.selectedRoomId = room.id;
    const entryEdge =
      this.preferredForwardEdge(startNode, null, 180, { preferTraversable: true }) ??
      this.preferredForwardEdge(startNode, null, 180);
    this.clearMovementKeys();
    this.viewerState = {
      nodeId: startNode.id,
      yaw: entryEdge?.headingDeg ?? 180,
      pitch: 0
    };
    this.viewerHistory = [startNode.id];
    this.syncSimulationLoop(true);
  }

  closeRoomViewer(): void {
    this.viewerState = null;
    this.viewerHistory = [];
    this.clearMovementKeys();
    this.syncSimulationLoop(true);
  }

  setViewerPose(yaw: number, pitch: number): void {
    if (!this.viewerState) {
      return;
    }

    this.viewerState = {
      ...this.viewerState,
      yaw: normalizeHeading(yaw),
      pitch: clamp(pitch, -80, 80)
    };
  }

  moveViewer(direction: "forward" | "back"): void {
    if (!this.viewerState) {
      return;
    }

    if (direction === "back") {
      const currentNodeId = this.viewerHistory[this.viewerHistory.length - 1];
      const previousNodeId = this.previousViewerNodeId();
      const previousNode = previousNodeId ? this.findImmersiveNode(previousNodeId) : undefined;

      if (!currentNodeId || !previousNode) {
        return;
      }

      const reentryEdge = previousNode.edges.find((edge) => edge.toNodeId === currentNodeId);
      this.viewerHistory = this.viewerHistory.slice(0, -1);
      this.viewerState = {
        nodeId: previousNode.id,
        yaw: reentryEdge?.targetHeadingDeg ?? this.viewerState.yaw,
        pitch: this.viewerState.pitch
      };
      if (this.game) {
        this.game.selectedRoomId = previousNode.roomId;
      }
      return;
    }

    const edge = this.viewerForwardEdge;
    const nextNode = edge ? this.findImmersiveNode(edge.toNodeId) : undefined;
    const nextRoom = nextNode ? this.findRoom(nextNode.roomId) : undefined;

    if (!edge || !nextNode || !nextRoom || !this.game || !this.isRoomUnlocked(nextRoom.id)) {
      return;
    }

    this.viewerHistory = [...this.viewerHistory, nextNode.id];
    this.viewerState = {
      nodeId: nextNode.id,
      yaw: edge.targetHeadingDeg,
      pitch: this.viewerState.pitch
    };
    this.game.selectedRoomId = nextRoom.id;
  }

  upgradeCurrentViewerRoom(): void {
    const room = this.viewerRoom;

    if (!room) {
      return;
    }

    this.upgradeRoom(room.id);
  }

  recordViewerSceneLoaded(roomId: string): void {
    const room = this.findRoom(roomId);

    if (!room) {
      return;
    }

    this.markImmersiveVisit(room);
  }

  private setActiveModal(modal: ModalState): void {
    if (!this.game) {
      return;
    }

    this.game.activeModal = modal;
    this.syncSimulationLoop(true);
  }

  private finishStudyRound(): void {
    if (!this.game) {
      return;
    }

    this.game.pendingCall = null;
    this.game.activeModal = null;
    this.syncSimulationLoop(true);
  }

  private questTestSuccessReward(mode: StudyMode): RewardBundle {
    if (mode === "match-pairs") {
      return { coins: 5, reputation: 3, curiosity: 4 };
    }

    return { coins: 4, reputation: 3, curiosity: 3 };
  }

  private questTestFailureReward(mode: StudyMode): RewardBundle {
    if (mode === "match-pairs") {
      return { coins: -2, reputation: -1, curiosity: -1 };
    }

    return { coins: -2, reputation: -2, curiosity: -1 };
  }

  private resolveQuestionRound(
    mode: QuestionStudyMode,
    question: QuestionRound,
    stage: StudyRoundStage,
    questId: string | null,
    success: boolean
  ): void {
    const feedback = buildStudyRoundFeedback(mode, stage, question);

    this.concludeStudyRound({
      mode,
      stage,
      question,
      questId,
      success,
      successRewards: feedback.successRewards,
      failureRewards: feedback.failureRewards,
      successMessage: feedback.successMessage,
      failureMessage: feedback.failureMessage
    });
  }

  private concludeStudyRound({
    mode,
    stage,
    question,
    questId,
    success,
    successRewards,
    failureRewards,
    successMessage,
    failureMessage
  }: {
    mode: StudyMode;
    stage: StudyStage;
    question: StudyQuestionLike;
    questId?: string | null;
    success: boolean;
    successRewards: RewardBundle;
    failureRewards: RewardBundle;
    successMessage: string;
    failureMessage: string;
  }): void {
    this.finishStudyRound();

    if (stage === "final-test") {
      if (success) {
        this.completeFinalTest(mode, question, questId ?? null, successRewards, successMessage);
        return;
      }

      this.recordFinalTestFailure(mode, question, questId ?? null, failureRewards, failureMessage);
      return;
    }

    if (stage === "quest-test") {
      if (success) {
        this.completeQuestTest(mode, question, questId ?? null, successRewards, successMessage);
        return;
      }

      this.recordQuestTestFailure(mode, question, questId ?? null, failureRewards, failureMessage);
      return;
    }

    if (success) {
      this.completeResourceTest(mode, question, successRewards, successMessage);
      return;
    }

    if (mode === "match-pairs") {
      this.recordStudyFailure(mode, failureRewards, failureMessage);
      return;
    }

    this.recordResourceTestFailure(mode, question, failureRewards, failureMessage);
  }

  private createMatchPairsModal(
    miniGame: MiniGameDefinition | null,
    {
      questId = null,
      stage = questId ? "quest-test" : "resource-test",
      subject,
      topic,
      preferredSubjects
    }: {
      questId?: string | null;
      stage?: MatchRoundStage;
      subject?: string;
      topic?: string;
      preferredSubjects?: string[];
    } = {}
  ): Extract<ModalState, { type: "match-pairs" }> {
    const selectedPairs = subject
      ? selectTargetedMatchPairs({ content: this.content, subject, pairCount: MATCH_PAIR_DECK_SIZE })
      : preferredSubjects?.length
        ? selectFocusedMatchPairs({ content: this.content, preferredSubjects, pairCount: MATCH_PAIR_DECK_SIZE })
        : drawMatchPairsDeck(this.content.matchPairDeck, MATCH_PAIR_DECK_SIZE);
    const subjects = Array.from(new Set(selectedPairs.map((pair) => pair.subject)));
    const resolvedSubject =
      subject ??
      (preferredSubjects?.length === 1
        ? preferredSubjects[0]
        : subjects.length === 1
          ? subjects[0]
          : "Mixed Subjects");
    const resolvedTopic = topic ?? (selectedPairs.length ? `${selectedPairs.length} revision pairs` : "Revision pairs");

    return {
      type: "match-pairs",
      stage,
      questId,
      miniGame,
      subject: resolvedSubject,
      topic: resolvedTopic,
      deck: buildMatchCards(selectedPairs),
      attempts: 0,
      locked: false
    };
  }

  private nextTargetedMcqQuestion(subject: string, topic: string, finalTest = true): McqQuestion {
    if (!this.game) {
      return fallbackMcqQuestion(this.content);
    }

    const sourceRecentIds = finalTest ? this.game.recentFinalQuestionIds : this.game.recentMcqIds;
    const { item, recentIds: nextRecentIds } = selectTargetedMcqQuestion({
      content: this.content,
      recentIds: sourceRecentIds,
      subject,
      topic,
      focusWeight: (item) => this.focusWeightFor("mcq", item.subject, item.topic)
    });

    if (finalTest) {
      this.game.recentFinalQuestionIds = nextRecentIds;
    } else {
      this.game.recentMcqIds = nextRecentIds;
    }
    return item;
  }

  private nextTargetedFreeTextQuestion(subject: string, topic: string, finalTest = true): FreeTextQuestion {
    if (!this.game) {
      return fallbackFreeTextQuestion(this.content);
    }

    const sourceRecentIds = finalTest ? this.game.recentFinalQuestionIds : this.game.recentFreeTextIds;
    const { item, recentIds: nextRecentIds } = selectTargetedFreeTextQuestion({
      content: this.content,
      recentIds: sourceRecentIds,
      subject,
      topic,
      focusWeight: (item) => this.focusWeightFor("free-text", item.subject, item.topic)
    });

    if (finalTest) {
      this.game.recentFinalQuestionIds = nextRecentIds;
    } else {
      this.game.recentFreeTextIds = nextRecentIds;
    }
    return item;
  }

  private nextTargetedQuizQuestion(subject: string, topic: string, finalTest = true): QuizQuestion {
    if (!this.game) {
      return fallbackQuizQuestion(this.content);
    }

    const sourceRecentIds = finalTest ? this.game.recentFinalQuestionIds : this.game.recentQuizIds;
    const { item, recentIds: nextRecentIds } = selectTargetedQuizQuestion({
      content: this.content,
      recentIds: sourceRecentIds,
      subject,
      topic,
      focusWeight: (item) => this.focusWeightFor("quiz", item.subject, item.topic)
    });

    if (finalTest) {
      this.game.recentFinalQuestionIds = nextRecentIds;
    } else {
      this.game.recentQuizIds = nextRecentIds;
    }
    return item;
  }

  private updatePerformance(mode: StudyMode, question: StudyQuestionLike, success: boolean): PerformanceRecord | null {
    if (!this.game) {
      return null;
    }

    this.game.performanceRecords = updatePerformanceRecords(this.game.performanceRecords, {
      mode,
      question,
      success
    });

    return this.game.performanceRecords.find((entry) => entry.subject === question.subject && entry.topic === question.topic) ?? null;
  }

  private performanceRecordForFocus(subject: string, topic: string): PerformanceRecord | null {
    return this.game?.performanceRecords.find((entry) => entry.subject === subject && entry.topic === topic) ?? null;
  }

  private performancePressure(record: PerformanceRecord): number {
    return record.failures * 1.35 + Math.max(0, 2 - record.successes) + Math.max(0, 1 - record.attempts * 0.1);
  }

  private preferredStudySubjects(): string[] {
    if (!this.game) {
      return [];
    }

    const activeQuestSubjects = this.game.activeQuests.map((quest) => quest.subject);
    const performanceSubjects = [...this.game.performanceRecords]
      .sort((left, right) => this.performancePressure(right) - this.performancePressure(left))
      .map((record) => record.subject);

    return Array.from(new Set([...activeQuestSubjects, ...performanceSubjects])).slice(0, 3);
  }

  private focusWeightFor(mode: Exclude<StudyMode, "match-pairs">, subject: string, topic: string): number {
    if (!this.game) {
      return 1;
    }

    let weight = 1;
    const activeQuest = this.activeQuestForFocus(subject, topic);
    const record = this.performanceRecordForFocus(subject, topic);

    if (activeQuest && (activeQuest.sourceMode === mode || finalTestModeForQuest(activeQuest.sourceMode) === mode)) {
      weight += activeQuest.stage === "final-ready" ? 1.35 : 0.85;
    }

    if (record) {
      weight += Math.min(1.5, this.performancePressure(record) * 0.22);
    }

    return weight;
  }

  private activeQuestForFocus(subject: string, topic: string): QuestState | null {
    return this.game?.activeQuests.find((quest) => quest.subject === subject && quest.topic === topic) ?? null;
  }

  private assignAdaptiveQuest(mode: StudyMode, question: StudyQuestionLike, record: PerformanceRecord, mastery: boolean): void {
    if (!this.game) {
      return;
    }

    const existingQuest = this.activeQuestForFocus(question.subject, question.topic);

    if (existingQuest) {
      existingQuest.performanceSummary = summarizePerformance(record);
      return;
    }

    const trigger = mastery ? QUEST_MASTERY_TRIGGER_BY_MODE[mode] : QUEST_TRIGGER_BY_MODE[mode];
    const selection = selectQuest({
      content: this.content,
      recentIds: this.game.recentQuestIds,
      trigger
    });

    if (!selection) {
      return;
    }

    this.game.recentQuestIds = selection.recentIds;
    const quest = buildAdaptiveQuestState({
      template: selection.item,
      record,
      mode,
      question,
      day: this.game.day,
      mastery,
      saveSlotId: this.saveSlotId
    });

    this.game.activeQuests = [...this.game.activeQuests, quest].slice(-ACTIVE_QUEST_LIMIT);
    this.logEvent(`Quest added: ${quest.title}. ${quest.performanceSummary}.`);
  }

  private unlockQuestFinalTest(quest: QuestState): void {
    if (!this.game) {
      return;
    }

    quest.stage = "final-ready";
    quest.currentSuccesses = quest.requiredSuccesses;
    quest.detail = `Focused practice complete for ${quest.topic}. Take the final ${finalTestModeForQuest(quest.sourceMode).replace("-", " ")} to earn the diploma.`;

    if (!this.game.activeFinalTests.some((entry) => entry.questId === quest.id)) {
      this.game.activeFinalTests = [...this.game.activeFinalTests, buildFinalTestState(quest)];
    }

    this.logEvent(`${quest.title} is ready for its final test.`);
  }

  private updateQuestProgress(question: StudyQuestionLike, record: PerformanceRecord | null, success: boolean, questId: string | null = null): void {
    if (!this.game) {
      return;
    }

    const quest = questId
      ? this.game.activeQuests.find((entry) => entry.id === questId) ?? null
      : this.activeQuestForFocus(question.subject, question.topic);

    if (!quest || quest.stage !== "improvement") {
      return;
    }

    quest.performanceSummary = record ? summarizePerformance(record) : quest.performanceSummary;

    if (!success) {
      quest.currentSuccesses = Math.max(0, quest.currentSuccesses - 1);
      quest.detail = `Refine ${quest.topic} with ${quest.currentSuccesses}/${quest.requiredSuccesses} secure improvement win${quest.requiredSuccesses === 1 ? "" : "s"} before the final test.`;
      return;
    }

    quest.currentSuccesses = Math.min(quest.requiredSuccesses, quest.currentSuccesses + 1);

    if (quest.currentSuccesses >= quest.requiredSuccesses) {
      this.unlockQuestFinalTest(quest);
      return;
    }

    quest.detail = `Refine ${quest.topic} with ${quest.currentSuccesses}/${quest.requiredSuccesses} secure improvement win${quest.requiredSuccesses === 1 ? "" : "s"} before the final test.`;
  }

  private completeResourceTest(mode: StudyMode, question: StudyQuestionLike, rewards: RewardBundle, message: string): void {
    const record = this.updatePerformance(mode, question, true);
    this.completeProgram(mode, rewards, message);

    if (record && shouldOfferMasteryQuest(record) && !this.activeQuestForFocus(question.subject, question.topic)) {
      this.assignAdaptiveQuest(mode, question, record, true);
    }
  }

  private recordResourceTestFailure(mode: StudyMode, question: StudyQuestionLike, rewards: RewardBundle, message: string): void {
    const record = this.updatePerformance(mode, question, false);
    this.recordStudyFailure(mode, rewards, message);

    if (record) {
      this.assignAdaptiveQuest(mode, question, record, false);
    }
  }

  private completeQuestTest(
    mode: StudyMode,
    question: StudyQuestionLike,
    questId: string | null,
    rewards: RewardBundle,
    message: string
  ): void {
    const record = this.updatePerformance(mode, question, true);
    this.recordStudyCompletion(mode);
    this.award(rewards, message);

    if (!this.game || !questId) {
      return;
    }

    if (!this.game.activeQuests.some((entry) => entry.id === questId)) {
      return;
    }

    this.updateQuestProgress(question, record, true, questId);
  }

  private recordQuestTestFailure(
    mode: StudyMode,
    question: StudyQuestionLike,
    questId: string | null,
    rewards: RewardBundle,
    message: string
  ): void {
    const record = this.updatePerformance(mode, question, false);
    this.recordStudyCompletion(mode);
    this.award(rewards, message);

    if (!this.game || !questId) {
      return;
    }

    if (!this.game.activeQuests.some((entry) => entry.id === questId)) {
      return;
    }

    this.updateQuestProgress(question, record, false, questId);
  }

  private completeFinalTest(
    mode: StudyMode,
    question: StudyQuestionLike,
    questId: string | null,
    rewards: RewardBundle,
    message: string
  ): void {
    if (!this.game || !questId) {
      this.completeProgram(mode, rewards, message);
      return;
    }

    this.updatePerformance(mode, question, true);
    this.game.activeQuests = this.game.activeQuests.filter((quest) => quest.id !== questId);
    this.game.activeFinalTests = this.game.activeFinalTests.filter((entry) => entry.questId !== questId);
    this.game.questsCompleted += 1;
    this.completeProgram(mode, rewards, message);
  }

  private recordFinalTestFailure(
    mode: StudyMode,
    question: StudyQuestionLike,
    questId: string | null,
    rewards: RewardBundle,
    message: string
  ): void {
    if (!this.game || !questId) {
      this.recordStudyFailure(mode, rewards, message);
      return;
    }

    const quest = this.game.activeQuests.find((entry) => entry.id === questId);
    const finalTest = this.game.activeFinalTests.find((entry) => entry.questId === questId);
    const nextAttempts = (finalTest?.attempts ?? 0) + 1;
    this.game.activeFinalTests = this.game.activeFinalTests.filter((entry) => entry.questId !== questId);
    const record = this.updatePerformance(mode, question, false);

    if (quest) {
      quest.stage = "improvement";
      quest.currentSuccesses = Math.max(0, quest.requiredSuccesses - 1);
      quest.detail = `The final test in ${quest.topic} did not pass yet. Build back to ${quest.requiredSuccesses} secure improvement win${quest.requiredSuccesses === 1 ? "" : "s"}, then reopen the final test.`;
      quest.performanceSummary = `${record ? summarizePerformance(record) : quest.performanceSummary} · final attempts ${nextAttempts}`;
    }

    this.recordStudyCompletion(mode);
    this.award(rewards, message);
  }

  setFreeTextAnswer(value: string): void {
    if (this.game?.activeModal?.type !== "free-text") {
      return;
    }

    this.game.activeModal.answer = value;
  }

  submitFreeText(): void {
    if (this.game?.activeModal?.type !== "free-text") {
      return;
    }

    const { question, answer, stage, questId } = this.game.activeModal;
    this.resolveQuestionRound("free-text", question, stage, questId, evaluateFreeTextAnswer(answer, question));
  }

  resolveMcqChoice(choiceIndex: number): void {
    if (this.game?.activeModal?.type !== "mcq") {
      return;
    }

    const { question, stage, questId } = this.game.activeModal;
    this.resolveQuestionRound("mcq", question, stage, questId, choiceIndex === question.correctIndex);
  }

  resolveQuizChoice(choiceIndex: number): void {
    if (this.game?.activeModal?.type !== "quiz") {
      return;
    }

    const { question, stage, questId } = this.game.activeModal;
    this.resolveQuestionRound("quiz", question, stage, questId, choiceIndex === question.correctIndex);
  }

  handleMatchCard(cardId: string): void {
    if (this.game?.activeModal?.type !== "match-pairs") {
      return;
    }

    const modal = this.game.activeModal;
    const syntheticQuestion: StudyQuestionLike = {
      id: `match-${modal.subject}-${modal.topic}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      subject: modal.subject,
      topic: modal.topic,
      prompt: `Complete the ${modal.subject} match-pairs board for ${modal.topic}.`
    };

    if (modal.locked) {
      return;
    }

    const card = modal.deck.find((entry) => entry.id === cardId);

    if (!card || card.matched || card.revealed) {
      return;
    }

    card.revealed = true;
    const revealed = modal.deck.filter((entry) => entry.revealed && !entry.matched);

    if (revealed.length !== 2) {
      return;
    }

    modal.attempts += 1;
    modal.locked = true;

    if (revealed[0].pair === revealed[1].pair) {
      revealed.forEach((entry) => {
        entry.matched = true;
      });
      modal.locked = false;

      if (modal.deck.every((entry) => entry.matched)) {
        const reward = Math.max(8, 18 - modal.attempts);
        this.finishStudyRound();
        if (modal.stage === "quest-test") {
          this.completeQuestTest(
            "match-pairs",
            syntheticQuestion,
            modal.questId,
            {
              ...this.questTestSuccessReward("match-pairs"),
              coins: reward
            },
            `Match-pairs improvement cleared in ${modal.attempts} tries.`
          );
        } else {
          this.completeResourceTest(
            "match-pairs",
            syntheticQuestion,
            {
              paper: modal.attempts <= 4 ? 2 : 1,
              ink: 1,
              revisionTokens: modal.attempts <= 5 ? 1 : 0,
              coins: reward,
              reputation: 5,
              curiosity: 7
            },
            `Match pairs cleared in ${modal.attempts} tries. Resources banked for a later diploma push.`
          );
        }
      }

      return;
    }

    if (modal.attempts >= MATCH_PAIR_ATTEMPT_LIMIT) {
      this.finishStudyRound();
      if (modal.stage === "quest-test") {
        this.recordQuestTestFailure(
          "match-pairs",
          syntheticQuestion,
          modal.questId,
          this.questTestFailureReward("match-pairs"),
          "The improvement board timed out. The diploma quest still needs more work."
        );
      } else {
        this.recordResourceTestFailure(
          "match-pairs",
          syntheticQuestion,
          { coins: -3, reputation: -2, curiosity: -1 },
          "The match board timed out. A personalised perfection quest has been added to your board."
        );
      }
      return;
    }

    window.setTimeout(() => {
      if (this.game?.activeModal?.type !== "match-pairs") {
        return;
      }

      revealed.forEach((entry) => {
        entry.revealed = false;
      });
      this.game.activeModal.locked = false;
    }, 700);
  }

  private readonly tick = (timestamp: number): void => {
    this.animationFrame = 0;

    if (!this.canRunSimulation()) {
      this.lastFrame = 0;
      return;
    }

    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }

    const deltaSeconds = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;

    if (this.game) {
      this.updateSimulation(deltaSeconds);

      if (timestamp - this.lastPersistAt >= SAVE_INTERVAL_MS) {
        this.persistGameSnapshot();
        this.lastPersistAt = timestamp;
      }
    }

    this.scheduleSimulationLoop();
  };

  private readonly handleVisibilityChange = (): void => {
    this.syncSimulationLoop(true);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (MOVEMENT_KEYS.has(key)) {
      if (this.game?.activeModal || this.viewerState) {
        this.keys.delete(key);
      } else {
        this.keys.add(key);
        event.preventDefault();
      }
    }

    if (key === "Escape") {
      if (this.viewerState) {
        this.closeRoomViewer();
        return;
      }

      this.closeModal();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    this.keys.delete(key);
  };

  private createGameSession(theme: ThemeDefinition): GameSession {
    const startingRoom = this.findRoom(theme.starterRoomId) ?? this.content.roomBlueprints[0];
    const startingPosition = roomCenter(startingRoom);
    const unlockedRoomIds = Array.from(
      new Set(
        this.content.roomBlueprints
          .filter((room) => room.startUnlocked)
          .map((room) => room.id)
          .concat(theme.starterRoomId)
      )
    );

    return {
      day: 1,
      timer: 0,
      coins: 34,
      diplomas: 0,
      reputation: 52,
      curiosity: 48,
      revenueEarned: 0,
      visitorsServed: 0,
      visitorsSeen: 0,
      roomsOpenedToday: 0,
      programsHosted: 0,
      immersiveVisits: 0,
      photospheresVisited: 0,
      resources: createStudyResources(),
      activeQuests: [],
      activeFinalTests: [],
      performanceRecords: [],
      questsCompleted: 0,
      completedMcqCount: 0,
      completedQuizCount: 0,
      completedFreeTextCount: 0,
      completedMatchPairsCount: 0,
      selectedRoomId: startingRoom.id,
      unlockedRoomIds,
      viewedRoomIds: [],
      recentMcqIds: [],
      recentFreeTextIds: [],
      recentQuizIds: [],
      recentFinalQuestionIds: [],
      recentQuestIds: [],
      roomLevels: createRoomNumberMap(this.content.roomBlueprints, 0),
      roomVisitCounts: createRoomNumberMap(this.content.roomBlueprints, 0),
      dailyGoals: buildDailyGoals(theme.id),
      visitors: [],
      floorCoins: [],
      curator: {
        x: startingPosition.x,
        y: startingPosition.y,
        target: { ...startingPosition },
        speed: 240,
        radius: 18
      },
      activity: [],
      nextVisitorSpawnAt: 3,
      nextCallAt: 18,
      pendingCall: null,
      activeModal: null
    };
  }

  private goalProgress(goal: DailyGoal): number {
    return goalProgressForGame(this.game, goal);
  }

  private checkGoals(): void {
    if (!this.game) {
      return;
    }

    for (const goal of this.game.dailyGoals) {
      if (goal.completed || this.goalProgress(goal) < goal.target) {
        continue;
      }

      goal.completed = true;
      this.applyGoalReward(goal);
    }
  }

  private applyGoalReward(goal: DailyGoal): void {
    this.award(goal.reward, `${goal.label} complete. Bonus secured: ${formatRewardLabel(goal.reward)}.`);
  }

  private findRoom(roomId: string): RoomBlueprint | undefined {
    return this.content.roomBlueprints.find((room) => room.id === roomId);
  }

  private findMiniGame(miniGameId: MiniGameId): MiniGameDefinition | undefined {
    return this.content.miniGames.find((miniGame) => miniGame.id === miniGameId);
  }

  private findImmersiveNode(nodeId: string): ImmersiveNode | undefined {
    for (const room of this.content.roomBlueprints) {
      const node = room.immersiveMap?.nodes.find((entry) => entry.id === nodeId);
      if (node) {
        return node;
      }
    }

    return undefined;
  }

  private startImmersiveNode(room: RoomBlueprint): ImmersiveNode | undefined {
    if (!room.immersiveMap) {
      return undefined;
    }

    return room.immersiveMap.nodes.find((node) => node.id === room.immersiveMap?.startNodeId) ?? room.immersiveMap.nodes[0];
  }

  private clearMovementKeys(): void {
    this.keys.clear();
  }

  private previousViewerNodeId(): string | null {
    return this.viewerHistory.length > 1 ? this.viewerHistory[this.viewerHistory.length - 2] : null;
  }

  private preferredForwardEdge(
    node: ImmersiveNode,
    previousNodeId: string | null,
    currentYaw: number,
    options: {
      preferTraversable?: boolean;
    } = {}
  ): ImmersiveEdge | undefined {
    const forwardEdges = node.edges.filter((edge) => edge.toNodeId !== previousNodeId);
    if (!forwardEdges.length) {
      return undefined;
    }

    const traversableEdges = options.preferTraversable
      ? forwardEdges.filter((edge) => this.canTraverseViewerEdge(edge))
      : [];
    const candidateEdges = traversableEdges.length ? traversableEdges : forwardEdges;

    return [...candidateEdges].sort((left, right) => {
      const delta = headingDelta(currentYaw, left.headingDeg) - headingDelta(currentYaw, right.headingDeg);
      return delta || left.label.localeCompare(right.label);
    })[0];
  }

  private canTraverseViewerEdge(edge: ImmersiveEdge | undefined): boolean {
    if (!edge) {
      return false;
    }

    return this.isRoomUnlocked(edge.roomId);
  }

  private nextStudyMode(): StudyMode {
    return selectStudyMode(this.content);
  }

  private nextMcqQuestion(preferredSubjects?: string[]): McqQuestion {
    if (!this.game) {
      return fallbackMcqQuestion(this.content);
    }

    const { item, recentIds } = selectMcqQuestion({
      content: this.content,
      recentIds: this.game.recentMcqIds,
      completedGoalsCount: this.completedGoalsCount,
      programsHosted: this.game.programsHosted,
      preferredSubjects,
      focusWeight: (item) => this.focusWeightFor("mcq", item.subject, item.topic)
    });

    this.game.recentMcqIds = recentIds;
    return item;
  }

  private nextFreeTextQuestion(preferredSubjects?: string[]): FreeTextQuestion {
    if (!this.game) {
      return fallbackFreeTextQuestion(this.content);
    }

    const { item, recentIds } = selectFreeTextQuestion({
      content: this.content,
      recentIds: this.game.recentFreeTextIds,
      completedGoalsCount: this.completedGoalsCount,
      selectedRoomLevel: this.roomLevel(this.game.selectedRoomId),
      preferredSubjects,
      focusWeight: (item) => this.focusWeightFor("free-text", item.subject, item.topic)
    });

    this.game.recentFreeTextIds = recentIds;
    return item;
  }

  private nextQuizQuestion(preferredSubjects?: string[]): QuizQuestion {
    if (!this.game) {
      return fallbackQuizQuestion(this.content);
    }

    const { item, recentIds } = selectQuizQuestion({
      content: this.content,
      recentIds: this.game.recentQuizIds,
      completedGoalsCount: this.completedGoalsCount,
      reputation: this.game.reputation,
      preferredSubjects,
      focusWeight: (item) => this.focusWeightFor("quiz", item.subject, item.topic)
    });

    this.game.recentQuizIds = recentIds;
    return item;
  }

  private roomLevel(roomId: string): number {
    return this.game?.roomLevels[roomId] ?? 0;
  }

  private hasImmersiveScene(room: RoomBlueprint): boolean {
    return Boolean(room.immersiveMap?.nodes.length || room.panoramaPath);
  }

  private roomUpgradeCost(room: RoomBlueprint): number {
    const level = this.roomLevel(room.id);
    return Math.round(Math.max(24, room.cost * 0.55 + 24 + level * 18));
  }

  private totalResources(resources?: StudyResources): number {
    const current = resources ?? this.game?.resources ?? createStudyResources();
    return current.paper + current.ink + current.revisionTokens;
  }

  private canUpgradeRoom(room: RoomBlueprint): boolean {
    if (!this.game || !this.isRoomUnlocked(room.id)) {
      return false;
    }

    return this.roomLevel(room.id) < MAX_ROOM_LEVEL && this.totalResources() >= this.roomUpgradeCost(room);
  }

  private effectiveRewardRate(room: RoomBlueprint): number {
    return room.rewardRate + this.roomLevel(room.id) * 1.4;
  }

  private roomCoinValue(room: RoomBlueprint): number {
    return Math.round(6 + this.effectiveRewardRate(room) * 2);
  }

  private roomTourRewardValue(room: RoomBlueprint): number {
    const level = this.roomLevel(room.id);
    return Math.round(12 + this.effectiveRewardRate(room) * 2 + level * 4);
  }

  private roomRewardPreview(room: RoomBlueprint): string {
    if (room.miniGameId) {
      const miniGame = this.findMiniGame(room.miniGameId);
      if (miniGame) {
        return formatCompactReward(miniGame.reward);
      }
    }

    return `Drift +${this.roomTourRewardValue(room)} coins`;
  }

  private isRoomUnlocked(roomId: string): boolean {
    return this.game?.unlockedRoomIds.includes(roomId) ?? false;
  }

  private canUnlockRoom(room: RoomBlueprint): boolean {
    if (!this.game) {
      return false;
    }

    if (this.isRoomUnlocked(room.id) || this.game.diplomas < room.diplomaRequirement) {
      return false;
    }

    return room.requiredRoomIds.every((requiredId) => this.isRoomUnlocked(requiredId));
  }

  private logEvent(message: string): void {
    if (!this.game) {
      return;
    }

    const nextActivity: ActivityEntry[] = [{ id: createId(), message }, ...this.game.activity];
    this.game.activity = nextActivity.slice(0, ACTIVITY_LOG_LIMIT);
  }

  private award(rewards: RewardBundle, message: string): void {
    if (!this.game) {
      return;
    }

    const coinDelta = rewards.coins ?? 0;
    const previousCoins = this.game.coins;
    const nextCoins =
      coinDelta >= 0
        ? previousCoins + coinDelta
        : previousCoins <= MIN_QUESTION_COINS
          ? previousCoins
          : Math.max(MIN_QUESTION_COINS, previousCoins + coinDelta);
    const appliedCoinDelta = nextCoins - previousCoins;

    this.game.coins = nextCoins;
    if (appliedCoinDelta > 0) {
      this.game.revenueEarned += appliedCoinDelta;
    }

    this.game.reputation = clamp(this.game.reputation + (rewards.reputation ?? 0), 0, 100);
    this.game.curiosity = clamp(this.game.curiosity + (rewards.curiosity ?? 0), 0, 100);
    this.game.diplomas = Math.max(0, this.game.diplomas + (rewards.diplomas ?? 0));
    this.applyResourceReward(rewards);
    this.logEvent(message);
    this.checkGoals();
  }

  private applyResourceReward(rewards: RewardBundle): void {
    if (!this.game) {
      return;
    }

    this.game.resources.paper = Math.max(0, this.game.resources.paper + (rewards.paper ?? 0));
    this.game.resources.ink = Math.max(0, this.game.resources.ink + (rewards.ink ?? 0));
    this.game.resources.revisionTokens = Math.max(0, this.game.resources.revisionTokens + (rewards.revisionTokens ?? 0));
  }

  private recordStudyCompletion(mode: StudyMode): void {
    if (!this.game) {
      return;
    }

    this.game.programsHosted += 1;

    if (mode === "mcq") {
      this.game.completedMcqCount += 1;
      return;
    }

    if (mode === "quiz") {
      this.game.completedQuizCount += 1;
      return;
    }

    if (mode === "free-text") {
      this.game.completedFreeTextCount += 1;
      return;
    }

    this.game.completedMatchPairsCount += 1;
  }

  private completeProgram(mode: StudyMode, rewards: RewardBundle, message: string): void {
    this.recordStudyCompletion(mode);
    this.award(rewards, message);
  }

  private recordStudyFailure(mode: StudyMode, rewards: RewardBundle, message: string): void {
    this.recordStudyCompletion(mode);
    this.award(rewards, message);
  }

  private assignQuest(trigger: QuestTrigger): void {
    if (!this.game) {
      return;
    }

    const selection = selectQuest({
      content: this.content,
      recentIds: this.game.recentQuestIds,
      trigger
    });

    if (!selection) {
      return;
    }

    const topic = this.selectedRoom?.label ?? "Prerequisite Review";
    const subject = "Study Skills";

    if (this.activeQuestForFocus(subject, topic)) {
      return;
    }

    const question = {
      id: createId(),
      subject,
      topic,
      prompt: `Rewrite the blocked work for ${topic} on paper before you try again.`
    };
    const record: PerformanceRecord = {
      id: `${subject.toLowerCase()}::${topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      subject,
      topic,
      attempts: 1,
      successes: 0,
      failures: 1,
      lastMode: "free-text",
      lastQuestionId: question.id,
      lastPrompt: question.prompt
    };

    this.game.recentQuestIds = selection.recentIds;
    const quest = buildAdaptiveQuestState({
      template: selection.item,
      record,
      mode: "free-text",
      question,
      day: this.game.day,
      mastery: false,
      saveSlotId: this.saveSlotId
    });

    this.game.activeQuests = [...this.game.activeQuests, quest].slice(-ACTIVE_QUEST_LIMIT);
    this.logEvent(`Quest added: ${quest.title}. ${quest.performanceSummary}.`);
  }

  private spendResources(totalCost: number): boolean {
    if (!this.game || this.totalResources() < totalCost) {
      return false;
    }

    let remaining = totalCost;
    const resources = this.game.resources;

    const spend = (key: keyof StudyResources) => {
      if (remaining <= 0) {
        return;
      }

      const spendAmount = Math.min(resources[key], remaining);
      resources[key] -= spendAmount;
      remaining -= spendAmount;
    };

    spend("paper");
    spend("ink");
    spend("revisionTokens");
    return remaining === 0;
  }

  private unlockRoom(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room || !this.canUnlockRoom(room)) {
      return;
    }

    this.game.unlockedRoomIds = [...this.game.unlockedRoomIds, room.id];
    this.game.selectedRoomId = room.id;
    this.game.roomsOpenedToday += 1;
    this.logEvent(`${room.label} opened at ${room.diplomaRequirement} diplomas. Diplomas stay in your record and are never spent.`);
    this.checkGoals();
  }

  private upgradeRoom(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room || !this.canUpgradeRoom(room)) {
      return;
    }

    const cost = this.roomUpgradeCost(room);
    if (!this.spendResources(cost)) {
      return;
    }

    this.game.roomLevels[room.id] = this.roomLevel(room.id) + 1;
    this.logEvent(`${room.label} upgraded to Tier ${this.roomLevel(room.id) + 1} using study resources.`);
    this.checkGoals();
  }

  private setCuratorTarget(target: Point): void {
    if (!this.game) {
      return;
    }

    this.game.curator.target = {
      x: clamp(target.x, 20, WORLD.width - 20),
      y: clamp(target.y, 20, WORLD.height - 20)
    };
  }

  private spawnCoin(position: Point, value: number): void {
    if (!this.game) {
      return;
    }

    this.game.floorCoins = [
      ...this.game.floorCoins,
      {
        id: createId(),
        x: position.x,
        y: position.y,
        ttl: 9,
        value
      }
    ];
  }

  private maybeCollectCoins(): void {
    if (!this.game) {
      return;
    }

    const collected: FloorCoin[] = [];

    this.game.floorCoins = this.game.floorCoins.filter((coin) => {
      if (distance(this.game!.curator, coin) <= this.game!.curator.radius + 20) {
        collected.push(coin);
        return false;
      }

      return coin.ttl > 0;
    });

    if (!collected.length) {
      return;
    }

    const total = collected.reduce((sum, coin) => sum + coin.value, 0);
    this.game.coins += total;
    this.game.revenueEarned += total;
    this.logEvent(`Collected ${total} drift coins from the route.`);
    this.checkGoals();
  }

  private updateCurator(deltaSeconds: number): void {
    if (!this.game) {
      return;
    }

    const curator = this.game.curator;
    let moveX = 0;
    let moveY = 0;

    if (this.keys.has("ArrowUp") || this.keys.has("w")) {
      moveY -= 1;
    }

    if (this.keys.has("ArrowDown") || this.keys.has("s")) {
      moveY += 1;
    }

    if (this.keys.has("ArrowLeft") || this.keys.has("a")) {
      moveX -= 1;
    }

    if (this.keys.has("ArrowRight") || this.keys.has("d")) {
      moveX += 1;
    }

    if (moveX || moveY) {
      const normal = Math.hypot(moveX, moveY) || 1;
      curator.x += (moveX / normal) * curator.speed * deltaSeconds;
      curator.y += (moveY / normal) * curator.speed * deltaSeconds;
      curator.target = null;
    } else if (curator.target) {
      moveToward(curator, curator.target, curator.speed, deltaSeconds);
    }

    curator.x = clamp(curator.x, 20, WORLD.width - 20);
    curator.y = clamp(curator.y, 20, WORLD.height - 20);
  }

  private pickUnlockedDestination(): RoomBlueprint {
    const unlockedRooms = this.content.roomBlueprints.filter((room) => this.isRoomUnlocked(room.id));
    const candidates = unlockedRooms.filter((room) => room.id !== "foyer");

    if (!candidates.length) {
      return this.findRoom("foyer") ?? unlockedRooms[0];
    }

    return pickWeightedItem(
      candidates.map((room) => ({
        item: room,
        weight: room.rewardRate + this.roomLevel(room.id) * 2 + (room.miniGameId ? 1.4 : 0) + (this.hasImmersiveScene(room) ? 0.8 : 0)
      }))
    );
  }

  private spawnVisitor(): void {
    if (!this.game) {
      return;
    }

    const targetRoom = this.pickUnlockedDestination();

    this.game.visitors = [
      ...this.game.visitors,
      {
        id: createId(),
        x: 54,
        y: 340,
        speed: 80 + Math.random() * 35,
        state: "to-room",
        roomId: targetRoom.id,
        dwell: 2.5 + Math.random() * 3 + this.roomLevel(targetRoom.id) * 0.45,
        coinDropped: false
      }
    ];
    this.game.visitorsSeen += 1;
  }

  private updateVisitors(deltaSeconds: number): void {
    if (!this.game) {
      return;
    }

    const entrance = { x: 54, y: 340 };
    const survivors: VisitorState[] = [];
    let progressed = false;

    for (const visitor of this.game.visitors) {
      if (visitor.state === "to-room") {
        const room = this.findRoom(visitor.roomId);

        if (room && moveToward(visitor, roomCenter(room), visitor.speed, deltaSeconds)) {
          visitor.state = "dwelling";
          this.game.roomVisitCounts[room.id] = (this.game.roomVisitCounts[room.id] ?? 0) + 1;
          progressed = true;
        }
      } else if (visitor.state === "dwelling") {
        visitor.dwell -= deltaSeconds;

        if (!visitor.coinDropped && visitor.dwell <= 1.2) {
          visitor.coinDropped = true;
          const room = this.findRoom(visitor.roomId);
          this.spawnCoin({ x: visitor.x, y: visitor.y }, room ? this.roomCoinValue(room) : 8);
        }

        if (visitor.dwell <= 0) {
          visitor.state = "exit";
        }
      } else if (moveToward(visitor, entrance, visitor.speed, deltaSeconds)) {
        this.game.visitorsServed += 1;
        this.game.reputation = clamp(this.game.reputation + 1, 0, 100);
        progressed = true;
        continue;
      }

      survivors.push(visitor);
    }

    this.game.visitors = survivors;

    if (progressed) {
      this.checkGoals();
    }
  }

  private updateFloorCoins(deltaSeconds: number): void {
    if (!this.game) {
      return;
    }

    this.game.floorCoins = this.game.floorCoins
      .map((coin) => ({
        ...coin,
        ttl: coin.ttl - deltaSeconds
      }))
      .filter((coin) => coin.ttl > 0);
  }

  private openStudyMode(mode: StudyMode, miniGame: MiniGameDefinition | null): void {
    if (!this.game) {
      return;
    }

    this.closeRoomViewer();
    this.openStudyRoundModal({
      mode,
      stage: "resource-test",
      questId: null,
      miniGame,
      preferredSubjects: this.preferredSubjectsForMiniGame(miniGame)
    });
  }

  private openArchiveModal(focusAssetId: string | null = null): void {
    if (!this.game) {
      return;
    }

    this.closeRoomViewer();
    this.setActiveModal({
      type: "archive",
      focusAssetId
    });
  }

  private triggerCallEvent(): void {
    if (!this.game) {
      return;
    }

    this.game.pendingCall = this.nextStudyMode();
    this.logEvent(`${formatStudyModeLabel(this.game.pendingCall)} round queued on the route board.`);
  }

  private markImmersiveVisit(room: RoomBlueprint): void {
    if (!this.game || this.game.viewedRoomIds.includes(room.id)) {
      return;
    }

    this.game.viewedRoomIds = [...this.game.viewedRoomIds, room.id];
    this.game.immersiveVisits += 1;
    this.game.photospheresVisited = this.game.immersiveVisits;
    this.game.programsHosted += 1;
    this.logEvent(`Immersive scene opened for ${room.label}.`);
    this.checkGoals();
  }

  private tourRoom(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room || !this.isRoomUnlocked(room.id)) {
      return;
    }

    const level = this.roomLevel(room.id);
    this.game.programsHosted += 1;
    this.game.reputation = clamp(this.game.reputation + 3 + level, 0, 100);
    this.game.curiosity = clamp(this.game.curiosity + 4 + level, 0, 100);
    this.spawnCoin(roomCenter(room), this.roomTourRewardValue(room));
    this.logEvent(`Drift route hosted in ${room.label}.`);
    this.checkGoals();
  }

  private updateSimulation(deltaSeconds: number): void {
    if (!this.game || this.game.activeModal || this.viewerState) {
      return;
    }

    this.game.timer += deltaSeconds;
    this.game.nextVisitorSpawnAt -= deltaSeconds;
    this.game.nextCallAt -= deltaSeconds;

    if (this.game.nextVisitorSpawnAt <= 0) {
      const maxVisitors = 3 + this.game.unlockedRoomIds.length + Math.floor(this.game.programsHosted / 2);

      if (this.game.visitors.length < maxVisitors) {
        this.spawnVisitor();
      }

      this.game.nextVisitorSpawnAt = Math.max(2.2, 5.3 - this.game.unlockedRoomIds.length * 0.24 - this.completedGoalsCount * 0.1);
    }

    if (this.game.nextCallAt <= 0 && !this.game.pendingCall) {
      this.triggerCallEvent();
      this.game.nextCallAt = Math.max(22, 28 - this.completedGoalsCount * 2);
    }

    this.updateCurator(deltaSeconds);
    this.updateVisitors(deltaSeconds);
    this.updateFloorCoins(deltaSeconds);
    this.maybeCollectCoins();
  }

  private hasLocalStorage(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  private readSavedSnapshot(): SavedGamePayload | null {
    if (!this.hasLocalStorage()) {
      return null;
    }

    try {
      for (const key of this.fallbackStorageKeys) {
        const raw = window.localStorage.getItem(key);

        if (!raw) {
          continue;
        }

        const parsed = JSON.parse(raw) as SavedGamePayload;

        if (parsed && typeof parsed === "object" && parsed.game) {
          return parsed;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private refreshSavedGameAvailability(): void {
    const snapshot = this.readSavedSnapshot();
    this.savedGameAvailable = !!snapshot;
    this.lastSavedAt = snapshot?.savedAt ?? null;
  }

  private normalizeSavedGame(rawGame: unknown, themeId: string): GameSession | null {
    if (!rawGame || typeof rawGame !== "object") {
      return null;
    }

    const theme = this.content.themes.find((entry) => entry.id === themeId) ?? this.content.themes[0];
    const fallback = this.createGameSession(theme);
    const validRoomIds = new Set(this.content.roomBlueprints.map((room) => room.id));
    const raw = rawGame as Record<string, unknown>;

    const unlockedRoomIds = asStringArray(raw.unlockedRoomIds).filter((roomId) => validRoomIds.has(roomId));
    const selectedRoomId = typeof raw.selectedRoomId === "string" && validRoomIds.has(raw.selectedRoomId)
      ? raw.selectedRoomId
      : unlockedRoomIds[0] ?? fallback.selectedRoomId;

    const dailyGoals = buildDailyGoals(theme.id).map((goal) => {
      const rawGoals = Array.isArray(raw.dailyGoals) ? raw.dailyGoals : [];
      const matchingGoal = rawGoals.find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).id === goal.id);

      return {
        ...goal,
        completed: Boolean(matchingGoal && (matchingGoal as Record<string, unknown>).completed)
      };
    });
    const immersiveVisits = Math.max(
      0,
      asFiniteNumber(raw.immersiveVisits, asFiniteNumber(raw.photospheresVisited, 0)),
    );
    const rawResources = raw.resources && typeof raw.resources === "object" ? raw.resources as Record<string, unknown> : {};
    const resources: StudyResources = {
      paper: Math.max(0, asFiniteNumber(rawResources.paper, 0)),
      ink: Math.max(0, asFiniteNumber(rawResources.ink, 0)),
      revisionTokens: Math.max(0, asFiniteNumber(rawResources.revisionTokens, 0))
    };
    const activeQuests = Array.isArray(raw.activeQuests)
      ? raw.activeQuests
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => {
            const quest = entry as Record<string, unknown>;
            const reward = quest.resourceReward && typeof quest.resourceReward === "object"
              ? quest.resourceReward as Record<string, unknown>
              : createStudyResources();
            const trigger = normalizeQuestTrigger(quest.trigger);

            return {
              id: typeof quest.id === "string" ? quest.id : createId(),
              title: typeof quest.title === "string" ? quest.title : "Study Quest",
              detail: typeof quest.detail === "string" ? quest.detail : "Review the last missed topic, improve it, and get it ready for the final test.",
              trigger,
              resourceReward: {
                paper: Math.max(0, asFiniteNumber(reward.paper, 0)),
                ink: Math.max(0, asFiniteNumber(reward.ink, 0)),
                revisionTokens: Math.max(0, asFiniteNumber(reward.revisionTokens, 0))
              },
              createdAtDay: Math.max(1, asFiniteNumber(quest.createdAtDay, fallback.day)),
              stage: (quest.stage === "final-ready" ? "final-ready" : "improvement") as "final-ready" | "improvement",
              subject: typeof quest.subject === "string" ? quest.subject : "Mixed Subject",
              topic: typeof quest.topic === "string" ? quest.topic : "Revision",
              sourceMode: isStudyMode(quest.sourceMode) ? quest.sourceMode : "quiz",
              sourceQuestionId: typeof quest.sourceQuestionId === "string" ? quest.sourceQuestionId : createId(),
              requiredSuccesses: Math.max(1, asFiniteNumber(quest.requiredSuccesses, 1)),
              currentSuccesses: Math.max(0, asFiniteNumber(quest.currentSuccesses, 0)),
              focusPrompt: typeof quest.focusPrompt === "string" ? quest.focusPrompt : "",
              performanceSummary: typeof quest.performanceSummary === "string" ? quest.performanceSummary : "New quest"
            };
          })
          .slice(-ACTIVE_QUEST_LIMIT)
      : [];
    const activeFinalTests = Array.isArray(raw.activeFinalTests)
      ? raw.activeFinalTests
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => {
            const finalTest = entry as Record<string, unknown>;
            return {
              id: typeof finalTest.id === "string" ? finalTest.id : createId(),
              questId: typeof finalTest.questId === "string" ? finalTest.questId : "",
              subject: typeof finalTest.subject === "string" ? finalTest.subject : "Mixed Subject",
              topic: typeof finalTest.topic === "string" ? finalTest.topic : "Revision",
              mode:
                finalTest.mode === "mcq" || finalTest.mode === "quiz" || finalTest.mode === "free-text"
                  ? finalTest.mode
                  : "quiz",
              title: typeof finalTest.title === "string" ? finalTest.title : "Diploma Final",
              detail: typeof finalTest.detail === "string" ? finalTest.detail : "Pass the final test to earn the diploma.",
              attempts: Math.max(0, asFiniteNumber(finalTest.attempts, 0))
            } as FinalTestState;
          })
      : [];
    const performanceRecords = Array.isArray(raw.performanceRecords)
      ? raw.performanceRecords
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => {
            const record = entry as Record<string, unknown>;
            return {
              id: typeof record.id === "string" ? record.id : createId(),
              subject: typeof record.subject === "string" ? record.subject : "Mixed Subject",
              topic: typeof record.topic === "string" ? record.topic : "Revision",
              attempts: Math.max(0, asFiniteNumber(record.attempts, 0)),
              successes: Math.max(0, asFiniteNumber(record.successes, 0)),
              failures: Math.max(0, asFiniteNumber(record.failures, 0)),
              lastMode: isStudyMode(record.lastMode) ? record.lastMode : "quiz",
              lastQuestionId: typeof record.lastQuestionId === "string" ? record.lastQuestionId : createId(),
              lastPrompt: typeof record.lastPrompt === "string" ? record.lastPrompt : ""
            } as PerformanceRecord;
          })
      : [];
    const pendingCall = isStudyMode(raw.pendingCall) ? raw.pendingCall : null;

    return {
      ...fallback,
      day: Math.max(1, asFiniteNumber(raw.day, fallback.day)),
      timer: Math.max(0, asFiniteNumber(raw.timer, fallback.timer)),
      coins: Math.max(0, asFiniteNumber(raw.coins, fallback.coins)),
      diplomas: Math.max(0, asFiniteNumber(raw.diplomas, fallback.diplomas)),
      reputation: clamp(asFiniteNumber(raw.reputation, fallback.reputation), 0, 100),
      curiosity: clamp(asFiniteNumber(raw.curiosity, fallback.curiosity), 0, 100),
      revenueEarned: Math.max(0, asFiniteNumber(raw.revenueEarned, 0)),
      visitorsServed: Math.max(0, asFiniteNumber(raw.visitorsServed, 0)),
      visitorsSeen: Math.max(0, asFiniteNumber(raw.visitorsSeen, 0)),
      roomsOpenedToday: Math.max(0, asFiniteNumber(raw.roomsOpenedToday, 0)),
      programsHosted: Math.max(0, asFiniteNumber(raw.programsHosted, 0)),
      immersiveVisits,
      photospheresVisited: immersiveVisits,
      resources,
      activeQuests,
      activeFinalTests,
      performanceRecords,
      questsCompleted: Math.max(0, asFiniteNumber(raw.questsCompleted, 0)),
      completedMcqCount: Math.max(0, asFiniteNumber(raw.completedMcqCount, 0)),
      completedQuizCount: Math.max(0, asFiniteNumber(raw.completedQuizCount, 0)),
      completedFreeTextCount: Math.max(0, asFiniteNumber(raw.completedFreeTextCount, 0)),
      completedMatchPairsCount: Math.max(0, asFiniteNumber(raw.completedMatchPairsCount, 0)),
      selectedRoomId,
      unlockedRoomIds: unlockedRoomIds.length ? Array.from(new Set(unlockedRoomIds)) : fallback.unlockedRoomIds,
      viewedRoomIds: asStringArray(raw.viewedRoomIds).filter((roomId) => validRoomIds.has(roomId)),
      recentMcqIds: asStringArray(raw.recentMcqIds ?? raw.recentQuestionIds).slice(-8),
      recentFreeTextIds: asStringArray(raw.recentFreeTextIds ?? raw.recentEstimationIds).slice(-6),
      recentQuizIds: asStringArray(raw.recentQuizIds ?? raw.recentCuratorCheckIds).slice(-8),
      recentFinalQuestionIds: asStringArray(raw.recentFinalQuestionIds).slice(-8),
      recentQuestIds: asStringArray(raw.recentQuestIds).slice(-10),
      roomLevels: asNumberRecord(raw.roomLevels, this.content.roomBlueprints),
      roomVisitCounts: asNumberRecord(raw.roomVisitCounts, this.content.roomBlueprints),
      dailyGoals,
      visitors: Array.isArray(raw.visitors)
        ? raw.visitors
            .filter((entry) => entry && typeof entry === "object")
            .map((entry) => {
              const visitor = entry as Record<string, unknown>;
              return {
                id: typeof visitor.id === "string" ? visitor.id : createId(),
                x: clamp(asFiniteNumber(visitor.x, 54), 20, WORLD.width - 20),
                y: clamp(asFiniteNumber(visitor.y, 340), 20, WORLD.height - 20),
                speed: Math.max(40, asFiniteNumber(visitor.speed, 80)),
                state: visitor.state === "dwelling" || visitor.state === "exit" ? visitor.state : "to-room",
                roomId: typeof visitor.roomId === "string" && validRoomIds.has(visitor.roomId) ? visitor.roomId : fallback.selectedRoomId,
                dwell: Math.max(0, asFiniteNumber(visitor.dwell, 2)),
                coinDropped: Boolean(visitor.coinDropped)
              } as VisitorState;
            })
        : [],
      floorCoins: Array.isArray(raw.floorCoins)
        ? raw.floorCoins
            .filter((entry) => entry && typeof entry === "object")
            .map((entry) => {
              const coin = entry as Record<string, unknown>;
              return {
                id: typeof coin.id === "string" ? coin.id : createId(),
                x: clamp(asFiniteNumber(coin.x, 54), 20, WORLD.width - 20),
                y: clamp(asFiniteNumber(coin.y, 340), 20, WORLD.height - 20),
                ttl: Math.max(0, asFiniteNumber(coin.ttl, 4)),
                value: Math.max(1, asFiniteNumber(coin.value, 6))
              } as FloorCoin;
            })
        : [],
      curator: raw.curator && typeof raw.curator === "object"
        ? {
            x: clamp(asFiniteNumber((raw.curator as Record<string, unknown>).x, fallback.curator.x), 20, WORLD.width - 20),
            y: clamp(asFiniteNumber((raw.curator as Record<string, unknown>).y, fallback.curator.y), 20, WORLD.height - 20),
            target:
              (raw.curator as Record<string, unknown>).target &&
              typeof (raw.curator as Record<string, unknown>).target === "object"
                ? {
                    x: clamp(
                      asFiniteNumber(((raw.curator as Record<string, unknown>).target as Record<string, unknown>).x, fallback.curator.x),
                      20,
                      WORLD.width - 20
                    ),
                    y: clamp(
                      asFiniteNumber(((raw.curator as Record<string, unknown>).target as Record<string, unknown>).y, fallback.curator.y),
                      20,
                      WORLD.height - 20
                    )
                  }
                : null,
            speed: Math.max(120, asFiniteNumber((raw.curator as Record<string, unknown>).speed, fallback.curator.speed)),
            radius: Math.max(12, asFiniteNumber((raw.curator as Record<string, unknown>).radius, fallback.curator.radius))
          }
        : fallback.curator,
      activity: Array.isArray(raw.activity)
        ? raw.activity
            .filter((entry) => entry && typeof entry === "object")
            .map((entry) => ({
              id: typeof (entry as Record<string, unknown>).id === "string" ? (entry as Record<string, unknown>).id as string : createId(),
              message:
                typeof (entry as Record<string, unknown>).message === "string"
                  ? (entry as Record<string, unknown>).message as string
                  : "Museum log restored."
            }))
            .slice(0, ACTIVITY_LOG_LIMIT)
        : [],
      nextVisitorSpawnAt: Math.max(0.5, asFiniteNumber(raw.nextVisitorSpawnAt, fallback.nextVisitorSpawnAt)),
      nextCallAt: Math.max(4, asFiniteNumber(raw.nextCallAt, fallback.nextCallAt)),
      pendingCall,
      activeModal: null
    };
  }

  private persistGameSnapshot(): void {
    if (!this.hasLocalStorage() || !this.game) {
      return;
    }

    const payload: SavedGamePayload = {
      version: 4,
      selectedThemeId: this.selectedThemeId,
      savedAt: new Date().toISOString(),
      game: JSON.parse(JSON.stringify(this.game)) as GameSession
    };

    window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    if (this.saveSlotId === "guest") {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    this.savedGameAvailable = true;
    this.lastSavedAt = payload.savedAt;
  }
}

export function resolveArchiveFocus(modal: ModalState | null, conceptArt: ConceptAsset[]): ConceptAsset | undefined {
  if (modal?.type !== "archive") {
    return undefined;
  }

  if (modal.focusAssetId) {
    return conceptArt.find((item) => item.id === modal.focusAssetId) ?? conceptArt[0];
  }

  return conceptArt[0];
}
