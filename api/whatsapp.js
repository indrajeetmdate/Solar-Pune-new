/**
 * Vercel Serverless Function — WhatsApp Business API
 * Sends a template message to a customer via Meta Cloud API.
 *
 * Required Vercel Environment Variables:
 *   WHATSAPP_PHONE_NUMBER_ID  — From Meta Developer Console → WhatsApp → API Setup
 *   WHATSAPP_ACCESS_TOKEN     — System User permanent token from Business Settings
 *
 * Optional:
 *   WHATSAPP_TEMPLATE_NAME    — Approved template name (defaults to "hello_world")
 *   WHATSAPP_TEMPLATE_LANG    — Template language code (defaults to "en_US")
 */

const GRAPH_API_VERSION = "v22.0";

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ── Validate env vars ──────────────────────────────────────────
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.error("Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN");
    return res.status(500).json({ error: "WhatsApp API not configured" });
  }

  // ── Parse request body ─────────────────────────────────────────
  const { phone, name, visitType, visitDate, surveyMinutes } = req.body || {};

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  // ── Normalize phone to E.164 (Indian numbers) ─────────────────
  const normalizedPhone = normalizeIndianPhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: "Invalid phone number format" });
  }

  // ── Build template message payload ─────────────────────────────
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "feedback_survey_1";
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";

  const payload = {
    messaging_product: "whatsapp",
    to: normalizedPhone,
    type: "template",
    template: {
      name: templateName,
      language: { code: templateLang },
    },
  };

  // ── Attach template parameters ─────────────────────────────────
  // feedback_survey_1 has 4 body params: {{1}}=name, {{2}}=visit, {{3}}=date, {{4}}=minutes
  if (templateName === "feedback_survey_1") {
    const today = new Date().toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric"
    });
    payload.template.components = [
      {
        type: "body",
        parameters: [
          { type: "text", text: name || "Customer" },
          { type: "text", text: visitType || "solar consultation" },
          { type: "text", text: visitDate || today },
          { type: "text", text: surveyMinutes || "2" },
        ],
      },
    ];
  } else if (templateName !== "hello_world" && name) {
    // Generic fallback for any other custom template with a single param
    payload.template.components = [
      {
        type: "body",
        parameters: [{ type: "text", text: name || "Customer" }],
      },
    ];
  }

  // ── Call Meta Cloud API ────────────────────────────────────────
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", JSON.stringify(data, null, 2));
      return res.status(response.status).json({
        error: "WhatsApp API error",
        details: data.error?.message || "Unknown error",
        code: data.error?.code,
      });
    }

    console.log("WhatsApp message sent:", data.messages?.[0]?.id);
    return res.status(200).json({
      success: true,
      messageId: data.messages?.[0]?.id,
    });
  } catch (error) {
    console.error("WhatsApp send failed:", error);
    return res.status(500).json({ error: "Failed to send WhatsApp message" });
  }
}

/**
 * Normalize an Indian phone number to E.164 format (91XXXXXXXXXX).
 * Accepts: +91..., 91..., 0..., or raw 10-digit numbers.
 * Returns null if the input doesn't look like a valid Indian mobile.
 */
function normalizeIndianPhone(raw) {
  // Strip all non-digit characters
  let digits = raw.replace(/\D/g, "");

  // Remove leading + (already stripped by regex, but in case)
  // Handle: +91XXXXXXXXXX → 91XXXXXXXXXX
  if (digits.startsWith("91") && digits.length === 12) {
    return digits; // already 91 + 10 digits
  }

  // Handle: 0XXXXXXXXXX → strip leading 0
  if (digits.startsWith("0") && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Should now be exactly 10 digits
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // If somehow 12 digits starting with 91, accept
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return null; // invalid
}
