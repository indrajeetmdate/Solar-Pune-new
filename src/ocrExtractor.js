/**
 * Bill Extractor — sends PDF/image files to the /api/ocr serverless proxy,
 * which calls Google Gemini 2.0 Flash for structured extraction.
 *
 * Supports: PDF, JPG, PNG, WEBP, BMP, TIFF
 * Returns: Structured JSON with full bill breakdown
 *
 * Falls back to direct Gemini call if window.__GEMINI_API_KEY is set
 * (useful for local development).
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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
    pdf: "application/pdf",
  };
  return map[ext] || file.type || "application/octet-stream";
}

/**
 * Call the /api/ocr serverless proxy (Vercel) to extract bill data.
 * Returns structured JSON from Gemini.
 */
async function callGeminiProxy(base64, mimeType) {
  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data: base64, mimeType }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body.error || "";

    if (response.status === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Gemini rate limit reached. Please wait a minute and try again.");
    }
    if (response.status === 403 || msg.includes("API_KEY_INVALID")) {
      throw new Error("Gemini API key is invalid. Check your configuration.");
    }

    throw new Error(body.error || `Extraction service error (${response.status})`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Direct Gemini call — used for local development when window.__GEMINI_API_KEY is set.
 */
async function callGeminiDirect(base64, mimeType, apiKey) {
  const EXTRACTION_PROMPT = `You are an expert system for extracting data from Indian electricity bills issued by MSEDCL.

IMPORTANT: The bill may be in Marathi. Translate all Marathi terms to standard English using this glossary:
- स्थिर आकार → Fixed Charge
- वीज आकार → Energy Charge
- वहन आकार → Wheeling Charge
- इंधन समायोजन आकार → Fuel Adjustment Charge
- वीज शुल्क → Electricity Duty
- मागणी आकार → Demand Charge
- मीटर भाडे → Meter Rent
- चालू वीज देयक → Current Bill Amount
- देयकाची निव्वळ रक्कम → Net Payable Amount

Extract ALL data into this JSON structure. Use null for missing fields:
{
  "consumerNo": "string or null",
  "buNumber": "string or null",
  "consumerName": "string or null",
  "address": "string or null",
  "tariffCategory": "string or null",
  "connectionPhase": "string or null",
  "sanctionedLoadKw": number or null,
  "connectedLoadKw": number or null,
  "meterNumber": "string or null",
  "billMonth": "string or null",
  "billingPeriod": "string or null",
  "dueDate": "string or null",
  "previousReading": number or null,
  "currentReading": number or null,
  "multiplicationFactor": number or null,
  "unitsConsumed": number or null,
  "maximumDemandKva": number or null,
  "powerFactor": number or null,
  "charges": [{ "label": "string", "amount": number }],
  "currentBillAmount": number or null,
  "arrears": number or null,
  "totalPayable": number or null,
  "billingHistory": [{ "month": "string", "units": number, "amount": number }]
}

RULES: charges must include EVERY line item. Rebates are negative. All amounts in Rs as numbers.`;

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { data: base64, mimeType } },
          { text: EXTRACTION_PROMPT }
        ]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!text) {
    throw new Error("Gemini returned an empty response. The file may not contain readable bill data.");
  }

  return JSON.parse(text);
}

/**
 * Extract structured bill data from a file (PDF or image).
 *
 * On Vercel: routes through /api/ocr serverless function.
 * Locally: uses window.__GEMINI_API_KEY for direct calls.
 *
 * @param {File} file — PDF or image file
 * @returns {Promise<object>} structured bill data JSON
 */
export async function extractBillData(file) {
  const base64 = await fileToBase64(file);
  const mimeType = mimeForFile(file);

  // Check for local dev API key
  const localKey =
    (typeof window !== "undefined" && window.__GEMINI_API_KEY) ||
    document.querySelector('meta[name="gemini-api-key"]')?.content ||
    "";

  if (localKey) {
    return callGeminiDirect(base64, mimeType, localKey);
  }

  return callGeminiProxy(base64, mimeType);
}

/**
 * Returns true if the file is a type that Gemini can process directly.
 * Now supports both images AND PDFs.
 */
export function isSupportedBillFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "pdf"].includes(ext);
}

/**
 * Legacy compat — returns true if file needs vision/OCR processing (images).
 */
export function isImageFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif"].includes(ext);
}
