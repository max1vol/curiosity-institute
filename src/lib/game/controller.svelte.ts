import type {
  ActivityEntry,
  ConceptAsset,
  DailyGoal,
  DailyGoalView,
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
  Point,
  QuestTrigger,
  RewardBundle,
  RoomAction,
  RoomBlueprint,
  RoomDetail,
  StatCard,
  StudyMode,
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
  selectFreeTextQuestion,
  selectMcqQuestion,
  selectQuest,
  selectQuizQuestion,
  selectStudyMode
} from "./challenge-selection";
import { buildDailyGoals, formatRewardLabel, goalProgressForGame, MAX_ROOM_LEVEL } from "./progression";
import {
  buildMatchCards,
  evaluateFreeTextAnswer,
  formatCompactReward,
  formatStudyModeLabel,
  formatStudyResources
} from "./study-helpers";

export const WORLD = {
  width: 1100,
  height: 640
} as const;

const MOVEMENT_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"]);
const STORAGE_KEY = "curiosity-institute-save-v4";
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

interface SavedGamePayload {
  version: number;
  selectedThemeId: string;
  savedAt: string;
  game: GameSession;
}

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
    value === "quiz-failure" ||
    value === "free-text-failure" ||
    value === "locked-submission" ||
    value === "match-pairs-failure"
    ? value
    : "locked-submission";
}

export class MuseumGameController {
  readonly content: GameContent;

  selectedThemeId = $state("");
  game = $state<GameSession | null>(null);
  viewerState = $state<ViewerState | null>(null);
  savedGameAvailable = $state(false);
  lastSavedAt = $state<string | null>(null);

  private readonly keys = new Set<string>();
  private viewerHistory: string[] = [];
  private animationFrame = 0;
  private lastFrame = 0;
  private lastPersistAt = 0;
  private mounted = false;

  constructor(content: GameContent) {
    this.content = content;
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
      return "No immersive room is open.";
    }

    if (this.viewerRoomLevel >= this.viewerRoomMaxLevel) {
      return "This room is already at max tier.";
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
      return "Upgrade Room";
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
      return "Choose a direction, then start or resume a Year 6 study day.";
    }

    if (this.completedGoalsCount === this.dailyGoals.length) {
      return "Quest board complete. Use the rest of the day to unlock more study rooms and raise the grade.";
    }

    if (this.game.activeQuests.length) {
      return "A redraft quest is waiting. Claim its study resources before the next hard room upgrade.";
    }

    if (this.game.pendingCall) {
      return `A ${formatStudyModeLabel(this.game.pendingCall)} round is waiting. Clear it before your study streak dips.`;
    }

