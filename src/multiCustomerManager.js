/**
 * Pune Solar Calculator - Multi-Customer Building Manager
 * Handles multi-customer societies, shared roof allocations, fixed-quantum subsidies,
 * CSV import/export, and combined master ledger calculations.
 */

import { DEFAULT_CONFIG } from "./config.js";
import { calculateSolarFinancing } from "./loanEngine.js";

// Distinct high-contrast color palette for up to 50 flats
export const FLAT_COLOR_PALETTE = [
  "#2563eb", // Royal Blue
  "#d97706", // Amber
  "#16a34a", // Green
  "#9333ea", // Purple
  "#0891b2", // Cyan
  "#e11d48", // Rose
  "#4f46e5", // Indigo
  "#059669", // Emerald
  "#d946ef", // Fuchsia
  "#ea580c", // Orange
  "#0284c7", // Sky
  "#65a30d", // Lime
  "#7c3aed", // Violet
  "#db2777", // Pink
  "#0d9488", // Teal
  "#b45309", // Warm Gold
  "#4338ca", // Deep Indigo
  "#15803d", // Forest Green
  "#be123c", // Crimson
  "#0369a1", // Ocean Blue
  "#6d28d9", // Grape
  "#c2410c", // Burnt Orange
  "#047857", // Deep Teal
  "#a21caf", // Plum
  "#1d4ed8", // Cobalt
  "#b91c1c", // Ruby
  "#0f766e", // Dark Cyan
  "#86198f", // Dark Magenta
  "#374151", // Slate Gray
  "#4d7c0f", // Olive Green
];

/**
 * PM Surya Ghar Fixed Quantum Subsidy Calculator
 * Slabs:
 * - < 1 kW: ₹0 (minimum grid-tied capacity eligible for subsidy is 1 kW)
 * - 1 kW to < 2 kW: ₹30,000 (fixed quantum for 1 kW completed slab)
 * - 2 kW to < 3 kW: ₹60,000 (fixed quantum for 2 kW completed slab)
 * - >= 3 kW: ₹78,000 (fixed quantum cap for 3 kW+ slab)
 * Note: Non-residential or commercial categories (LT-II, LT-III) get ₹0.
 */
export function calculateFixedQuantumSubsidy(capacityKw, category = "LT-I") {
  const cap = Number(capacityKw) || 0;
  const cat = String(category || "LT-I").toUpperCase();

  // Commercial / Industrial meters do not receive residential PM Surya Ghar subsidy
  if (cat.startsWith("LT-II") || cat.startsWith("LT-III") || cat.startsWith("HT")) {
    return 0;
  }

  // GHS Common Meter (Group Housing Society common services)
  if (cat === "LT-I-GHS" || cat === "GHS") {
    return Math.min(Math.floor(cap) * 18000, 78000 * 10);
  }

  // Individual residential flat meters: Fixed Quantum Slabs (no linear scaling)
  if (cap < 1.0) {
    return 0;
  } else if (cap < 2.0) {
    return 30000;
  } else if (cap < 3.0) {
    return 60000;
  } else {
    return 78000;
  }
}

/**
 * Assign distinct colors and labels to flats
 */
export function assignFlatColors(flats) {
  return flats.map((flat, idx) => ({
    ...flat,
    color: flat.color || FLAT_COLOR_PALETTE[idx % FLAT_COLOR_PALETTE.length],
    borderColor: flat.borderColor || FLAT_COLOR_PALETTE[idx % FLAT_COLOR_PALETTE.length],
  }));
}

/**
 * Allocate total panels across flats proportional to their monthly consumption (monthlyUnits).
 * Ensures sum(flat.panels) exactly equals totalPanels.
 */
