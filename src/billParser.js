import { isImageFile, extractTextFromImage } from "./ocrExtractor.js";

const PDF_JS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.mjs";
const PDF_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

const MONTH_YEAR = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-20\d{2}/i;

function cleanLine(line) {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLines(text) {
  return String(text || "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isStandaloneMoney(line) {
  return /^\d{3,}(?:,\d{2,3})*(?:\.\d{1,2})?$/.test(line);
}

function isStandaloneNumber(line) {
  return /^-?\d+(?:\.\d+)?$/.test(line);
}

function numericValues(line) {
  return [...line.matchAll(/-?\d+(?:,\d{2,3})*(?:\.\d+)?/g)]
    .map((match) => toNumber(match[0]))
    .filter((value) => value !== null);
}

function isLikelyLabel(line) {
  return /:|Consumer|Address|Date|Tariff|Category|Amount|Charge|Duty|Demand|Load|Meter|Email|Mobile/i.test(line);
}

function findConsumerIndex(lines) {
  return lines.findIndex((line) => /^\d{12}$/.test(line) || /Consumer No\.?\s*:?\s*\d{12}/i.test(line));
}

function extractConsumerNo(text, lines) {
  const labelled = text.match(/Consumer No\.?\s*:?\s*(\d{12})/i);
  if (labelled) return labelled[1];

  const exact = lines.find((line) => /^\d{12}$/.test(line));
  return exact || null;
}

function extractName(text, lines, consumerIndex) {
  const labelled = text.match(/Consumer Name\s*:?\s*([^\n]+)/i);
  if (labelled && labelled[1] && !isLikelyLabel(labelled[1])) {
    return cleanLine(labelled[1]);
  }

  if (consumerIndex >= 0) {
    const parts = [];

    for (let index = consumerIndex + 1; index < Math.min(lines.length, consumerIndex + 8); index += 1) {
      const line = lines[index];

      if (
        MONTH_YEAR.test(line) ||
        /CIRCLE|DIVISION|SUB-DN|Maharashtra State|BILL OF SUPPLY/i.test(line) ||
        /@/.test(line) ||
        isStandaloneNumber(line) ||
        isLikelyLabel(line)
      ) {
        break;
      }

      parts.push(line);
    }

    if (parts.length) return cleanLine(parts.join(" "));
  }

  return null;
}

function extractAddress(text, lines, consumerIndex) {
  const labelled = text.match(/Address\s*:?\s*([^\n]+)/i);
  if (labelled && labelled[1] && !/IF PAID|BILL DATE/i.test(labelled[1])) {
    return cleanLine(labelled[1]);
  }

  const searchEnd = consumerIndex >= 0 ? consumerIndex : Math.min(lines.length, 80);
  const addressWords = /(S\.?\s?NO|PLOT|FLAT|HOUSE|ROAD|PUNE|NAGAR|SOCIETY|ESTATE|COLONY|CITY|LANE|APARTMENT|BUILDING|TAL|DIST|PIN)/i;
  const skipWords = /(BILLING HISTORY|Maharashtra State|Website|GSTIN|Consumer|Tariff|Receipt|Amount|Date)/i;

  for (let index = searchEnd - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (addressWords.test(line) && !skipWords.test(line) && !MONTH_YEAR.test(line)) {
      return cleanLine(line);
    }
  }

  return null;
}

function extractBillMonth(text, lines, consumerIndex) {
  const labelled = text.match(/BILL OF SUPPLY FOR THE MONTH\s*([A-Za-z]{3}-20\d{2})/i);
  if (labelled) return cleanLine(labelled[1]);

  const exactMonthIndex = lines.findIndex((line, index) => {
    if (!new RegExp(`^${MONTH_YEAR.source}$`, "i").test(line)) return false;
    return consumerIndex < 0 || index > consumerIndex;
  });

  if (exactMonthIndex >= 0) return lines[exactMonthIndex];

  const first = lines.find((line) => new RegExp(`^${MONTH_YEAR.source}$`, "i").test(line));
  return first || null;
}

function extractSanctionedLoad(text, lines) {
  const labelled = text.match(/(?:Sanctioned|Connected)\s+Load\s*:?\s*([0-9]+(?:\.\d+)?)/i);
  if (labelled) return toNumber(labelled[1]);

  for (let index = 0; index < Math.min(lines.length, 70); index += 1) {
    if (!/^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?$/.test(lines[index])) continue;
    const values = numericValues(lines[index]);
    if (values.length === 2 && values.every((value) => value > 0 && value <= 500)) {
      return values[0];
    }
  }

  for (let index = 0; index < Math.min(lines.length - 1, 80); index += 1) {
    if (!isStandaloneNumber(lines[index]) || !isStandaloneNumber(lines[index + 1])) continue;

    const first = toNumber(lines[index]);
    const second = toNumber(lines[index + 1]);
    const previous = lines[index - 1] || "";

    if (first > 0 && first <= 500 && second > 0 && second <= 500 && !/^\d{2}\/\d{2}\/20\d{2}$/.test(previous)) {
      return first;
    }
  }

  return null;
}

function extractBillAmount(text, lines) {
  const labelledLine = lines.find((line) => /Total Bill Amount/i.test(line) && numericValues(line).length);
  if (labelledLine) return numericValues(labelledLine).at(-1);

  const billNoIndex = lines.findIndex((line) => /Bill No/i.test(line));
  if (billNoIndex >= 0) {
    for (let index = billNoIndex + 1; index < Math.min(lines.length, billNoIndex + 10); index += 1) {
      const value = toNumber(lines[index]);
      if (isStandaloneMoney(lines[index]) && /\.\d{1,2}$/.test(lines[index]) && value > 100 && value < 10000000) {
        return value;
      }
    }
  }

  const payableAfter = lines.find((line) => /\d{2}\/\d{2}\/20\d{2}\s+[0-9][0-9,]*(?:\.\d+)?/.test(line));
  if (payableAfter) {
    const values = numericValues(payableAfter);
    return values.at(-1) || null;
  }

  return null;
}

function extractUnitsConsumed(text, lines) {
  const labelled = text.match(/(?:Units Consumed|Total Consumption)\s*:?\s*([0-9]+(?:\.\d+)?)/i);
  if (labelled) return toNumber(labelled[1]);

  const start = lines.findIndex((line) => /BILLING DETAILS|CURRENT CONSUMPTION DETAILS/i.test(line));
  const end = lines.findIndex((line, index) => index > start && /Amount In Words|Consumer No\.?\s*:/i.test(line));
  const sliceStart = start >= 0 ? start : 0;
  const sliceEnd = end > sliceStart ? end : Math.min(lines.length, sliceStart + 130);

  for (let index = sliceStart; index < sliceEnd; index += 1) {
    const values = numericValues(lines[index]);
    if (values.length >= 5) {
      const sameLineCandidate = values.at(-1);
      const precedingSum = values.slice(0, -1).reduce((sum, value) => sum + value, 0);

      if (sameLineCandidate > 0 && precedingSum > 0 && sameLineCandidate >= precedingSum * 0.75 && sameLineCandidate <= precedingSum * 1.35) {
        return round(sameLineCandidate, 3);
      }

      const nextLine = lines[index + 1];
      if (nextLine && isStandaloneNumber(nextLine)) {
        const nextValue = toNumber(nextLine);
        const sum = values.reduce((total, value) => total + value, 0);

        if (nextValue > 0 && nextValue >= sum * 0.75 && nextValue <= sum * 1.35) {
          return round(nextValue, 3);
        }
      }
    }

    const nextFive = lines.slice(index, index + 5);
    const allPositiveStandalone = nextFive.length === 5 && nextFive.every((line) => {
      const value = toNumber(line);
      return isStandaloneNumber(line) && value > 0;
    });
    const candidateLine = lines[index + 5];

    if (allPositiveStandalone && candidateLine && isStandaloneNumber(candidateLine)) {
      const sum = nextFive.reduce((total, line) => total + toNumber(line), 0);
      const candidate = toNumber(candidateLine);

      if (candidate > 0 && candidate >= sum * 0.75 && candidate <= sum * 1.35) {
        return round(candidate, 3);
      }
    }
  }

  return null;
}

function extractBillingHistory(lines) {
  const start = lines.findIndex((line) => /BILLING HISTORY/i.test(line));
  if (start < 0) return [];

  const history = [];
  for (let index = start + 1; index < Math.min(lines.length, start + 20); index += 1) {
    const line = lines[index];
    if (/Consumer|Maharashtra State|BILL OF SUPPLY|S\.?\s?NO|Address/i.test(line)) break;

    const match = line.match(/^(?:\d{1,2})?([A-Za-z]{3}-20\d{2})\s+([0-9]+(?:\.\d+)?)(?:\s+([0-9]+(?:\.\d+)?))?/i);
    if (!match && new RegExp(`^${MONTH_YEAR.source}$`, "i").test(line)) {
      const units = toNumber(lines[index + 1]);
      const amount = toNumber(lines[index + 2]);

      if (units !== null) {
        history.push({
          month: line,
          units,
          amount,
        });
      }

      continue;
    }

    if (!match) continue;

    history.push({
      month: cleanLine(match[1]),
      units: toNumber(match[2]),
      amount: toNumber(match[3]),
    });
  }

  return history;
}

function averageHistoryUnits(history) {
  const units = history
    .map((entry) => entry.units)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!units.length) return null;
  return round(units.reduce((sum, value) => sum + value, 0) / units.length, 2);
}

function buildWarnings(fields) {
  const warnings = [];
  const required = [
    ["name", "Name"],
    ["address", "Address"],
    ["billMonth", "Bill month"],
    ["sanctionedLoadKw", "Sanctioned load"],
    ["billAmountRs", "Bill amount"],
    ["unitsConsumedKwh", "Units consumed"],
    ["yearlyAvgUnitsKwh", "Yearly average units"],
  ];

  required.forEach(([key, label]) => {
    if (fields[key] === null || fields[key] === "") warnings.push(`${label} was not found.`);
  });

  return warnings;
}

export function parseMsebBillText(text, { fileName = "" } = {}) {
  const lines = splitLines(text);
  const normalizedText = lines.join("\n");
  const consumerIndex = findConsumerIndex(lines);
  const history = extractBillingHistory(lines);

  const fields = {
    fileName,
    consumerNo: extractConsumerNo(normalizedText, lines),
    name: extractName(normalizedText, lines, consumerIndex),
    address: extractAddress(normalizedText, lines, consumerIndex),
    billMonth: extractBillMonth(normalizedText, lines, consumerIndex),
    sanctionedLoadKw: extractSanctionedLoad(normalizedText, lines),
    billAmountRs: extractBillAmount(normalizedText, lines),
    unitsConsumedKwh: extractUnitsConsumed(normalizedText, lines),
    yearlyAvgUnitsKwh: averageHistoryUnits(history),
  };

  const warnings = buildWarnings(fields);

  return {
    fields,
    history,
    warnings,
    rawText: normalizedText,
    confidence: Math.round(((7 - warnings.length) / 7) * 100),
  };
}

function groupTextItemsIntoLines(items) {
  const rows = [];

  items.forEach((item) => {
    const text = cleanLine(item.str || "");
    if (!text) return;

    const x = item.transform?.[4] || 0;
    const y = item.transform?.[5] || 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2.5);

    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }

    row.items.push({ x, text });
  });

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => row.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" "))
    .map(cleanLine)
    .filter(Boolean);
}

export async function extractTextFromBillFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "txt" || extension === "csv") {
    return file.text();
  }

  // Image files → OCR via Google Gemini
  if (isImageFile(file)) {
    return extractTextFromImage(file);
  }

  if (extension !== "pdf") {
    throw new Error("Supported formats: PDF (selectable text), JPG, PNG, WEBP, TXT, CSV.");
  }

  const pdfjs = await import(PDF_JS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(groupTextItemsIntoLines(content.items).join("\n"));
  }

  return pages.join("\n");
}

export async function parseMsebBillFile(file) {
  const text = await extractTextFromBillFile(file);
  return parseMsebBillText(text, { fileName: file.name });
}
