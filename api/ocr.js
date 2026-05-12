/**
 * Vercel Serverless Function — OCR proxy for Google Gemini.
 * Receives a base64-encoded image from the client, forwards it to Gemini,
 * and returns the extracted text. Keeps the API key server-side.
 *
 * Vercel env var: gem_key
 *
 * Features:
 * - Tries gemini-2.0-flash first, falls back to gemini-1.5-flash
 * - Auto-retries once on 429 (rate limit) with the suggested delay
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

const PROMPT = `You are an expert OCR system specialising in Indian electricity bills (MSEDCL / MSEB / Maharashtra State Electricity Distribution Co. Ltd).

Extract ALL text from this electricity bill image. Preserve the original layout as closely as possible — output each line of text on a separate line, keeping numbers, labels, table rows, and header/footer text intact.

Pay special attention to these fields and ensure they appear in the output:
• Consumer No (12-digit number)
• Consumer Name
• Address
• Bill Month (e.g. "Jan-2026")
• Sanctioned Load / Connected Load (in kW)
• Bill Amount / Total Amount (in Rs)
• Units Consumed / Total Consumption (in kWh)
• Billing History table (month, units, amount rows)
• Meter reading details (previous, current, consumption)
• Tariff Category

Return ONLY the extracted text. Do not add any commentary, explanation, or formatting beyond the raw bill text.`;

function buildRequestBody(imageBase64, mimeType) {
  return {
    contents: [
      {
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  };
}

function extractText(result) {
  return (
    result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || ""
  );
}

function parseRetryDelay(errorBody) {
  const match = errorBody.match(/"retryDelay"\s*:\s*"(\d+)s?"/);
  return match ? Math.min(parseInt(match[1], 10), 60) : 10;
}

async function callModel(model, apiKey, body) {
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response;
}

async function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.gem_key;
  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API key not configured on server." });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing imageBase64 or mimeType in request body." });
  }

  const body = buildRequestBody(imageBase64, mimeType);
  let lastError = "";

  // Try each model, with one retry on 429
  for (const model of MODELS) {
    try {
      let response = await callModel(model, apiKey, body);

      // Auto-retry once on 429
      if (response.status === 429) {
        const errorBody = await response.text();
        const delay = parseRetryDelay(errorBody);
        await sleep(delay);
        response = await callModel(model, apiKey, body);
      }

      if (!response.ok) {
        lastError = await response.text();
        continue; // try next model
      }

      const result = await response.json();
      const text = extractText(result);

      if (!text) {
        lastError = "Gemini returned an empty response.";
        continue;
      }

      return res.status(200).json({ text, model });
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  // All models failed
  return res.status(502).json({
    error: `OCR failed on all models. Last error: ${lastError}`,
  });
}