export function allocatePanelsByConsumption(totalPanels, flats, panelWp = 550) {
  if (!flats || flats.length === 0) return [];
  if (totalPanels <= 0) {
    return flats.map((f) => ({ ...f, panels: 0, allocatedKw: 0 }));
  }

  const totalUnits = flats.reduce((sum, f) => sum + (Math.max(0, Number(f.monthlyUnits)) || 0), 0);

  // If all units are 0, distribute equally
  if (totalUnits <= 0) {
    const basePanels = Math.floor(totalPanels / flats.length);
    let rem = totalPanels % flats.length;
    return flats.map((f, i) => {
      const pCount = basePanels + (i < rem ? 1 : 0);
      return {
        ...f,
        panels: pCount,
        allocatedKw: Math.round((pCount * panelWp / 1000) * 100) / 100,
      };
    });
  }

  // Proportional allocation with Hare-Niemeyer largest remainder method
  const floatAllocations = flats.map((f, idx) => {
    const units = Math.max(0, Number(f.monthlyUnits)) || 0;
    const exact = (units / totalUnits) * totalPanels;
    const floor = Math.floor(exact);
    const remainder = exact - floor;
    return { idx, floor, remainder };
  });

  let allocatedSum = floatAllocations.reduce((s, a) => s + a.floor, 0);
  let remainingPanels = totalPanels - allocatedSum;

  // Distribute remaining panels to flats with largest fractions
  floatAllocations.sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < remainingPanels; i++) {
    floatAllocations[i % floatAllocations.length].floor += 1;
  }

  // Sort back to original flat order
  floatAllocations.sort((a, b) => a.idx - b.idx);

  return flats.map((f, idx) => {
    const pCount = floatAllocations[idx].floor;
    const allocatedKw = Math.round((pCount * panelWp / 1000) * 100) / 100;
    return {
      ...f,
      panels: pCount,
      allocatedKw,
    };
  });
}

/**
 * Calculate the Complete Master Financial Ledger for the entire building and each individual flat.
 */
