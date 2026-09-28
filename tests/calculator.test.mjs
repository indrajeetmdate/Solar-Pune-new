import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import {
  calculateBill,
  calculateEstimate,
  calculateSubsidy,
  recommendCapacity,
} from "../src/calculator.js";
import { buildSystemIncludesText, sanitizeSystemIncludes } from "../src/reportGenerator.js";

function makeInput(overrides = {}) {
  return {
    monthlyUnits: 450,
    monthlyBill: 5200,
    roofArea: 650,
    sanctionedLoad: 5,
    goal: "ongrid",
    backupNeeded: true,
    panelType: "dcr",
    structureType: "hotDip",
    capacityOverride: 0,
    inverterOverride: 0,
    backupLoadPercent: 50,
    backupHours: 2,
    savingsMethod: "auto",
    ...overrides,
  };
}

assert.equal(calculateSubsidy("ongrid", "dcr", 1).total, 30000);
assert.equal(calculateSubsidy("ongrid", "dcr", 2).total, 60000);
assert.equal(calculateSubsidy("ongrid", "dcr", 2.5).total, 69000);
assert.equal(calculateSubsidy("ongrid", "dcr", 3).total, 78000);
assert.equal(calculateSubsidy("ongrid", "dcr", 6).total, 78000);
assert.equal(calculateSubsidy("ongrid", "nonDcr", 3).total, 0);
assert.equal(calculateSubsidy("offgrid", "dcr", 3).total, 0);

const bill = calculateBill(450, DEFAULT_CONFIG.tariff);
assert.ok(bill.total > 0);
assert.equal(bill.fixedCharge, 130);

const sizing = recommendCapacity(makeInput(), DEFAULT_CONFIG);
assert.ok(sizing.dcCapacityKw <= 5);
assert.ok(sizing.dcCapacityKw <= sizing.byAreaKw);

const estimate = calculateEstimate(makeInput(), DEFAULT_CONFIG);
assert.equal(estimate.options.length, 3);
assert.equal(estimate.options[0].systemType, "ongrid");
assert.equal(estimate.options[1].systemType, "hybrid");
assert.equal(estimate.options[2].systemType, "offgrid");
assert.equal(estimate.options[2].subsidy, 0);
assert.ok(estimate.recommended.netCost > 0);

const backupEstimate = calculateEstimate(makeInput({ goal: "hybrid" }), DEFAULT_CONFIG);
assert.equal(backupEstimate.recommended.systemType, "hybrid");
assert.ok(backupEstimate.recommended.batteryCapacityKwh > 0);

const lowRoof = calculateEstimate(makeInput({ roofArea: 180, sanctionedLoad: 10 }), DEFAULT_CONFIG);
assert.ok(lowRoof.recommended.dcCapacityKw <= 2.2);

// Financing assertions
assert.ok(estimate.recommended.financing);
assert.equal(estimate.recommended.financing.principal, estimate.recommended.netCost);
assert.equal(estimate.recommended.financing.monthlyEmi, 5200);
assert.ok(estimate.recommended.financing.tenureYears > 0);
// Wiring and cabling cost assertion when rate/W is 0
const zeroWiringConfig = {
  ...DEFAULT_CONFIG,
  pricing: {
    ...DEFAULT_CONFIG.pricing,
    wiringRatePerW: 0,
  }
};
const zeroWiringEstimate = calculateEstimate(makeInput({ capacityOverride: 13 }), zeroWiringConfig);
assert.equal(
  zeroWiringEstimate.recommended.costBreakup.electricalSafetyAndWiring,
  0,
  "Wiring and cabling cost must be 0 when rate/W is 0 (no basic 55000 protection cost)"
);

// Systems without battery must NOT include peak penalty avoided
const commercialInput = makeInput({
  consumerCategory: "LT-II",
  monthlyUnits: 1000,
  monthlyBill: 12000,
  goal: "ongrid",
  backupNeeded: true, // Even if requested, on-grid has no battery
});
const commercialEstimate = calculateEstimate(commercialInput, DEFAULT_CONFIG);
assert.equal(commercialEstimate.options[0].systemType, "ongrid");
assert.equal(commercialEstimate.options[0].batteryCapacityKwh, 0);
assert.equal(commercialEstimate.options[0].savingsBreakdown.todPeakAvoided, 0, "Ongrid without battery must have 0 peak penalty avoided");

