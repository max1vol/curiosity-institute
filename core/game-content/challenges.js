import { YEAR6_CURRICULUM } from "./year6-curriculum.generated.js";

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

export const QUEST_DECK = YEAR6_CURRICULUM.questDeck;
