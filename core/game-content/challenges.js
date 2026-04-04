import { YEAR6_CURRICULUM } from "./year6-curriculum.generated.js";

const MASTERY_TRIGGER_BY_FAILURE = {
  "mcq-failure": "mcq-mastery",
  "quiz-failure": "quiz-mastery",
  "free-text-failure": "free-text-mastery",
  "match-pairs-failure": "match-pairs-mastery",
};

export const STUDY_MODE_WEIGHTS = {
  quiz: 50,
  "free-text": 25,
  mcq: 20,
  "match-pairs": 5,
};

export const MCQ_DECK = YEAR6_CURRICULUM.mcqDeck.map((item) => ({
  ...item,
  category: item.subject,
}));

export const QUIZ_DECK = YEAR6_CURRICULUM.quizDeck.map((item) => ({
  ...item,
  category: item.subject,
}));

export const FREE_TEXT_DECK = YEAR6_CURRICULUM.freeTextDeck.map((item) => ({
  ...item,
  category: item.subject,
}));

export const MATCH_PAIR_DECK = YEAR6_CURRICULUM.matchPairDeck;

function cloneMasteryQuest(template, trigger) {
  const baseReward = template.resourceReward ?? {};

  return {
    ...template,
    id: `${template.id}-${trigger}`,
    title: template.title.replace(/Recovery/gi, "Perfection"),
    detail: `${template.detail} Use the improvement run to prove the topic is polished enough for a final diploma test.`,
    trigger,
    resourceReward: {
      paper: Number.isFinite(baseReward.paper) ? baseReward.paper : 0,
      ink: Number.isFinite(baseReward.ink) ? baseReward.ink : 0,
      revisionTokens: Number.isFinite(baseReward.revisionTokens) ? baseReward.revisionTokens : 0,
    },
  };
}

function ensureQuestCoverage(questDeck) {
  const nextDeck = [...questDeck];
  const existingTriggers = new Set(nextDeck.map((quest) => quest.trigger));

  for (const [failureTrigger, masteryTrigger] of Object.entries(MASTERY_TRIGGER_BY_FAILURE)) {
    if (existingTriggers.has(masteryTrigger)) {
      continue;
    }

    const fallbackTemplate = nextDeck.find((quest) => quest.trigger === failureTrigger);

    if (!fallbackTemplate) {
      continue;
    }

    nextDeck.push(cloneMasteryQuest(fallbackTemplate, masteryTrigger));
    existingTriggers.add(masteryTrigger);
  }

  return nextDeck;
}

export const QUEST_DECK = ensureQuestCoverage(YEAR6_CURRICULUM.questDeck);
