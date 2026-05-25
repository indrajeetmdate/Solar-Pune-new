/**
 * Bill Parser — handles both structured Gemini JSON extraction
 * and legacy text-based parsing for TXT/CSV files.
 *
 * Primary flow: PDF/Image → Gemini → structured JSON → normalized result
 * Fallback flow: TXT/CSV → text parsing → regex extraction → normalized result
 */

import { isSupportedBillFile, extractBillData, isImageFile } from "./ocrExtractor.js";

// ─── Legacy text parsing helpers (for TXT/CSV files only) ────────────────────

const MONTH_YEAR = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-20\d{2}/i;

function cleanLine(line) {
  return line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function splitLines(text) {
  return String(text || "").replace(/\r/g, "\n").split("\n").map(cleanLine).filter(Boolean);
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

function numericValues(line) {
  return [...line.matchAll(/-?\d+(?:,\d{2,3})*(?:\.\d+)?/g)]
    .map((m) => toNumber(m[0]))
    .filter((v) => v !== null);
}

function extractConsumerNo(text) {
  const m = text.match(/Consumer No\.?\s*:?\s*(\d{12})/i);
  return m ? m[1] : null;
}

function extractName(text) {
  const m = text.match(/Consumer Name\s*:?\s*([^\n]+)/i);
  return m ? cleanLine(m[1]) : null;
}

function extractSanctionedLoad(text) {
  const m = text.match(/(?:Sanctioned|Connected)\s+Load\s*:?\s*(\d+(?:\.\d+)?)/i);
  return m ? toNumber(m[1]) : null;
}

function extractBillMonth(text) {
  const m = text.match(/(?:BILL OF SUPPLY FOR THE MONTH|Bill Month)\s*:?\s*([A-Za-z]{3}-20\d{2})/i);
  if (m) return m[1];
  const monthMatch = text.match(MONTH_YEAR);
  return monthMatch ? monthMatch[0] : null;
}

function extractBillAmount(text) {
  const m = text.match(/Total Bill Amount\s*:?\s*([\d,]+(?:\.\d+)?)/i);
  return m ? toNumber(m[1]) : null;
}

function extractUnitsConsumed(text) {
  const m = text.match(/(?:Units Consumed|Total Consumption)\s*:?\s*(\d+(?:\.\d+)?)/i);
  return m ? toNumber(m[1]) : null;
}

// ─── Structured JSON normalization (for Gemini output) ───────────────────────

/**
 * Normalize the structured Gemini JSON into the app's standard format.
 * This is the primary path for PDF and image files.
 */
function normalizeGeminiResult(data, fileName) {
  const charges = Array.isArray(data.charges) ? data.charges : [];
  const history = Array.isArray(data.billingHistory) ? data.billingHistory : [];

  // Calculate yearly average and peak from billing history
  const validUnits = history
    .map((e) => e.units)
    .filter((v) => Number.isFinite(v) && v > 0);
  const yearlyAvg = validUnits.length
    ? round(validUnits.reduce((s, v) => s + v, 0) / validUnits.length)
    : null;
  const peakUnits = validUnits.length
    ? Math.max(...validUnits)
    : null;

  const fields = {
    fileName,
    consumerNo: data.consumerNo || null,
    buNumber: data.buNumber || null,
    name: data.consumerName || null,
    address: data.address || null,
    tariffCategory: data.tariffCategory || null,
    connectionPhase: data.connectionPhase || null,
    billMonth: data.billMonth || null,
    billingPeriod: data.billingPeriod || null,
    dueDate: data.dueDate || null,
    sanctionedLoadKw: toNumber(data.sanctionedLoadKw),
    connectedLoadKw: toNumber(data.connectedLoadKw),
    meterNumber: data.meterNumber || null,
    previousReading: toNumber(data.previousReading),
    currentReading: toNumber(data.currentReading),
    multiplicationFactor: toNumber(data.multiplicationFactor),
    unitsConsumedKwh: toNumber(data.unitsConsumed),
    maximumDemandKva: toNumber(data.maximumDemandKva),
    powerFactor: toNumber(data.powerFactor),
    billAmountRs: toNumber(data.currentBillAmount),
    arrears: toNumber(data.arrears),
    totalPayable: toNumber(data.totalPayable),
    yearlyAvgUnitsKwh: yearlyAvg,
    peakUnitsKwh: peakUnits,
  };

  // Build warnings for missing critical fields
  const warnings = [];
  const required = [
    ["name", "Name"],
    ["billMonth", "Bill month"],
    ["sanctionedLoadKw", "Sanctioned load"],
    ["billAmountRs", "Bill amount"],
    ["unitsConsumedKwh", "Units consumed"],
  ];
  required.forEach(([key, label]) => {
    if (fields[key] === null || fields[key] === "") warnings.push(`${label} was not found.`);
  });

  const totalFields = required.length + 5; // 5 bonus fields
  const found = totalFields - warnings.length;

  return {
    fields,
    charges,
    history,
    warnings,
    rawData: data,
    confidence: Math.round((found / totalFields) * 100),
    extractionMethod: "gemini-structured",
  };
}

/**
 * Legacy text-based parsing for TXT/CSV files.
 */
function parseBillText(text, fileName) {
  const lines = splitLines(text);
  const normalized = lines.join("\n");

  // Extract billing history
  const history = [];
  const histStart = lines.findIndex((l) => /BILLING HISTORY/i.test(l));
  if (histStart >= 0) {
    for (let i = histStart + 1; i < Math.min(lines.length, histStart + 20); i++) {
      const m = lines[i].match(/([A-Za-z]{3}-20\d{2})\s+([\d.]+)(?:\s+([\d.]+))?/i);
      if (m) history.push({ month: m[1], units: toNumber(m[2]), amount: toNumber(m[3]) });
    }
  }

  const validUnits = history.map((e) => e.units).filter((v) => Number.isFinite(v) && v > 0);
  const yearlyAvg = validUnits.length
    ? round(validUnits.reduce((s, v) => s + v, 0) / validUnits.length)
    : null;
  const peakUnits = validUnits.length
    ? Math.max(...validUnits)
    : null;

  const fields = {
    fileName,
    consumerNo: extractConsumerNo(normalized),
    name: extractName(normalized),
    address: null,
    tariffCategory: null,
    billMonth: extractBillMonth(normalized),
    sanctionedLoadKw: extractSanctionedLoad(normalized),
    billAmountRs: extractBillAmount(normalized),
    unitsConsumedKwh: extractUnitsConsumed(normalized),
    yearlyAvgUnitsKwh: yearlyAvg,
    peakUnitsKwh: peakUnits,
  };

  const warnings = [];
  const required = [
    ["name", "Name"],
    ["billMonth", "Bill month"],
    ["sanctionedLoadKw", "Sanctioned load"],
    ["billAmountRs", "Bill amount"],
    ["unitsConsumedKwh", "Units consumed"],
  ];
  required.forEach(([key, label]) => {
    if (fields[key] === null || fields[key] === "") warnings.push(`${label} was not found.`);
  });

  return {
    fields,
    charges: [],
    history,
    warnings,
    rawText: normalized,
    confidence: Math.round(((required.length - warnings.length) / required.length) * 100),
    extractionMethod: "text-regex",
  };
}

// ─── Main entry points ──────────────────────────────────────────────────────

/**
 * Parse an MSEDCL bill file (PDF, image, or text).
 *
 * PDF & Images → Gemini structured extraction (primary path)
 * TXT/CSV → Legacy text parsing (fallback)
 */
export async function parseMsebBillFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();

  // Text files → legacy parser
  if (ext === "txt" || ext === "csv") {
    const text = await file.text();
    return parseBillText(text, file.name);
  }

  // PDF & images → Gemini structured extraction
  if (isSupportedBillFile(file)) {
    const data = await extractBillData(file);
    return normalizeGeminiResult(data, file.name);
  }

  throw new Error("Supported formats: PDF, JPG, PNG, WEBP, BMP, TIFF, TXT, CSV.");
}

/**
 * Legacy compat — parse raw text into bill fields.
 */
export function parseMsebBillText(text, { fileName = "" } = {}) {
  return parseBillText(text, fileName);
}
