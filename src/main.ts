import "./styles.css";
import {
  buildInitialDistrictState,
  confidenceOptions,
  districtOrder,
  districts,
  districtsById,
  type ComparisonDirection,
  type ConfidenceOption,
  type District,
  type DistrictProgressMap,
  type Quiz,
  type QuizRound,
  quizzes,
  quizzesByDistrict,
  worldMessages,
} from "./gameData";

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

type AppState = {
  selectedDistrictId: string;
  districtProgress: DistrictProgressMap;
  answeredQuizIds: string[];
  score: number;
  wisdom: number;
  citizens: number;
  prestige: number;
  currentRound: QuizRound;
  tutorialRound: QuizRound | null;
  activeQuizId: string | null;
  currentOutcome: QuizOutcome | null;
  intervalDraft: IntervalDraft;
  comparisonDraft: ComparisonDraft;
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

const countRoundAnswers = (state: AppState, round: QuizRound) =>
  state.answeredQuizIds.filter((quizId) => quizzes.find((quiz) => quiz.id === quizId)?.round === round)
    .length;

const spriteCache = new Map<string, HTMLImageElement>();

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
  answeredQuizIds: [],
  score: 0,
  wisdom: 0,
  citizens: 120,
  prestige: 0,
  currentRound: 1,
  tutorialRound: 1,
  activeQuizId: null,
  currentOutcome: null,
  intervalDraft: { lower: "", upper: "" },
  comparisonDraft: { direction: null, confidence: 65 },
  eventLog: ["The English academy gates are open again."],
  messageIndex: 0,
  clock: 0,
};

const resetDrafts = () => {
  state.intervalDraft = { lower: "", upper: "" };
  state.comparisonDraft = { direction: null, confidence: 65 };
};

const getSelectedDistrict = () => districtsById[state.selectedDistrictId];

const getQuizById = (quizId: string | null) => quizzes.find((quiz) => quiz.id === quizId) ?? null;

