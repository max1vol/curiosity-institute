import "./styles.css";
import {
  buildInitialDistrictState,
  confidenceOptions,
  districtOrder,
  districts,
  districtsById,
  learningPlans,
  quizzes,
  quizzesByDistrict,
  researchNodesByDistrict,
  worldMessages,
  type ComparisonDirection,
  type ConfidenceOption,
  type District,
  type DistrictId,
  type DistrictLearningPlan,
  type DistrictResearchNode,
  type DistrictProgressMap,
  type PracticePrompt,
  type Quiz,
  type QuizRound,
} from "./gameData";

type SheetView =
  | "facility"
  | "study"
  | "practice"
  | "test"
  | "ledger"
  | "build"
  | "research"
  | "battle"
  | "council";

type QuizOutcome = {
  correct: boolean;
  points: number;
  percentile: number;
  accuracy: number;
  casualties: number;
  guessLabel: string;
  actualLabel: string;
  summary: string;
};

type IntervalDraft = {
  lower: string;
  upper: string;
};

type ComparisonDraft = {
  direction: ComparisonDirection | null;
  confidence: ConfidenceOption;
};

type PracticeDraft = Partial<Record<string, string>>;

type PracticeFeedback = {
  promptId: string;
  promptTitle: string;
  correct: boolean;
  selectedLabel: string;
  correctLabel: string;
  explanation: string;
};

type PracticeOutcome = {
  passed: boolean;
  score: number;
  total: number;
  summary: string;
  feedback: PracticeFeedback[];
};

type DistrictTrainingState = {
  studied: boolean;
  practicePassed: boolean;
  practiceAttempts: number;
  studyVisits: number;
  remediationRequired: boolean;
  incidents: number;
  losses: number;
};

type DistrictTrainingMap = Record<DistrictId, DistrictTrainingState>;

type DistrictProjectState = {
  built: boolean;
};

type DistrictProjectMap = Record<DistrictId, DistrictProjectState>;

type AppState = {
  selectedDistrictId: DistrictId;
  districtProgress: DistrictProgressMap;
  training: DistrictTrainingMap;
  projects: DistrictProjectMap;
  answeredQuizIds: string[];
  score: number;
  wisdom: number;
  citizens: number;
  prestige: number;
  currentRound: QuizRound;
  activeSheet: SheetView | null;
  activeQuizId: string | null;
  currentOutcome: QuizOutcome | null;
  intervalDraft: IntervalDraft;
  comparisonDraft: ComparisonDraft;
  practiceDraft: PracticeDraft;
  practiceOutcome: PracticeOutcome | null;
  battle: BattleState;
  eventLog: string[];
  messageIndex: number;
  clock: number;
};

type ResearchNodeStatus = {
  state: "locked" | "ready" | "online" | "offline";
  label: string;
  detail: string;
};

type BattleQuestion = {
  id: string;
  title: string;
  prompt: string;
  answer: number;
  choices: number[];
  unit: string;
  warrior: string;
  difficulty: string;
};

type BattleState = {
  districtId: DistrictId | null;
  waveIndex: number;
  selectedChoice: number | null;
  front: number;
  correct: number;
  losses: number;
  log: string[];
  finished: boolean;
};

type DistrictFacilityProfile = {
  name: string;
  subtitle: string;
  stations: [string, string, string];
};

type CityOrder = {
  id: string;
  districtId: DistrictId;
  title: string;
  summary: string;
  reward: string;
  sheet: SheetView;
  status: "critical" | "ready" | "stable";
  statusLabel: string;
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

const root = app;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));

const formatSubjectLabel = (subject: District["subject"]) =>
  subject === "dte" ? "DTE" : subject.charAt(0).toUpperCase() + subject.slice(1);

const districtFacilities: Record<DistrictId, DistrictFacilityProfile> = {
  laboratory: {
    name: "Chemistry Lab",
    subtitle: "Use fair tests, safe variables, and measured evidence before science goes live.",
    stations: ["Primer bench", "Reaction drill", "Deployment trial"],
  },
  workshop: {
    name: "Fabrication Floor",
    subtitle: "Transfer accurate units and strong structures into practical build work.",
    stations: ["Draft table", "Frame drill", "Yard trial"],
  },
  observatory: {
    name: "Proof Engine",
    subtitle: "Lock the pattern first, then push number sense into a fresh problem under pressure.",
    stations: ["Pattern desk", "Logic drill", "Signal trial"],
  },
  scriptorium: {
    name: "Writers Desk",
    subtitle: "Teach grammar and meaning, then adapt language precisely before public use.",
    stations: ["Rule shelf", "Language drill", "Script trial"],
  },
  archive: {
    name: "Source Chamber",
    subtitle: "Order chronology, read evidence carefully, and stop unsupported claims before they spread.",
    stations: ["Timeline wall", "Evidence drill", "Record trial"],
  },
  harbour: {
    name: "Map Room",
    subtitle: "Use direction, place, and feature knowledge before the city relies on routes or coasts.",
    stations: ["Chart table", "Route drill", "Survey trial"],
  },
};

const buildInitialTrainingState = (): DistrictTrainingMap =>
  districtOrder.reduce(
    (accumulator, districtId) => {
      accumulator[districtId] = {
        studied: false,
        practicePassed: false,
        practiceAttempts: 0,
        studyVisits: 0,
        remediationRequired: false,
        incidents: 0,
        losses: 0,
      };
      return accumulator;
    },
    {} as DistrictTrainingMap,
  );

const buildInitialProjectState = (): DistrictProjectMap =>
  districtOrder.reduce(
    (accumulator, districtId) => {
      accumulator[districtId] = {
        built: false,
      };
      return accumulator;
    },
    {} as DistrictProjectMap,
  );

const buildInitialBattleState = (districtId: DistrictId | null = null): BattleState => ({
  districtId,
  waveIndex: 0,
  selectedChoice: null,
  front: 18,
  correct: 0,
  losses: 0,
  log: [],
  finished: false,
});

const spriteCache = new Map<DistrictId, HTMLImageElement>();

const loadDistrictSprites = () => {
  spriteCache.clear();
};

const state: AppState = {
  selectedDistrictId: districtOrder[0],
  districtProgress: buildInitialDistrictState(),
  training: buildInitialTrainingState(),
  projects: buildInitialProjectState(),
  answeredQuizIds: [],
  score: 0,
  wisdom: 0,
  citizens: 120,
  prestige: 0,
  currentRound: 1,
  activeSheet: null,
  activeQuizId: null,
  currentOutcome: null,
  intervalDraft: { lower: "", upper: "" },
  comparisonDraft: { direction: null, confidence: 65 },
  practiceDraft: {},
  practiceOutcome: null,
  battle: buildInitialBattleState(),
  eventLog: ["The academy now runs six subject districts: science, DTE, maths, English, history, and geography."],
  messageIndex: 0,
  clock: 0,
};

const getSelectedDistrict = () => districtsById[state.selectedDistrictId];

const getSelectedPlan = () => learningPlans[state.selectedDistrictId];

const getTraining = (districtId = state.selectedDistrictId) => state.training[districtId];

const getProjectState = (districtId = state.selectedDistrictId) => state.projects[districtId];

const getQuizById = (quizId: string | null) => quizzes.find((quiz) => quiz.id === quizId) ?? null;

const getTotalLosses = () =>
  districtOrder.reduce((total, districtId) => total + state.training[districtId].losses, 0);

const getTotalIncidents = () =>
  districtOrder.reduce((total, districtId) => total + state.training[districtId].incidents, 0);

const buildRecoveryPrompts = (districtId: DistrictId): PracticePrompt[] => {
  const plan = learningPlans[districtId];
  const distractorPool = districtOrder
    .filter((entry) => entry !== districtId)
    .flatMap((entry) => learningPlans[entry].studyCards.map((card) => card.summary));

  return plan.studyCards.map((card, index) => {
    const siblingSummary =
      plan.studyCards[(index + 1) % plan.studyCards.length]?.summary ?? distractorPool[0] ?? card.summary;
    const globalSummary =
      distractorPool[(districtOrder.indexOf(districtId) + index) % Math.max(distractorPool.length, 1)] ??
      siblingSummary;
    const correctOption = {
      id: `${districtId}-recovery-${index}-correct`,
      label: card.summary,
      correct: true,
      feedback: `Right. ${card.summary}`,
    };
    const siblingOption = {
      id: `${districtId}-recovery-${index}-sibling`,
      label: siblingSummary,
      correct: false,
      feedback: `That note is not specific enough for this recovery. ${card.summary}`,
    };
    const globalOption = {
      id: `${districtId}-recovery-${index}-global`,
      label: globalSummary,
      correct: false,
      feedback: `That note belongs elsewhere. ${card.summary}`,
    };

    return {
      id: `${districtId}-recovery-${index}`,
      title: `Recovery Memory ${index + 1}`,
      situation: card.example,
      question: `Which study note should control the district's recovery here?`,
      options: index % 2 === 0 ? [correctOption, siblingOption, globalOption] : [siblingOption, globalOption, correctOption],
    };
  });
};

const getActivePracticePrompts = (districtId = state.selectedDistrictId) => {
  const plan = learningPlans[districtId];
  const training = state.training[districtId];

  return training.remediationRequired
    ? [...plan.practicePrompts, ...buildRecoveryPrompts(districtId)]
    : plan.practicePrompts;
};

const getResearchNodeStatus = (districtId: DistrictId, node: DistrictResearchNode): ResearchNodeStatus => {
  const training = state.training[districtId];
  const progress = state.districtProgress[districtId];
  const project = state.projects[districtId];

  if (training.remediationRequired && node.tier > 1) {
    return {
      state: "offline",
      label: "Offline after incident",
      detail: "The district must clear its longer recovery drill before higher technologies can be used again.",
    };
  }

  if (node.tier === 1) {
    return training.studied
      ? {
          state: "online",
          label: "Study unlocked",
          detail: "Base knowledge is stable enough for this technology route.",
        }
      : {
          state: "locked",
          label: "Study required",
          detail: "Review the district study sheet to stabilise the first technology node.",
        };
  }

  if (node.tier === 2) {
    return training.practicePassed && progress.completed >= 1
      ? {
          state: "ready",
          label: "Field-ready",
          detail: "The district has passed practice and cleared an estimate test, so this node can be deployed.",
        }
      : {
          state: "locked",
          label: "Test and practice required",
          detail: "Clear the adaptation drill and at least one district test before this node goes live.",
        };
  }

  return project.built && progress.completed >= 3
    ? {
        state: "online",
        label: "City-wide deployment",
        detail: "The district project is built and the higher knowledge line is now safe to use.",
      }
    : {
        state: "locked",
        label: "Project required",
        detail: "Raise the district project and clear deeper mastery before this final technology can be trusted.",
      };
};

const resetDrafts = () => {
  state.intervalDraft = { lower: "", upper: "" };
  state.comparisonDraft = { direction: null, confidence: 65 };
};

const resetPracticeDraft = () => {
  state.practiceDraft = {};
  state.practiceOutcome = null;
};

const countRoundAnswers = (round: QuizRound) =>
  state.answeredQuizIds.filter((quizId) => quizzes.find((quiz) => quiz.id === quizId)?.round === round)
    .length;

const getDistrictCompletion = (districtId: DistrictId) => {
  const districtQuizzes = quizzesByDistrict[districtId] ?? [];
  const completed = districtQuizzes.filter((quiz) => state.answeredQuizIds.includes(quiz.id)).length;
  return {
    completed,
    total: districtQuizzes.length,
    roundOneComplete: districtQuizzes
      .filter((quiz) => quiz.round === 1)
      .every((quiz) => state.answeredQuizIds.includes(quiz.id)),
  };
};

const buildBattleChoices = (quiz: Quiz, index: number) => {
  const span = Math.max(1, Math.round((quiz.max - quiz.min) / (quiz.round === 2 ? 12 : 8)));
  const low = clamp(quiz.answer - span * (index % 2 === 0 ? 2 : 1), quiz.min, quiz.max);
  const high = clamp(quiz.answer + span * (index % 2 === 0 ? 1 : 2), quiz.min, quiz.max);
  const ordered = [
    [low, quiz.answer, high],
    [quiz.answer, high, low],
    [high, low, quiz.answer],
    [low, high, quiz.answer],
  ][index % 4];

  return Array.from(new Set(ordered));
};

