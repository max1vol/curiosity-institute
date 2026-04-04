import test from "node:test";
import assert from "node:assert/strict";

import { QUEST_DECK } from "../core/game-content/challenges.js";

test("quest deck exposes canonical trigger coverage", () => {
  const triggers = new Set(QUEST_DECK.map((quest) => quest.trigger));

  for (const trigger of [
    "mcq-failure",
    "mcq-mastery",
    "quiz-failure",
    "quiz-mastery",
    "free-text-failure",
    "free-text-mastery",
    "locked-submission",
    "match-pairs-failure",
    "match-pairs-mastery",
  ]) {
    assert.ok(triggers.has(trigger), `missing ${trigger}`);
  }

  assert.ok(!triggers.has("mastery-review"));
  assert.ok(!triggers.has("final-diploma-test"));
});
