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
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

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
    rawResponse: responseJson,
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
      rawResponse: {
        dryRun: true,
      },
    };
  }

  const request =
    auth.kind === "developer-api"
      ? buildDeveloperApiRequest({
          model,
          apiKey: auth.apiKey,
          prompt,
          imageBuffer,
          mimeType,
        })
      : buildVertexApiRequest({
          model,
          accessToken: auth.accessToken,
          projectId,
          location,
          prompt,
          imageBuffer,
          mimeType,
        });

  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(extractError(responseJson));
  }

  return extractImage(responseJson);
}