const getBattleQuestions = (districtId: DistrictId): BattleQuestion[] => {
  const progress = state.districtProgress[districtId];
  const project = state.projects[districtId];
  const pool = [...(quizzesByDistrict[districtId] ?? [])];
  const ordered =
    project.built || progress.completed >= 3
      ? pool.sort((left, right) => right.round - left.round || right.answer - left.answer)
      : pool.sort((left, right) => left.round - right.round || left.answer - right.answer);
  const warriorSets =
    project.built || progress.completed >= 3
      ? ["Veteran Guard", "Siege Scholar", "Champion Cohort", "Royal Engine"]
      : progress.completed >= 1
        ? ["Town Guard", "Shield Line", "Crossbow Band", "Watch Captain"]
        : ["Militia", "Scout Pair", "Apprentice Guard", "Gate Runner"];

  return ordered.slice(0, 4).map((quiz, index) => ({
    id: `${districtId}-battle-${quiz.id}`,
    title: quiz.title,
    prompt: quiz.question,
    answer: quiz.answer,
    choices: buildBattleChoices(quiz, index),
    unit: quiz.unit,
    warrior: warriorSets[index] ?? warriorSets[warriorSets.length - 1],
    difficulty: project.built || progress.completed >= 3 ? "Veteran front" : "Training front",
  }));
};

const resetBattle = (districtId = state.selectedDistrictId) => {
  state.battle = buildInitialBattleState(districtId);
};

const ensureBattleState = (districtId = state.selectedDistrictId) => {
  if (state.battle.districtId !== districtId || state.battle.finished) {
    resetBattle(districtId);
  }
};

const getNextQuizForDistrict = (districtId: DistrictId) => {
  const available = (quizzesByDistrict[districtId] ?? []).filter(
    (quiz) => !state.answeredQuizIds.includes(quiz.id),
  );

  if (state.currentRound === 1) {
    return available.find((quiz) => quiz.round === 1) ?? null;
  }

  return (
    available.sort((left, right) => {
      if (left.round !== right.round) {
        return left.round - right.round;
      }

      return left.id.localeCompare(right.id);
    })[0] ?? null
  );
};

const getDistrictRequirement = (districtId: DistrictId) => {
  const progress = state.districtProgress[districtId];
  const training = state.training[districtId];
  const nextQuiz = getNextQuizForDistrict(districtId);

  if (!progress.unlocked) {
    return "Unlock the previous district first.";
  }

  if (!training.studied) {
    return "Study the base rule sheet.";
  }

  if (training.remediationRequired) {
    return "Recovery drill required after a failed deployment.";
  }

  if (!training.practicePassed) {
    return "Pass the adaptation drill.";
  }

  if (!nextQuiz) {
    return "District mastered for this round.";
  }

  return `Estimate test ready: ${nextQuiz.title}.`;
};

const getMasteryPercent = (districtId: DistrictId) => {
  const completion = getDistrictCompletion(districtId);
  const training = state.training[districtId];
  const quizShare = completion.total === 0 ? 0 : (completion.completed / completion.total) * 60;
  const studyShare = training.studied ? 20 : 0;
  const practiceShare = training.practicePassed ? 20 : 0;
  return clamp(Math.round(quizShare + studyShare + practiceShare), 0, 100);
};

const canBuildProject = (districtId: DistrictId) =>
  state.districtProgress[districtId].completed >= 1 &&
  !state.projects[districtId].built &&
  !state.training[districtId].remediationRequired;

const getCitySafety = () => {
  const incidents = getTotalIncidents();
  const losses = getTotalLosses();

  if (incidents === 0 && losses === 0) {
    return "Secure";
  }

  if (incidents <= 3 && losses <= 18) {
    return "Watch";
  }

  return "Strained";
};

const getCitySupplies = () => {
  const builtCount = districtOrder.filter((districtId) => state.projects[districtId].built).length;
  return 40 + builtCount * 14 + state.answeredQuizIds.length * 3 + state.wisdom / 20;
};

const getCityMorale = () => {
  const restoredDistricts = districtOrder.filter((districtId) => state.districtProgress[districtId].stage >= 3)
    .length;
  const morale = 34 + restoredDistricts * 10 + state.prestige / 9 - getTotalIncidents() * 6;
  return clamp(Math.round(morale), 0, 100);
};

const getCityOrders = (): CityOrder[] =>
  districts
    .filter((district) => state.districtProgress[district.id].unlocked)
    .map<CityOrder>((district) => {
      const training = state.training[district.id];
      const project = state.projects[district.id];
      const nextQuiz = getNextQuizForDistrict(district.id);

      if (training.remediationRequired) {
        return {
          id: `${district.id}-recovery`,
          districtId: district.id,
          title: "Recovery Lockdown",
          summary: `${district.name} caused losses after a failed deployment. Re-teach the base rule and clear the longer recovery drill before any higher technology comes back online.`,
          reward: "Restores safe technology use",
          sheet: "practice",
          status: "critical",
          statusLabel: "Emergency drill",
        };
      }

      if (!training.studied) {
        return {
          id: `${district.id}-study`,
          districtId: district.id,
          title: "Base Knowledge Briefing",
          summary: `Open ${districtFacilities[district.id].name} and stabilise the first rule set before the city trusts this district's tech line.`,
          reward: "Unlocks tier 1 technology",
          sheet: "facility",
          status: "ready",
          statusLabel: "Brief district",
        };
      }

      if (!training.practicePassed) {
        return {
          id: `${district.id}-practice`,
          districtId: district.id,
          title: "Adaptation Drill",
          summary: `Run the district drill and prove that you can transfer the knowledge to a fresh situation rather than copying the study sheet.`,
          reward: "Opens the district trial",
          sheet: "practice",
          status: "ready",
          statusLabel: "Run drill",
        };
      }

      if (nextQuiz) {
        return {
          id: `${district.id}-trial`,
          districtId: district.id,
          title: "Deployment Trial",
          summary: `Clear ${nextQuiz.title} to move the district forward. A bad call locks technology and costs citizens, so the knowledge must be applied correctly.`,
          reward: "Raises mastery and the frontier",
          sheet: "test",
          status: "ready",
          statusLabel: "Launch trial",
        };
      }

      if (canBuildProject(district.id)) {
        return {
          id: `${district.id}-build`,
          districtId: district.id,
          title: "Raise Civic Upgrade",
          summary: `The district has enough proof to turn its knowledge into permanent city structure through ${learningPlans[district.id].cityProjectName}.`,
          reward: "Improves the world map",
          sheet: "build",
          status: "ready",
          statusLabel: "Start upgrade",
        };
      }

      if (!project.built) {
        return {
          id: `${district.id}-research`,
          districtId: district.id,
          title: "Deepen the Tech Line",
          summary: `${district.name} is stable, but higher research still needs more mastery and a district project before city-wide use is safe.`,
          reward: "Pushes deeper research tiers",
          sheet: "research",
          status: "stable",
          statusLabel: "Review tech",
        };
      }

      return {
        id: `${district.id}-battle`,
        districtId: district.id,
        title: "Battle Rush Rotation",
        summary: `Use ${district.name}'s knowledge line on the automated front. Better district progress fields stronger warriors and harder rush questions.`,
        reward: "Raises score and frontier pressure",
        sheet: "battle",
        status: "stable",
        statusLabel: "Deploy front",
      };
    })
    .slice(0, 6);

const updateTotals = () => {
  const totalCompleted = state.answeredQuizIds.length;
  const studiedCount = districtOrder.filter((districtId) => state.training[districtId].studied).length;
  const practicePassedCount = districtOrder.filter(
    (districtId) => state.training[districtId].practicePassed,
  ).length;
  const builtCount = districtOrder.filter((districtId) => state.projects[districtId].built).length;
  const restoredDistricts = Object.values(state.districtProgress).filter((district) => district.stage >= 3)
    .length;
  const totalLosses = getTotalLosses();
  const totalIncidents = getTotalIncidents();

  state.wisdom =
    totalCompleted * 18 + studiedCount * 12 + practicePassedCount * 18 + builtCount * 20 + restoredDistricts * 12;
  state.citizens = Math.max(
    0,
    120 + totalCompleted * 14 + practicePassedCount * 26 + builtCount * 34 + restoredDistricts * 36 - totalLosses,
  );
  state.prestige = clamp(
    Math.round(state.score / 14) +
      studiedCount * 8 +
      practicePassedCount * 12 +
      builtCount * 22 -
      totalIncidents * 12 -
      Math.round(totalLosses / 3),
    0,
    999,
  );
};

const pushEvent = (entry: string) => {
  state.eventLog.unshift(entry);
  state.eventLog = state.eventLog.slice(0, 6);
};

const unlockNextDistrict = (districtId: DistrictId) => {
  const currentIndex = districtOrder.findIndex((entry) => entry === districtId);
  const nextDistrictId = districtOrder[currentIndex + 1];

  if (!nextDistrictId) {
    return;
  }

  const current = state.districtProgress[districtId];
  const next = state.districtProgress[nextDistrictId];

  if (!next.unlocked && current.completed >= 2) {
    next.unlocked = true;
    pushEvent(`${districtsById[nextDistrictId].name} has opened for a new lesson line.`);
  }
};

const maybeAdvanceRound = () => {
  const roundOneRequirement = Math.max(8, districtOrder.length * 2);

  if (state.currentRound === 1 && countRoundAnswers(1) >= roundOneRequirement) {
    state.currentRound = 2;
    pushEvent("Round 2 unlocked: the city now allows faster Above or Below judgment tests.");
  }
};

const hydrateNextQuiz = () => {
  if (state.currentOutcome || getQuizById(state.activeQuizId)) {
    return;
  }

  const nextQuiz = getNextQuizForDistrict(state.selectedDistrictId);
  state.activeQuizId = nextQuiz?.id ?? null;
  resetDrafts();
};

const openSheet = (sheet: SheetView) => {
  state.activeSheet = sheet;

  if (sheet === "test") {
    hydrateNextQuiz();
  }

  if (sheet === "battle") {
    ensureBattleState();
  }

  renderApp();
};

const focusDistrictAndOpen = (districtId: DistrictId, sheet: SheetView) => {
  const progress = state.districtProgress[districtId];

  if (!progress.unlocked) {
    return;
  }

  state.selectedDistrictId = districtId;
  state.activeQuizId = null;
  state.currentOutcome = null;
  resetDrafts();
  resetPracticeDraft();
  state.activeSheet = sheet;

  if (sheet === "test") {
    hydrateNextQuiz();
  }

  if (sheet === "battle") {
    ensureBattleState(districtId);
  }

  renderApp();
};

const calculateIntervalOutcome = (quiz: Quiz, lowerRaw: number, upperRaw: number): QuizOutcome => {
  const lower = clamp(Math.min(lowerRaw, upperRaw), quiz.min, quiz.max);
  const upper = clamp(Math.max(lowerRaw, upperRaw), quiz.min, quiz.max);
  const contains = lower <= quiz.answer && quiz.answer <= upper;
  const span = Math.max(upper - lower, 1);
  const range = quiz.max - quiz.min;
  const widthRatio = clamp(span / range, 0.01, 1);
  const centre = (lower + upper) / 2;
  const proximity = 1 - clamp(Math.abs(centre - quiz.answer) / range, 0, 1);

  const points = contains
    ? Math.round(120 + proximity * 44 - widthRatio * 72)
    : -Math.round(22 + Math.max(0, 0.32 - widthRatio) * 110 + (1 - proximity) * 30);

  const percentile = contains
    ? clamp(Math.round(58 + (1 - widthRatio) * 24 + proximity * 12), 50, 99)
    : clamp(Math.round(16 + (1 - widthRatio) * 16), 5, 42);

  return {
    correct: contains,
    points,
    percentile,
    accuracy: clamp(Math.round(proximity * 100), 1, 99),
    casualties: contains ? 0 : 8,
    guessLabel: `${formatNumber(lower)} to ${formatNumber(upper)} ${quiz.unit}`,
    actualLabel: `${formatNumber(quiz.answer)} ${quiz.unit}`,
    summary: contains
      ? "Your interval captured the answer and kept the district moving."
      : "Your interval missed the answer, the district used the technology badly, and a longer recovery drill is now required.",
  };
};

