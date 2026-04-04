export interface RenderView {
  id: string;
  label: string;
  slot: number;
  imagePath: string;
  metadataPath: string;
  overlapInstruction: string;
  intersectsWith: string[];
}

export type Vector3Tuple = [number, number, number];

export interface ImmersiveEdge {
  id: string;
  toNodeId: string;
  roomId: string;
  label: string;
  headingDeg: number;
  targetHeadingDeg: number;
  panoramaPath: string;
  imagePath: string;
}

export type SplatFormat = "ply" | "splat" | "ksplat" | "spz";

export interface ImmersiveNode {
  id: string;
  roomId: string;
  label: string;
  panoramaPath: string;
  panoramaSourcePath: string;
  panoramaMetadataPath: string;
  imagePath: string;
  sourcePath: string;
  metadataPath: string;
  splatPath?: string;
  splatMetadataPath?: string;
  splatFormat?: SplatFormat;
  splatSceneCenter?: Vector3Tuple;
  splatLookAt?: Vector3Tuple;
  splatCameraUp?: Vector3Tuple;
  splatCameraRadius?: number;
  splatHeadingOffsetDeg?: number;
  edges: ImmersiveEdge[];
}

export interface ImmersiveMap {
  roomId: string;
  startNodeId: string;
  nodes: ImmersiveNode[];
}

export type PhotosphereEdge = ImmersiveEdge;
export type PhotosphereNode = ImmersiveNode;
export type PhotosphereMap = ImmersiveMap;

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
  diplomaRequirement: number;
  startUnlocked: boolean;
  requiredRoomIds: string[];
  immersiveNeighbors?: string[];
  position: RoomPosition;
  rewardRate: number;
  miniGameId?: MiniGameId;
  artPath: string;
  renderViews: RenderView[];
  immersiveMap: ImmersiveMap | null;
  panoramaPath: string;
  panoramaSourcePath: string;
  panoramaMetadataPath: string;
  splatPath?: string;
  splatMetadataPath?: string;
  splatFormat?: SplatFormat;
  splatSceneCenter?: Vector3Tuple;
  splatLookAt?: Vector3Tuple;
  splatCameraUp?: Vector3Tuple;
  splatCameraRadius?: number;
  splatHeadingOffsetDeg?: number;
  photosphereMap: ImmersiveMap | null;
  photospherePath: string;
  photosphereSourcePath: string;
  photosphereMetadataPath: string;
  previewPath: string;
  previewRenderViews: RenderView[];
}

export type MiniGameId = "study-quiz" | "estimation" | "curator-check" | "match-pairs";

export interface RewardBundle {
  coins?: number;
  reputation?: number;
  curiosity?: number;
  diplomas?: number;
  paper?: number;
  ink?: number;
  revisionTokens?: number;
}

