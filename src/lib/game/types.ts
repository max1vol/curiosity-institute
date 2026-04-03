export interface RenderView {
  id: string;
  label: string;
  slot: number;
  imagePath: string;
  metadataPath: string;
  overlapInstruction: string;
  intersectsWith: string[];
}

export interface PhotosphereEdge {
  id: string;
  toNodeId: string;
  roomId: string;
  label: string;
  headingDeg: number;
  targetHeadingDeg: number;
  imagePath: string;
}

export type SplatFormat = "ply" | "splat" | "ksplat" | "spz";

export interface PhotosphereNode {
  id: string;
  roomId: string;
  label: string;
  imagePath: string;
  sourcePath: string;
  metadataPath: string;
  splatPath?: string;
  splatMetadataPath?: string;
  splatFormat?: SplatFormat;
  edges: PhotosphereEdge[];
}

export interface PhotosphereMap {
  roomId: string;
  startNodeId: string;
  nodes: PhotosphereNode[];
}

export interface ThemePalette {
  accent: string;
  deep: string;
  highlight: string;
  shadow: string;
}

export interface ThemeDefinition {
  id: string;
  label: string;
  starterRoomId: string;
  description: string;
  palette: ThemePalette;
  heroImage: string;
  renderViews: RenderView[];
  archiveAssetId: string;
}

export interface RoomPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomBlueprint {
  id: string;
  label: string;
  artAsset: string;
  previewAsset: string;
  blurb: string;
  cost: number;
  startUnlocked: boolean;
  requiredRoomIds: string[];
  immersiveNeighbors?: string[];
  position: RoomPosition;
  rewardRate: number;
  miniGameId?: MiniGameId;
  artPath: string;
  renderViews: RenderView[];
  photosphereMap: PhotosphereMap | null;
  photospherePath: string;
  photosphereSourcePath: string;
  photosphereMetadataPath: string;
  splatPath?: string;
  splatMetadataPath?: string;
  splatFormat?: SplatFormat;
  previewPath: string;
  previewRenderViews: RenderView[];
}

export type MiniGameId = "study-quiz" | "estimation" | "curator-check" | "match-pairs";

export interface MiniGameDefinition {
  id: MiniGameId;
  label: string;
  roomId: string;
  artAsset: string;
  description: string;
  formatNote: string;
  difficultyLabel: string;
  reward: {
    coins: number;
    reputation: number;
    curiosity: number;
  };
  artPath: string;
  renderViews: RenderView[];
  photospherePath: string;
}

export type ChallengeDifficulty = "Advanced" | "Expert";

export interface RenderLibrary {
  id: string;
  asset: string;
  label: string;
  category: string;
  manifestPath: string;
  readmePath: string;
  outputDirectory: string;
  coverageGoal: string;
  renderProfile: string;
  views: RenderView[];
}

export interface PhotosphereAsset {
  asset: string;
  imagePath: string;
  sourcePath: string;
  metadataPath: string;
  profile: string;
}

export interface SplatAsset {
  asset: string;
  splatPath: string;
  metadataPath: string;
  format: SplatFormat;
}

export interface ConceptAsset {
  id: string;
  asset: string;
  label: string;
  category: string;
  displayPath: string;
  originalPath: string;
  renderLibrary: RenderLibrary | null;
  photosphere: PhotosphereAsset | null;
  splat: SplatAsset | null;
}

export interface ConceptGroup {
  id: string;
  label: string;
  description: string;
  items: ConceptAsset[];
}

export interface CallQuestion {
  id: string;
  style: string;
  difficulty: ChallengeDifficulty;
  category: string;
  context: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  success: string;
  failure: string;
}

export interface EstimationScenario {
  id: string;
  style: string;
  difficulty: ChallengeDifficulty;
  category: string;
  clue: string;
  prompt: string;
  min: number;
  max: number;
  value: number;
  unit: string;
}