const calculateComparisonOutcome = (
  quiz: Quiz,
  direction: ComparisonDirection,
  confidence: ConfidenceOption,
): QuizOutcome => {
  const correct = direction === quiz.comparisonAnswer;
  const rewardMap: Record<ConfidenceOption, number> = {
    55: 24,
    65: 40,
    75: 58,
    85: 78,
  };
  const penaltyMap: Record<ConfidenceOption, number> = {
    55: -10,
    65: -18,
    75: -30,
    85: -44,
  };
  const casualtyMap: Record<ConfidenceOption, number> = {
    55: 6,
    65: 10,
    75: 14,
    85: 18,
  };

  return {
    correct,
    points: correct ? rewardMap[confidence] : penaltyMap[confidence],
    percentile: correct ? clamp(52 + confidence / 2, 50, 96) : clamp(40 - confidence / 3, 6, 38),
    accuracy: correct ? confidence : clamp(100 - confidence, 15, 45),
    casualties: correct ? 0 : casualtyMap[confidence],
    guessLabel: `${direction === "above" ? "Above" : "Below"} ${formatNumber(
      quiz.comparisonValue ?? 0,
    )} ${quiz.unit} at ${confidence}% confidence`,
    actualLabel: `${formatNumber(quiz.answer)} ${quiz.unit}`,
    summary: correct
      ? "Your quick judgment held under pressure."
      : "The fast call missed, the city deployed the knowledge badly, and the district has reopened a longer recovery drill.",
  };
};

const recordOutcome = (quiz: Quiz, outcome: QuizOutcome) => {
  state.currentOutcome = outcome;
  state.answeredQuizIds = [...state.answeredQuizIds, quiz.id];
  state.score += outcome.points;

  const progress = state.districtProgress[quiz.districtId];
  progress.completed += 1;
  progress.stage = clamp(progress.completed, 0, 5);
  progress.bestScore = Math.max(progress.bestScore, outcome.points);
  progress.history.unshift({
    quizId: quiz.id,
    points: outcome.points,
    accuracy: outcome.accuracy,
  });
  progress.history = progress.history.slice(0, 4);

  const training = state.training[quiz.districtId];

  if (!outcome.correct) {
    training.practicePassed = false;
    training.remediationRequired = true;
    training.incidents += 1;
    training.losses += outcome.casualties;
  }

  unlockNextDistrict(quiz.districtId);
  maybeAdvanceRound();
  updateTotals();

  pushEvent(
    outcome.correct
      ? `${quiz.title}: success in ${districtsById[quiz.districtId].name} (${outcome.points >= 0 ? "+" : ""}${outcome.points}).`
      : `${quiz.title}: failed deployment in ${districtsById[quiz.districtId].name}. ${outcome.casualties} citizens were lost and a recovery drill is now required.`,
  );
};

const submitCurrentQuiz = () => {
  const quiz = getQuizById(state.activeQuizId);

  if (!quiz) {
    return;
  }

  const outcome =
    quiz.round === 1
      ? calculateIntervalOutcome(quiz, Number(state.intervalDraft.lower), Number(state.intervalDraft.upper))
      : calculateComparisonOutcome(
          quiz,
          state.comparisonDraft.direction ?? "above",
          state.comparisonDraft.confidence,
        );

  recordOutcome(quiz, outcome);
  renderApp();
};

const selectDistrict = (districtId: DistrictId) => {
  const progress = state.districtProgress[districtId];

  if (!progress.unlocked) {
    return;
  }

  state.selectedDistrictId = districtId;
  state.activeQuizId = null;
  state.currentOutcome = null;
  resetDrafts();
  resetPracticeDraft();

  if (state.activeSheet === "test") {
    hydrateNextQuiz();
  }

  if (state.activeSheet === "battle") {
    ensureBattleState(districtId);
  }

  renderApp();
};

const markStudyReady = () => {
  const district = getSelectedDistrict();
  const training = getTraining();

  training.studied = true;
  training.studyVisits += 1;
  resetPracticeDraft();
  updateTotals();
  pushEvent(`${district.name}: study sheet reviewed. Apply the rule correctly to unlock the test.`);
  state.activeSheet = "practice";
  renderApp();
};

const completeProject = () => {
  const district = getSelectedDistrict();
  const plan = getSelectedPlan();
  const project = getProjectState();

  if (!canBuildProject(district.id) || project.built) {
    return;
  }

  project.built = true;
  updateTotals();
  pushEvent(`${plan.cityProjectName} has been raised in ${district.name}. ${plan.cityProjectEffect}`);
  state.activeSheet = "build";
  renderApp();
};

const buildPracticeFeedback = (prompt: PracticePrompt): PracticeFeedback => {
  const selectedId = state.practiceDraft[prompt.id];
  const selectedOption = prompt.options.find((option) => option.id === selectedId);
  const correctOption = prompt.options.find((option) => option.correct);

  if (!correctOption) {
    throw new Error(`Prompt ${prompt.id} is missing a correct option.`);
  }

  return {
    promptId: prompt.id,
    promptTitle: prompt.title,
    correct: Boolean(selectedOption?.correct),
    selectedLabel: selectedOption?.label ?? "No answer selected",
    correctLabel: correctOption.label,
    explanation: selectedOption?.feedback ?? "Select an answer before submitting practice.",
  };
};

const submitPractice = () => {
  const district = getSelectedDistrict();
  const training = getTraining();
  const recoveryMode = training.remediationRequired;
  const feedback = getActivePracticePrompts(district.id).map(buildPracticeFeedback);
  const score = feedback.filter((entry) => entry.correct).length;
  const passed = score === feedback.length;

  state.practiceOutcome = {
    passed,
    score,
    total: feedback.length,
    summary: recoveryMode
      ? passed
        ? "The longer recovery drill is clear. The district can use its knowledge safely again."
        : "The recovery drill is still blocked. The district remains unsafe until every recovery check is correct."
      : passed
        ? "The district trusts your memory and adaptation, so the estimation test is now open."
        : "The district is not convinced yet. Review the rule and adapt it more carefully before testing again.",
    feedback,
  };

  training.practiceAttempts += 1;
  training.practicePassed = passed;
  training.remediationRequired = recoveryMode ? !passed : false;
  state.activeQuizId = null;
  state.currentOutcome = null;
  resetDrafts();
  updateTotals();

  pushEvent(
    recoveryMode
      ? passed
        ? `${district.name}: recovery drill passed. Higher technologies can be trusted again.`
        : `${district.name}: recovery drill failed. The district remains under safety lock.`
      : passed
        ? `${district.name}: adaptation drill passed. The next estimate test is unlocked.`
        : `${district.name}: adaptation drill failed. The lesson sheet should be reviewed again.`,
  );

  renderApp();
};

const resetPracticeFlow = () => {
  resetPracticeDraft();
  renderApp();
};

const submitBattle = () => {
  ensureBattleState();
  const district = getSelectedDistrict();
  const questions = getBattleQuestions(district.id);
  const question = questions[state.battle.waveIndex];

  if (!question || state.battle.selectedChoice === null) {
    return;
  }

  const correct = state.battle.selectedChoice === question.answer;
  const swing = correct ? 18 : -10;
  const losses = correct ? 0 : 3 + state.battle.waveIndex * 2;

  state.battle.front = clamp(state.battle.front + swing, 0, 100);
  state.battle.correct += correct ? 1 : 0;
  state.battle.losses += losses;
  state.battle.log.unshift(
    correct
      ? `${question.warrior} advanced after ${question.title}.`
      : `${question.warrior} stumbled on ${question.title}. ${losses} citizens were lost on the line.`,
  );
  state.battle.log = state.battle.log.slice(0, 5);
  state.battle.waveIndex += 1;
  state.battle.selectedChoice = null;

  state.score += correct ? 32 : -14;

  if (!correct) {
    state.training[district.id].losses += losses;
    state.training[district.id].incidents += 1;
  }

  if (state.battle.waveIndex >= questions.length) {
    state.battle.finished = true;
    pushEvent(
      state.battle.front >= 50
        ? `${district.name}: battle rush cleared. The city's line held.`
        : `${district.name}: battle rush failed. The line broke under pressure.`,
    );
  } else {
    pushEvent(
      correct
        ? `${district.name}: ${question.warrior} moved forward.`
        : `${district.name}: ${question.warrior} fell back after a wrong call.`,
    );
  }

  updateTotals();
  renderApp();
};

const resetBattleFlow = () => {
  resetBattle();
  renderApp();
};

const closeSheet = () => {
  state.activeSheet = null;
  renderApp();
};

const closeResult = () => {
  state.currentOutcome = null;
  state.activeQuizId = null;
  resetDrafts();
  state.activeSheet = null;
  renderApp();
};

const advanceAfterResult = () => {
  const districtId = state.selectedDistrictId;

  state.currentOutcome = null;
  state.activeQuizId = null;
  resetDrafts();

  if (state.training[districtId].practicePassed && getNextQuizForDistrict(districtId)) {
    state.activeSheet = "test";
    hydrateNextQuiz();
  } else {
    state.activeSheet = state.training[districtId].practicePassed ? "ledger" : "practice";
  }

  renderApp();
};

const renderWorldTicker = () => {
  const latestEvent = state.eventLog[0] ?? "Select a district to begin rebuilding.";

  return `
    <div class="world-ticker">
      <p class="eyebrow">City Pulse</p>
      <strong>${worldMessages[state.messageIndex % worldMessages.length]}</strong>
      <span>${latestEvent}</span>
    </div>
  `;
};

const renderDistrictRibbon = () => `
  <div class="district-ribbon">
    ${districts
      .map((district) => {
        const progress = state.districtProgress[district.id];
        const training = state.training[district.id];
        const unlocked = progress.unlocked;
        const selected = district.id === state.selectedDistrictId;

        return `
          <button
            class="district-chip ${selected ? "district-chip--selected" : ""}"
            data-action="select-district"
            data-district-id="${district.id}"
            ${unlocked ? "" : "disabled"}
          >
            <span class="district-chip__icon">${district.icon}</span>
            <span class="district-chip__body">
              <strong>${district.name}</strong>
              <span>
                ${
                  unlocked
                    ? training.remediationRequired
                      ? "Recovery locked"
                      : `Mastery ${getMasteryPercent(district.id)}%`
                    : "Locked"
                }
              </span>
            </span>
          </button>
        `;
      })
      .join("")}
  </div>
`;

const renderWorldStats = () => {
  const restoredDistricts = districtOrder.filter(
    (districtId) => state.districtProgress[districtId].stage >= 3,
  ).length;
  const builtProjects = districtOrder.filter((districtId) => state.projects[districtId].built).length;
  const morale = getCityMorale();
  const activeBattle =
    state.activeSheet === "battle" && state.battle.districtId === state.selectedDistrictId;

  return `
    <div class="world-stats">
      <div class="world-pill">
        <span>Round</span>
        <strong>${state.currentRound}</strong>
      </div>
      <div class="world-pill">
        <span>Tests</span>
        <strong>${state.answeredQuizIds.length}</strong>
      </div>
      <div class="world-pill">
        <span>Districts</span>
        <strong>${restoredDistricts}/${districtOrder.length}</strong>
      </div>
      <div class="world-pill">
        <span>Projects</span>
        <strong>${builtProjects}/${districtOrder.length}</strong>
      </div>
      <div class="world-pill">
        <span>Supplies</span>
        <strong>${formatNumber(getCitySupplies())}</strong>
      </div>
      <div class="world-pill">
        <span>Morale</span>
        <strong>${morale}%</strong>
      </div>
      <div class="world-pill">
        <span>Safety</span>
        <strong>${getCitySafety()}</strong>
      </div>
      ${
        activeBattle
          ? `<div class="world-pill">
              <span>Front</span>
              <strong>${state.battle.front}%</strong>
            </div>`
          : ""
      }
    </div>
  `;
};

