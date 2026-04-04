import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfiguredEnv } from "../core/load-env.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = path.join(repoRoot, "core", "game-content", "year6-curriculum.generated.js");
const explicitModels = [process.env.GEMINI_TEXT_MODEL, process.env.GEMINI_MODEL].filter(Boolean);
const candidateModels = explicitModels.length
  ? Array.from(new Set(explicitModels))
  : ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.GOOGLE_REQUEST_TIMEOUT_MS ?? "60000", 10);

const prompt = `
Generate hard UK Year 6 curriculum game content as strict JSON.

Return one JSON object with exactly these top-level keys:
- mcqDeck
- quizDeck
- freeTextDeck
- matchPairDeck
- questDeck

Requirements:
- Use only ASCII characters.
- Use UK Year 6 / Key Stage 2 topics.
- Make the tone challenging but age-appropriate.
- Cover Maths, English, Science, History, and Geography across the decks.
- Do not include markdown fences or commentary.

mcqDeck:
- Exactly 12 items.
- Each item keys: id, style, difficulty, subject, topic, context, prompt, choices, correctIndex, success, failure.
- difficulty must be "Advanced" or "Expert".
- choices must have exactly 4 strings.
- correctIndex must be 0-3.

quizDeck:
- Exactly 16 items.
- Each item keys: id, style, difficulty, subject, topic, context, prompt, choices, correctIndex.
- difficulty must be "Advanced" or "Expert".
- choices must have exactly 4 strings.
- correctIndex must be 0-3.
- These should feel like harder reasoning quiz prompts, not simple recall.

freeTextDeck:
- Exactly 12 items.
- Each item keys: id, style, difficulty, subject, topic, context, prompt, placeholder, acceptedAnswers, modelAnswer, success, failure.
- difficulty must be "Advanced" or "Expert".
- acceptedAnswers must have 2-5 short answer strings.
- modelAnswer must be a concise exemplar answer.

matchPairDeck:
- Exactly 16 items.
- Each item keys: id, subject, left, right.
- left and right must be different but form a valid curriculum pair.

questDeck:
- Exactly 18 items.
- Each item keys: id, title, detail, trigger, resourceReward.
- trigger must be one of:
  "mcq-failure", "mcq-mastery", "quiz-failure", "quiz-mastery",
  "free-text-failure", "free-text-mastery", "locked-submission",
  "match-pairs-failure", "match-pairs-mastery"
- resourceReward keys: paper, ink, revisionTokens
- resourceReward values must be integers from 0 to 1 because plain tests, not quests, now award the main resource flow.
- Every quest detail should describe a personalised improvement or perfection task that prepares the learner for a final diploma test.
- At least 4 quests must be mastery/perfection quests for strong performance, not recovery quests.
- At least 2 quests must explicitly mention rewriting or reworking an answer on paper.
- At least 1 quest must explicitly mention not being able to edit the work anymore.

Content rules:
- ids must be slug-like and unique.
- Avoid duplicate prompts.
- Make the questions objectively gradable.
- Keep success/failure strings short and game-ready.
`.trim();

function extractText(responseJson) {
  const candidate = responseJson?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  return parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function validateDeck(name, value, expectedLength) {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new Error(`${name} must contain exactly ${expectedLength} items.`);
  }
}