export interface MiniGameDefinition {
  id: MiniGameId;
  label: string;
  roomId: string;
  subjectFocus?: string;
  artAsset: string;
  description: string;
  formatNote: string;
  difficultyLabel: string;
  reward: RewardBundle;
  artPath: string;
  renderViews: RenderView[];
  panoramaPath: string;
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

export interface PanoramaAsset {
  asset: string;
  panoramaPath: string;
  panoramaSourcePath: string;
  panoramaMetadataPath: string;
  imagePath: string;
  sourcePath: string;
  metadataPath: string;
  profile: string;
}

export type PhotosphereAsset = PanoramaAsset;

export interface SplatAsset {
  asset: string;
  splatPath: string;
  metadataPath: string;
  format: SplatFormat;
  sceneCenter?: Vector3Tuple;
  lookAt?: Vector3Tuple;
  cameraUp?: Vector3Tuple;
  cameraRadius?: number;
  headingOffsetDeg?: number;
}

export interface ConceptAsset {
  id: string;
  asset: string;
  label: string;
  category: string;
  displayPath: string;
  originalPath: string;
  renderLibrary: RenderLibrary | null;
  panorama: PanoramaAsset | null;
  photosphere: PanoramaAsset | null;
  splat: SplatAsset | null;
}

export interface ConceptGroup {
  id: string;
  label: string;
  description: string;
  items: ConceptAsset[];
}

export interface McqQuestion {
  id: string;
  style: string;
  difficulty: ChallengeDifficulty;
  subject: string;
  topic: string;
  category: string;
  context: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  success: string;
  failure: string;
}

export type CallQuestion = McqQuestion;

export interface FreeTextQuestion {
  id: string;
  style: string;
  difficulty: ChallengeDifficulty;
  subject: string;
  topic: string;
  category: string;
  context: string;
  prompt: string;
  placeholder: string;
  acceptedAnswers: string[];
  modelAnswer: string;
  success: string;
  failure: string;
}

export type EstimationScenario = FreeTextQuestion;

export interface QuizQuestion {
  id: string;
  style: string;
  difficulty: ChallengeDifficulty;
  subject: string;
  topic: string;
  category: string;
  context: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

export type CuratorCheckScenario = QuizQuestion;

export interface MatchPairDefinition {
  id: string;
  subject: string;
  left: string;
  right: string;
}

export type QuestTrigger =
  | "mcq-failure"
  | "mcq-mastery"
  | "quiz-failure"
  | "quiz-mastery"
  | "free-text-failure"
  | "free-text-mastery"
  | "locked-submission"
  | "match-pairs-failure"
  | "match-pairs-mastery"
  | "mastery-review"
  | "final-diploma-test";

export interface QuestResourceReward {
  paper: number;
  ink: number;
  revisionTokens: number;
}

export interface StudyResources extends QuestResourceReward {}

export interface QuestDefinition {
  id: string;
  title: string;
  detail: string;
  trigger: QuestTrigger;
  resourceReward: QuestResourceReward;
}

export type QuestStage = "improvement" | "final-ready";

export interface QuestState extends QuestDefinition {
  createdAtDay: number;
  stage: QuestStage;
  subject: string;
  topic: string;
  sourceMode: StudyMode;
  sourceQuestionId: string;
  requiredSuccesses: number;
  currentSuccesses: number;
  focusPrompt: string;
  performanceSummary: string;
}

export type StudyMode = "quiz" | "free-text" | "mcq" | "match-pairs";
export type FinalTestMode = Exclude<StudyMode, "match-pairs">;
export type StudyStage = "resource-test" | "quest-test" | "final-test";

export type DailyGoalKind =
  | "rooms-opened"
  | "diplomas-earned"
  | "challenge-completed"
  | "mcq-completed"
  | "quiz-completed"
  | "free-text-completed"
  | "match-pairs-completed"
  | "immersive-scenes-visited"
  | "quests-completed";

export interface DailyGoal {
  id: string;
  kind: DailyGoalKind;
  label: string;
  detail: string;
  target: number;
  reward: QuestResourceReward;
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
    immersiveCount: number;
    panoramaCount: number;
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
  mcqDeck: McqQuestion[];
  quizDeck: QuizQuestion[];
  freeTextDeck: FreeTextQuestion[];
  matchPairDeck: MatchPairDefinition[];
  questDeck: QuestDefinition[];
  studyModeWeights: Record<StudyMode, number>;
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

export interface PerformanceRecord {
  id: string;
  subject: string;
  topic: string;
  attempts: number;
  successes: number;
  failures: number;
  lastMode: StudyMode;
  lastQuestionId: string;
  lastPrompt: string;
}

export interface FinalTestState {
  id: string;
  questId: string;
  subject: string;
  topic: string;
  mode: FinalTestMode;
  title: string;
  detail: string;
  attempts: number;
}

export type ModalState =
  | {
      type: "mcq";
      stage: StudyStage;
      questId: string | null;
      miniGame: MiniGameDefinition | null;
      question: McqQuestion;
    }
  | {
      type: "free-text";
      stage: StudyStage;
      questId: string | null;
      miniGame: MiniGameDefinition | null;
      question: FreeTextQuestion;
      answer: string;
    }
  | {
      type: "quiz";
      stage: StudyStage;
      questId: string | null;
      miniGame: MiniGameDefinition | null;
      question: QuizQuestion;
    }
  | {
      type: "match-pairs";
      stage: Exclude<StudyStage, "final-test">;
      questId: string | null;
      miniGame: MiniGameDefinition | null;
      subject: string;
      topic: string;
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
  diplomas: number;
  reputation: number;
  curiosity: number;
  revenueEarned: number;
  visitorsServed: number;
  visitorsSeen: number;
  roomsOpenedToday: number;
  programsHosted: number;
  immersiveVisits: number;
  photospheresVisited: number;
  resources: StudyResources;
  activeQuests: QuestState[];
  activeFinalTests: FinalTestState[];
  performanceRecords: PerformanceRecord[];
  questsCompleted: number;
  completedMcqCount: number;
  completedQuizCount: number;
  completedFreeTextCount: number;
  completedMatchPairsCount: number;
  selectedRoomId: string;
  unlockedRoomIds: string[];
  viewedRoomIds: string[];
  recentMcqIds: string[];
  recentFreeTextIds: string[];
  recentQuizIds: string[];
  recentFinalQuestionIds: string[];
  recentQuestIds: string[];
  roomLevels: Record<string, number>;
  roomVisitCounts: Record<string, number>;
  dailyGoals: DailyGoal[];
  visitors: VisitorState[];
  floorCoins: FloorCoin[];
  curator: CuratorState;
  activity: ActivityEntry[];
  nextVisitorSpawnAt: number;
  nextCallAt: number;
  pendingCall: StudyMode | null;
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