export interface CuratorCheckScenario {
  id: string;
  style: string;
  difficulty: ChallengeDifficulty;
  category: string;
  context: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export type DailyGoalKind =
  | "visitors-served"
  | "revenue-earned"
  | "rooms-opened"
  | "programs-hosted"
  | "photospheres-visited"
  | "reputation"
  | "curiosity";

export interface DailyGoal {
  id: string;
  kind: DailyGoalKind;
  label: string;
  detail: string;
  target: number;
  reward: {
    coins: number;
    reputation: number;
    curiosity: number;
  };
  completed: boolean;
}

export interface DailyGoalView extends DailyGoal {
  progress: number;
  rewardLabel: string;
}

export interface RenderLabSummary {
  profile: string | null;
  tricks: string[];
}

export interface GameContent {
  generatedAt: string;
  summary: {
    conceptArtCount: number;
    renderLibraryCount: number;
    photosphereCount: number;
    splatCount: number;
    themeCount: number;
    roomCount: number;
    miniGameCount: number;
  };
  renderLab: RenderLabSummary;
  themes: ThemeDefinition[];
  roomBlueprints: RoomBlueprint[];
  miniGames: MiniGameDefinition[];
  conceptGroups: ConceptGroup[];
  conceptArt: ConceptAsset[];
  renderLibraries: RenderLibrary[];
  callDeck: CallQuestion[];
  estimationDeck: EstimationScenario[];
  curatorCheckDeck: CuratorCheckScenario[];
  matchPairsDeck: string[];
}

export interface ActivityEntry {
  id: string;
  message: string;
}

export interface CuratorState {
  x: number;
  y: number;
  target: Point | null;
  speed: number;
  radius: number;
}

export interface VisitorState {
  id: string;
  x: number;
  y: number;
  speed: number;
  state: "to-room" | "dwelling" | "exit";
  roomId: string;
  dwell: number;
  coinDropped: boolean;
}

export interface FloorCoin {
  id: string;
  x: number;
  y: number;
  ttl: number;
  value: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface MatchCard {
  id: string;
  pair: string;
  label: string;
  matched: boolean;
  revealed: boolean;
}

export type ModalState =
  | {
      type: "call";
      question: CallQuestion;
    }
  | {
      type: "estimation";
      miniGame: MiniGameDefinition;
      scenario: EstimationScenario;
      guess: number;
    }
  | {
      type: "curator-check";
      miniGame: MiniGameDefinition;
      scenario: CuratorCheckScenario;
    }
  | {
      type: "match-pairs";
      miniGame: MiniGameDefinition;
      deck: MatchCard[];
      attempts: number;
      locked: boolean;
    }
  | {
      type: "archive";
      focusAssetId: string | null;
    };

export interface GameSession {
  day: number;
  timer: number;
  coins: number;
  reputation: number;
  curiosity: number;
  revenueEarned: number;
  visitorsServed: number;
  visitorsSeen: number;
  roomsOpenedToday: number;
  programsHosted: number;
  photospheresVisited: number;
  selectedRoomId: string;
  unlockedRoomIds: string[];
  viewedRoomIds: string[];
  recentQuestionIds: string[];
  recentEstimationIds: string[];
  recentCuratorCheckIds: string[];
  roomLevels: Record<string, number>;
  roomVisitCounts: Record<string, number>;
  dailyGoals: DailyGoal[];
  visitors: VisitorState[];
  floorCoins: FloorCoin[];
  curator: CuratorState;
  activity: ActivityEntry[];
  nextVisitorSpawnAt: number;
  nextCallAt: number;
  pendingCall: CallQuestion | null;
  activeModal: ModalState | null;
}

export interface StatCard {
  label: string;
  value: string | number;
}

export interface ViewerState {
  nodeId: string;
  yaw: number;
  pitch: number;
}

export type ViewerMoveDirection = "forward" | "back";

export interface ObjectivePill {
  label: string;
  value: string;
}

export interface RoomDetail {
  label: string;
  value: string;
  accent?: boolean;
}

export interface RoomAction {
  id: string;
  action: "unlock" | "mini-game" | "tour" | "move" | "viewer" | "upgrade";
  label: string;
  primary?: boolean;
  disabled?: boolean;
  tone?: "glow" | "dim";
}