const renderDistrictInspector = () => {
  const district = getSelectedDistrict();
  const plan = getSelectedPlan();
  const training = getTraining();
  const progress = state.districtProgress[district.id];
  const completion = getDistrictCompletion(district.id);
  const project = getProjectState();
  const canBuild = canBuildProject(district.id);
  const facility = districtFacilities[district.id];

  return `
    <aside class="district-inspector">
      <div class="district-inspector__header">
        <div class="district-inspector__crest" style="background:linear-gradient(145deg, ${district.palette.accent}, ${district.palette.stone})">
          ${district.icon}
        </div>
        <div>
          <p class="eyebrow">Selected District</p>
          <h2>${district.name}</h2>
          <p>${district.tagline}</p>
        </div>
      </div>
      <div class="district-inspector__tags">
        <span>${formatSubjectLabel(district.subject)}</span>
        <span>${facility.name}</span>
        <span>Mastery ${getMasteryPercent(district.id)}%</span>
        <span>${completion.completed}/${completion.total} trials</span>
      </div>
      <div class="district-inspector__status ${training.remediationRequired ? "district-inspector__status--danger" : ""}">
        <strong>${getDistrictRequirement(district.id)}</strong>
        <span>
          ${
            training.remediationRequired
              ? `${training.losses} citizens lost here. Technology is locked until the longer recovery drill is cleared.`
              : training.practicePassed
                ? "The district has remembered the base rule and can attempt a live deployment."
                : facility.subtitle
          }
        </span>
      </div>
      <div class="district-inspector__meta">
        <div class="world-project-chip ${project.built ? "world-project-chip--built" : canBuild ? "world-project-chip--ready" : ""}">
          <strong>${plan.cityProjectName}</strong>
          <span>
            ${
              project.built
                ? "District upgrade complete"
                : canBuild
                  ? "Ready to raise"
                  : "Still locked behind mastery"
            }
          </span>
        </div>
        <div class="district-inspector__ledger">
          <div>
            <span>Stage</span>
            <strong>${progress.stage}/5</strong>
          </div>
          <div>
            <span>Incidents</span>
            <strong>${training.incidents}</strong>
          </div>
          <div>
            <span>Mentor</span>
            <strong>${district.mentor}</strong>
          </div>
        </div>
      </div>
      <div class="district-inspector__actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="facility">Open ${facility.name}</button>
        <button class="button" data-action="open-sheet" data-sheet="research">View tech tree</button>
      </div>
    </aside>
  `;
};

