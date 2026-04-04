import type { ChallengeDifficulty, FreeTextQuestion, McqQuestion, QuizQuestion, RewardBundle, StudyMode, StudyStage } from "./types";

type QuestionMode = Exclude<StudyMode, "match-pairs">;
type QuestionLike = McqQuestion | QuizQuestion | FreeTextQuestion;

const RESOURCE_SUCCESS_REWARDS: Record<QuestionMode, Record<ChallengeDifficulty, RewardBundle>> = {
  mcq: {
    Advanced: { paper: 1, ink: 1, revisionTokens: 1, coins: 7, reputation: 5, curiosity: 6 },
    Expert: { paper: 2, ink: 1, revisionTokens: 1, coins: 10, reputation: 6, curiosity: 8 },
  },
  quiz: {
    Advanced: { paper: 1, ink: 1, revisionTokens: 1, coins: 8, reputation: 5, curiosity: 5 },
    Expert: { paper: 1, ink: 2, revisionTokens: 1, coins: 11, reputation: 7, curiosity: 6 },
  },
  "free-text": {
    Advanced: { paper: 2, ink: 1, revisionTokens: 1, coins: 7, reputation: 5, curiosity: 5 },
    Expert: { paper: 2, ink: 2, revisionTokens: 1, coins: 9, reputation: 6, curiosity: 7 },
  },
};

const RESOURCE_FAILURE_REWARDS: Record<QuestionMode, Record<ChallengeDifficulty, RewardBundle>> = {
  mcq: {
    Advanced: { coins: -4, reputation: -4, curiosity: -2 },
    Expert: { coins: -6, reputation: -5, curiosity: -3 },
  },
  quiz: {
    Advanced: { coins: -3, reputation: -3, curiosity: -1 },
    Expert: { coins: -5, reputation: -4, curiosity: -2 },
  },
  "free-text": {
    Advanced: { coins: -3, reputation: -2, curiosity: -1 },
    Expert: { coins: -4, reputation: -3, curiosity: -2 },
  },
};

const FINAL_SUCCESS_REWARDS: Record<QuestionMode, Record<ChallengeDifficulty, RewardBundle>> = {
  mcq: {
    Advanced: { diplomas: 1, coins: 12, reputation: 8, curiosity: 7 },
    Expert: { diplomas: 1, coins: 14, reputation: 9, curiosity: 8 },
  },
  quiz: {
    Advanced: { diplomas: 1, coins: 13, reputation: 9, curiosity: 6 },
    Expert: { diplomas: 1, coins: 16, reputation: 10, curiosity: 7 },
  },
  "free-text": {
    Advanced: { diplomas: 1, coins: 11, reputation: 8, curiosity: 7 },
    Expert: { diplomas: 1, coins: 13, reputation: 9, curiosity: 8 },
  },
};

const QUEST_SUCCESS_REWARDS: Record<QuestionMode, RewardBundle> = {
  mcq: { coins: 4, reputation: 3, curiosity: 3 },
  quiz: { coins: 4, reputation: 3, curiosity: 3 },
  "free-text": { coins: 4, reputation: 3, curiosity: 3 },
};

const QUEST_FAILURE_REWARDS: Record<QuestionMode, RewardBundle> = {
  mcq: { coins: -2, reputation: -2, curiosity: -1 },
  quiz: { coins: -2, reputation: -2, curiosity: -1 },
  "free-text": { coins: -2, reputation: -2, curiosity: -1 },
};

export interface StudyRoundFeedback {
  successRewards: RewardBundle;
  failureRewards: RewardBundle;
  successMessage: string;
  failureMessage: string;
}

function resourceSuccessMessage(mode: QuestionMode, question: QuestionLike): string {
  if (mode === "mcq") {
    return `${(question as McqQuestion).success} ${question.subject} resources improved.`;
  }

  if (mode === "quiz") {
    return `${question.style} solved cleanly. Resources improved in ${question.subject}.`;
  }

  return `${(question as FreeTextQuestion).success} Resources earned for ${question.subject}.`;
}

function resourceFailureMessage(mode: QuestionMode, question: QuestionLike): string {
  if (mode === "mcq") {
    return `${(question as McqQuestion).failure} A personalised perfection quest has been added to the board.`;
  }

  if (mode === "quiz") {
    return `${question.subject} slipped this round. A personalised perfection quest has been added.`;
  }

  return `${(question as FreeTextQuestion).failure} A personalised perfection quest has been added to the board.`;
}

export function buildStudyRoundFeedback(
  mode: QuestionMode,
  stage: StudyStage,
  question: QuestionLike,
): StudyRoundFeedback {
  if (stage === "final-test") {
    return {
      successRewards: FINAL_SUCCESS_REWARDS[mode][question.difficulty],
      failureRewards: RESOURCE_FAILURE_REWARDS[mode][question.difficulty],
      successMessage:
        mode === "mcq"
          ? `${question.subject} diploma secured through the final multiple-choice check.`
          : mode === "quiz"
            ? `${question.subject} diploma secured through the final quiz.`
            : `${question.subject} diploma secured through the final written response.`,
      failureMessage: `${question.subject} final test missed. The perfection quest has been reopened.`,
    };
  }

  if (stage === "quest-test") {
    return {
      successRewards: QUEST_SUCCESS_REWARDS[mode],
      failureRewards: QUEST_FAILURE_REWARDS[mode],
      successMessage: `${question.subject} improvement win logged.`,
      failureMessage: `${question.subject} still needs more polishing before the final test.`,
    };
  }

  return {
    successRewards: RESOURCE_SUCCESS_REWARDS[mode][question.difficulty],
    failureRewards: RESOURCE_FAILURE_REWARDS[mode][question.difficulty],
    successMessage: resourceSuccessMessage(mode, question),
    failureMessage: resourceFailureMessage(mode, question),
  };
}
