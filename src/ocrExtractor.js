/**
 * OCR Extractor — sends bill images to the /api/ocr serverless proxy,
 * which calls OpenRouter server-side (keeping the API key secure).
 *
 * Falls back to direct OpenRouter call if window.__OPENROUTER_API_KEY is set
 * (useful for local development).
 */

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "baidu/qianfan-ocr-fast:free";

const OCR_PROMPT = `You are an expert OCR system specialising in Indian electricity bills (MSEDCL / MSEB / Maharashtra State Electricity Distribution Co. Ltd).

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

/**
 * Convert a File / Blob to a base64 data string (without the data-URI prefix).
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Map common file extensions to MIME types.
 */
function mimeForFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    tiff: "image/tiff",
    tif: "image/tiff",
  };
  return map[ext] || file.type || "image/jpeg";
}

/**
 * Call the /api/ocr serverless proxy (Vercel) to extract text from an image.
 * Falls back to direct OpenRouter call if a local API key is available.
 */
async function callOcrProxy(base64, mimeType) {
  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.error || "";

    // Friendly messages for common errors
    if (response.status === 429 || msg.includes("429") || msg.includes("rate limit")) {
      throw new Error("OCR rate limit reached. Please wait a minute and try again.");
    }
    if (msg.includes("limit: 0") || msg.includes("quota") || response.status === 402) {
      throw new Error("OCR API key needs setup. Check your OpenRouter billing or key configuration.");
    }

    throw new Error(body.error || `OCR service error (${response.status})`);
  }

  const result = await response.json();
  return result.text;
}

/**
 * Direct OpenRouter call — used for local development when window.__OPENROUTER_API_KEY is set.
 */
async function callOpenRouterDirect(base64, mimeType, apiKey) {
  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: OCR_PROMPT },
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64}` },
          },
        ],
      },
    ],
    temperature: 0.1,
  };

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:5173", // Optional, for OpenRouter rankings
      "X-Title": "DC Energy Solar Calculator Local" // Optional, for OpenRouter rankings
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content?.trim() || "";

  if (!text) {
    throw new Error("Model returned an empty response. The image may not contain readable text.");
  }

  return text;
}

/**
 * Extract text from a bill image file.
 *
 * On Vercel: routes through /api/ocr serverless function (API key stays server-side).
 * Locally: uses window.__OPENROUTER_API_KEY or <meta name="gemini-api-key"> (as fallback) for direct calls.
 *
 * @param {File} file — image file (JPG, PNG, WEBP, etc.)
 * @returns {Promise<string>} extracted text
 */
export async function extractTextFromImage(file) {
  const base64 = await fileToBase64(file);
  const mimeType = mimeForFile(file);

  // Check for local dev API key (checking both __OPENROUTER_API_KEY and __GEMINI_API_KEY for backwards compat with index.html instructions)
  const localKey =
    (typeof window !== "undefined" && (window.__OPENROUTER_API_KEY || window.__GEMINI_API_KEY)) ||
    document.querySelector('meta[name="gemini-api-key"]')?.content ||
    "";

  if (localKey) {
    // Direct call for local development
    return callOpenRouterDirect(base64, mimeType, localKey);
  }

  // Production: use the serverless proxy
  return callOcrProxy(base64, mimeType);
}

/**
 * Returns true if the file extension suggests an image that needs OCR.
 */
export function isImageFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif"].includes(ext);
}
