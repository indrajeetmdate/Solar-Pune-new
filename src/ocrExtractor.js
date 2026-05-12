/**
 * OCR Extractor — uses Google Gemini free-tier API to extract text from
 * scanned / image-based electricity bills (JPG, PNG, WEBP).
 *
 * The API key is expected in the environment variable VITE_GEMINI_API_KEY
 * (injected at build time via Vercel) or read from a global fallback.
 *
 * Because this project is a dependency-free ES-module static app (no Vite
 * build step), the key must be set on `window.__GEMINI_API_KEY` at runtime
 * or passed directly to `extractTextFromImage()`.
 */

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Resolve the API key from available sources.
 * Priority: explicit argument → window global → meta tag → empty.
 */
function resolveApiKey(explicit) {
  if (explicit) return explicit;
  if (typeof window !== "undefined" && window.__GEMINI_API_KEY) return window.__GEMINI_API_KEY;
  const meta = document.querySelector('meta[name="gemini-api-key"]');
  if (meta) return meta.content;
  return "";
}

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
 * Map common file extensions to MIME types Gemini expects.
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
 * Call Gemini to extract structured electricity-bill fields from an image.
 *
 * Returns the raw text content extracted by the model so the existing
 * `parseMsebBillText()` pipeline can consume it.
 *
 * @param {File} file  — image file (JPG, PNG, WEBP, etc.)
 * @param {string} [apiKey] — optional explicit API key
 * @returns {Promise<string>} extracted text
 */
export async function extractTextFromImage(file, apiKey) {
  const key = resolveApiKey(apiKey);
  if (!key) {
    throw new Error(
      "Gemini API key is not configured. Set window.__GEMINI_API_KEY or add a <meta name=\"gemini-api-key\"> tag."
    );
  }

  const base64 = await fileToBase64(file);
  const mime = mimeForFile(file);

  const prompt = `You are an expert OCR system specialising in Indian electricity bills (MSEDCL / MSEB / Maharashtra State Electricity Distribution Co. Ltd).

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

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mime,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
    },
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${key}`, {
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
 * Returns true if the file extension suggests an image that needs OCR
 * rather than text-based PDF extraction.
 */
export function isImageFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif"].includes(ext);
}