const renderActionDock = () => {
  const district = getSelectedDistrict();
  const facility = districtFacilities[district.id];
  const activeSheet = state.activeSheet;
  const isFacilityFlow =
    activeSheet === "facility" || activeSheet === "study" || activeSheet === "practice" || activeSheet === "test";
  const actions: Array<{ id: SheetView; label: string; active: boolean }> = [
    { id: "research", label: "Tech Tree", active: activeSheet === "research" },
    { id: "facility", label: facility.name, active: isFacilityFlow },
    { id: "battle", label: "Puzzle Rush", active: activeSheet === "battle" },
    { id: "build", label: "Build", active: activeSheet === "build" },
    { id: "council", label: "Council", active: activeSheet === "council" },
    { id: "ledger", label: "Ledger", active: activeSheet === "ledger" },
  ];

  return `
    <div class="action-dock">
      ${actions
        .map(
          (action) => `
            <button class="world-action ${action.active ? "world-action--active" : ""}" data-action="open-sheet" data-sheet="${action.id}">
              ${action.label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
};

const getSheetHeader = (activeView: SheetView, district: District) => {
  const facility = districtFacilities[district.id];

  switch (activeView) {
    case "facility":
      return {
        eyebrow: "Subject Facility",
        title: facility.name,
        detail: facility.subtitle,
      };
    case "study":
      return {
        eyebrow: "Base Knowledge",
        title: getSelectedPlan().primerTitle,
        detail: "Remember the rule set before you try to adapt or deploy it.",
      };
    case "practice":
      return {
        eyebrow: getTraining().remediationRequired ? "Recovery Drill" : "Adaptation Drill",
        title: getTraining().remediationRequired ? `${district.name} Recovery` : `${district.name} Drill`,
        detail: "The game only opens safe deployment when the rule is adapted correctly in a fresh case.",
      };
    case "test":
      return {
        eyebrow: "Deployment Trial",
        title: `${district.name} Trial Line`,
        detail: "A wrong application locks the technology, costs citizens, and triggers a longer corrective test.",
      };
    case "research":
      return {
        eyebrow: "Technology Tree",
        title: `${district.name} Research`,
        detail: "Study unlocks theory, correct trials unlock use, and projects unlock civic deployment.",
      };
    case "battle":
      return {
        eyebrow: "Automated Front",
        title: `${district.name} Puzzle Rush`,
        detail: "Answer the rush question and the line moves automatically. Better districts field stronger warriors.",
      };
    case "build":
      return {
        eyebrow: "City Upgrade",
        title: getSelectedPlan().cityProjectName,
        detail: "Turn proven knowledge into permanent structures that visibly change the city.",
      };
    case "council":
      return {
        eyebrow: "High Council",
        title: "City Orders",
        detail: "Use these directives to move between districts without losing the wider city loop.",
      };
    case "ledger":
      return {
        eyebrow: "District Ledger",
        title: `${district.name} Record`,
        detail: "Review mastery, incidents, and recent deployment history for this district.",
      };
    default:
      return {
        eyebrow: "District Command",
        title: district.name,
        detail: district.summary,
      };
  }
};

const renderSheetWindow = () => {
  if (!state.activeSheet) {
    return "";
  }

  const district = getSelectedDistrict();
  const header = getSheetHeader(state.activeSheet, district);

  return `
    <div class="sheet-window-shell">
      <div class="sheet-window">
        <div class="sheet-window__header">
          <div>
            <p class="eyebrow">${header.eyebrow}</p>
            <h2>${header.title}</h2>
            <p>${header.detail}</p>
          </div>
          <button class="icon-button" data-action="close-sheet" aria-label="Close sheet">×</button>
        </div>
        <div class="sheet-window__body">
          ${renderSheetBody(state.activeSheet)}
        </div>
      </div>
    </div>
  `;
};

const renderFacilityBody = (district: District, plan: DistrictLearningPlan) => {
  const training = getTraining();
  const progress = state.districtProgress[district.id];
  const facility = districtFacilities[district.id];
  const nextQuiz = getNextQuizForDistrict(district.id);

  return `
    <section class="sheet-section">
      <p class="eyebrow">Facility Floor</p>
      <h2>${facility.name}</h2>
      <p>${facility.subtitle}</p>
      ${
        training.remediationRequired
          ? `<div class="feedback-card feedback-card--danger"><strong>Safety lockdown</strong><p>A failed deployment killed citizens in ${district.name}. The district must relearn and pass the longer recovery drill before any higher technology can be used again.</p></div>`
          : `<div class="memory-banner"><strong>Knowledge chain</strong><p>Base knowledge teaches the rule, the drill checks adaptation, and the trial proves you can deploy the idea without harming the city.</p></div>`
      }
      <div class="facility-grid">
        <article class="facility-card ${training.studied ? "facility-card--complete" : ""}">
          <span>Station 1</span>
          <h3>${facility.stations[0]}</h3>
          <p>${plan.memoryPrompt}</p>
          <button class="button ${training.studied ? "button--ghost" : ""}" data-action="open-sheet" data-sheet="study">
            ${training.studied ? "Review study sheet" : "Teach base knowledge"}
          </button>
        </article>
        <article class="facility-card ${training.practicePassed ? "facility-card--complete" : ""}">
          <span>Station 2</span>
          <h3>${facility.stations[1]}</h3>
          <p>${training.remediationRequired ? "Run the longer recovery drill built from the district's own study notes." : plan.adaptationHint}</p>
          <button class="button ${training.practicePassed && !training.remediationRequired ? "button--ghost" : ""}" data-action="open-sheet" data-sheet="practice">
            ${training.remediationRequired ? "Start recovery drill" : training.practicePassed ? "Review drill results" : "Run adaptation drill"}
          </button>
        </article>
        <article class="facility-card ${training.practicePassed && nextQuiz ? "facility-card--ready" : progress.completed >= 1 ? "facility-card--complete" : ""}">
          <span>Station 3</span>
          <h3>${facility.stations[2]}</h3>
          <p>${nextQuiz ? nextQuiz.title : "Every current district trial is complete."}</p>
          <button class="button ${(training.practicePassed && nextQuiz) ? "" : "button--ghost"}" data-action="open-sheet" data-sheet="test">
            ${training.practicePassed && nextQuiz ? "Launch deployment trial" : "View trial line"}
          </button>
        </article>
      </div>
      <div class="lesson-card-grid">
        ${plan.studyCards
          .map(
            (card, index) => `
              <article class="lesson-card lesson-card--compact">
                <p class="eyebrow">Knowledge ${index + 1}</p>
                <h3>${card.title}</h3>
                <p>${card.summary}</p>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="research">Open tech tree</button>
        <button class="button" data-action="open-sheet" data-sheet="${training.remediationRequired ? "practice" : training.practicePassed ? "test" : "study"}">
          ${training.remediationRequired ? "Fix district" : training.practicePassed ? "Go to trial" : "Start teaching"}
        </button>
      </div>
    </section>
  `;
};

const renderStudyBody = (district: District, plan: DistrictLearningPlan) => {
  const training = getTraining();

  return `
    <section class="sheet-section sheet-section--hero">
      <p class="eyebrow">Study Sheet</p>
      <h2>${plan.primerTitle}</h2>
      <p>${plan.primerGoal}</p>
      <div class="memory-banner">
        <strong>Memory line</strong>
        <p>${plan.memoryPrompt}</p>
      </div>
      <div class="lesson-card-grid">
        ${plan.studyCards
          .map(
            (card) => `
              <article class="lesson-card">
                <h3>${card.title}</h3>
                <p>${card.summary}</p>
                <ul>
                  ${card.bullets
                    .map(
                      (bullet) => `
                        <li>${bullet}</li>
                      `,
                    )
                    .join("")}
                </ul>
                <div class="worked-example">${card.example}</div>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="research">Open tech tree</button>
        <button class="button" data-action="mark-study-ready">
          ${training.studied ? "Review complete, go to practice" : `I've studied ${district.name}`}
        </button>
      </div>
    </section>
  `;
};

const renderPracticeForm = (plan: DistrictLearningPlan) => {
  const training = getTraining();
  const prompts = getActivePracticePrompts();
  const allAnswered = prompts.every((prompt) => state.practiceDraft[prompt.id]);

  return `
    <section class="sheet-section">
      <p class="eyebrow">${training.remediationRequired ? "Recovery Drill" : "Adaptation Drill"}</p>
      <h2>${training.remediationRequired ? "Recover the district before you test again" : "Use the rule in a new context"}</h2>
      <p>
        ${
          training.remediationRequired
            ? "A failed deployment caused losses. This longer drill combines adaptation with memory checks before the city will trust the district again."
            : plan.adaptationHint
        }
      </p>
      ${
        training.remediationRequired
          ? `<div class="feedback-card feedback-card--danger"><strong>Safety lock</strong><p>${getSelectedDistrict().name} has lost ${training.losses} citizens so far. Clear every recovery check before using its technology again.</p></div>`
          : ""
      }
      ${prompts
        .map(
          (prompt, index) => `
            <article class="practice-card">
              <p class="eyebrow">Prompt ${index + 1}</p>
              <h3>${prompt.title}</h3>
              <p>${prompt.situation}</p>
              <p><strong>${prompt.question}</strong></p>
              <div class="option-list">
                ${prompt.options
                  .map(
                    (option) => `
                      <button class="option-pill ${
                        state.practiceDraft[prompt.id] === option.id ? "option-pill--selected" : ""
                      }" data-action="set-practice-option" data-prompt-id="${prompt.id}" data-option-id="${option.id}">
                        ${option.label}
                      </button>
                    `,
                  )
                  .join("")}
              </div>
            </article>
          `,
        )
        .join("")}
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="study">Back to study</button>
        <button class="button" data-action="submit-practice" ${allAnswered ? "" : "disabled"}>
          ${training.remediationRequired ? "Submit recovery drill" : "Submit adaptation check"}
        </button>
      </div>
    </section>
  `;
};

const renderPracticeOutcome = (outcome: PracticeOutcome) => `
  <section class="sheet-section">
    <p class="eyebrow">${outcome.passed ? "Practice Passed" : "Practice Blocked"}</p>
    <h2>${outcome.score}/${outcome.total} scenarios correct</h2>
    <p>${outcome.summary}</p>
    <div class="feedback-list">
      ${outcome.feedback
        .map(
          (entry) => `
            <article class="feedback-card ${entry.correct ? "feedback-card--success" : "feedback-card--danger"}">
              <strong>${entry.promptTitle}</strong>
              <p><span>Your choice:</span> ${entry.selectedLabel}</p>
              ${entry.correct ? "" : `<p><span>Correct choice:</span> ${entry.correctLabel}</p>`}
              <p>${entry.explanation}</p>
            </article>
          `,
        )
        .join("")}
    </div>
    <div class="sheet-actions">
      <button class="button button--ghost" data-action="reset-practice">Try fresh prompts</button>
      <button class="button" data-action="open-sheet" data-sheet="${outcome.passed ? "test" : "study"}">
        ${outcome.passed ? "Open estimate test" : "Review study sheet"}
      </button>
    </div>
  </section>
`;

const renderPracticeBody = (plan: DistrictLearningPlan) => {
  const training = getTraining();

  if (!training.studied && !state.practiceOutcome) {
    return `
      <section class="sheet-section gate-card">
        <p class="eyebrow">Practice Locked</p>
        <h2>Study comes first</h2>
        <p>The district will not let you adapt the rule until you have reviewed the base knowledge sheet.</p>
        <div class="sheet-actions">
          <button class="button" data-action="open-sheet" data-sheet="study">Open study sheet</button>
        </div>
      </section>
    `;
  }

  if (state.practiceOutcome) {
    return renderPracticeOutcome(state.practiceOutcome);
  }

  return renderPracticeForm(plan);
};

const renderTestGate = (plan: DistrictLearningPlan) => {
  const training = getTraining();

  return `
    <section class="sheet-section gate-card">
      <p class="eyebrow">Test Locked</p>
      <h2>Prove the knowledge before the estimate</h2>
      <p>${plan.testBrief}</p>
      <div class="gate-list">
        <div class="gate-item ${training.studied ? "gate-item--complete" : ""}">
          <strong>Study sheet</strong>
          <span>${training.studied ? "Reviewed" : "Still needed"}</span>
        </div>
        <div class="gate-item ${training.practicePassed ? "gate-item--complete" : ""}">
          <strong>Adaptation drill</strong>
          <span>${training.practicePassed ? "Passed" : "Still needed"}</span>
        </div>
        <div class="gate-item ${training.remediationRequired ? "" : "gate-item--complete"}">
          <strong>Recovery status</strong>
          <span>${training.remediationRequired ? "Safety lock is active" : "District is safe to deploy"}</span>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="study">Study first</button>
        <button class="button" data-action="open-sheet" data-sheet="practice">Go to practice</button>
      </div>
    </section>
  `;
};

const renderQuizForm = (district: District, quiz: Quiz, plan: DistrictLearningPlan) => {
  const intervalInputs =
    quiz.round === 1
      ? `
        <div class="guess-grid">
          <label class="input-card">
            <span>Lower bound</span>
            <input id="guess-lower" type="number" min="${quiz.min}" max="${quiz.max}" value="${state.intervalDraft.lower}" />
          </label>
          <label class="input-card">
            <span>Upper bound</span>
            <input id="guess-upper" type="number" min="${quiz.min}" max="${quiz.max}" value="${state.intervalDraft.upper}" />
          </label>
        </div>
        <div class="memory-banner">
          <strong>Round 1</strong>
          <p>Give a careful interval. Narrower ranges score more if they still contain the truth.</p>
        </div>
      `
      : `
        <div class="option-list option-list--dual">
          <button class="option-pill ${state.comparisonDraft.direction === "above" ? "option-pill--selected" : ""}" data-action="set-direction" data-direction="above">
            Above ${formatNumber(quiz.comparisonValue ?? 0)}
          </button>
          <button class="option-pill ${state.comparisonDraft.direction === "below" ? "option-pill--selected" : ""}" data-action="set-direction" data-direction="below">
            Below ${formatNumber(quiz.comparisonValue ?? 0)}
          </button>
        </div>
        <div class="confidence-row">
          ${confidenceOptions
            .map(
              (option) => `
                <button class="confidence-pill ${
                  option === state.comparisonDraft.confidence ? "confidence-pill--selected" : ""
                }" data-action="set-confidence" data-confidence="${option}">
                  ${option}%
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="memory-banner">
          <strong>Round 2</strong>
          <p>Choose Above or Below and match your confidence to how strong your reasoning is.</p>
        </div>
      `;

  const submitDisabled =
    quiz.round === 1
      ? Number.isNaN(Number(state.intervalDraft.lower)) ||
        Number.isNaN(Number(state.intervalDraft.upper)) ||
        state.intervalDraft.lower === "" ||
        state.intervalDraft.upper === ""
      : state.comparisonDraft.direction === null;

  return `
    <section class="sheet-section">
      <p class="eyebrow">Estimate Test</p>
      <h2>${quiz.title}</h2>
      <p>${plan.testBrief}</p>
      <div class="test-brief">
        <strong>${district.name}</strong>
        <p>${quiz.prompt}</p>
      </div>
      <p class="test-question">${quiz.question}</p>
      <div class="anchor-list">
        ${quiz.anchors
          .map(
            (anchor) => `
              <div class="anchor-pill">${anchor}</div>
            `,
          )
          .join("")}
      </div>
      ${intervalInputs}
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="cancel-quiz">Stand down</button>
        <button class="button" data-action="submit-quiz" ${submitDisabled ? "disabled" : ""}>Lock in estimate</button>
      </div>
    </section>
  `;
};

const renderQuizResult = (district: District, quiz: Quiz, outcome: QuizOutcome) => {
  const nextQuiz = getNextQuizForDistrict(district.id);
  const nextActionLabel = outcome.correct
    ? nextQuiz && state.training[district.id].practicePassed
      ? "Open next test"
      : "View district ledger"
    : "Return to practice";
  const nextActionSheet = outcome.correct
    ? nextQuiz && state.training[district.id].practicePassed
      ? "advance-report"
      : "open-ledger"
    : "open-practice";

  return `
    <section class="sheet-section">
      <p class="eyebrow">${outcome.correct ? "Result: Cleared" : "Result: Correction Needed"}</p>
      <h2>${quiz.title}</h2>
      <p>${outcome.summary}</p>
      <div class="result-grid">
        <div class="result-card">
          <span>Your call</span>
          <strong>${outcome.guessLabel}</strong>
        </div>
        <div class="result-card">
          <span>Correct answer</span>
          <strong>${outcome.actualLabel}</strong>
        </div>
        <div class="result-card">
          <span>Points</span>
          <strong>${outcome.points >= 0 ? "+" : ""}${outcome.points}</strong>
        </div>
        <div class="result-card">
          <span>Accuracy</span>
          <strong>${outcome.accuracy}%</strong>
        </div>
        <div class="result-card">
          <span>Percentile</span>
          <strong>${outcome.percentile}th</strong>
        </div>
        <div class="result-card">
          <span>Reward</span>
          <strong>${quiz.reward}</strong>
        </div>
        ${
          outcome.casualties > 0
            ? `<div class="result-card">
                <span>Citizens lost</span>
                <strong>${outcome.casualties}</strong>
              </div>`
            : ""
        }
      </div>
      <div class="feedback-card ${outcome.correct ? "feedback-card--success" : "feedback-card--danger"}">
        <strong>Why this answer?</strong>
        <p>${quiz.explanation}</p>
        <p><span>Source:</span> ${quiz.source}</p>
        ${
          outcome.correct
            ? ""
            : `<p><span>Next step:</span> Pass the longer recovery drill before the next estimate or technology use will open again.</p>`
        }
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="close-result">Close report</button>
        ${
          nextActionSheet === "advance-report"
            ? `<button class="button" data-action="advance-report">${nextActionLabel}</button>`
            : `<button class="button" data-action="open-sheet" data-sheet="${
                nextActionSheet === "open-ledger" ? "ledger" : "practice"
              }">${nextActionLabel}</button>`
        }
      </div>
    </section>
  `;
};

const renderTestBody = (district: District, plan: DistrictLearningPlan) => {
  const quiz = getQuizById(state.activeQuizId);

  if (state.currentOutcome) {
    const lastQuizId = state.answeredQuizIds[state.answeredQuizIds.length - 1] ?? null;
    const quizForResult = quiz ?? getQuizById(lastQuizId);

    if (quizForResult) {
      return renderQuizResult(district, quizForResult, state.currentOutcome);
    }
  }

  const training = getTraining();

  if (!training.studied || !training.practicePassed) {
    return renderTestGate(plan);
  }

  if (quiz) {
    return renderQuizForm(district, quiz, plan);
  }

  return `
    <section class="sheet-section gate-card">
      <p class="eyebrow">District Report</p>
      <h2>${getNextQuizForDistrict(district.id) ? "Test ready" : "District mastered"}</h2>
      <p>
        ${
          getNextQuizForDistrict(district.id)
            ? "This district is ready for another estimate test. Open the sheet again if you want to continue."
            : "Every available estimate in this district is complete for now."
        }
      </p>
      <div class="sheet-actions">
        ${
          getNextQuizForDistrict(district.id)
            ? `<button class="button" data-action="open-sheet" data-sheet="test">Load next test</button>`
            : `<button class="button" data-action="open-sheet" data-sheet="ledger">View ledger</button>`
        }
      </div>
    </section>
  `;
};

const renderResearchBody = (district: District) => {
  const training = getTraining();
  const completion = getDistrictCompletion(district.id);
  const nodes = researchNodesByDistrict[district.id];

  return `
    <section class="sheet-section">
      <p class="eyebrow">Technology Tree</p>
      <h2>${district.name}</h2>
      <p>The city only trusts technology when the knowledge is remembered, adapted, and applied correctly.</p>
      ${
        training.remediationRequired
          ? `<div class="feedback-card feedback-card--danger"><strong>Technology safety lock</strong><p>${district.name} is under recovery after failed deployment. ${training.losses} citizens have been lost here so far, and higher nodes stay offline until the longer recovery drill is passed.</p></div>`
          : `<div class="memory-banner"><strong>Research condition</strong><p>Study unlocks theory, one passed test unlocks field use, and a built project unlocks full civic deployment.</p></div>`
      }
      <div class="tech-tree">
        ${nodes
          .map((node, index) => {
            const status = getResearchNodeStatus(district.id, node);
            const connectorClass =
              index === 0
                ? ""
                : status.state === "locked"
                  ? "tech-tree__link tech-tree__link--locked"
                  : status.state === "offline"
                    ? "tech-tree__link tech-tree__link--offline"
                    : "tech-tree__link tech-tree__link--online";
            return `
              ${
                index === 0
                  ? ""
                  : `<div class="${connectorClass}" aria-hidden="true"><span></span></div>`
              }
              <article class="research-card research-card--${status.state}">
                <div class="research-card__tier">Tier ${node.tier}</div>
                <h3>${node.name}</h3>
                <p>${node.summary}</p>
                <div class="research-card__status">
                  <strong>${status.label}</strong>
                  <p>${status.detail}</p>
                </div>
                <p><span>Effect:</span> ${node.effect}</p>
                <p><span>Risk:</span> ${node.risk}</p>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="result-grid">
        <div class="result-card">
          <span>Tests cleared</span>
          <strong>${completion.completed}/${completion.total}</strong>
        </div>
        <div class="result-card">
          <span>Incidents</span>
          <strong>${training.incidents}</strong>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="practice">
          ${training.remediationRequired ? "Open recovery drill" : "Open practice"}
        </button>
        <button class="button" data-action="open-sheet" data-sheet="build">Review district project</button>
      </div>
    </section>
  `;
};

const renderBattleBody = (district: District) => {
  ensureBattleState(district.id);
  const battle = state.battle;
  const questions = getBattleQuestions(district.id);
  const question = questions[battle.waveIndex];
  const frontLabel = battle.front >= 70 ? "Advancing" : battle.front >= 45 ? "Holding" : "Breaking";

  if (battle.finished || !question) {
    return `
      <section class="sheet-section">
        <p class="eyebrow">Puzzle Rush Report</p>
        <h2>${district.name}</h2>
        <div class="battle-lane">
          <div class="battle-lane__track">
            <div class="battle-lane__progress" style="width:${battle.front}%;"></div>
            <div class="battle-lane__marker battle-lane__marker--friendly" style="left:${Math.max(8, battle.front - 6)}%;"></div>
            <div class="battle-lane__marker battle-lane__marker--enemy" style="left:82%;"></div>
          </div>
          <div class="battle-lane__labels">
            <span>Front ${battle.front}%</span>
            <span>${frontLabel}</span>
          </div>
        </div>
        <div class="result-grid">
          <div class="result-card">
            <span>Correct rush answers</span>
            <strong>${battle.correct}/${questions.length}</strong>
          </div>
          <div class="result-card">
            <span>Battle losses</span>
            <strong>${battle.losses}</strong>
          </div>
        </div>
        <div class="feedback-list">
          ${battle.log
            .map(
              (entry) => `
                <article class="feedback-card">
                  <strong>Battle feed</strong>
                  <p>${entry}</p>
                </article>
              `,
            )
            .join("")}
        </div>
        <div class="sheet-actions">
          <button class="button button--ghost" data-action="reset-battle">Run another rush</button>
          <button class="button" data-action="open-sheet" data-sheet="research">Back to tech tree</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="sheet-section">
      <p class="eyebrow">Puzzle Rush</p>
      <h2>${district.name}</h2>
      <p>The battlefield is automated: answer fast and your warriors surge forward. Better city tiers send stronger warriors into harder question lines.</p>
      <div class="battle-lane">
        <div class="battle-lane__track">
          <div class="battle-lane__progress" style="width:${battle.front}%;"></div>
          <div class="battle-lane__marker battle-lane__marker--friendly" style="left:${Math.max(8, battle.front - 6)}%;"></div>
          <div class="battle-lane__marker battle-lane__marker--enemy" style="left:82%;"></div>
        </div>
        <div class="battle-lane__labels">
          <span>${question.warrior}</span>
          <span>${question.difficulty}</span>
          <span>Rush ${battle.waveIndex + 1}/${questions.length}</span>
        </div>
      </div>
      <div class="test-brief">
        <strong>${question.title}</strong>
        <p>${question.prompt}</p>
      </div>
      <div class="option-list option-list--dual">
        ${question.choices
          .map(
            (choice) => `
              <button class="option-pill ${battle.selectedChoice === choice ? "option-pill--selected" : ""}" data-action="set-battle-choice" data-battle-choice="${choice}">
                ${formatNumber(choice)} ${question.unit}
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="feedback-card">
        <strong>Battle feed</strong>
        <p>${battle.log[0] ?? "The line is waiting for the next call."}</p>
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="reset-battle">Reset rush</button>
        <button class="button" data-action="submit-battle" ${battle.selectedChoice === null ? "disabled" : ""}>
          Answer and move line
        </button>
      </div>
    </section>
  `;
};

const renderBuildBody = (district: District, plan: DistrictLearningPlan) => {
  const completion = getDistrictCompletion(district.id);
  const project = getProjectState();
  const canBuild = canBuildProject(district.id);
  const training = getTraining();

  if (project.built) {
    return `
      <section class="sheet-section">
        <p class="eyebrow">District Upgrade Complete</p>
        <h2>${plan.cityProjectName}</h2>
        <div class="memory-banner">
          <strong>Built into the world</strong>
          <p>${plan.cityProjectEffect}</p>
        </div>
        <p>${plan.cityProjectSummary}</p>
        <div class="sheet-actions">
          <button class="button button--ghost" data-action="open-sheet" data-sheet="research">Back to tech tree</button>
          <button class="button" data-action="open-sheet" data-sheet="ledger">View district ledger</button>
        </div>
      </section>
    `;
  }

  if (!canBuild) {
    return `
      <section class="sheet-section gate-card">
        <p class="eyebrow">Upgrade Locked</p>
        <h2>${plan.cityProjectName}</h2>
        <p>${plan.cityProjectSummary}</p>
        <div class="gate-list">
        <div class="gate-item ${completion.completed >= 1 ? "gate-item--complete" : ""}">
          <strong>Clear a district test</strong>
          <span>${completion.completed >= 1 ? "Requirement met" : "Still needed"}</span>
        </div>
        <div class="gate-item ${state.training[district.id].studied ? "gate-item--complete" : ""}">
          <strong>Teach the district</strong>
          <span>${state.training[district.id].studied ? "Requirement met" : "Still needed"}</span>
        </div>
        <div class="gate-item ${training.remediationRequired ? "" : "gate-item--complete"}">
          <strong>Safe deployment</strong>
          <span>${training.remediationRequired ? "Recovery drill still required" : "District is safe to build with"}</span>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="study">Study district</button>
        <button class="button" data-action="open-sheet" data-sheet="${training.remediationRequired ? "practice" : "test"}">
          ${training.remediationRequired ? "Open recovery drill" : "Open estimate test"}
        </button>
      </div>
    </section>
  `;
  }

  return `
    <section class="sheet-section">
      <p class="eyebrow">World Upgrade</p>
      <h2>${plan.cityProjectName}</h2>
      <div class="memory-banner">
        <strong>Restoration plan</strong>
        <p>${plan.cityProjectSummary}</p>
      </div>
      <div class="feedback-card feedback-card--success">
        <strong>Visible effect</strong>
        <p>${plan.cityProjectEffect}</p>
        <p>Raising this project makes the district look busier, richer, and more alive on the map.</p>
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="research">Back to tech tree</button>
        <button class="button" data-action="complete-project">Raise ${plan.cityProjectName}</button>
      </div>
    </section>
  `;
};

const renderCouncilBody = () => {
  const orders = getCityOrders();

  return `
    <section class="sheet-section">
      <p class="eyebrow">High Council</p>
      <h2>City Orders</h2>
      <p>These directives tie the city together so the game is not just one district at a time. Each order points to the knowledge step that changes the world next.</p>
      <div class="council-grid">
        ${orders
          .map((order) => {
            const district = districtsById[order.districtId];
            return `
              <article class="council-card council-card--${order.status}">
                <p class="eyebrow">${district.name}</p>
                <h3>${order.title}</h3>
                <p>${order.summary}</p>
                <div class="council-card__meta">
                  <span>${order.reward}</span>
                  <span>${order.statusLabel}</span>
                </div>
                <button class="button ${order.status === "critical" ? "" : "button--ghost"}" data-action="jump-order" data-district-id="${order.districtId}" data-sheet="${order.sheet}">
                  ${order.statusLabel}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="research">Review selected tech tree</button>
        <button class="button" data-action="open-sheet" data-sheet="battle">Open selected battle rush</button>
      </div>
    </section>
  `;
};

const renderLedgerBody = (district: District, plan: DistrictLearningPlan) => {
  const progress = state.districtProgress[district.id];
  const completion = getDistrictCompletion(district.id);
  const training = getTraining();
  const history = progress.history;

  return `
    <section class="sheet-section">
      <p class="eyebrow">District Ledger</p>
      <h2>${district.name}</h2>
      <p>${plan.masteryReward} becomes permanent once the district can both teach and pass its estimate line.</p>
      <div class="ledger-grid">
        <div class="result-card">
          <span>Mastery</span>
          <strong>${getMasteryPercent(district.id)}%</strong>
        </div>
        <div class="result-card">
          <span>Tests cleared</span>
          <strong>${completion.completed}/${completion.total}</strong>
        </div>
        <div class="result-card">
          <span>Best score</span>
          <strong>${progress.bestScore >= 0 ? "+" : ""}${progress.bestScore}</strong>
        </div>
        <div class="result-card">
          <span>Practice attempts</span>
          <strong>${training.practiceAttempts}</strong>
        </div>
        <div class="result-card">
          <span>Incidents</span>
          <strong>${training.incidents}</strong>
        </div>
        <div class="result-card">
          <span>Losses</span>
          <strong>${training.losses}</strong>
        </div>
      </div>
      <div class="gate-list">
        <div class="gate-item ${training.studied ? "gate-item--complete" : ""}">
          <strong>Study sheet</strong>
          <span>${training.studied ? "Reviewed" : "Still needed"}</span>
        </div>
        <div class="gate-item ${training.practicePassed ? "gate-item--complete" : ""}">
          <strong>Adaptation drill</strong>
          <span>${training.practicePassed ? "Passed" : "Needs another pass"}</span>
        </div>
        <div class="gate-item ${training.remediationRequired ? "" : "gate-item--complete"}">
          <strong>Recovery status</strong>
          <span>${training.remediationRequired ? "Longer recovery drill required" : "Safe for technology use"}</span>
        </div>
        <div class="gate-item ${Boolean(getNextQuizForDistrict(district.id)) ? "" : "gate-item--complete"}">
          <strong>Next requirement</strong>
          <span>${getDistrictRequirement(district.id)}</span>
        </div>
      </div>
      <div class="feedback-list">
        ${
          history.length > 0
            ? history
                .map((entry) => {
                  const quiz = getQuizById(entry.quizId);
                  return `
                    <article class="feedback-card">
                      <strong>${quiz?.title ?? entry.quizId}</strong>
                      <p><span>Points:</span> ${entry.points >= 0 ? "+" : ""}${entry.points}</p>
                      <p><span>Accuracy:</span> ${entry.accuracy}%</p>
                    </article>
                  `;
                })
                .join("")
            : `<article class="feedback-card"><strong>No tests logged yet.</strong><p>Study the base rule, adapt it in practice, and the ledger will begin to fill.</p></article>`
        }
      </div>
      <div class="sheet-actions">
        <button class="button button--ghost" data-action="open-sheet" data-sheet="study">Review study</button>
        <button class="button" data-action="open-sheet" data-sheet="test">Go to test</button>
      </div>
    </section>
  `;
};

const renderSheetBody = (activeView: SheetView) => {
  const district = getSelectedDistrict();
  const plan = getSelectedPlan();

  switch (activeView) {
    case "facility":
      return renderFacilityBody(district, plan);
    case "study":
      return renderStudyBody(district, plan);
    case "practice":
      return renderPracticeBody(plan);
    case "test":
      return renderTestBody(district, plan);
    case "research":
      return renderResearchBody(district);
    case "battle":
      return renderBattleBody(district);
    case "build":
      return renderBuildBody(district, plan);
    case "council":
      return renderCouncilBody();
    case "ledger":
      return renderLedgerBody(district, plan);
    default:
      return "";
  }
};

const renderSheet = () => {
  return renderSheetWindow();
};

const renderShell = () => {
  return `
    <div class="game-shell">
      <header class="topbar">
        <div class="topbar__crest">
          <div class="crest__icon">FS</div>
          <div>
            <p class="eyebrow">Forge of Subjects</p>
            <h1>Raise districts, unlock tech trees, run subject facilities, and rebuild a six-subject civilization.</h1>
          </div>
        </div>
        <div class="topbar__era">Round ${state.currentRound}: ${
          state.currentRound === 1 ? "Estimation Intervals" : "Above or Below"
        }</div>
        <div class="topbar__stats">
          <div class="resource-pill">
            <span>Mastery</span>
            <strong>${formatNumber(state.score)}</strong>
          </div>
          <div class="resource-pill">
            <span>Knowledge</span>
            <strong>${formatNumber(state.wisdom)}</strong>
          </div>
          <div class="resource-pill">
            <span>Learners</span>
            <strong>${formatNumber(state.citizens)}</strong>
          </div>
          <div class="resource-pill">
            <span>Prestige</span>
            <strong>${formatNumber(state.prestige)}</strong>
          </div>
        </div>
      </header>

      <main class="city-layout">
        <div class="city-stage">
          <canvas id="city-canvas" width="1280" height="860" aria-label="Isometric learning city"></canvas>
          ${renderWorldTicker()}
          ${renderDistrictRibbon()}
          ${renderDistrictInspector()}
          ${renderWorldStats()}
          ${renderActionDock()}
          ${renderSheet()}
        </div>
      </main>
    </div>
  `;
};

const renderTile = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  stroke: string,
) => {
  ctx.beginPath();
  ctx.moveTo(x, y - height / 2);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x, y + height / 2);
  ctx.lineTo(x - width / 2, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.fill();
  ctx.stroke();
};

const drawBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  colors: { top: string; left: string; right: string },
) => {
  const halfW = width / 2;
  const halfD = depth / 2;

  ctx.beginPath();
  ctx.moveTo(x, y - halfD - height);
  ctx.lineTo(x + halfW, y - height);
  ctx.lineTo(x, y + halfD - height);
  ctx.lineTo(x - halfW, y - height);
  ctx.closePath();
  ctx.fillStyle = colors.top;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x - halfW, y - height);
  ctx.lineTo(x, y + halfD - height);
  ctx.lineTo(x, y + halfD);
  ctx.lineTo(x - halfW, y);
  ctx.closePath();
  ctx.fillStyle = colors.left;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + halfW, y - height);
  ctx.lineTo(x, y + halfD - height);
  ctx.lineTo(x, y + halfD);
  ctx.lineTo(x + halfW, y);
  ctx.closePath();
  ctx.fillStyle = colors.right;
  ctx.fill();
};

const projectPlot = (row: number, col: number) => {
  const tileWidth = 126;
  const tileHeight = 64;
  const originX = 640;
  const originY = 205;

  return {
    x: originX + (col - row) * (tileWidth / 2),
    y: originY + (col + row) * (tileHeight / 2),
  };
};

const drawRoad = (
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  width: number,
  fill: string,
  edge: string,
) => {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = edge;
  ctx.lineWidth = width + 10;
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.setLineDash([12, 14]);
  ctx.strokeStyle = "rgba(252, 226, 175, 0.2)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
};

const drawTree = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  canopy = "#4a7a44",
) => {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 10 * scale, 18 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#5f3f25";
  ctx.fillRect(x - 3 * scale, y - 10 * scale, 6 * scale, 18 * scale);
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.arc(x, y - 14 * scale, 16 * scale, 0, Math.PI * 2);
  ctx.arc(x - 12 * scale, y - 6 * scale, 13 * scale, 0, Math.PI * 2);
  ctx.arc(x + 12 * scale, y - 4 * scale, 12 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawStall = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  roof: string,
  base = "#6b4b32",
) => {
  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(x - 14 * scale, y - 6 * scale, 28 * scale, 16 * scale);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 18 * scale, y - 6 * scale);
  ctx.lineTo(x, y - 20 * scale);
  ctx.lineTo(x + 18 * scale, y - 6 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawBoat = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, hull: string) => {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 10 * scale, 24 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(x - 26 * scale, y);
  ctx.lineTo(x + 26 * scale, y);
  ctx.lineTo(x + 16 * scale, y + 12 * scale);
  ctx.lineTo(x - 16 * scale, y + 12 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#f7e7c0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 28 * scale);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#f7e7c0";
  ctx.beginPath();
  ctx.moveTo(x, y - 28 * scale);
  ctx.lineTo(x + 18 * scale, y - 6 * scale);
  ctx.lineTo(x, y - 6 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const interpolatePath = (points: Array<{ x: number; y: number }>, progress: number) => {
  const lengths = [];
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }

  let travelled = progress * total;

  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1];

    if (travelled <= length) {
      const ratio = length === 0 ? 0 : travelled / length;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio,
      };
    }

    travelled -= length;
  }

  return points[points.length - 1];
};

const drawCitizen = (
  ctx: CanvasRenderingContext2D,
  path: Array<{ x: number; y: number }>,
  progress: number,
  accent: string,
) => {
  const point = interpolatePath(path, progress);

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(point.x, point.y + 9, 8, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.fillRect(point.x - 3, point.y - 7, 6, 12);
  ctx.fillStyle = "#f5d7bf";
  ctx.beginPath();
  ctx.arc(point.x, point.y - 11, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawLantern = (ctx: CanvasRenderingContext2D, x: number, y: number, glow: string) => {
  ctx.save();
  ctx.strokeStyle = "#5d4531";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 28);
  ctx.stroke();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 32, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawSmokePlume = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  phase: number,
  tint = "rgba(224, 225, 232, 0.42)",
) => {
  ctx.save();

  for (let puff = 0; puff < 5; puff += 1) {
    const lift = ((phase / 90 + puff * 10) % 46) * 3;
    const drift = Math.sin(phase / 260 + puff) * 12;
    ctx.beginPath();
    ctx.fillStyle = tint;
    ctx.arc(x + drift, y - lift, 12 + puff * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

const drawBird = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) => {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 245, 220, 0.54)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10 * scale, y);
  ctx.quadraticCurveTo(x - 3 * scale, y - 8 * scale, x, y);
  ctx.quadraticCurveTo(x + 3 * scale, y - 8 * scale, x + 10 * scale, y);
  ctx.stroke();
  ctx.restore();
};

const drawBanner = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
  ctx.save();
  ctx.strokeStyle = "#f4e7c7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 26);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 24);
  ctx.lineTo(x + 18, y - 18);
  ctx.lineTo(x, y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawCrate = (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, wood = "#7b5334") => {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(x, y + 8 * scale, 12 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = wood;
  ctx.fillRect(x - 10 * scale, y - 6 * scale, 20 * scale, 16 * scale);
  ctx.strokeStyle = "#d7b685";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 10 * scale, y - 6 * scale, 20 * scale, 16 * scale);
  ctx.restore();
};

const drawDistrictLandmarks = (
  ctx: CanvasRenderingContext2D,
  district: District,
  point: { x: number; y: number },
) => {
  switch (district.id) {
    case "laboratory":
      drawBanner(ctx, point.x - 58, point.y + 10, "#80d9ef");
      drawCrate(ctx, point.x + 46, point.y + 26, 0.8, "#54767b");
      break;
    case "workshop":
      drawCrate(ctx, point.x - 44, point.y + 22, 0.9, "#8a5d34");
      drawBanner(ctx, point.x + 48, point.y + 10, "#db914b");
      break;
    case "observatory":
      drawBanner(ctx, point.x - 52, point.y + 8, "#9c91ff");
      drawLantern(ctx, point.x + 40, point.y + 18, "#d4ccff");
      break;
    case "scriptorium":
      drawBanner(ctx, point.x + 44, point.y + 12, "#88c677");
      drawCrate(ctx, point.x - 42, point.y + 22, 0.82, "#6d5f41");
      break;
    case "archive":
      drawBanner(ctx, point.x - 48, point.y + 12, "#cf9569");
      drawCrate(ctx, point.x + 42, point.y + 24, 0.8, "#7a5b49");
      break;
    case "harbour":
      drawBanner(ctx, point.x + 46, point.y + 12, "#6aa8ef");
      drawCrate(ctx, point.x - 42, point.y + 24, 0.84, "#5e4a37");
      break;
    default:
      return;
  }
};

const drawProjectDetails = (
  ctx: CanvasRenderingContext2D,
  district: District,
  point: { x: number; y: number },
) => {
  if (!state.projects[district.id].built) {
    return;
  }

  switch (district.id) {
    case "laboratory":
      drawLantern(ctx, point.x - 34, point.y + 18, "#bdefff");
      drawLantern(ctx, point.x + 20, point.y + 24, "#b0f3e8");
      drawStall(ctx, point.x + 56, point.y + 24, 0.68, "#79d4df", "#4b6d6a");
      break;
    case "workshop":
      drawStall(ctx, point.x - 54, point.y + 22, 0.78, "#d99859");
      drawStall(ctx, point.x + 8, point.y + 28, 0.72, "#f0b572", "#70472f");
      drawLantern(ctx, point.x + 46, point.y + 24, "#ffd38a");
      break;
    case "observatory":
      drawLantern(ctx, point.x - 40, point.y + 22, "#dcd2ff");
      drawLantern(ctx, point.x + 14, point.y + 20, "#c7beff");
      drawStall(ctx, point.x + 50, point.y + 24, 0.7, "#9788ff", "#5e5c8b");
      break;
    case "scriptorium":
      drawStall(ctx, point.x - 38, point.y + 22, 0.72, "#91ca7e", "#56724b");
      drawTree(ctx, point.x + 18, point.y + 30, 0.88, "#6ea15f");
      drawLantern(ctx, point.x + 50, point.y + 24, "#d3f3a0");
      break;
    case "archive":
      drawTree(ctx, point.x - 40, point.y + 24, 0.86, "#92604e");
      drawLantern(ctx, point.x + 8, point.y + 18, "#f6cfb0");
      drawStall(ctx, point.x + 52, point.y + 24, 0.68, "#ca865c", "#6d4b3d");
      break;
    case "harbour":
      drawBoat(ctx, point.x + 82, point.y + 44, 0.58, "#56739c");
      drawStall(ctx, point.x + 18, point.y + 20, 0.7, "#74a8df", "#455a73");
      drawLantern(ctx, point.x - 24, point.y + 18, "#bcd7ff");
      break;
    default:
      return;
  }
};

const drawCity = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#29455a");
  sky.addColorStop(0.22, "#537086");
  sky.addColorStop(0.42, "#7fa17f");
  sky.addColorStop(1, "#172117");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 228, 161, 0.18)";
  ctx.beginPath();
  ctx.ellipse(1020, 112, 180, 80, -0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  [0, 1, 2].forEach((index) => {
    const drift = ((state.clock / 40 + index * 180) % (canvas.width + 220)) - 120;
    ctx.beginPath();
    ctx.ellipse(drift, 110 + index * 28, 62, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(drift + 30, 98 + index * 28, 52, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(drift + 72, 112 + index * 28, 48, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  [
    { x: 214 + Math.sin(state.clock / 700) * 16, y: 148, scale: 1 },
    { x: 278 + Math.cos(state.clock / 820) * 12, y: 132, scale: 0.82 },
    { x: 940 + Math.sin(state.clock / 760) * 18, y: 164, scale: 0.94 },
    { x: 996 + Math.cos(state.clock / 710) * 14, y: 142, scale: 0.76 },
  ].forEach((bird) => drawBird(ctx, bird.x, bird.y, bird.scale));

  ctx.fillStyle = "rgba(35, 57, 46, 0.44)";
  ctx.beginPath();
  ctx.moveTo(0, 240);
  ctx.lineTo(120, 182);
  ctx.lineTo(260, 236);
  ctx.lineTo(410, 170);
  ctx.lineTo(580, 246);
  ctx.lineTo(760, 172);
  ctx.lineTo(940, 228);
  ctx.lineTo(1120, 184);
  ctx.lineTo(1280, 250);
  ctx.lineTo(1280, 320);
  ctx.lineTo(0, 320);
  ctx.closePath();
  ctx.fill();

  const coastWater = ctx.createLinearGradient(870, 420, 1220, 760);
  coastWater.addColorStop(0, "rgba(88, 136, 181, 0.9)");
  coastWater.addColorStop(1, "rgba(28, 69, 102, 0.96)");
  ctx.fillStyle = coastWater;
  ctx.beginPath();
  ctx.moveTo(920, 450);
  ctx.lineTo(1280, 510);
  ctx.lineTo(1280, 860);
  ctx.lineTo(780, 860);
  ctx.lineTo(820, 666);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(225, 244, 255, 0.18)";
  ctx.lineWidth = 2;
  for (let wave = 0; wave < 5; wave += 1) {
    ctx.beginPath();
    ctx.moveTo(910 + wave * 22, 492 + wave * 52);
    ctx.quadraticCurveTo(1030, 472 + wave * 54, 1180, 540 + wave * 50);
    ctx.stroke();
  }

  const tileWidth = 126;
  const tileHeight = 64;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const { x, y } = projectPlot(row, col);
      const shade =
        row + col > 11
          ? (row + col) % 2 === 0
            ? "#6f8364"
            : "#617658"
          : (row + col) % 2 === 0
            ? "#6a8f58"
            : "#5b7f4d";
      renderTile(ctx, x, y, tileWidth, tileHeight, shade, "rgba(25, 42, 21, 0.55)");
    }
  }

  const academy = projectPlot(4, 4);
  const academyRoads = districts.map((district) => {
    const point = projectPlot(district.plot.row, district.plot.col);
    return [
      { x: academy.x, y: academy.y + 58 },
      { x: (academy.x + point.x) / 2, y: (academy.y + point.y) / 2 + 64 },
      { x: point.x, y: point.y + 34 },
    ];
  });

  academyRoads.forEach((path) => {
    drawRoad(ctx, path, 16, "#9a7853", "rgba(58, 37, 25, 0.68)");
  });

  [
    { x: academy.x - 230, y: academy.y + 220, scale: 1.2, canopy: "#507847" },
    { x: academy.x - 302, y: academy.y + 146, scale: 0.9, canopy: "#406e3d" },
    { x: academy.x + 278, y: academy.y + 178, scale: 1.1, canopy: "#587d4b" },
    { x: academy.x + 330, y: academy.y + 118, scale: 0.95, canopy: "#4a6d52" },
    { x: academy.x - 120, y: academy.y - 70, scale: 0.8, canopy: "#648c58" },
    { x: academy.x + 118, y: academy.y - 66, scale: 0.75, canopy: "#6b8758" },
  ].forEach((tree) => drawTree(ctx, tree.x, tree.y, tree.scale, tree.canopy));

  drawBlock(ctx, academy.x, academy.y + 10, 210, 126, 148, {
    top: "#b8844f",
    left: "#7c5027",
    right: "#9f6937",
  });
  drawBlock(ctx, academy.x, academy.y - 28, 116, 76, 92, {
    top: "#dcb06d",
    left: "#87613b",
    right: "#b4814f",
  });

  drawStall(ctx, academy.x - 116, academy.y + 72, 0.92, "#e5be6c");
  drawStall(ctx, academy.x + 108, academy.y + 84, 0.88, "#d9a672");
  drawStall(ctx, academy.x + 8, academy.y + 126, 1.05, "#ca8658");
  drawBanner(ctx, academy.x - 132, academy.y + 46, "#f0bf73");
  drawBanner(ctx, academy.x + 134, academy.y + 52, "#95d78f");

  const builtCount = districtOrder.filter((districtId) => state.projects[districtId].built).length;
  for (let houseIndex = 0; houseIndex < 2 + builtCount; houseIndex += 1) {
    const offsetX = -186 + houseIndex * 54;
    const offsetY = 168 + (houseIndex % 2) * 24;
    drawBlock(ctx, academy.x + offsetX, academy.y + offsetY, 52, 34, 42, {
      top: houseIndex % 2 === 0 ? "#d4ae67" : "#c98c58",
      left: "#7c5027",
      right: "#a86d43",
    });
  }

  drawBlock(ctx, academy.x - 226, academy.y + 118, 42, 30, 54, {
    top: "#d4ae67",
    left: "#7b512d",
    right: "#b27b46",
  });
  drawBlock(ctx, academy.x + 226, academy.y + 118, 42, 30, 54, {
    top: "#d4ae67",
    left: "#7b512d",
    right: "#b27b46",
  });
  ctx.fillStyle = "#8c633c";
  ctx.beginPath();
  ctx.moveTo(academy.x - 198, academy.y + 126);
  ctx.lineTo(academy.x + 198, academy.y + 126);
  ctx.lineTo(academy.x + 198, academy.y + 156);
  ctx.lineTo(academy.x - 198, academy.y + 156);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c38c56";
  ctx.fillRect(academy.x - 22, academy.y + 126, 44, 40);

  ctx.fillStyle = "#f8edd5";
  ctx.textAlign = "center";
  ctx.font = '700 44px "Georgia", serif';
  ctx.fillText("Academy of Subjects", academy.x, 74);
  ctx.font = '400 21px "Georgia", serif';
  ctx.fillStyle = "rgba(248, 237, 213, 0.9)";
  ctx.fillText("Science, DTE, maths, English, history, and geography", academy.x, 106);

  districts.forEach((district) => {
    const progress = state.districtProgress[district.id];
    const training = state.training[district.id];
    const plan = learningPlans[district.id];
    const point = projectPlot(district.plot.row, district.plot.col);
    const selected = district.id === state.selectedDistrictId;
    const pulse = 0.5 + Math.sin(state.clock / 550 + district.plot.row) * 0.12;

    ctx.beginPath();
    ctx.fillStyle = selected
      ? district.palette.glow.replace("0.95", "0.28")
      : district.palette.glow.replace("0.95", `${0.12 + pulse * 0.1}`);
    ctx.ellipse(point.x, point.y + 20, 92, 36, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprite = spriteCache.get(district.id);
    const buildingHeight = 48 + progress.stage * 20;

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const scale = 0.46 + progress.stage * 0.05;
      const width = sprite.naturalWidth * scale;
      const height = sprite.naturalHeight * scale;
      ctx.drawImage(sprite, point.x - width / 2, point.y - height + 28, width, height);
    } else {
      drawBlock(ctx, point.x, point.y, 126, 84, buildingHeight, {
        top: district.palette.roof,
        left: district.palette.stone,
        right: district.palette.accent,
      });
      drawBlock(ctx, point.x, point.y - buildingHeight * 0.55, 64, 44, buildingHeight * 0.45, {
        top: "#ead6a4",
        left: district.palette.stone,
        right: "#cba56f",
      });
    }

    if ((district.id === "laboratory" || district.id === "workshop") && (training.studied || progress.stage >= 2)) {
      drawSmokePlume(
        ctx,
        point.x + (district.id === "laboratory" ? 22 : 30),
        point.y - buildingHeight - 8,
        state.clock + district.plot.col * 60,
        district.id === "laboratory" ? "rgba(179, 237, 255, 0.32)" : "rgba(236, 205, 171, 0.36)",
      );
    }

    drawDistrictLandmarks(ctx, district, point);
    drawProjectDetails(ctx, district, point);

    if (state.activeSheet === "battle" && state.selectedDistrictId === district.id) {
      drawStall(ctx, point.x - 64, point.y + 26, 0.72, "#b05d48", "#5f3c2c");
      drawStall(ctx, point.x - 18, point.y + 34, 0.64, "#d09763", "#6e4731");
      drawBanner(ctx, point.x + 56, point.y + 16, "#f0bf73");
    }

    ctx.fillStyle = "rgba(255, 245, 224, 0.9)";
    ctx.fillRect(point.x - 2, point.y - buildingHeight - 48, 4, 42);
    ctx.fillStyle = state.projects[district.id].built ? district.palette.trim : district.palette.accent;
    ctx.beginPath();
    ctx.moveTo(point.x + 2, point.y - buildingHeight - 46);
    ctx.lineTo(point.x + 26, point.y - buildingHeight - 34);
    ctx.lineTo(point.x + 2, point.y - buildingHeight - 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = selected ? "#fff1d6" : "rgba(255, 245, 224, 0.92)";
    ctx.font = '700 20px "Georgia", serif';
    ctx.fillText(district.name, point.x, point.y + 78);
    ctx.font = '400 15px "Georgia", serif';
    ctx.fillStyle = "rgba(255, 240, 210, 0.82)";
    ctx.fillText(
      state.projects[district.id].built
        ? plan.cityProjectName
        : state.activeSheet === "battle" && state.selectedDistrictId === district.id
          ? "Battle rush active"
        : training.remediationRequired
          ? "Recovery locked"
        : training.practicePassed
          ? "Test-ready district"
          : training.studied
            ? "Practice next"
            : "Study next",
      point.x,
      point.y + 100,
    );
  });

  const citizenRoads = districts.flatMap((district, index) => {
    const point = projectPlot(district.plot.row, district.plot.col);
    const outboundColors = ["#9dd88c", "#ffca91", "#a8c7ff", "#ffb7a0", "#cbb08b", "#89d6cf"];
    const inboundColors = ["#f7df8a", "#90d0b5", "#cab9ff", "#ffc9b8", "#f2c39b", "#a9e2f0"];
    return [
      {
        path: [
          { x: academy.x, y: academy.y + 64 },
          { x: (academy.x + point.x) / 2, y: (academy.y + point.y) / 2 + 64 },
          { x: point.x - 8, y: point.y + 36 },
        ],
        color: outboundColors[index % outboundColors.length],
        speed: 0.17 + index * 0.04,
      },
      {
        path: [
          { x: point.x + 12, y: point.y + 40 },
          { x: (academy.x + point.x) / 2, y: (academy.y + point.y) / 2 + 82 },
          { x: academy.x + 22, y: academy.y + 84 },
        ],
        color: inboundColors[index % inboundColors.length],
        speed: 0.12 + index * 0.03,
      },
    ];
  });

  citizenRoads.forEach((road, index) => {
    const progress = ((state.clock / 1000) * road.speed + index * 0.19) % 1;
    drawCitizen(ctx, road.path, progress, road.color);
  });

  drawBoat(ctx, 1080 + Math.sin(state.clock / 700) * 22, 666 + Math.cos(state.clock / 820) * 14, 0.86, "#765a4d");
};

const bindCanvas = () => {
  const canvas = document.querySelector<HTMLCanvasElement>("#city-canvas");

  if (!canvas) {
    return;
  }

  drawCity(canvas);

  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;

    const nearest = districts
      .map((district) => {
        const point = projectPlot(district.plot.row, district.plot.col);
        return {
          districtId: district.id,
          distance: Math.hypot(point.x - x, point.y - y),
        };
      })
      .sort((left, right) => left.distance - right.distance)[0];

    if (!nearest || nearest.distance > 120) {
      return;
    }

    selectDistrict(nearest.districtId);
  });
};

root.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");

  if (!target) {
    return;
  }

  const action = target.dataset.action;

  switch (action) {
    case "select-district": {
      const districtId = target.dataset.districtId as DistrictId | undefined;

      if (!districtId) {
        return;
      }

      selectDistrict(districtId);
      return;
    }
    case "open-sheet": {
      const sheet = target.dataset.sheet as SheetView | undefined;

      if (!sheet) {
        return;
      }

      openSheet(sheet);
      return;
    }
    case "jump-order": {
      const districtId = target.dataset.districtId as DistrictId | undefined;
      const sheet = target.dataset.sheet as SheetView | undefined;

      if (!districtId || !sheet) {
        return;
      }

      focusDistrictAndOpen(districtId, sheet);
      return;
    }
    case "close-sheet":
      closeSheet();
      return;
    case "mark-study-ready":
      markStudyReady();
      return;
    case "complete-project":
      completeProject();
      return;
    case "set-practice-option": {
      const promptId = target.dataset.promptId;
      const optionId = target.dataset.optionId;

      if (!promptId || !optionId) {
        return;
      }

      state.practiceDraft = { ...state.practiceDraft, [promptId]: optionId };
      renderApp();
      return;
    }
    case "submit-practice":
      submitPractice();
      return;
    case "reset-practice":
      resetPracticeFlow();
      return;
    case "set-battle-choice":
      state.battle.selectedChoice = Number(target.dataset.battleChoice);
      renderApp();
      return;
    case "submit-battle":
      submitBattle();
      return;
    case "reset-battle":
      resetBattleFlow();
      return;
    case "cancel-quiz":
      state.activeQuizId = null;
      state.currentOutcome = null;
      resetDrafts();
      state.activeSheet = "research";
      renderApp();
      return;
    case "submit-quiz":
      submitCurrentQuiz();
      return;
    case "set-direction":
      state.comparisonDraft.direction = (target.dataset.direction as ComparisonDirection) ?? null;
      renderApp();
      return;
    case "set-confidence":
      state.comparisonDraft.confidence = Number(target.dataset.confidence) as ConfidenceOption;
      renderApp();
      return;
    case "advance-report":
      advanceAfterResult();
      return;
    case "close-result":
      closeResult();
      return;
    default:
      return;
  }
});

root.addEventListener("input", (event) => {
  const input = event.target as HTMLInputElement;

  if (input.id === "guess-lower") {
    state.intervalDraft.lower = input.value;
  }

  if (input.id === "guess-upper") {
    state.intervalDraft.upper = input.value;
  }
});

function renderApp() {
  root.innerHTML = renderShell();
  bindCanvas();
}

let tickerHandle: number | null = null;

const startTicker = () => {
  tickerHandle = window.setInterval(() => {
    state.clock += 220;
    state.messageIndex = Math.floor(state.clock / 4400) % worldMessages.length;

    if (document.activeElement instanceof HTMLInputElement) {
      return;
    }

    if (state.activeSheet !== null) {
      return;
    }

    renderApp();
  }, 700);
};

renderApp();
loadDistrictSprites();

if (tickerHandle === null) {
  startTicker();
}

window.render_game_to_text = () =>
  JSON.stringify(
    {
      mode: "city-builder-learning",
      selectedDistrict: state.selectedDistrictId,
      activeSheet: state.activeSheet,
      currentRound: state.currentRound,
      activeQuizId: state.activeQuizId,
      score: state.score,
      wisdom: state.wisdom,
      citizens: state.citizens,
      prestige: state.prestige,
      totalLosses: getTotalLosses(),
      totalIncidents: getTotalIncidents(),
      unlockedDistricts: districtOrder.filter((districtId) => state.districtProgress[districtId].unlocked),
      districtProgress: districtOrder.map((districtId) => ({
        districtId,
        stage: state.districtProgress[districtId].stage,
        completed: state.districtProgress[districtId].completed,
        studied: state.training[districtId].studied,
        practicePassed: state.training[districtId].practicePassed,
        remediationRequired: state.training[districtId].remediationRequired,
        incidents: state.training[districtId].incidents,
        losses: state.training[districtId].losses,
      })),
      answeredQuizIds: state.answeredQuizIds,
      note: "Canvas origin is top-left. The central academy sits near (640, 480) with districts arranged on an isometric grid.",
    },
    null,
    2,
  );

window.advanceTime = (ms = 1000) => {
  state.clock += ms;
  state.messageIndex = (state.messageIndex + 1) % worldMessages.length;
  renderApp();
};

declare global {
  interface Window {
    render_game_to_text: () => string;
    advanceTime: (ms?: number) => void;
  }
}
