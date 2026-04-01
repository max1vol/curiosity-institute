import type {
  ActivityEntry,
  CallQuestion,
  ConceptAsset,
  CuratorCheckScenario,
  EstimationScenario,
  FloorCoin,
  GameContent,
  GameSession,
  MatchCard,
  MiniGameDefinition,
  MiniGameId,
  ModalState,
  ObjectivePill,
  Point,
  RoomAction,
  RoomBlueprint,
  StatCard,
  ThemeDefinition,
  VisitorState
} from "./types";

export const WORLD = {
  width: 1100,
  height: 640
} as const;

const MOVEMENT_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"]);

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
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

export class MuseumGameController {
  readonly content: GameContent;

  selectedThemeId = $state("");
  game = $state<GameSession | null>(null);
  viewerRoomId = $state<string | null>(null);

  private readonly keys = new Set<string>();
  private animationFrame = 0;
  private lastFrame = 0;
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
    if (!this.viewerRoomId) {
      return undefined;
    }

    return this.findRoom(this.viewerRoomId);
  }

  get stats(): StatCard[] {
    if (!this.game) {
      return [
        { label: "Coins", value: 0 },
        { label: "Reputation", value: "0%" },
        { label: "Curiosity", value: "0%" },
        { label: "Visitors Served", value: 0 },
        { label: "Visitors On Floor", value: 0 },
        { label: "Rooms Open", value: `0/${this.content.roomBlueprints.length}` }
      ];
    }

    return [
      { label: "Coins", value: this.game.coins },
      { label: "Reputation", value: `${this.game.reputation}%` },
      { label: "Curiosity", value: `${this.game.curiosity}%` },
      { label: "Visitors Served", value: this.game.visitorsServed },
      { label: "Visitors On Floor", value: this.game.visitors.length },
      { label: "Rooms Open", value: `${this.game.unlockedRoomIds.length}/${this.content.roomBlueprints.length}` }
    ];
  }

  get currentObjective(): string {
    if (!this.game) {
      return "Start a museum day, pick a direction, and begin opening wings.";
    }

    const lockedRooms = this.content.roomBlueprints.filter((room) => !this.isRoomUnlocked(room.id));
    const unlockable = lockedRooms.find((room) => this.canUnlockRoom(room));

    if (this.game.pendingCall) {
      return "Answer the incoming hotline question before visitor confidence dips.";
    }

    if (unlockable) {
      return `Collect enough coins to open ${unlockable.label}.`;
    }

    if (lockedRooms.length) {
      return "Grow visitor traffic and reputation until the next branch becomes affordable.";
    }

    return "All wings are open. Keep the floor moving and push for a high-curiosity museum day.";
  }

  get objectivePills(): ObjectivePill[] {
    const themeLabel = this.activeTheme?.label ?? "Direction";

    if (!this.game) {
      return [
        { label: "Direction", value: themeLabel },
        { label: "Day Timer", value: "Ready" },
        { label: "Hotline", value: "Quiet" }
      ];
    }

    return [
      { label: "Direction", value: themeLabel },
      { label: "Day Timer", value: `${Math.floor(this.game.timer)}s` },
      { label: "Hotline", value: this.game.pendingCall ? "Live" : "Quiet" }
    ];
  }

  get roomActions(): RoomAction[] {
    const room = this.selectedRoom;

    if (!this.game || !room) {
      return [];
    }

    const actions: RoomAction[] = [];

    if (!this.isRoomUnlocked(room.id)) {
      const affordable = this.game.coins >= room.cost;
      const prerequisitesMet = room.requiredRoomIds.every((requiredId) => this.isRoomUnlocked(requiredId));

      if (affordable && prerequisitesMet) {
        actions.push({
          id: `${room.id}-unlock`,
          action: "unlock",
          label: `Unlock For ${room.cost} Coins`,
          primary: true
        });
      } else {
        actions.push({
          id: `${room.id}-blocked`,
          action: "unlock",
          label: !prerequisitesMet
            ? `Open ${room.requiredRoomIds.map((requiredId) => this.findRoom(requiredId)?.label ?? requiredId).join(" and ")} first`
            : `Need ${room.cost - this.game.coins} more coins`,
          disabled: true
        });
      }
    } else {
      if (room.photospherePath) {
        actions.push({
          id: `${room.id}-viewer`,
          action: "viewer",
          label: "Enter 3D View",
          primary: true
        });
      }

      if (room.miniGameId) {
        actions.push({
          id: `${room.id}-mini-game`,
          action: "mini-game",
          label: `Play ${this.findMiniGame(room.miniGameId)?.label ?? "Mini Game"}`,
          primary: !room.photospherePath
        });
      } else {
        actions.push({
          id: `${room.id}-tour`,
          action: "tour",
          label: "Host Guided Tour",
          primary: !room.photospherePath
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

  mount(): void {
    if (this.mounted || typeof window === "undefined") {
      return;
    }

    this.mounted = true;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.animationFrame = window.requestAnimationFrame(this.tick);
  }

  destroy(): void {
    if (!this.mounted || typeof window === "undefined") {
      return;
    }

    this.mounted = false;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
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

    this.game = {
      day: 1,
      timer: 0,
      coins: 34,
      reputation: 52,
      curiosity: 48,
      visitorsServed: 0,
      visitorsSeen: 0,
      selectedRoomId: startingRoom.id,
      unlockedRoomIds,
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
    this.viewerRoomId = null;

    this.logEvent(`The ${theme.label} museum day begins.`);
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

    this.openCallModal(this.game.pendingCall ?? randomItem(this.content.callDeck));
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

    if (miniGameId === "study-quiz") {
      this.openCallModal(randomItem(this.content.callDeck));
      return;
    }

    if (miniGameId === "estimation") {
      const scenario = randomItem(this.content.estimationDeck);
      this.game.activeModal = {
        type: "estimation",
        miniGame,
        scenario,
        guess: Math.round((scenario.min + scenario.max) / 2)
      };
      return;
    }

    if (miniGameId === "curator-check") {
      this.game.activeModal = {
        type: "curator-check",
        miniGame,
        scenario: randomItem(this.content.curatorCheckDeck)
      };
      return;
    }

    const deck = shuffle(
      this.content.matchPairsDeck.flatMap((label) => [
        { id: `${label}-a`, pair: label, label },
        { id: `${label}-b`, pair: label, label }
      ])
    ).map((card) => ({
      ...card,
      matched: false,
      revealed: false
    }));

    this.game.activeModal = {
      type: "match-pairs",
      miniGame,
      deck,
      attempts: 0,
      locked: false
    };
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

    if (this.isRoomUnlocked(room.id)) {
      if (room.photospherePath) {
        this.openRoomViewer(room.id);
        return;
      }

      this.setCuratorTarget(roomCenter(room));
    }
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
  }

  openRoomViewer(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room || !this.isRoomUnlocked(room.id) || !room.photospherePath) {
      return;
    }

    this.game.selectedRoomId = room.id;
    this.viewerRoomId = room.id;
  }

  closeRoomViewer(): void {
    this.viewerRoomId = null;
  }

  setEstimationGuess(value: number): void {
    if (this.game?.activeModal?.type !== "estimation") {
      return;
    }

    this.game.activeModal.guess = Number.parseInt(String(value), 10);
  }

  finishEstimation(): void {
    if (this.game?.activeModal?.type !== "estimation") {
      return;
    }

    const { scenario, guess } = this.game.activeModal;
    const distanceFromAnswer = Math.abs(guess - scenario.value);
    const range = Math.max(1, scenario.max - scenario.min);
    const accuracy = 1 - distanceFromAnswer / range;
    const coinReward = Math.max(4, Math.round(accuracy * 22));
    const repReward = accuracy > 0.8 ? 5 : 2;

    this.game.activeModal = null;
    this.award(
      { coins: coinReward, reputation: repReward, curiosity: 4 },
      `Estimation lab completed with ${coinReward} bonus coins.`
    );
  }

  resolveCallChoice(choiceIndex: number): void {
    if (this.game?.activeModal?.type !== "call") {
      return;
    }

    const { question } = this.game.activeModal;
    const success = choiceIndex === question.correctIndex;
    this.game.pendingCall = null;
    this.game.activeModal = null;

    if (success) {
      this.award({ coins: 14, reputation: 6, curiosity: 8 }, question.success);
      return;
    }

    this.award({ reputation: -4, curiosity: -2 }, question.failure);
  }

  resolveCuratorCheckChoice(choiceIndex: number): void {
    if (this.game?.activeModal?.type !== "curator-check") {
      return;
    }

    const { scenario } = this.game.activeModal;
    const success = choiceIndex === scenario.correctIndex;
    this.game.activeModal = null;

    if (success) {
      this.award({ coins: 10, reputation: 8, curiosity: 5 }, "Curator check solved cleanly. Visitor flow improves.");
      return;
    }

    this.award({ reputation: -3, curiosity: -1 }, "The curator check slipped. The museum loses a little confidence.");
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
        const reward = Math.max(8, 22 - modal.attempts);
        this.game.activeModal = null;
        this.award({ coins: reward, reputation: 5, curiosity: 7 }, `Match Pairs cleared in ${modal.attempts} tries.`);
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
    if (!this.lastFrame) {
      this.lastFrame = timestamp;
    }

    const deltaSeconds = Math.min(0.05, (timestamp - this.lastFrame) / 1000);
    this.lastFrame = timestamp;

    if (this.game) {
      this.updateSimulation(deltaSeconds);
    }

    this.animationFrame = window.requestAnimationFrame(this.tick);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (MOVEMENT_KEYS.has(key)) {
      this.keys.add(key);
      event.preventDefault();
    }

    if (key === "Escape") {
      if (this.viewerRoomId) {
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

  private findRoom(roomId: string): RoomBlueprint | undefined {
    return this.content.roomBlueprints.find((room) => room.id === roomId);
  }

  private findMiniGame(miniGameId: MiniGameId): MiniGameDefinition | undefined {
    return this.content.miniGames.find((miniGame) => miniGame.id === miniGameId);
  }

  private isRoomUnlocked(roomId: string): boolean {
    return this.game?.unlockedRoomIds.includes(roomId) ?? false;
  }

  private canUnlockRoom(room: RoomBlueprint): boolean {
    if (!this.game) {
      return false;
    }

    if (this.isRoomUnlocked(room.id) || this.game.coins < room.cost) {
      return false;
    }

    return room.requiredRoomIds.every((requiredId) => this.isRoomUnlocked(requiredId));
  }

  private logEvent(message: string): void {
    if (!this.game) {
      return;
    }

    const nextActivity: ActivityEntry[] = [{ id: createId(), message }, ...this.game.activity];
    this.game.activity = nextActivity.slice(0, 8);
  }

  private award(
    rewards: { coins?: number; reputation?: number; curiosity?: number },
    message: string
  ): void {
    if (!this.game) {
      return;
    }

    this.game.coins += rewards.coins ?? 0;
    this.game.reputation = clamp(this.game.reputation + (rewards.reputation ?? 0), 0, 100);
    this.game.curiosity = clamp(this.game.curiosity + (rewards.curiosity ?? 0), 0, 100);
    this.logEvent(message);
  }

  private unlockRoom(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room || !this.canUnlockRoom(room)) {
      return;
    }

    this.game.coins -= room.cost;
    this.game.unlockedRoomIds = [...this.game.unlockedRoomIds, room.id];
    this.game.selectedRoomId = room.id;
    this.logEvent(`${room.label} opened for visitors.`);
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
    this.logEvent(`Collected ${total} museum coins from the floor.`);
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
    return randomItem(unlockedRooms.filter((room) => room.id !== "foyer")) ?? this.findRoom("foyer") ?? unlockedRooms[0];
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
        dwell: 2.5 + Math.random() * 3,
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

    for (const visitor of this.game.visitors) {
      if (visitor.state === "to-room") {
        const room = this.findRoom(visitor.roomId);

        if (room && moveToward(visitor, roomCenter(room), visitor.speed, deltaSeconds)) {
          visitor.state = "dwelling";
        }
      } else if (visitor.state === "dwelling") {
        visitor.dwell -= deltaSeconds;

        if (!visitor.coinDropped && visitor.dwell <= 1.2) {
          visitor.coinDropped = true;
          const room = this.findRoom(visitor.roomId);
          this.spawnCoin({ x: visitor.x, y: visitor.y }, 6 + (room?.rewardRate ?? 1) * 2);
        }

        if (visitor.dwell <= 0) {
          visitor.state = "exit";
        }
      } else if (moveToward(visitor, entrance, visitor.speed, deltaSeconds)) {
        this.game.visitorsServed += 1;
        this.game.reputation = clamp(this.game.reputation + 1, 0, 100);
        continue;
      }

      survivors.push(visitor);
    }

    this.game.visitors = survivors;
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

  private openCallModal(question: CallQuestion): void {
    if (!this.game) {
      return;
    }

    this.closeRoomViewer();
    this.game.activeModal = {
      type: "call",
      question
    };
  }

  private openArchiveModal(focusAssetId: string | null = null): void {
    if (!this.game) {
      return;
    }

    this.closeRoomViewer();
    this.game.activeModal = {
      type: "archive",
      focusAssetId
    };
  }

  private triggerCallEvent(): void {
    if (!this.game) {
      return;
    }

    this.game.pendingCall = randomItem(this.content.callDeck);
  }

  private tourRoom(roomId: string): void {
    if (!this.game) {
      return;
    }

    const room = this.findRoom(roomId);

    if (!room || !this.isRoomUnlocked(room.id)) {
      return;
    }

    this.game.reputation = clamp(this.game.reputation + 3, 0, 100);
    this.game.curiosity = clamp(this.game.curiosity + 4, 0, 100);
    this.spawnCoin(roomCenter(room), 12 + room.rewardRate * 2);
    this.logEvent(`Guided tour hosted in ${room.label}.`);
  }

  private updateSimulation(deltaSeconds: number): void {
    if (!this.game || this.game.activeModal || this.viewerRoomId) {
      return;
    }

    this.game.timer += deltaSeconds;
    this.game.nextVisitorSpawnAt -= deltaSeconds;
    this.game.nextCallAt -= deltaSeconds;

    if (this.game.nextVisitorSpawnAt <= 0) {
      const maxVisitors = 3 + this.game.unlockedRoomIds.length;

      if (this.game.visitors.length < maxVisitors) {
        this.spawnVisitor();
      }

      this.game.nextVisitorSpawnAt = Math.max(2.4, 5.4 - this.game.unlockedRoomIds.length * 0.22);
    }

    if (this.game.nextCallAt <= 0 && !this.game.pendingCall) {
      this.triggerCallEvent();
      this.game.nextCallAt = 28;
    }

    this.updateCurator(deltaSeconds);
    this.updateVisitors(deltaSeconds);
    this.updateFloorCoins(deltaSeconds);
    this.maybeCollectCoins();
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
