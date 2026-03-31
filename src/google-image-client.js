import crypto from "node:crypto";

const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;
const serviceAccountTokenCache = new Map();

function buildDeveloperApiRequest({ model, apiKey, prompt, imageBuffer, mimeType }) {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  );
  url.searchParams.set("key", apiKey);

  return {
    url: url.toString(),
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        candidateCount: 1,
      },
    },
  };
}

function buildVertexApiRequest({
  model,
  accessToken,
  projectId,
  location,
  prompt,
  imageBuffer,
  mimeType,
}) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  return {
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        candidateCount: 1,
      },
    },
  };
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

function resolveRequestTimeoutMs() {
  const rawValue = process.env.GOOGLE_REQUEST_TIMEOUT_MS ?? process.env.REQUEST_TIMEOUT_MS;
  const parsed = Number.parseInt(rawValue ?? "", 10);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_REQUEST_TIMEOUT_MS;
}

async function fetchJsonWithTimeout(url, options) {
  const timeoutMs = resolveRequestTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const responseJson = await response.json();

    return { response, responseJson };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Google request timed out after ${timeoutMs}ms.`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function exchangeServiceAccountForAccessToken(serviceAccount) {
  const cacheKey = serviceAccount.client_email;
  const cachedToken = serviceAccountTokenCache.get(cacheKey);

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + 3600;
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const payload = {
    iss: serviceAccount.client_email,
    scope: CLOUD_PLATFORM_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: issuedAt,
    exp: expiresAt,
  };
  const assertionBase = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(assertionBase)
    .end()
    .sign(normalizePrivateKey(serviceAccount.private_key));
  const assertion = `${assertionBase}.${toBase64Url(signature)}`;

  const { response, responseJson } = await fetchJsonWithTimeout(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok || !responseJson.access_token) {
    throw new Error(responseJson.error_description || responseJson.error || "Unable to obtain Google access token.");
  }

  serviceAccountTokenCache.set(cacheKey, {
    accessToken: responseJson.access_token,
    expiresAt: Date.now() + ((responseJson.expires_in ?? 3600) * 1000),
  });

  return responseJson.access_token;
}

function extractError(responseJson) {
  const apiError = responseJson?.error;
  if (apiError?.message) {
    return apiError.message;
  }

  const blockReason = responseJson?.promptFeedback?.blockReason;
  if (blockReason) {
    return `Request blocked by model safety filters: ${blockReason}`;
  }

  return "Unknown Google image API error.";
}

function extractImage(responseJson) {
  const candidate = responseJson?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  const text = parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!imagePart) {
    throw new Error(extractError(responseJson));
  }

  return {
    imageBuffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType || "image/png",
    modelText: text,
    responseMeta: summarizeResponse(responseJson),
  };
}

function summarizeResponse(responseJson) {
  const candidate = responseJson?.candidates?.[0];

  return {
    usageMetadata: responseJson?.usageMetadata ?? null,
    promptFeedback: responseJson?.promptFeedback ?? null,
    finishReason: candidate?.finishReason ?? null,
  };
}

export async function generateEditedImage({
  auth,
  model,
  projectId,
  location,
  prompt,
  imageBuffer,
  mimeType,
  dryRun,
}) {
  if (dryRun) {
    return {
      imageBuffer,
      mimeType,
      modelText: "Dry run enabled. Original input copied without network generation.",
      responseMeta: {
        dryRun: true,
      },
    };
  }

  let request;

  if (auth.kind === "developer-api") {
    request = buildDeveloperApiRequest({
      model,
      apiKey: auth.apiKey,
      prompt,
      imageBuffer,
      mimeType,
    });
  } else if (auth.kind === "vertex-access-token") {
    request = buildVertexApiRequest({
      model,
      accessToken: auth.accessToken,
      projectId,
      location,
      prompt,
      imageBuffer,
      mimeType,
    });
  } else {
    request = buildVertexApiRequest({
      model,
      accessToken: await exchangeServiceAccountForAccessToken(auth.serviceAccount),
      projectId,
      location,
      prompt,
      imageBuffer,
      mimeType,
    });
  }

  const { response, responseJson } = await fetchJsonWithTimeout(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    throw new Error(extractError(responseJson));
  }

  return extractImage(responseJson);
}