    return "Balance room unlocks, diploma progress, and redraft quests to lift the grade.";
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
        label: "Curation",
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
        label: "Footfall",
        value: `${visitCount} routed`
      },
      {
        label: "Immersive Scene",
        value: room.immersiveMap?.nodes[0]?.edges.length
          ? `${room.immersiveMap.nodes[0].edges.length} connected wings`
          : this.hasImmersiveScene(room)
            ? "Standalone room"
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
        { label: "Visitors Served", value: 0 },
        { label: "Rooms Open", value: `0/${this.content.roomBlueprints.length}` }
      ];
    }

    return [
      { label: "Coins", value: this.game.coins },
      { label: "Diplomas", value: this.game.diplomas },
      { label: "Resources", value: formatStudyResources(this.game.resources) },
      { label: "Reputation", value: `${this.game.reputation}%` },
      { label: "Curiosity", value: `${this.game.curiosity}%` },
      { label: "Visitors Served", value: this.game.visitorsServed },
      { label: "Rooms Open", value: `${this.game.unlockedRoomIds.length}/${this.content.roomBlueprints.length}` }
    ];
  }

  get currentObjective(): string {
    if (!this.game) {
      return "Start a study day, pick a direction, and begin unlocking Year 6 rooms.";
    }

    if (this.game.pendingCall) {
      return `Open the queued ${formatStudyModeLabel(this.game.pendingCall)} round before the study streak cools down.`;
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
      return `Quest board complete. Use your diplomas to open ${unlockable.label}.`;
    }

    return "All core quests are complete. Keep learning and chase a higher grade.";
  }

  get objectivePills(): ObjectivePill[] {
    const themeLabel = this.activeTheme?.label ?? "Direction";

    if (!this.game) {
      return [
        { label: "Direction", value: themeLabel },
        { label: "Grade", value: "Preview" },
        { label: "Quests", value: `0/${buildDailyGoals(this.activeTheme?.id ?? "").length}` },
        { label: "Autosave", value: this.savedGameAvailable ? "Ready" : "None" }
      ];
    }

    return [
      { label: "Direction", value: themeLabel },
      { label: "Grade", value: this.museumGrade },
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
          label: `Unlock At ${room.diplomaRequirement} Diplomas`,
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
          label: `Host Guided Tour (+${this.roomTourRewardValue(room)} coins)`,
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
      label: "Move Curator Here"
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
    this.logEvent(`The ${theme.label} study day begins.`);
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
    this.logEvent("Resumed a saved study day.");
    this.checkGoals();
    this.persistGameSnapshot();
    this.syncSimulationLoop(true);
  }

  clearSavedGame(): void {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
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
      this.assignQuest("locked-submission");
      this.logEvent(`${room.label} is still locked. Earn more diplomas or clear the prerequisite wings.`);
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

    this.game.activeQuests = this.game.activeQuests.filter((entry) => entry.id !== questId);
    this.game.questsCompleted += 1;
    this.award(quest.resourceReward, `${quest.title} complete. Resources gained: ${formatRewardLabel(quest.resourceReward)}.`);
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

  private studySuccessReward(mode: "mcq" | "quiz" | "free-text", difficulty: "Advanced" | "Expert"): RewardBundle {
    const expert = difficulty === "Expert";

    if (mode === "mcq") {
      return expert
        ? { diplomas: 2, coins: 12, reputation: 8, curiosity: 10 }
        : { diplomas: 1, coins: 9, reputation: 6, curiosity: 8 };
    }

    if (mode === "quiz") {
      return expert
        ? { diplomas: 2, coins: 14, reputation: 9, curiosity: 6 }
        : { diplomas: 1, coins: 10, reputation: 7, curiosity: 5 };
    }

    return expert
      ? { diplomas: 2, coins: 10, reputation: 7, curiosity: 8 }
      : { diplomas: 1, coins: 7, reputation: 5, curiosity: 6 };
  }

  private studyFailureReward(mode: "mcq" | "quiz" | "free-text", difficulty: "Advanced" | "Expert"): RewardBundle {
    const expert = difficulty === "Expert";

    if (mode === "mcq") {
      return expert
        ? { coins: -6, reputation: -5, curiosity: -3 }
        : { coins: -4, reputation: -4, curiosity: -2 };
    }

    if (mode === "quiz") {
      return expert
        ? { coins: -5, reputation: -4, curiosity: -2 }
        : { coins: -3, reputation: -3, curiosity: -1 };
    }

    return expert
      ? { coins: -4, reputation: -3, curiosity: -2 }
      : { coins: -3, reputation: -2, curiosity: -1 };
  }

  private concludeStudyRound({
    mode,
    success,
    successRewards,
    failureRewards,
    successMessage,
    failureMessage
  }: {
    mode: StudyMode;
    success: boolean;
    successRewards: RewardBundle;
    failureRewards: RewardBundle;
    successMessage: string;
    failureMessage: string;
  }): void {
    this.finishStudyRound();

    if (success) {
      this.completeProgram(mode, successRewards, successMessage);
      return;
    }

    this.recordStudyFailure(mode, failureRewards, failureMessage);
  }

  private createMatchPairsModal(miniGame: MiniGameDefinition | null): Extract<ModalState, { type: "match-pairs" }> {
    const selectedPairs = drawMatchPairsDeck(this.content.matchPairDeck, MATCH_PAIR_DECK_SIZE);
    const subjects = Array.from(new Set(selectedPairs.map((pair) => pair.subject)));
    const subject = subjects.length === 1 ? subjects[0] : "Mixed Subjects";
    const topic = selectedPairs.length ? `${selectedPairs.length} revision pairs` : "Revision pairs";

    return {
      type: "match-pairs",
      miniGame,
      subject,
      topic,
      deck: buildMatchCards(selectedPairs),
      attempts: 0,
      locked: false
    };
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

    const { question, answer } = this.game.activeModal;
    this.concludeStudyRound({
      mode: "free-text",
      success: evaluateFreeTextAnswer(answer, question),
      successRewards: this.studySuccessReward("free-text", question.difficulty),
      failureRewards: this.studyFailureReward("free-text", question.difficulty),
      successMessage: `${question.success} Diploma progress climbs in ${question.subject}.`,
      failureMessage: `${question.failure} A rewrite quest has been added to the board.`
    });
  }

  resolveMcqChoice(choiceIndex: number): void {
    if (this.game?.activeModal?.type !== "mcq") {
      return;
    }

    const { question } = this.game.activeModal;
    this.concludeStudyRound({
      mode: "mcq",
      success: choiceIndex === question.correctIndex,
      successRewards: this.studySuccessReward("mcq", question.difficulty),
      failureRewards: this.studyFailureReward("mcq", question.difficulty),
      successMessage: `${question.success} ${question.subject} diploma progress improves.`,
      failureMessage: `${question.failure} Coin losses stop at the final safety coin.`
    });
  }

  resolveQuizChoice(choiceIndex: number): void {
    if (this.game?.activeModal?.type !== "quiz") {
      return;
    }

    const { question } = this.game.activeModal;
    this.concludeStudyRound({
      mode: "quiz",
      success: choiceIndex === question.correctIndex,
      successRewards: this.studySuccessReward("quiz", question.difficulty),
      failureRewards: this.studyFailureReward("quiz", question.difficulty),
      successMessage: `${question.style} solved cleanly. ${question.subject} confidence improves.`,
      failureMessage: `${question.subject} slipped this round. The study streak dips, but the last coin stays safe.`
    });
  }

  handleMatchCard(cardId: string): void {
    if (this.game?.activeModal?.type !== "match-pairs") {
      return;
    }

    const modal = this.game.activeModal;

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
        this.completeProgram(
          "match-pairs",
          {
            diplomas: modal.attempts <= 4 ? 2 : 1,
            coins: reward,
            reputation: 5,
            curiosity: 7
          },
          `Match pairs cleared in ${modal.attempts} tries.`
        );
      }

      return;
    }

    if (modal.attempts >= MATCH_PAIR_ATTEMPT_LIMIT) {
      this.finishStudyRound();
      this.recordStudyFailure(
        "match-pairs",
        { coins: -3, reputation: -2, curiosity: -1 },
        "The match board timed out. A redraft quest has been added to your board."
      );
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

  private nextMcqQuestion(): McqQuestion {
    if (!this.game) {
      return fallbackMcqQuestion(this.content);
    }

    const { item, recentIds } = selectMcqQuestion({
      content: this.content,
      recentIds: this.game.recentMcqIds,
      completedGoalsCount: this.completedGoalsCount,
      programsHosted: this.game.programsHosted
    });

    this.game.recentMcqIds = recentIds;
    return item;
  }

  private nextFreeTextQuestion(): FreeTextQuestion {
    if (!this.game) {
      return fallbackFreeTextQuestion(this.content);
    }

    const { item, recentIds } = selectFreeTextQuestion({
      content: this.content,
      recentIds: this.game.recentFreeTextIds,
      completedGoalsCount: this.completedGoalsCount,
      selectedRoomLevel: this.roomLevel(this.game.selectedRoomId)
    });

    this.game.recentFreeTextIds = recentIds;
    return item;
  }

  private nextQuizQuestion(): QuizQuestion {
    if (!this.game) {
      return fallbackQuizQuestion(this.content);
    }

    const { item, recentIds } = selectQuizQuestion({
      content: this.content,
      recentIds: this.game.recentQuizIds,
      completedGoalsCount: this.completedGoalsCount,
      reputation: this.game.reputation
    });

    this.game.recentQuizIds = recentIds;
    return item;
  }

  private roomLevel(roomId: string): number {
    return this.game?.roomLevels[roomId] ?? 0;
  }

  private hasImmersiveScene(room: RoomBlueprint): boolean {
    return Boolean(room.immersiveMap?.nodes.length || room.splatPath || room.panoramaPath);
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

    return `Tour +${this.roomTourRewardValue(room)} coins`;
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
    this.assignQuest(QUEST_TRIGGER_BY_MODE[mode]);
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

    if (this.game.activeQuests.some((quest) => quest.id === selection.item.id)) {
      return;
    }

    this.game.recentQuestIds = selection.recentIds;

    this.game.activeQuests = [
      ...this.game.activeQuests,
      {
        ...selection.item,
        createdAtDay: this.game.day
      }
    ].slice(-ACTIVE_QUEST_LIMIT);

    this.logEvent(`Quest added: ${selection.item.title}.`);
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
    this.logEvent(`${room.label} unlocked at ${room.diplomaRequirement} diplomas. Diplomas stay in your record and are never spent.`);
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
    this.logEvent(`Collected ${total} museum coins from the floor.`);
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

    switch (mode) {
      case "mcq":
        this.setActiveModal({
          type: "mcq",
          miniGame,
          question: this.nextMcqQuestion()
        });
        return;
      case "quiz":
        this.setActiveModal({
          type: "quiz",
          miniGame,
          question: this.nextQuizQuestion()
        });
        return;
      case "free-text":
        this.setActiveModal({
          type: "free-text",
          miniGame,
          question: this.nextFreeTextQuestion(),
          answer: ""
        });
        return;
      case "match-pairs":
        this.setActiveModal(this.createMatchPairsModal(miniGame));
        return;
    }
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
    this.logEvent(`${formatStudyModeLabel(this.game.pendingCall)} round queued on the study board.`);
  }

  private markImmersiveVisit(room: RoomBlueprint): void {
    if (!this.game || this.game.viewedRoomIds.includes(room.id)) {
      return;
    }

    this.game.viewedRoomIds = [...this.game.viewedRoomIds, room.id];
    this.game.immersiveVisits += 1;
    this.game.photospheresVisited = this.game.immersiveVisits;
    this.game.programsHosted += 1;
    this.logEvent(`Immersive splat scene opened for ${room.label}.`);
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
    this.logEvent(`Guided tour hosted in ${room.label}.`);
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
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as SavedGamePayload;

      if (!parsed || typeof parsed !== "object" || !parsed.game) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
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
              detail: typeof quest.detail === "string" ? quest.detail : "Review the last missed topic and redraft it on paper.",
              trigger,
              resourceReward: {
                paper: Math.max(0, asFiniteNumber(reward.paper, 0)),
                ink: Math.max(0, asFiniteNumber(reward.ink, 0)),
                revisionTokens: Math.max(0, asFiniteNumber(reward.revisionTokens, 0))
              },
              createdAtDay: Math.max(1, asFiniteNumber(quest.createdAtDay, fallback.day))
            };
          })
          .slice(-ACTIVE_QUEST_LIMIT)
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

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