const getNextQuizForDistrict = (districtId: string) => {
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

const getDistrictCompletion = (districtId: string) => {
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

const updateTotals = () => {
  const totalCompleted = state.answeredQuizIds.length;
  const restoredDistricts = Object.values(state.districtProgress).filter((district) => district.stage >= 3)
    .length;
  state.wisdom = totalCompleted * 18 + restoredDistricts * 12;
  state.citizens = 120 + totalCompleted * 14 + restoredDistricts * 36;
  state.prestige = clamp(Math.round(state.score / 14) + restoredDistricts * 20, 0, 999);
};

const unlockNextDistrict = (districtId: District["id"]) => {
  const currentIndex = districtOrder.findIndex((entry) => entry === districtId);
  const nextDistrictId = districtOrder[currentIndex + 1];

  if (!nextDistrictId) {
    return;
  }

  const current = state.districtProgress[districtId];
  const next = state.districtProgress[nextDistrictId];

  if (!next.unlocked && current.completed >= 2) {
    next.unlocked = true;
    state.eventLog.unshift(`${districtsById[nextDistrictId].name} has been chartered for new lessons.`);
  }
};

const maybeAdvanceRound = () => {
  if (state.currentRound === 1 && countRoundAnswers(state, 1) >= 8) {
    state.currentRound = 2;
    state.tutorialRound = 2;
    state.eventLog.unshift("Round 2 unlocked: the forecasters now judge Above or Below challenges.");
  }
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
      ? "Your confidence interval captured the truth."
      : "Your interval missed the mark, so the guild had to spend extra effort correcting it.",
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
      ? "Your fast judgment was correct."
      : "The quick call was wrong, so the district lost tempo on the repair.",
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

  unlockNextDistrict(quiz.districtId);
  maybeAdvanceRound();
  updateTotals();

  state.eventLog.unshift(
    `${quiz.title}: ${outcome.correct ? "success" : "setback"} for ${districtsById[quiz.districtId].name} (${outcome.points >= 0 ? "+" : ""}${outcome.points}).`,
  );
  state.eventLog = state.eventLog.slice(0, 5);
};

const startNextQuiz = () => {
  const district = getSelectedDistrict();
  const progress = state.districtProgress[district.id];

  if (!progress.unlocked) {
    return;
  }

  const nextQuiz = getNextQuizForDistrict(district.id);

  state.activeQuizId = nextQuiz?.id ?? null;
  state.currentOutcome = null;
  resetDrafts();
  renderApp();
};

const submitCurrentQuiz = () => {
  const quiz = getQuizById(state.activeQuizId);

  if (!quiz) {
    return;
  }

  const outcome =
    quiz.round === 1
      ? calculateIntervalOutcome(
          quiz,
          Number(state.intervalDraft.lower),
          Number(state.intervalDraft.upper),
        )
      : calculateComparisonOutcome(
          quiz,
          state.comparisonDraft.direction ?? "above",
          state.comparisonDraft.confidence,
        );

  recordOutcome(quiz, outcome);
  renderApp();
};

const advanceAfterResult = () => {
  state.activeQuizId = null;
  state.currentOutcome = null;
  resetDrafts();
  renderApp();
};

const renderMissionList = () => {
  const restoredDistricts = Object.values(state.districtProgress).filter((district) => district.stage >= 3)
    .length;
  const missions = [
    {
      title: "Open the fast-answer round",
      copy: "Complete eight interval lessons so the city unlocks Above or Below.",
      complete: state.currentRound === 2,
    },
    {
      title: "Restore two English districts",
      copy: "Push any two quarters to stage three or higher.",
      complete: restoredDistricts >= 2,
    },
    {
      title: "Reach 600 fluency",
      copy: "Accumulate enough points to draw a full city of learners.",
      complete: state.score >= 600,
    },
  ];

  return missions
    .map(
      (mission) => `
        <article class="mission ${mission.complete ? "mission--complete" : ""}">
          <div>
            <h3>${mission.title}</h3>
            <p>${mission.copy}</p>
          </div>
          <span>${mission.complete ? "Done" : "Active"}</span>
        </article>
      `,
    )
    .join("");
};

const renderDistrictList = () =>
  districts
    .map((district) => {
      const progress = state.districtProgress[district.id];
      const completion = getDistrictCompletion(district.id);
      const selected = district.id === state.selectedDistrictId;
      const progressWidth = (completion.completed / completion.total) * 100;

      return `
        <button class="district-row ${selected ? "district-row--selected" : ""}" data-action="select-district" data-district-id="${district.id}" ${
          progress.unlocked ? "" : "disabled"
        }>
          <div class="district-row__icon" style="background:linear-gradient(145deg, ${district.palette.accent}, ${district.palette.stone})">
            ${district.icon}
          </div>
          <div class="district-row__copy">
            <strong>${district.name}</strong>
            <small>${progress.unlocked ? district.tagline : "Unlock this district by restoring the previous one."}</small>
            <small>${completion.completed}/${completion.total} lessons completed</small>
            <div class="progress-track">
              <div class="progress-track__fill" style="width:${progressWidth}%"></div>
            </div>
          </div>
        </button>
      `;
    })
    .join("");

const renderDetailPanel = (district: District) => {
  const progress = state.districtProgress[district.id];
  const completion = getDistrictCompletion(district.id);
  const canLaunch = progress.unlocked && Boolean(getNextQuizForDistrict(district.id));

  return `
    <section class="panel-card" style="--district-glow:${district.palette.glow}; --district-roof:${district.palette.roof}">
      <p class="eyebrow">English Quarter</p>
      <div class="selected-header">
        <div class="selected-badge">${district.icon}</div>
        <div>
          <h2>${district.name}</h2>
          <p>${district.tagline}</p>
        </div>
      </div>
      <p class="selected-description">${district.summary} ${district.lore}</p>
      <div class="selected-stats">
        <div>
          <span>Mentor</span>
          <strong>${district.mentor}</strong>
        </div>
        <div>
          <span>Restored</span>
          <strong>${completion.completed}/${completion.total}</strong>
        </div>
        <div>
          <span>Stage</span>
          <strong>${progress.stage}/5</strong>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-track__fill" style="width:${(completion.completed / completion.total) * 100}%"></div>
      </div>
      <button class="button ${canLaunch ? "" : "button--disabled"}" data-action="launch-quiz" ${
        canLaunch ? "" : "disabled"
      }>
        ${progress.unlocked ? (canLaunch ? "Launch next lesson" : "District mastered") : "District locked"}
      </button>
    </section>
  `;
};

const renderQuizPanel = () => {
  const quiz = getQuizById(state.activeQuizId);
  const district = getSelectedDistrict();
  const nextQuiz = getNextQuizForDistrict(district.id);

  if (!quiz && !state.currentOutcome) {
    return `
      <section class="panel-card panel-card--quiz">
        <p class="eyebrow">English Lesson Desk</p>
        <h2>${nextQuiz ? "Ready for the next challenge" : "District report complete"}</h2>
        <p class="quiz-prompt">
          ${
            nextQuiz
              ? `Round ${nextQuiz.round} is ready in ${district.name}. Start when you want a fresh estimation test.`
              : "Choose another district or wait for Round 2 if more forecasting missions are still locked."
          }
        </p>
        <div class="quiz-hint">
          <strong>Reference cues</strong>
          <p>${district.summary}</p>
        </div>
      </section>
    `;
  }

  if (quiz && !state.currentOutcome) {
    const intervalInputs =
      quiz.round === 1
        ? `
          <div class="guess-fields">
            <label>
              <span>Lower bound</span>
              <input id="guess-lower" type="number" min="${quiz.min}" max="${quiz.max}" value="${state.intervalDraft.lower}" />
            </label>
            <label>
              <span>Upper bound</span>
              <input id="guess-upper" type="number" min="${quiz.min}" max="${quiz.max}" value="${state.intervalDraft.upper}" />
            </label>
          </div>
          <div class="quiz-hint">
            <strong>Round 1: Estimation Intervals</strong>
            <p>Give a 90% confidence interval. Narrower ranges can score bigger if they still capture the answer.</p>
          </div>
        `
        : `
          <div class="choice-grid">
            <button class="choice-pill ${state.comparisonDraft.direction === "above" ? "choice-pill--selected" : ""}" data-action="set-direction" data-direction="above">Above ${formatNumber(
              quiz.comparisonValue ?? 0,
            )}</button>
            <button class="choice-pill ${state.comparisonDraft.direction === "below" ? "choice-pill--selected" : ""}" data-action="set-direction" data-direction="below">Below ${formatNumber(
              quiz.comparisonValue ?? 0,
            )}</button>
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
          <div class="quiz-hint">
            <strong>Round 2: Above or Below</strong>
            <p>Higher confidence wins more when correct, but costs more when wrong.</p>
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
      <section class="panel-card panel-card--quiz">
        <p class="eyebrow">Round ${quiz.round}</p>
        <h2>${quiz.title}</h2>
        <p class="quiz-prompt">${quiz.prompt}</p>
        <p class="quiz-prompt"><strong>${quiz.question}</strong></p>
        <div class="anchor-stack">
          ${quiz.anchors
            .map(
              (anchor) => `
                <div class="anchor-chip">${anchor}</div>
              `,
            )
            .join("")}
        </div>
        ${intervalInputs}
        <div class="quiz-actions">
          <button class="button button--ghost" data-action="cancel-quiz">Stand down</button>
          <button class="button" data-action="submit-quiz" ${submitDisabled ? "disabled" : ""}>Submit estimate</button>
        </div>
      </section>
    `;
  }

  const quizForResult = quiz ?? getQuizById(state.answeredQuizIds.at(-1) ?? null);
  const outcome = state.currentOutcome;

  if (!quizForResult || !outcome) {
    return "";
  }

  return `
    <section class="panel-card panel-card--quiz">
      <p class="eyebrow">${outcome.correct ? "Result: Success" : "Result: Correction needed"}</p>
      <h2>${quizForResult.title}</h2>
      <p class="quiz-prompt">${outcome.summary}</p>
      <div class="result-grid">
        <div>
          <span>Your call</span>
          <strong>${outcome.guessLabel}</strong>
        </div>
        <div>
          <span>Correct answer</span>
          <strong>${outcome.actualLabel}</strong>
        </div>
        <div>
          <span>Points</span>
          <strong>${outcome.points >= 0 ? "+" : ""}${outcome.points}</strong>
        </div>
        <div>
          <span>Accuracy</span>
          <strong>${outcome.accuracy}%</strong>
        </div>
        <div>
          <span>Percentile</span>
          <strong>${outcome.percentile}th</strong>
        </div>
        <div>
          <span>Reward</span>
          <strong>${quizForResult.reward}</strong>
        </div>
      </div>
      <div class="result-fact">
        <strong>Why this answer?</strong>
        <p>${quizForResult.explanation}</p>
        <p><em>Source:</em> ${quizForResult.source}</p>
      </div>
      <div class="quiz-actions">
        <button class="button button--ghost" data-action="close-report">Close report</button>
        <button class="button" data-action="advance-report">Next briefing</button>
      </div>
    </section>
  `;
};

const renderDockPanel = () => {
  const district = getSelectedDistrict();
  const completion = getDistrictCompletion(district.id);
  const roundOneDone = countRoundAnswers(state, 1);
  const roundTwoDone = countRoundAnswers(state, 2);

  return `
    <section class="panel-card">
      <p class="eyebrow">City Ledger</p>
      <div class="dock-grid">
        <div class="dock-chip">
          <span>Round 1 cleared</span>
          <strong>${roundOneDone}/12</strong>
        </div>
        <div class="dock-chip">
          <span>Round 2 cleared</span>
          <strong>${roundTwoDone}/8</strong>
        </div>
        <div class="dock-chip">
          <span>${district.name}</span>
          <strong>${completion.completed}/${completion.total} finished</strong>
        </div>
        <div class="dock-chip ${state.currentRound === 1 ? "dock-chip--locked" : ""}">
          <span>Forecast chamber</span>
          <strong>${state.currentRound === 1 ? "Locked to Round 1" : "Round 2 active"}</strong>
        </div>
      </div>
      <div class="quiz-hint">
        <strong>Recent city log</strong>
        <p>${state.eventLog.map((entry) => `• ${entry}`).join("<br />")}</p>
      </div>
    </section>
  `;
};

const renderTutorial = () => {
  if (state.tutorialRound === null) {
    return "";
  }

  const roundCopy =
    state.tutorialRound === 1
      ? {
          title: "Round 1: Estimation Intervals",
          body: "Answer with a lower and upper bound. A narrower interval can win more points if it still captures the truth, just like a careful forecaster staking a precise claim.",
        }
      : {
          title: "Round 2: Above or Below",
          body: "The city now wants faster judgments. Choose Above or Below and pick your confidence. Higher confidence wins bigger if correct and loses more if wrong.",
        };

  return `
    <div class="tutorial-shell">
      <div class="tutorial-card">
        <p class="eyebrow">Lesson Briefing</p>
        <h2>${roundCopy.title}</h2>
        <p>${roundCopy.body}</p>
        <div class="tutorial-actions">
          <button class="button button--ghost" data-action="dismiss-tutorial">Review city first</button>
          <button class="button" data-action="dismiss-tutorial-and-launch">Got it</button>
        </div>
      </div>
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
            <h1>Build an English-learning city through estimation quests.</h1>
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
            <span>Word Power</span>
            <strong>${formatNumber(state.wisdom)}</strong>
          </div>
          <div class="resource-pill">
            <span>Learners</span>
            <strong>${formatNumber(state.citizens)}</strong>
          </div>
        </div>
      </header>

      <aside class="panel">
        <section class="panel-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Lesson Goals</p>
              <h2>Fluency campaign</h2>
            </div>
          </div>
          <div class="mission-list">${renderMissionList()}</div>
        </section>

        <section class="panel-card">
          <div class="section-heading">
            <div>
              <p class="eyebrow">English Map</p>
              <h2>Choose a district</h2>
            </div>
          </div>
          <div class="district-list">${renderDistrictList()}</div>
        </section>
      </aside>

      <main class="panel panel--centre">
        <div class="city-stage">
          <canvas id="city-canvas" width="1280" height="860" aria-label="Isometric English learning city"></canvas>
          <div class="stage-overlay">
            <div class="stage-banner">
              <p class="eyebrow">Lesson Chronicle</p>
              <h2>${district.name}</h2>
              <p>${worldMessages[state.messageIndex % worldMessages.length]}</p>
            </div>
          </div>
        </div>
      </main>

      <aside class="panel">
        ${renderDetailPanel(district)}
        ${renderQuizPanel()}
        ${renderDockPanel()}
      </aside>
      ${renderTutorial()}
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
  sky.addColorStop(0, "#2a3d52");
  sky.addColorStop(0.34, "#5f7e61");
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
      const shade = (row + col) % 2 === 0 ? "#688c56" : "#5d7f4e";
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
  ctx.fillText("A KS2 city rebuilt through English estimation", academy.x, 106);

  districts.forEach((district) => {
    const progress = state.districtProgress[district.id];
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

    ctx.fillStyle = selected ? "#fff1d6" : "rgba(255, 245, 224, 0.9)";
    ctx.font = '700 20px "Georgia", serif';
    ctx.fillText(district.name, point.x, point.y + 78);
    ctx.font = '400 15px "Georgia", serif';
    ctx.fillStyle = "rgba(255, 240, 210, 0.82)";
    ctx.fillText(`Stage ${progress.stage}/5`, point.x, point.y + 100);
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

    const progress = state.districtProgress[nearest.districtId];

    if (!progress.unlocked) {
      return;
    }

    state.selectedDistrictId = nearest.districtId;
    state.activeQuizId = null;
    state.currentOutcome = null;
    resetDrafts();
    renderApp();
  });
};

const bindInteractions = () => {
  root.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
    element.addEventListener("click", () => {
      const action = element.dataset.action;

      switch (action) {
        case "select-district": {
          const districtId = element.dataset.districtId;
          if (!districtId) {
            return;
          }

          state.selectedDistrictId = districtId;
          state.activeQuizId = null;
          state.currentOutcome = null;
          resetDrafts();
          renderApp();
          return;
        }
        case "launch-quiz":
        case "dismiss-tutorial-and-launch":
          state.tutorialRound = null;
          startNextQuiz();
          return;
        case "dismiss-tutorial":
          state.tutorialRound = null;
          renderApp();
          return;
        case "cancel-quiz":
          state.activeQuizId = null;
          state.currentOutcome = null;
          resetDrafts();
          renderApp();
          return;
        case "submit-quiz":
          submitCurrentQuiz();
          return;
        case "advance-report":
          advanceAfterResult();
          startNextQuiz();
          return;
        case "close-report":
          advanceAfterResult();
          return;
        case "set-direction":
          state.comparisonDraft.direction = (element.dataset.direction as ComparisonDirection) ?? null;
          renderApp();
          return;
        case "set-confidence":
          state.comparisonDraft.confidence = Number(element.dataset.confidence) as ConfidenceOption;
          renderApp();
          return;
        default:
          return;
      }
    });
  });

  const lowerInput = root.querySelector<HTMLInputElement>("#guess-lower");
  const upperInput = root.querySelector<HTMLInputElement>("#guess-upper");

  lowerInput?.addEventListener("input", (event) => {
    state.intervalDraft.lower = (event.currentTarget as HTMLInputElement).value;
  });

  upperInput?.addEventListener("input", (event) => {
    state.intervalDraft.upper = (event.currentTarget as HTMLInputElement).value;
  });
};

function renderApp() {
  root.innerHTML = renderShell();
  bindInteractions();
  bindCanvas();
}

let tickerHandle: number | null = null;

const startTicker = () => {
  tickerHandle = window.setInterval(() => {
    state.messageIndex = (state.messageIndex + 1) % worldMessages.length;
    state.clock += 200;
    renderApp();
  }, 4800);
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
      currentRound: state.currentRound,
      activeQuizId: state.activeQuizId,
      score: state.score,
      wisdom: state.wisdom,
      citizens: state.citizens,
      unlockedDistricts: districtOrder.filter((districtId) => state.districtProgress[districtId].unlocked),
      districtProgress: districtOrder.map((districtId) => ({
        districtId,
        stage: state.districtProgress[districtId].stage,
        completed: state.districtProgress[districtId].completed,
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
