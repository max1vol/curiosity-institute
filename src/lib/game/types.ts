export interface RenderView {
  id: string;
  label: string;
  slot: number;
  imagePath: string;
  metadataPath: string;
  overlapInstruction: string;
  intersectsWith: string[];
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
  position: RoomPosition;
  rewardRate: number;
  miniGameId?: MiniGameId;
  artPath: string;
  renderViews: RenderView[];
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
  reward: {
    coins: number;
    reputation: number;
    curiosity: number;
  };
  artPath: string;
  renderViews: RenderView[];
}

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

export interface ConceptAsset {
  id: string;
  asset: string;
  label: string;
  category: string;
  originalPath: string;
  renderLibrary: RenderLibrary | null;
}

export interface ConceptGroup {
  id: string;
  label: string;
  description: string;
  items: ConceptAsset[];
}

export interface CallQuestion {
  prompt: string;
  choices: string[];
  correctIndex: number;
  success: string;
  failure: string;
}

export interface EstimationScenario {
  prompt: string;
  min: number;
  max: number;
  value: number;
  unit: string;
}

export interface CuratorCheckScenario {
  prompt: string;
  choices: string[];
  correctIndex: number;
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
  visitorsServed: number;
  visitorsSeen: number;
  selectedRoomId: string;
  unlockedRoomIds: string[];
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

export interface ObjectivePill {
  label: string;
  value: string;
}

export interface RoomAction {
  id: string;
  action: "unlock" | "mini-game" | "tour" | "move";
  label: string;
  primary?: boolean;
  disabled?: boolean;
}