function validatePayload(payload) {
  validateDeck("mcqDeck", payload.mcqDeck, 12);
  validateDeck("quizDeck", payload.quizDeck, 16);
  validateDeck("freeTextDeck", payload.freeTextDeck, 12);
  validateDeck("matchPairDeck", payload.matchPairDeck, 16);
  validateDeck("questDeck", payload.questDeck, 18);

  for (const entry of payload.mcqDeck) {
    if (!Array.isArray(entry.choices) || entry.choices.length !== 4) {
      throw new Error(`mcqDeck item ${entry.id ?? "<unknown>"} must have exactly 4 choices.`);
    }
  }

  for (const entry of payload.quizDeck) {
    if (!Array.isArray(entry.choices) || entry.choices.length !== 4) {
      throw new Error(`quizDeck item ${entry.id ?? "<unknown>"} must have exactly 4 choices.`);
    }
  }

  for (const entry of payload.freeTextDeck) {
    if (!Array.isArray(entry.acceptedAnswers) || entry.acceptedAnswers.length < 2 || entry.acceptedAnswers.length > 5) {
      throw new Error(`freeTextDeck item ${entry.id ?? "<unknown>"} must have 2-5 accepted answers.`);
    }
  }

  const questTriggers = new Set([
    "mcq-failure",
    "mcq-mastery",
    "quiz-failure",
    "quiz-mastery",
    "free-text-failure",
    "free-text-mastery",
    "locked-submission",
    "match-pairs-failure",
    "match-pairs-mastery"
  ]);

  for (const quest of payload.questDeck) {
    if (!quest || typeof quest !== "object") {
      throw new Error("questDeck items must be objects.");
    }

    if (typeof quest.id !== "string" || typeof quest.title !== "string" || typeof quest.detail !== "string") {
      throw new Error("questDeck items must include id, title, and detail strings.");
    }

    if (!questTriggers.has(quest.trigger)) {
      throw new Error(`questDeck item ${quest.id ?? "<unknown>"} has an invalid trigger.`);
    }

    if (!quest.resourceReward || typeof quest.resourceReward !== "object") {
      throw new Error(`questDeck item ${quest.id ?? "<unknown>"} is missing resourceReward.`);
    }

    for (const key of ["paper", "ink", "revisionTokens"]) {
      const value = quest.resourceReward[key];

      if (!Number.isInteger(value) || value < 0 || value > 1) {
        throw new Error(`questDeck item ${quest.id ?? "<unknown>"} has invalid resourceReward.${key}.`);
      }
    }
  }
}

async function requestCurriculum(model, apiKey) {
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
  url.searchParams.set("key", apiKey);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 60000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
      signal: controller.signal,
    });
    const responseJson = await response.json();

    if (!response.ok) {
      const message = responseJson?.error?.message ?? `Gemini request failed with ${response.status}`;
      throw new Error(message);
    }

    const text = extractText(responseJson);
    if (!text) {
      throw new Error("Gemini returned no text payload.");
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizePrivateKey(privateKey) {
  return privateKey.replace(/\\n/g, "\n");
}

async function exchangeServiceAccountForAccessToken(serviceAccount) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  };
  const assertionBase = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(assertionBase)
    .end()
    .sign(normalizePrivateKey(serviceAccount.private_key));
  const assertion = `${assertionBase}.${toBase64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const responseJson = await response.json();

  if (!response.ok || !responseJson.access_token) {
    throw new Error(responseJson.error_description || responseJson.error || "Unable to obtain Google access token.");
  }

  return responseJson.access_token;
}

async function requestCurriculumWithServiceAccount(model, serviceAccount, projectId, location) {
  const accessToken = await exchangeServiceAccountForAccessToken(serviceAccount);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number.isFinite(REQUEST_TIMEOUT_MS) ? REQUEST_TIMEOUT_MS : 60000);

  try {
    const response = await fetch(
      `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      },
    );
    const responseJson = await response.json();

    if (!response.ok) {
      const message = responseJson?.error?.message ?? `Vertex request failed with ${response.status}`;
      throw new Error(message);
    }

    const text = extractText(responseJson);
    if (!text) {
      throw new Error("Vertex Gemini returned no text payload.");
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

function toModuleSource(payload, model) {
  return `export const YEAR6_CURRICULUM = ${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      model,
      ...payload,
    },
    null,
    2,
  )};\n`;
}

async function main() {
  loadConfiguredEnv({ cwd: repoRoot });
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
    : null;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT ?? serviceAccount?.project_id ?? "";
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? "global";

  if (!apiKey) {
    if (!serviceAccount || !projectId) {
      throw new Error("Missing Gemini credentials. Set KEYS_FILE or GEMINI_API_KEY first.");
    }
  }

  let lastError = null;

  if (apiKey) {
    for (const model of candidateModels) {
      try {
        const payload = await requestCurriculum(model, apiKey);
        validatePayload(payload);
        await fs.writeFile(outputFile, toModuleSource(payload, model), "utf8");
        console.log(`Wrote ${outputFile} using developer API model ${model}.`);
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (serviceAccount && projectId) {
    for (const model of candidateModels) {
      try {
        const payload = await requestCurriculumWithServiceAccount(model, serviceAccount, projectId, location);
        validatePayload(payload);
        await fs.writeFile(outputFile, toModuleSource(payload, model), "utf8");
        console.log(`Wrote ${outputFile} using Vertex model ${model}.`);
        return;
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError ?? new Error("Unable to generate Year 6 curriculum payload.");
}

await main();