export function calculateBuildingLedger({
  buildingName = "Building Solar Project",
  buildingAddress = "Pune, Maharashtra",
  roofAreaSqft = 1500,
  panelMake = "Tata Power Solar",
  panelType = "dcr",
  panelRate = 25,
  panelWp = 550,
  structureType = "hotDip",
  loanInterestRate = 7,
  loanDownPaymentPct = 10,
  flats = [],
  config = DEFAULT_CONFIG,
} = {}) {
  const coloredFlats = assignFlatColors(flats);

  // Sizing by roof area
  const panelWidthMm = 1123;
  const panelHeightMm = 2279;
  const panelAreaSqft = (panelWidthMm / 1000) * (panelHeightMm / 1000) * 10.7639; // ~27.5 sq ft
  const maxRoofPanels = Math.max(0, Math.floor((roofAreaSqft * 0.70) / panelAreaSqft));

  // Sizing by total consumption
  const totalMonthlyUnits = coloredFlats.reduce((s, f) => s + (Number(f.monthlyUnits) || 0), 0);
  const totalSanctionedLoad = coloredFlats.reduce((s, f) => s + (Number(f.sanctionedLoad) || 0), 0);
  const totalCurrentBill = coloredFlats.reduce((s, f) => s + (Number(f.monthlyBill) || 0), 0);

  // Approximate generation: 1 kWp produces ~110 units/month in Pune (450 units for 4.4 kWp)
  const unitsPerKwMonth = 105;
  const targetKwByConsumption = totalMonthlyUnits > 0 ? (totalMonthlyUnits / unitsPerKwMonth) : (totalSanctionedLoad || 5);
  const targetPanelsByConsumption = Math.round((targetKwByConsumption * 1000) / panelWp);

  // Total building panels (bounded by roof area)
  const totalBuildingPanels = maxRoofPanels > 0 
    ? Math.min(targetPanelsByConsumption, maxRoofPanels)
    : targetPanelsByConsumption;

  const totalBuildingCapacityKw = Math.round((totalBuildingPanels * panelWp / 1000) * 10) / 10;

  // Allocate panels across flats proportional to monthly units
  const allocatedFlats = allocatePanelsByConsumption(totalBuildingPanels, coloredFlats, panelWp);

  // Pricing constants (matches calculator.js / config.js)
  const pricing = config.pricing || DEFAULT_CONFIG.pricing;
  const structureRate = pricing.structureRates?.[structureType] || 6;
  const installationRate = pricing.installationRatePerW || 2.5;
  const consultancyRate = pricing.consultancyRatePerW || 1.0;
  const inverterRate = 5.5; // Rs/W average for large scale ongrid inverters
  const safetyAndEarthingCostTotal = Math.max(15000, totalBuildingCapacityKw * 1500);

  // Calculate Building Gross Project Cost
  const totalDcWatts = totalBuildingCapacityKw * 1000;
  const panelCost = totalDcWatts * panelRate;
  const structureCost = totalDcWatts * structureRate;
  const inverterCost = totalDcWatts * inverterRate;
  const installationCost = totalDcWatts * installationRate;
  const consultancyCost = totalDcWatts * consultancyRate;

  const preTaxSubtotal = panelCost + structureCost + inverterCost + installationCost + consultancyCost + safetyAndEarthingCostTotal;
  const gst = preTaxSubtotal * 0.089; // 8.9% effective GST
  const baseCostInclGst = preTaxSubtotal + gst;
  const margin = baseCostInclGst * 0.30; // 30% margin
  const totalBuildingGrossCost = Math.round(baseCostInclGst + margin);

  // Gross cost per kWp
  const grossCostPerKw = totalBuildingCapacityKw > 0 ? (totalBuildingGrossCost / totalBuildingCapacityKw) : 60000;

  // Total generation
  const monthlyGenerationTotal = Math.round(totalBuildingCapacityKw * unitsPerKwMonth);
  const annualGenerationTotal = monthlyGenerationTotal * 12;
  const lifetimeGenerationTotal = annualGenerationTotal * 25;

  // Process individual flat metrics
  let totalSubsidiesSum = 0;
  let totalNetCostSum = 0;
  let totalMonthlySavingsSum = 0;
  let totalAnnualSavingsSum = 0;
  let totalLifetimeSavingsSum = 0;

  const flatLedger = allocatedFlats.map((flat, idx) => {
    const flatCapKw = flat.allocatedKw || (flat.panels * panelWp / 1000);
    const flatShareFraction = totalBuildingCapacityKw > 0 ? (flatCapKw / totalBuildingCapacityKw) : (1 / allocatedFlats.length);
    const grossCost = Math.round(totalBuildingGrossCost * flatShareFraction);

    // Fixed Quantum Subsidy per flat
    const subsidy = calculateFixedQuantumSubsidy(flatCapKw, flat.consumerCategory || "LT-I");
    totalSubsidiesSum += subsidy;

    const netCost = Math.max(0, grossCost - subsidy);
    totalNetCostSum += netCost;

    // Monthly solar generation for this flat
    const flatMonthlyGen = Math.round(monthlyGenerationTotal * flatShareFraction);
    const flatMonthlyUnits = Number(flat.monthlyUnits) || 0;
    const flatMonthlyBill = Number(flat.monthlyBill) || 0;

    // Avg rate per unit
    const avgTariffPerUnit = flatMonthlyUnits > 0 ? (flatMonthlyBill / flatMonthlyUnits) : 10.5;

    // Offset up to flat's consumption
    const offsetUnits = Math.min(flatMonthlyUnits, flatMonthlyGen);
    const monthlySavings = Math.round(Math.min(flatMonthlyBill, offsetUnits * avgTariffPerUnit));
    totalMonthlySavingsSum += monthlySavings;

    const annualSavings = monthlySavings * 12;
    totalAnnualSavingsSum += annualSavings;

    const lifetimeSavings = annualSavings * 25;
    totalLifetimeSavingsSum += lifetimeSavings;

    const postSolarBill = Math.max(0, flatMonthlyBill - monthlySavings);
    const paybackYears = annualSavings > 0 && netCost > 0 ? Math.round((netCost / annualSavings) * 10) / 10 : 0;
    const roiPercent = netCost > 0 ? Math.round((annualSavings / netCost) * 1000) / 10 : 0;

    // Loan calculations per flat (Option B)
    const isLoan = flat.paymentMode === "loan";
    const downPaymentPct = Number.isFinite(Number(flat.loanDownPaymentPct)) ? Number(flat.loanDownPaymentPct) : loanDownPaymentPct;
    const interestRate = Number.isFinite(Number(flat.loanInterestRate)) ? Number(flat.loanInterestRate) : loanInterestRate;

    const financing = calculateSolarFinancing({
      netCost,
      totalPreSubsidy: grossCost,
      subsidy,
      monthlyBill: flatMonthlyBill,
      monthlySavings,
      lifetimeSavings,
      paymentMode: isLoan ? "loan" : "upfront",
      downPaymentPct,
      interestRatePct: interestRate,
    });

    return {
      index: idx + 1,
      id: flat.id || `flat_${idx + 1}`,
      flatNo: flat.flatNo || `Flat ${idx + 101}`,
      customerName: flat.customerName || `Resident ${idx + 1}`,
      sanctionedLoad: Number(flat.sanctionedLoad) || 3,
      category: flat.category || flat.consumerCategory || "LT-I",
      consumerCategory: flat.consumerCategory || flat.category || "LT-I",
      phase: flat.phase || "1-phase",
      monthlyUnits: flatMonthlyUnits,
      monthlyBill: flatMonthlyBill,
      panels: flat.panels || 0,
      allocatedKw: flatCapKw,
      grossCost,
      subsidy,
      netCost,
      monthlyGeneration: flatMonthlyGen,
      annualGeneration: flatMonthlyGen * 12,
      monthlySavings,
      annualSavings,
      lifetimeSavings,
      postSolarBill,
      paybackYears,
      roiPercent,
      loanMode: isLoan,
      paymentMode: isLoan ? "loan" : "upfront",
      downPaymentPct,
      interestRate,
      financing,
      color: flat.color,
      borderColor: flat.borderColor,
    };
  });

  const overallPaybackYears = totalAnnualSavingsSum > 0 && totalNetCostSum > 0
    ? Math.round((totalNetCostSum / totalAnnualSavingsSum) * 10) / 10
    : 0;

  const totals = {
    totalFlats: flatLedger.length,
    totalSanctionedLoad,
    totalMonthlyUnits,
    totalCurrentBill,
    totalPanels: totalBuildingPanels,
    totalCapacityKw: totalBuildingCapacityKw,
    totalGrossCost: totalBuildingGrossCost,
    totalSubsidies: totalSubsidiesSum,
    totalNetCost: totalNetCostSum,
    monthlyGeneration: monthlyGenerationTotal,
    annualGeneration: annualGenerationTotal,
    lifetimeGeneration: lifetimeGenerationTotal,
    totalMonthlySavings: totalMonthlySavingsSum,
    totalAnnualSavings: totalAnnualSavingsSum,
    totalLifetimeSavings: totalLifetimeSavingsSum,
    overallPaybackYears,
    panelMake,
    panelType,
    panelRate,
    panelWp,
    structureType,
    loanInterestRate,
    loanDownPaymentPct,
  };

  const summary = {
    ...totals,
    totalPanels: totalBuildingPanels,
    totalBuildingPanels,
    totalCapacityKw: totalBuildingCapacityKw,
    totalBuildingCapacityKw,
    totalGrossCost: totalBuildingGrossCost,
    totalBuildingGrossCost,
    totalSubsidy: totalSubsidiesSum,
    totalSubsidies: totalSubsidiesSum,
    totalNetCost: totalNetCostSum,
    monthlyGenerationTotal,
    annualGenerationTotal,
    buildingPaybackYears: overallPaybackYears,
    overallPaybackYears,
  };

  return {
    buildingName,
    buildingAddress,
    roofAreaSqft,
    panelMake,
    panelType,
    panelRate,
    panelWp,
    loanInterestRate,
    loanDownPaymentPct,
    totals: summary,
    summary,
    flatLedger,
  };
}

