/**
 * Vercel Serverless Function — Bill extraction via Google Gemini.
 * Accepts base64-encoded PDF or image, sends to Gemini 2.0 Flash (free tier),
 * returns structured JSON with full bill breakdown.
 *
 * Vercel env var: gem_key (Google AI Studio API key)
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const EXTRACTION_PROMPT = `You are an expert system for extracting data from Indian electricity bills issued by MSEDCL (Maharashtra State Electricity Distribution Co. Ltd).

IMPORTANT: The bill may be partially or fully in Marathi. You MUST automatically translate all Marathi terms into standard English electricity billing terminology.
Do NOT use literal translations. Use the glossary below:

MARATHI → ENGLISH GLOSSARY:
- ग्राहक क्रमांक → Consumer Number
- ग्राहकाचे नाव → Consumer Name
- पत्ता → Address
- मंजूर भार → Sanctioned Load
- जोडलेला भार → Connected Load
- दर वर्गवारी → Tariff Category
- देयकाचा कालावधी → Billing Period
- देयक महिना → Bill Month
- देय दिनांक → Due Date
- स्थिर आकार → Fixed Charge
- वीज आकार → Energy Charge
- वहन आकार → Wheeling Charge
- इंधन समायोजन आकार → Fuel Adjustment Charge (FAC)
- वीज शुल्क → Electricity Duty
- मागणी आकार → Demand Charge
- मीटर भाडे → Meter Rent
- इतर आकार → Other Charges
- सूट / सवलत → Rebate / Discount
- टीओडी सूट → ToD Rebate
- विलंब आकार → Late Payment Surcharge
- चालू वीज देयक → Current Bill Amount
- निवडक थकबाकी → Net Arrears
- एकूण थकबाकी → Total Outstanding
- देयकाची निव्वळ रक्कम → Net Payable Amount
- एकूण खर्च → Total Consumption
- मागील वाचन → Previous Reading
- चालू वाचन → Current Reading
- वापर → Consumption (kWh)
- एकके → Units
- बिलिंग इतिहास → Billing History
- कमाल मागणी → Maximum Demand (kVA/kW)

Extract ALL data from this electricity bill into the following JSON structure. If a field is not found, use null. For charges, extract EVERY line item visible on the bill.

{
  "consumerNo": "string or null",
  "buNumber": "string or null",
  "consumerName": "string or null",
  "address": "string or null",
  "tariffCategory": "string or null (e.g. LT-I, LT-II, HT-I)",
  "connectionPhase": "string or null (e.g. Single Phase, Three Phase)",
  "sanctionedLoadKw": number or null,
  "connectedLoadKw": number or null,
  "meterNumber": "string or null",
  "billMonth": "string or null (e.g. Jan-2026)",
  "billingPeriod": "string or null",
  "dueDate": "string or null",
  "previousReading": number or null,
  "currentReading": number or null,
  "multiplicationFactor": number or null,
  "unitsConsumed": number or null,
  "maximumDemandKva": number or null,
  "powerFactor": number or null,
  "charges": [
    { "label": "string (English name)", "amount": number },
    ...
  ],
  "currentBillAmount": number or null,
  "arrears": number or null,
  "totalPayable": number or null,
  "billingHistory": [
    { "month": "string (e.g. Jan-2026)", "units": number, "amount": number },
    ...
  ]
}

RULES:
1. charges array must include EVERY individual charge/fee/duty/rebate line item on the bill. Rebates/discounts should have negative amounts.
2. billingHistory should include all visible historical months (usually 6-12 months).
3. All monetary amounts in Indian Rupees (Rs). Do not include currency symbols in numbers.
4. All numeric values must be plain numbers, not strings.
5. Preserve exact consumer number format (usually 12 digits).`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.gem_key;
  if (!apiKey) return res.status(500).json({ error: "API key not configured on server." });

  const { base64Data, mimeType } = req.body || {};
  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: "Missing base64Data or mimeType in request body." });
  }

  const supportedTypes = [
    "application/pdf",
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "image/bmp", "image/tiff"
  ];
  if (!supportedTypes.includes(mimeType)) {
    return res.status(400).json({ error: `Unsupported file type: ${mimeType}. Use PDF, JPG, PNG, or WEBP.` });
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType } },
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
      return res.status(response.status).json({
        error: `Gemini API error ${response.status}: ${errorBody}`,
      });
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return res.status(422).json({
        error: "Gemini returned an empty response. The file may not contain readable bill data.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { rawText: text };
    }

    return res.status(200).json({ data: parsed, model: "gemini-2.0-flash" });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
