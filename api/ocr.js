/**
 * Vercel Serverless Function — OCR proxy for OpenRouter.
 * Receives a base64-encoded image from the client, forwards it to OpenRouter,
 * and returns the extracted text. Keeps the API key server-side.
 *
 * Vercel env var: gem_key
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "baidu/qianfan-ocr-fast:free";

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
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`
            }
          }
        ]
      }
    ],
    temperature: 0.1,
  };
}

function extractText(result) {
  return result?.choices?.[0]?.message?.content?.trim() || "";
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

  // Still reading from gem_key as requested
  const apiKey = process.env.gem_key;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing imageBase64 or mimeType in request body." });
  }

  const body = buildRequestBody(imageBase64, mimeType);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://dcenergy.in", // Recommended by OpenRouter
        "X-Title": "DC Energy Solar Calculator" // Recommended by OpenRouter
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: `OpenRouter API error ${response.status}: ${errorBody}`,
      });
    }

    const result = await response.json();
    const text = extractText(result);

    if (!text) {
      return res.status(422).json({
        error: "Model returned an empty response. The image may not contain readable text.",
      });
    }

    return res.status(200).json({ text, model: MODEL });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