// But hybrid system with battery should include peak penalty avoided for LT-II
assert.equal(commercialEstimate.options[1].systemType, "hybrid");
assert.ok(commercialEstimate.options[1].batteryCapacityKwh > 0);
assert.ok(commercialEstimate.options[1].savingsBreakdown.todPeakAvoided > 0, "Hybrid with battery should calculate peak penalty avoided");

// Margin & 60 Rs/W Warning Benchmark Tests
{
  const testInput = makeInput({ capacityOverride: 5 });
  const est = calculateEstimate(testInput, DEFAULT_CONFIG);
  const opt = est.recommended;
  const cb = opt.costBreakup;

  // Margin percentage defaults to 30%
  assert.equal(cb.marginRate, 30, "Default margin must be 30%");
  assert.ok(cb.baseCostInclGst > 0, "Base cost incl. GST must be calculated");
  assert.equal(cb.margin, Math.round(cb.baseCostInclGst * 0.3), "Margin must be 30% of base cost incl. GST");
  assert.equal(opt.totalPreSubsidy, cb.baseCostInclGst + cb.margin, "Total cost must include margin");
  assert.equal(opt.netCost, opt.totalPreSubsidy - opt.subsidy, "Net cost must equal total pre-subsidy minus subsidy");

  // Warning benchmark: check if rate/W exceeds 60 Rs/W
  const costPerWatt = opt.totalPreSubsidy / (opt.dcCapacityKw * 1000);
  assert.ok(costPerWatt > 60, "With 30% margin, standard system exceeds 60 Rs/W triggering warning");

  // Test custom margin override (e.g. 0%)
  const customConfig = {
    ...DEFAULT_CONFIG,
    pricing: {
      ...DEFAULT_CONFIG.pricing,
      marginRate: 0,
    }
  };
  const lowMarginEst = calculateEstimate(testInput, customConfig);
  const lowOpt = lowMarginEst.recommended;
  assert.equal(lowOpt.costBreakup.marginRate, 0);
  assert.equal(lowOpt.costBreakup.margin, 0);
  assert.ok(lowOpt.totalPreSubsidy < opt.totalPreSubsidy);
  const lowCostPerWatt = lowOpt.totalPreSubsidy / (lowOpt.dcCapacityKw * 1000);
  assert.ok(lowCostPerWatt < 60, "With 0% margin, system rate/W should stay below 60 Rs/W");
}

// System Includes > never include Contingency in the PDF Tests
{
  // 1. Test auto-generated system includes text from estimate option
  const est = calculateEstimate(makeInput(), DEFAULT_CONFIG);
  const opt = est.recommended;
  const pdfIncludesText = buildSystemIncludesText(opt);
  assert.ok(!/contingency/i.test(pdfIncludesText), "Auto-generated System Includes must not contain Contingency");
  assert.ok(pdfIncludesText.startsWith("System Includes:"), "Must start with 'System Includes:'");
  assert.ok(pdfIncludesText.includes("GST"), "Must include GST");
  assert.ok(pdfIncludesText.endsWith("."), "Must end with period");

  // 2. Test sanitizeSystemIncludes with various strings containing Contingency
  const cases = [
    {
      input: "Solar Panels, Mounting Structure, On-grid Inverter, GST, and Contingency.",
      expected: "Solar Panels, Mounting Structure, On-grid Inverter, and GST."
    },
    {
      input: "Solar Panels, Inverter, Contingency, and GST.",
      expected: "Solar Panels, Inverter, and GST."
    },
    {
      input: "Solar Panels, Inverter, and Contingency.",
      expected: "Solar Panels, Inverter."
    },
    {
      input: "Solar Panels, Inverter, Contingency.",
      expected: "Solar Panels, Inverter."
    }
  ];

  for (const c of cases) {
    const res = sanitizeSystemIncludes(c.input);
    assert.ok(!/contingency/i.test(res), `Result '${res}' must not contain contingency`);
    assert.equal(res, c.expected);
  }

  // 3. Test buildSystemIncludesText when custom systemIncludesText was supplied with Contingency
  const customOpt = {
    ...opt,
    systemIncludesText: "Solar Panels, Structure, Inverter, GST, and Contingency."
  };
  const customPdfText = buildSystemIncludesText(customOpt);
  assert.ok(!/contingency/i.test(customPdfText), "Custom text with Contingency must have Contingency stripped");
  assert.equal(customPdfText, "System Includes: Solar Panels, Structure, Inverter, and GST.");
}

console.log("calculator tests passed");