/**
 * Generate CSV template for multi-customer building solar proposal
 */
export function generateBuildingCSVTemplate() {
  const headers = [
    "FlatNo",
    "CustomerName",
    "SanctionLoadKw",
    "Category",
    "Phase",
    "MonthlyUnits",
    "MonthlyBill",
    "PaymentMode",
    "LoanDownPaymentPct",
    "LoanInterestRate",
  ];

  const sampleRows = [
    ["101", "Rahul Sharma", "3", "LT-I", "1-phase", "280", "3100", "without_loan", "10", "7"],
    ["102", "Anil Deshmukh", "4", "LT-I", "1-phase", "350", "3900", "without_loan", "10", "7"],
    ["201", "Sunita Patil", "5", "LT-I", "3-phase", "480", "5400", "loan", "15", "7"],
    ["202", "Amit Joshi", "3", "LT-I", "1-phase", "260", "2900", "without_loan", "10", "7"],
    ["301", "Priya Kulkarni", "4", "LT-I", "1-phase", "320", "3600", "without_loan", "10", "7"],
    ["302", "Suresh Mehta (Penthouse)", "6", "LT-I", "3-phase", "650", "7200", "loan", "10", "7"],
  ];

  const csvContent = [headers.join(","), ...sampleRows.map((r) => r.map(c => `"${c}"`).join(","))].join("\n");
  return csvContent;
}

/**
 * Parse uploaded Building Flats CSV/TSV into flat objects
 */
