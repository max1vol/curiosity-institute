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
  worldMessages,
  type ComparisonDirection,
  type ConfidenceOption,
  type District,
  type DistrictId,
  type DistrictLearningPlan,
  type DistrictProgressMap,
  type PracticePrompt,
  type Quiz,
  type QuizRound,
} from "./gameData";

type SheetView = "study" | "practice" | "test" | "ledger";

type QuizOutcome = {
  correct: boolean;
  points: number;
  percentile: number;
  accuracy: number;
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
};

type DistrictTrainingMap = Record<DistrictId, DistrictTrainingState>;

type AppState = {
  selectedDistrictId: DistrictId;
  districtProgress: DistrictProgressMap;
  training: DistrictTrainingMap;
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
  eventLog: string[];
  messageIndex: number;
  clock: number;
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

const buildInitialTrainingState = (): DistrictTrainingMap =>
  districtOrder.reduce(
    (accumulator, districtId) => {
      accumulator[districtId] = {
        studied: false,
        practicePassed: false,
        practiceAttempts: 0,
        studyVisits: 0,
      };
      return accumulator;
    },
    {} as DistrictTrainingMap,
  );

const spriteCache = new Map<DistrictId, HTMLImageElement>();

const loadDistrictSprites = () => {
  districts.forEach((district) => {
    const image = new Image();
    image.src = district.sprite;
    image.onload = () => renderApp();
    image.onerror = () => spriteCache.delete(district.id);
    spriteCache.set(district.id, image);
  });
};

const state: AppState = {
  selectedDistrictId: districtOrder[0],
  districtProgress: buildInitialDistrictState(),
  training: buildInitialTrainingState(),
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
  eventLog: ["The academy has switched to sheet-led lessons: study, adapt, then estimate."],
  messageIndex: 0,
  clock: 0,
};

const getSelectedDistrict = () => districtsById[state.selectedDistrictId];

const getSelectedPlan = () => learningPlans[state.selectedDistrictId];

const getTraining = (districtId = state.selectedDistrictId) => state.training[districtId];

const getQuizById = (quizId: string | null) => quizzes.find((quiz) => quiz.id === quizId) ?? null;

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

const updateTotals = () => {
  const totalCompleted = state.answeredQuizIds.length;
  const studiedCount = districtOrder.filter((districtId) => state.training[districtId].studied).length;
  const practicePassedCount = districtOrder.filter(
    (districtId) => state.training[districtId].practicePassed,
  ).length;
  const restoredDistricts = Object.values(state.districtProgress).filter((district) => district.stage >= 3)
    .length;

  state.wisdom = totalCompleted * 18 + studiedCount * 12 + practicePassedCount * 18 + restoredDistricts * 12;
  state.citizens = 120 + totalCompleted * 14 + practicePassedCount * 26 + restoredDistricts * 36;
  state.prestige = clamp(Math.round(state.score / 14) + studiedCount * 8 + practicePassedCount * 12, 0, 999);
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
  if (state.currentRound === 1 && countRoundAnswers(1) >= 8) {
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
    guessLabel: `${formatNumber(lower)} to ${formatNumber(upper)} ${quiz.unit}`,
    actualLabel: `${formatNumber(quiz.answer)} ${quiz.unit}`,
    summary: contains
      ? "Your interval captured the answer and kept the district moving."
      : "Your interval missed the answer, so the district has sent you back for another applied drill.",
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

  return {
    correct,
    points: correct ? rewardMap[confidence] : penaltyMap[confidence],
    percentile: correct ? clamp(52 + confidence / 2, 50, 96) : clamp(40 - confidence / 3, 6, 38),
    accuracy: correct ? confidence : clamp(100 - confidence, 15, 45),
    guessLabel: `${direction === "above" ? "Above" : "Below"} ${formatNumber(
      quiz.comparisonValue ?? 0,
    )} ${quiz.unit} at ${confidence}% confidence`,
    actualLabel: `${formatNumber(quiz.answer)} ${quiz.unit}`,
    summary: correct
      ? "Your quick judgment held under pressure."
      : "The fast call missed, so the district has reopened its practice sheet.",
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

  if (!outcome.correct) {
    state.training[quiz.districtId].practicePassed = false;
  }

  unlockNextDistrict(quiz.districtId);
  maybeAdvanceRound();
  updateTotals();

  pushEvent(
    `${quiz.title}: ${outcome.correct ? "success" : "setback"} in ${districtsById[quiz.districtId].name} (${outcome.points >= 0 ? "+" : ""}${outcome.points}).`,
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
  const plan = getSelectedPlan();
  const feedback = plan.practicePrompts.map(buildPracticeFeedback);
  const score = feedback.filter((entry) => entry.correct).length;
  const passed = score === feedback.length;

  state.practiceOutcome = {
    passed,
    score,
    total: feedback.length,
    summary: passed
      ? "The district trusts your memory and adaptation, so the estimation test is now open."
      : "The district is not convinced yet. Review the rule and adapt it more carefully before testing again.",
    feedback,
  };

  const training = getTraining();
  training.practiceAttempts += 1;
  training.practicePassed = passed;
  state.activeQuizId = null;
  state.currentOutcome = null;
  resetDrafts();
  updateTotals();

  pushEvent(
    passed
      ? `${district.name}: adaptation drill passed. The next estimate test is unlocked.`
      : `${district.name}: adaptation drill failed. The lesson sheet should be reviewed again.`,
  );

  renderApp();
};

const resetPracticeFlow = () => {
  resetPracticeDraft();
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

const renderDistrictSwitcher = () =>
  districts
    .map((district) => {
      const progress = state.districtProgress[district.id];
      const completion = getDistrictCompletion(district.id);
      const selected = district.id === state.selectedDistrictId;
      const mastery = getMasteryPercent(district.id);
      const training = state.training[district.id];
      const status = !progress.unlocked
        ? "Locked"
        : training.practicePassed
          ? "Test-ready"
          : training.studied
            ? "Practice"
            : "Study";

      return `
        <button class="district-chip ${selected ? "district-chip--selected" : ""}" data-action="select-district" data-district-id="${district.id}" ${
          progress.unlocked ? "" : "disabled"
        }>
          <div class="district-chip__icon" style="background:linear-gradient(145deg, ${district.palette.accent}, ${district.palette.stone})">
            ${district.icon}
          </div>
          <div class="district-chip__body">
            <strong>${district.name}</strong>
            <small>${progress.unlocked ? district.tagline : "Unlock by restoring the previous district."}</small>
            <div class="district-chip__meta">
              <span>${completion.completed}/${completion.total} tests</span>
              <span>${status}</span>
              <span>${mastery}% mastery</span>
            </div>
          </div>
        </button>
      `;
    })
    .join("");

const renderSelectedDistrictCard = () => {
  const district = getSelectedDistrict();
  const progress = state.districtProgress[district.id];
  const completion = getDistrictCompletion(district.id);
  const training = getTraining();
  const nextRequirement = getDistrictRequirement(district.id);

  return `
    <section class="overlay-card overlay-card--district">
      <p class="eyebrow">Selected District</p>
      <div class="overlay-heading">
        <div class="selected-seal" style="background:linear-gradient(145deg, ${district.palette.accent}, ${district.palette.stone})">
          ${district.icon}
        </div>
        <div>
          <h2>${district.name}</h2>
          <p>${district.summary}</p>
        </div>
      </div>
      <div class="status-grid">
        <div class="status-tile">
          <span>Mentor</span>
          <strong>${district.mentor}</strong>
        </div>
        <div class="status-tile">
          <span>Stage</span>
          <strong>${progress.stage}/5</strong>
        </div>
        <div class="status-tile">
          <span>Study</span>
          <strong>${training.studied ? "Reviewed" : "Needed"}</strong>
        </div>
        <div class="status-tile">
          <span>Practice</span>
          <strong>${training.practicePassed ? "Passed" : "Needed"}</strong>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-bar__fill" style="width:${(completion.completed / completion.total) * 100}%"></div>
      </div>
      <p class="district-requirement">${nextRequirement}</p>
      <div class="district-switcher">${renderDistrictSwitcher()}</div>
    </section>
  `;
};

const renderCampaignCard = () => {
  const roundOneDone = countRoundAnswers(1);
  const roundTwoDone = countRoundAnswers(2);
  const restoredDistricts = districtOrder.filter(
    (districtId) => state.districtProgress[districtId].stage >= 3,
  ).length;

  return `
    <section class="overlay-card overlay-card--campaign">
      <p class="eyebrow">Campaign Board</p>
      <div class="campaign-grid">
        <div class="status-tile">
          <span>Round 1</span>
          <strong>${roundOneDone}/12</strong>
        </div>
        <div class="status-tile ${state.currentRound === 1 ? "status-tile--locked" : ""}">
          <span>Round 2</span>
          <strong>${state.currentRound === 1 ? "Locked" : `${roundTwoDone}/8`}</strong>
        </div>
        <div class="status-tile">
          <span>Districts Restored</span>
          <strong>${restoredDistricts}/4</strong>
        </div>
        <div class="status-tile">
          <span>Reputation</span>
          <strong>${formatNumber(state.prestige)}</strong>
        </div>
      </div>
      <div class="log-card">
        <strong>Recent log</strong>
        <div class="log-list">
          ${state.eventLog
            .map(
              (entry) => `
                <p>${entry}</p>
              `,
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
};

const renderCommandBar = () => {
  const buttons: Array<{ sheet: SheetView; label: string; sublabel: string }> = [
    { sheet: "study", label: "Study", sublabel: "Base knowledge" },
    { sheet: "practice", label: "Practice", sublabel: "Adapt the rule" },
    { sheet: "test", label: "Test", sublabel: "Estimation trial" },
    { sheet: "ledger", label: "Ledger", sublabel: "District progress" },
  ];

  return `
    <div class="command-bar">
      ${buttons
        .map(
          (button) => `
            <button class="command-button ${state.activeSheet === button.sheet ? "command-button--active" : ""}" data-action="open-sheet" data-sheet="${button.sheet}">
              <strong>${button.label}</strong>
              <span>${button.sublabel}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;
};

const renderSheetTabs = () => {
  const tabs: Array<{ id: SheetView; label: string }> = [
    { id: "study", label: "Study" },
    { id: "practice", label: "Practice" },
    { id: "test", label: "Test" },
    { id: "ledger", label: "Ledger" },
  ];

  return tabs
    .map(
      (tab) => `
        <button class="sheet-tab ${state.activeSheet === tab.id ? "sheet-tab--active" : ""}" data-action="open-sheet" data-sheet="${tab.id}">
          ${tab.label}
        </button>
      `,
    )
    .join("");
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
        <button class="button button--ghost" data-action="close-sheet">Keep exploring city</button>
        <button class="button" data-action="mark-study-ready">
          ${training.studied ? "Review complete, go to practice" : `I've studied ${district.name}`}
        </button>
      </div>
    </section>
  `;
};

const renderPracticeForm = (plan: DistrictLearningPlan) => {
  const allAnswered = plan.practicePrompts.every((prompt) => state.practiceDraft[prompt.id]);

  return `
    <section class="sheet-section">
      <p class="eyebrow">Adaptation Drill</p>
      <h2>Use the rule in a new context</h2>
      <p>${plan.adaptationHint}</p>
      ${plan.practicePrompts
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
        <button class="button" data-action="submit-practice" ${allAnswered ? "" : "disabled"}>Submit adaptation check</button>
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
      </div>
      <div class="feedback-card ${outcome.correct ? "feedback-card--success" : "feedback-card--danger"}">
        <strong>Why this answer?</strong>
        <p>${quiz.explanation}</p>
        <p><span>Source:</span> ${quiz.source}</p>
        ${
          outcome.correct
            ? ""
            : `<p><span>Next step:</span> Pass the adaptation drill again before the next estimate will open.</p>`
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

const renderSheetBody = () => {
  const district = getSelectedDistrict();
  const plan = getSelectedPlan();

  switch (state.activeSheet) {
    case "study":
      return renderStudyBody(district, plan);
    case "practice":
      return renderPracticeBody(plan);
    case "test":
      return renderTestBody(district, plan);
    case "ledger":
      return renderLedgerBody(district, plan);
    default:
      return "";
  }
};

const renderSheet = () => {
  if (!state.activeSheet) {
    return "";
  }

  const district = getSelectedDistrict();

  return `
    <div class="sheet-shell">
      <button class="sheet-backdrop" data-action="close-sheet" aria-label="Close sheet"></button>
      <aside class="sheet-panel" aria-label="${district.name} ${state.activeSheet} sheet">
        <div class="sheet-header">
          <div>
            <p class="eyebrow">Sheet UI</p>
            <h2>${district.name}</h2>
            <p>${district.lore}</p>
          </div>
          <button class="icon-button" data-action="close-sheet" aria-label="Close sheet">×</button>
        </div>
        <div class="sheet-tabs">${renderSheetTabs()}</div>
        <div class="sheet-body">${renderSheetBody()}</div>
      </aside>
    </div>
  `;
};

const renderShell = () => {
  const district = getSelectedDistrict();

  return `
    <div class="game-shell">
      <header class="topbar">
        <div class="topbar__crest">
          <div class="crest__icon">FE</div>
          <div>
            <p class="eyebrow">Forge of English</p>
            <h1>Study first, adapt next, then pass the estimation test.</h1>
          </div>
        </div>
        <div class="topbar__era">Round ${state.currentRound}: ${
          state.currentRound === 1 ? "Estimation Intervals" : "Above or Below"
        }</div>
        <div class="topbar__stats">
          <div class="resource-pill">
            <span>Fluency</span>
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
          <canvas id="city-canvas" width="1280" height="860" aria-label="Isometric English learning city"></canvas>
          <div class="stage-banner">
            <p class="eyebrow">City Chronicle</p>
            <h2>${district.name}</h2>
            <p>${worldMessages[state.messageIndex % worldMessages.length]}</p>
          </div>
          ${renderSelectedDistrictCard()}
          ${renderCampaignCard()}
          ${renderCommandBar()}
        </div>
      </main>
      ${renderSheet()}
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

const drawCity = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#29455a");
  sky.addColorStop(0.34, "#6f8f69");
  sky.addColorStop(1, "#172117");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 228, 161, 0.16)";
  ctx.beginPath();
  ctx.ellipse(1020, 112, 180, 80, -0.18, 0, Math.PI * 2);
  ctx.fill();

  const tileWidth = 126;
  const tileHeight = 64;

  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const { x, y } = projectPlot(row, col);
      const shade = (row + col) % 2 === 0 ? "#6a8f58" : "#5b7f4d";
      renderTile(ctx, x, y, tileWidth, tileHeight, shade, "rgba(25, 42, 21, 0.55)");
    }
  }

  const academy = projectPlot(4, 4);
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

  ctx.fillStyle = "#f8edd5";
  ctx.textAlign = "center";
  ctx.font = '700 44px "Georgia", serif';
  ctx.fillText("Academy of English", academy.x, 74);
  ctx.font = '400 21px "Georgia", serif';
  ctx.fillStyle = "rgba(248, 237, 213, 0.9)";
  ctx.fillText("Study, adapt, then estimate", academy.x, 106);

  districts.forEach((district) => {
    const progress = state.districtProgress[district.id];
    const training = state.training[district.id];
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

    ctx.fillStyle = selected ? "#fff1d6" : "rgba(255, 245, 224, 0.92)";
    ctx.font = '700 20px "Georgia", serif';
    ctx.fillText(district.name, point.x, point.y + 78);
    ctx.font = '400 15px "Georgia", serif';
    ctx.fillStyle = "rgba(255, 240, 210, 0.82)";
    ctx.fillText(
      training.practicePassed ? "Sheet cleared" : training.studied ? "Practice next" : "Study next",
      point.x,
      point.y + 100,
    );
  });
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
    case "close-sheet":
      closeSheet();
      return;
    case "mark-study-ready":
      markStudyReady();
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
    case "cancel-quiz":
      state.activeQuizId = null;
      state.currentOutcome = null;
      resetDrafts();
      state.activeSheet = null;
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
    state.clock += 180;

    if (document.activeElement instanceof HTMLInputElement) {
      return;
    }

    if (state.activeSheet === "test" && state.currentOutcome === null) {
      return;
    }

    state.messageIndex = (state.messageIndex + 1) % worldMessages.length;
    renderApp();
  }, 5200);
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
      unlockedDistricts: districtOrder.filter((districtId) => state.districtProgress[districtId].unlocked),
      districtProgress: districtOrder.map((districtId) => ({
        districtId,
        stage: state.districtProgress[districtId].stage,
        completed: state.districtProgress[districtId].completed,
        studied: state.training[districtId].studied,
        practicePassed: state.training[districtId].practicePassed,
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
