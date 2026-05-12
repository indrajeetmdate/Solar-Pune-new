/**
 * OCR Extractor — sends bill images to the /api/ocr serverless proxy,
 * which calls Google Gemini server-side (keeping the API key secure).
 *
 * Falls back to direct Gemini call if window.__GEMINI_API_KEY is set
 * (useful for local development).
 */

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
 * Falls back to direct Gemini call if a local API key is available.
 */
async function callOcrProxy(base64, mimeType) {
  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `OCR proxy error ${response.status}`);
  }

  const result = await response.json();
  return result.text;
}

/**
 * Direct Gemini call — used for local development when window.__GEMINI_API_KEY is set.
 */
async function callGeminiDirect(base64, mimeType, apiKey) {
  const body = {
    contents: [
      {
        parts: [
          { text: OCR_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const text =
    result?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("\n")
      .trim() || "";

  if (!text) {
    throw new Error("Gemini returned an empty response. The image may not contain readable text.");
  }

  return text;
}

/**
 * Extract text from a bill image file.
 *
 * On Vercel: routes through /api/ocr serverless function (API key stays server-side).
 * Locally: uses window.__GEMINI_API_KEY or <meta name="gemini-api-key"> for direct calls.
 *
 * @param {File} file — image file (JPG, PNG, WEBP, etc.)
 * @returns {Promise<string>} extracted text
 */
export async function extractTextFromImage(file) {
  const base64 = await fileToBase64(file);
  const mimeType = mimeForFile(file);

  // Check for local dev API key
  const localKey =
    (typeof window !== "undefined" && window.__GEMINI_API_KEY) ||
    document.querySelector('meta[name="gemini-api-key"]')?.content ||
    "";

  if (localKey) {
    // Direct call for local development
    return callGeminiDirect(base64, mimeType, localKey);
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