const cleanNum = (str, fallback = 0) => {
  if (str === null || str === undefined) return fallback;
  const num = parseFloat(String(str).replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? fallback : num;
};

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  let inQuotes = false;
  let tabs = 0;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"' || ch === "'") {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === "\t") tabs++;
      else if (ch === ",") commas++;
      else if (ch === ";") semicolons++;
    }
  }
  if (tabs > commas && tabs >= semicolons) return "\t";
  if (semicolons > commas && semicolons > tabs) return ";";
  return ",";
}

// RFC 4180 compliant line parser supporting configurable delimiter
export function splitCsvLine(line, delimiter = ",") {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      if (inQuotes && i + 1 < line.length && line[i + 1] === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ""));
  return result;
}

export function parseBuildingCSV(csvText) {
  if (!csvText || typeof csvText !== "string") {
    throw new Error("Invalid or empty CSV content");
  }

  // Strip UTF-8 BOM if present (e.g. from Excel export)
  const cleanedText = csvText.replace(/^\uFEFF/, "");
  const lines = cleanedText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("CSV file must contain a header row and at least one data row");
  }

  const delimiter = detectDelimiter(lines[0]);
  // Parse header
  const rawHeaders = splitCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));

  const findCol = (predicate) => rawHeaders.findIndex(predicate);

  let flatNoIdx = findCol((h) => h === "flatno" || h === "flat" || h === "flatnumber" || h === "flatnum" || h === "apt" || h === "apartment" || h === "unitno" || h === "room");
  if (flatNoIdx === -1) {
    flatNoIdx = findCol((h) => h.includes("flat") || (h.includes("unit") && !h.includes("monthly") && !h.includes("kwh") && !h.includes("consum")));
  }

  let custNameIdx = findCol((h) => h === "customername" || h === "consumername" || h === "residentname" || h === "name" || h === "customer" || h === "client" || h === "resident");
  if (custNameIdx === -1) {
    custNameIdx = findCol((h) => h.includes("name") || h.includes("consumer") || h.includes("resident") || h.includes("customer"));
  }

  let loadIdx = findCol((h) => h === "sanctionloadkw" || h === "sanctionedload" || h === "sanctionload" || h === "loadkw" || h === "load");
  if (loadIdx === -1) {
    loadIdx = findCol((h) => h.includes("sanction") || (h.includes("load") && !h.includes("down") && !h.includes("upfront")));
  }

  let catIdx = findCol((h) => h === "category" || h === "tariff" || h === "tariffcategory" || h === "consumercategory" || h === "cat");
  if (catIdx === -1) {
    catIdx = findCol((h) => h.includes("cat") || h.includes("tariff"));
  }

  let phaseIdx = findCol((h) => h === "phase" || h === "connectionphase" || h === "supplyphase");
  if (phaseIdx === -1) {
    phaseIdx = findCol((h) => h.includes("phase"));
  }

  let unitsIdx = findCol((h) => h === "monthlyunits" || h === "units" || h === "kwh" || h === "unitsmo" || h === "monthlyconsumption" || h === "consumption");
  if (unitsIdx === -1) {
    unitsIdx = findCol((h) => (h.includes("unit") || h.includes("kwh") || h.includes("consum")) && !h.includes("flat") && !h.includes("apt"));
  }

  let billIdx = findCol((h) => h === "monthlybill" || h === "bill" || h === "billamount" || h === "currentbill" || h === "billrs" || h === "amount");
  if (billIdx === -1) {
    billIdx = findCol((h) => h.includes("bill") || (h.includes("amount") && !h.includes("loan") && !h.includes("down")));
  }

  let payModeIdx = findCol((h) => h === "paymentmode" || h === "paymode" || h === "mode" || h === "payment" || h === "loanmode");
  if (payModeIdx === -1) {
    payModeIdx = findCol((h) => (!h.includes("down") && !h.includes("interest") && !h.includes("rate") && !h.includes("pct")) && (h.includes("payment") || h.includes("mode") || h === "loan"));
  }

  let downPctIdx = findCol((h) => h === "loandownpaymentpct" || h === "downpaymentpct" || h === "downpayment" || h === "upfrontpct" || h === "downpct");
  if (downPctIdx === -1) {
    downPctIdx = findCol((h) => h.includes("down") || h.includes("upfront"));
  }

  let interestIdx = findCol((h) => h === "loaninterestrate" || h === "interestrate" || h === "interest" || h === "roi" || h === "ratepct");
  if (interestIdx === -1) {
    interestIdx = findCol((h) => h.includes("interest") || (h.includes("rate") && !h.includes("slab") && !h.includes("panel")));
  }

  const colMap = {
    flatNo: flatNoIdx,
    customerName: custNameIdx,
    sanctionedLoad: loadIdx,
    category: catIdx,
    phase: phaseIdx,
    monthlyUnits: unitsIdx,
    monthlyBill: billIdx,
    paymentMode: payModeIdx,
    loanDownPaymentPct: downPctIdx,
    loanInterestRate: interestIdx,
  };

  const flats = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], delimiter);
    if (cols.length === 0 || cols.every((c) => !c.trim())) continue;

    const flatNo = (colMap.flatNo !== -1 && cols[colMap.flatNo]) ? cols[colMap.flatNo].trim() : `Flat ${i}`;
    const customerName = (colMap.customerName !== -1 && cols[colMap.customerName]) ? cols[colMap.customerName].trim() : `Resident ${flatNo}`;
    const sanctionedLoad = (colMap.sanctionedLoad !== -1) ? cleanNum(cols[colMap.sanctionedLoad], 3) : 3;
    const rawCat = (colMap.category !== -1 && cols[colMap.category]) ? cols[colMap.category].trim().toUpperCase() : "LT-I";
    const category = rawCat.includes("GHS") ? "LT-I-GHS" : rawCat.includes("LT-II") ? "LT-II" : rawCat.includes("LT-III") ? "LT-III" : "LT-I";
    const phase = (colMap.phase !== -1 && cols[colMap.phase] && cols[colMap.phase].includes("3")) ? "3-phase" : "1-phase";
    const monthlyUnits = (colMap.monthlyUnits !== -1) ? cleanNum(cols[colMap.monthlyUnits], 300) : 300;
    const monthlyBill = (colMap.monthlyBill !== -1) ? cleanNum(cols[colMap.monthlyBill], Math.round(monthlyUnits * 11)) : Math.round(monthlyUnits * 11);

    let paymentMode = "upfront";
    let loanMode = false;
    if (colMap.paymentMode !== -1 && cols[colMap.paymentMode]) {
      const pm = cols[colMap.paymentMode].toLowerCase().trim();
      if (pm.includes("without") || pm.includes("no") || pm.includes("cash") || pm.includes("upfront") || pm === "false" || pm === "0") {
        paymentMode = "upfront";
        loanMode = false;
      } else if (pm.includes("loan") || pm.includes("bank") || pm.includes("emi") || pm.includes("finance") || pm === "true" || pm === "yes" || pm === "1") {
        paymentMode = "loan";
        loanMode = true;
      }
    }

    const loanDownPaymentPct = (colMap.loanDownPaymentPct !== -1) ? cleanNum(cols[colMap.loanDownPaymentPct], 10) : 10;
    const loanInterestRate = (colMap.loanInterestRate !== -1) ? cleanNum(cols[colMap.loanInterestRate], 7) : 7;

    flats.push({
      id: `flat_${i}`,
      flatNo,
      customerName,
      sanctionedLoad,
      category,
      consumerCategory: category,
      phase,
      monthlyUnits,
      monthlyBill,
      paymentMode,
      loanMode,
      loanDownPaymentPct,
      loanInterestRate,
    });
  }

  // Ensure both Array.isArray(result) and result.flats work identically
  flats.flats = flats;
  return flats;
}

/**
 * Export flats list to CSV string
 */
export function exportBuildingToCSV(flats) {
  const headers = [
    "FlatNo",
    "CustomerName",
    "SanctionLoadKw",
    "Category",
    "Phase",
    "MonthlyUnits",
    "MonthlyBill",
    "Panels",
    "AllocatedKw",
    "GrossCost",
    "Subsidy",
    "NetCost",
    "MonthlySavings",
    "PaybackYears",
    "PaymentMode",
  ];

  const rows = flats.map((f) => [
    f.flatNo || "",
    f.customerName || "",
    f.sanctionedLoad || 3,
    f.consumerCategory || "LT-I",
    f.phase || "1-phase",
    f.monthlyUnits || 0,
    f.monthlyBill || 0,
    f.panels || 0,
    f.allocatedKw || 0,
    f.grossCost || 0,
    f.subsidy || 0,
    f.netCost || 0,
    f.monthlySavings || 0,
    f.paybackYears || 0,
    f.paymentMode || "upfront",
  ]);

  return [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
}


