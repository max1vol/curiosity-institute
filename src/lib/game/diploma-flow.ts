import type {
  FinalTestMode,
  FinalTestState,
  McqQuestion,
  PerformanceRecord,
  QuestDefinition,
  QuestState,
  QuizQuestion,
  StudyMode,
  FreeTextQuestion
} from "./types";

type QuestionLike = Pick<McqQuestion | QuizQuestion | FreeTextQuestion, "id" | "subject" | "topic" | "prompt">;

const MODE_LABEL: Record<StudyMode, string> = {
  mcq: "resource test",
  quiz: "resource test",
  "free-text": "written resource test",
  "match-pairs": "revision resource test"
};
const QUEST_TRACKS = ["precision", "method", "clarity", "fluency"];

export function performanceRecordId(subject: string, topic: string): string {
  return `${subject}::${topic}`.toLowerCase().replace(/[^a-z0-9:]+/g, "-");
}

export function updatePerformanceRecords(
  records: PerformanceRecord[],
  {
    mode,
    question,
    success
  }: {
    mode: StudyMode;
    question: QuestionLike;
    success: boolean;
  }
): PerformanceRecord[] {
  const id = performanceRecordId(question.subject, question.topic);
  const current =
    records.find((entry) => entry.id === id) ??
    {
      id,
      subject: question.subject,
      topic: question.topic,
      attempts: 0,
      successes: 0,
      failures: 0,
      lastMode: mode,
      lastQuestionId: question.id,
      lastPrompt: question.prompt
    };
  const nextRecord: PerformanceRecord = {
    ...current,
    attempts: current.attempts + 1,
    successes: current.successes + (success ? 1 : 0),
    failures: current.failures + (success ? 0 : 1),
    lastMode: mode,
    lastQuestionId: question.id,
    lastPrompt: question.prompt
  };

  return [...records.filter((entry) => entry.id !== id), nextRecord];
}

export function summarizePerformance(record: PerformanceRecord): string {
  return `${record.successes}/${record.attempts} secure in ${record.topic}`;
}

export function shouldOfferMasteryQuest(record: PerformanceRecord): boolean {
  return record.successes >= 2 && record.successes >= record.failures + 1;
}

function excerptPrompt(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  return normalized.length > 88 ? `${normalized.slice(0, 85).trimEnd()}...` : normalized;
}

function templateDirective(detail: string): string {
  const lowered = detail.toLowerCase();

  if (lowered.includes("paper") || lowered.includes("diagram") || lowered.includes("draw") || lowered.includes("timeline")) {
    return "Work the revision out on paper before you check the answer.";
  }

  if (lowered.includes("cannot") || lowered.includes("won't be able to edit") || lowered.includes("cannot re-submit")) {
    return "Treat the next answer as a one-shot draft and make it cleaner before you submit.";
  }

  return "Tighten the method and explanation until the topic is final-test ready.";
}

function hashText(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function buildAdaptiveQuestState({
  template,
  record,
  mode,
  question,
  day,
  mastery,
  saveSlotId
}: {
  template: QuestDefinition;
  record: PerformanceRecord;
  mode: StudyMode;
  question: QuestionLike;
  day: number;
  mastery: boolean;
  saveSlotId: string;
}): QuestState {
  const track = QUEST_TRACKS[hashText(`${saveSlotId}:${record.id}:${day}`) % QUEST_TRACKS.length];
  const requiredSuccesses = mastery ? 2 : Math.min(3, Math.max(2, record.failures));
  const focusInstruction = mastery
    ? `You are close to a ${question.subject} diploma in ${question.topic}. Tighten the ${track} from "${excerptPrompt(question.prompt)}" so it is final-test ready.`
    : `Your last ${MODE_LABEL[mode]} in ${question.subject} on ${question.topic} slipped on "${excerptPrompt(question.prompt)}". Rework the ${track} cleanly before the diploma check.`;
  const directive = templateDirective(template.detail);

  return {
    ...template,
    id: `${template.id}-${record.id}-${day}-${record.attempts}`,
    title: mastery ? `${question.topic} Perfection Quest` : `${question.topic} Recovery Quest`,
    detail: `${focusInstruction} ${directive} Secure ${requiredSuccesses} focused improvement win${requiredSuccesses === 1 ? "" : "s"}, then take the final test.`,
    createdAtDay: day,
    stage: "improvement",
    subject: question.subject,
    topic: question.topic,
    sourceMode: mode,
    sourceQuestionId: question.id,
    requiredSuccesses,
    currentSuccesses: 0,
    focusPrompt: question.prompt,
    performanceSummary: summarizePerformance(record)
  };
}

export function finalTestModeForQuest(mode: StudyMode): FinalTestMode {
  return mode === "match-pairs" ? "quiz" : mode;
}

export function buildFinalTestState(quest: QuestState, attempts = 0): FinalTestState {
  const finalMode = finalTestModeForQuest(quest.sourceMode);

  return {
    id: `${quest.id}-final`,
    questId: quest.id,
    subject: quest.subject,
    topic: quest.topic,
    mode: finalMode,
    title: `${quest.subject} Diploma Final`,
    detail: `Pass this final ${finalMode.replace("-", " ")} on ${quest.topic} to earn the diploma.`,
    attempts
  };
}
