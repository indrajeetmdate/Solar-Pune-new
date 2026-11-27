import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import {
  calculateBill,
  calculateEstimate,
  calculateSubsidy,
  recommendCapacity,
  findInverterForCapacity,
  getInverterCost,
  getInverterRate,
  INVERTER_PRICE_CATALOG,
} from "../src/calculator.js";
import { buildSystemIncludesText, sanitizeSystemIncludes, getScopeOfWorkItems } from "../src/reportGenerator.js";

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

// PM Surya Ghar pro-rata slab subsidy tests (MNRE Guidelines 07.06.2024 & MERC Regulations):
// 0 to 2 kWp: ₹30,000 / kWp
// >2 to 3 kWp: ₹18,000 / kWp
// >3 kWp: max cap ₹78,000
// Commercial / non-residential: ₹0
assert.equal(calculateSubsidy("ongrid", "dcr", 0.5).total, 15000);
assert.equal(calculateSubsidy("ongrid", "dcr", 1).total, 30000);
assert.equal(calculateSubsidy("ongrid", "dcr", 1.5).total, 45000); // Worked Example 1: 1.5 * 30k = 45k
assert.equal(calculateSubsidy("ongrid", "dcr", 2).total, 60000);
assert.equal(calculateSubsidy("ongrid", "dcr", 2.5).total, 69000); // Worked Example 2: 60k + 0.5 * 18k = 69k
assert.equal(calculateSubsidy("ongrid", "dcr", 3).total, 78000);
assert.equal(calculateSubsidy("ongrid", "dcr", 6).total, 78000); // Worked Example 3: 6 kW cap = 78k
assert.equal(calculateSubsidy("ongrid", "dcr", 3, { consumerCategory: "LT-II" }).total, 0);
assert.equal(calculateSubsidy("ongrid", "dcr", 3, { consumerCategory: "LT-III" }).total, 0);
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
  zeroWiringEstimate.recommended.costBreakup.wiringExcludingCable,
  0,
  "Wiring excluding cable cost must be 0 when rate/W is 0"
);
assert.ok(
  zeroWiringEstimate.recommended.costBreakup.safetyAndEarthing > 0,
  "Safety and earthing cost must be independent and retained"
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

// Ongrid Inverter Capacity Recommendation (1:1 with solar capacity by default)
{
  const est = calculateEstimate(makeInput(), DEFAULT_CONFIG);
  const ongridOpt = est.options.find(o => o.systemType === "ongrid");
  assert.equal(
    ongridOpt.inverterCapacityKw,
    ongridOpt.dcCapacityKw,
    "Ongrid inverter capacity by default must match recommended solar capacity (dcCapacityKw)"
  );

  const estOverride = calculateEstimate(makeInput({ inverterOverride: 5 }), DEFAULT_CONFIG);
  const ongridOverrideOpt = estOverride.options.find(o => o.systemType === "ongrid");
  assert.equal(ongridOverrideOpt.inverterCapacityKw, 5, "Inverter override must be respected when > 0");

  const hybridOpt = est.options.find(o => o.systemType === "hybrid");
  assert.ok(
    hybridOpt.inverterCapacityKw < hybridOpt.dcCapacityKw,
    "Hybrid inverter capacity retains standard clipping calculation"
  );
}

// Margin & 60 Rs/W Warning Benchmark Tests
{
  const testInput = makeInput({ capacityOverride: 5 });
  const est = calculateEstimate(testInput, DEFAULT_CONFIG);
  const opt = est.recommended;
  const cb = opt.costBreakup;

  // Margin percentage defaults to 25% (calculated on pre-tax direct cost & contingency, GST after margin)
  assert.equal(cb.marginRate, 25, "Default margin must be 25%");
  assert.ok(cb.costBeforeMargin > 0, "Cost before margin must be calculated");
  assert.equal(cb.margin, Math.round(cb.costBeforeMargin * 0.25), "Margin must be 25% of pre-tax cost & contingency");
  assert.equal(cb.taxableAmount, cb.costBeforeMargin + cb.margin, "Taxable amount must be cost before margin + margin");
  assert.equal(cb.gst, Math.round(cb.taxableAmount * (cb.effectiveGstRate / 100)), "GST must be calculated after margin on taxable supply value");
  assert.equal(opt.totalPreSubsidy, cb.taxableAmount + cb.gst, "Total cost must be taxable amount + GST");
  assert.equal(opt.netCost, opt.totalPreSubsidy - opt.subsidy, "Net cost must equal total pre-subsidy minus subsidy");

  // Warning benchmark: high margin (> 60 Rs/W triggers warning)
  const highMarginConfig = {
    ...DEFAULT_CONFIG,
    pricing: {
      ...DEFAULT_CONFIG.pricing,
      marginRate: 30,
    }
  };
  const highMarginEst = calculateEstimate(testInput, highMarginConfig);
  const costPerWatt = highMarginEst.recommended.totalPreSubsidy / (highMarginEst.recommended.dcCapacityKw * 1000);
  assert.ok(costPerWatt > 60, "With 30% margin override, standard system exceeds 60 Rs/W triggering warning");

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

  // 4. Test getScopeOfWorkItems fallback and custom parsing
  const defaultItems = getScopeOfWorkItems(opt, makeInput());
  assert.ok(defaultItems.includes("Solar Panels"), "Must include Solar Panels");
  assert.ok(defaultItems.includes("Mounting Structure (Hot-dip galvanized)"), "Must include Mounting Structure (Hot-dip galvanized)");
  assert.ok(defaultItems.includes("On-grid Inverter"), "Must include On-grid Inverter");
  assert.ok(defaultItems.includes("Safety and earthing"), "Must include Safety and earthing");
  assert.ok(defaultItems.includes("Wiring excluding cable cost"), "Must include Wiring excluding cable cost");
  assert.ok(defaultItems.includes("Installation & Commissioning"), "Must include Installation & Commissioning");
  assert.ok(defaultItems.includes("Consultancy"), "Must include Consultancy");
  assert.ok(defaultItems.includes("GST"), "Must include GST");

  const customSow = getScopeOfWorkItems({
    systemIncludesText: "Solar Panels, Mounting Structure (Hot-dip galvanized), On-grid Inverter, Safety and earthing, Wiring excluding cable cost, Installation & Commissioning, Consultancy, and GST."
  });
  assert.equal(customSow.length, 8, "Must parse exactly 8 items");
  assert.equal(customSow[0], "Solar Panels");
  assert.equal(customSow[1], "Mounting Structure (Hot-dip galvanized)");
  assert.equal(customSow[2], "On-grid Inverter");
  assert.equal(customSow[3], "Safety and earthing");
  assert.equal(customSow[4], "Wiring excluding cable cost");
  assert.equal(customSow[5], "Installation & Commissioning");
  assert.equal(customSow[6], "Consultancy");
  assert.equal(customSow[7], "GST");
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily & Monthly Generation, Current Bill Breakdown Reconcilation & Save/mo Tests
// ─────────────────────────────────────────────────────────────────────────────
{
  // 1. Daily and Monthly Generation outputs
  const testInput = makeInput({ monthlyUnits: 450, capacityOverride: 4 });
  const est = calculateEstimate(testInput, DEFAULT_CONFIG);
  const opt = est.recommended;

  assert.ok(opt.monthlyGeneration > 0, "Monthly generation should be positive");
  assert.ok(opt.dailyGeneration > 0, "Daily generation should be positive");
  assert.equal(
    opt.dailyGeneration,
    Math.round((opt.monthlyGeneration / 30) * 10) / 10,
    "Daily generation should equal monthly generation divided by 30"
  );

  const dailyPerKw = Number((opt.dailyGeneration / opt.dcCapacityKw).toFixed(2));
  const monthlyPerKw = Number((opt.monthlyGeneration / opt.dcCapacityKw).toFixed(1));
  assert.ok(dailyPerKw >= 3.0 && dailyPerKw <= 6.0, "Daily kWh/kW should be within typical Pune range (3.5 - 5.5)");
  assert.ok(monthlyPerKw >= 90 && monthlyPerKw <= 180, "Monthly kWh/kW should be within typical range (100 - 165)");

  // 2. Current Bill Breakdown Reconciliation with actual monthly bill
  // 2a. Bill higher than slab base (with Wheeling and FAC charges)
  const highBillInput = makeInput({ monthlyUnits: 450, monthlyBill: 7200, capacityOverride: 4 });
  const highEst = calculateEstimate(highBillInput, DEFAULT_CONFIG);
  const highCb = highEst.recommended.currentBillBreakdown;

  assert.equal(highCb.total, 7200, "Current bill breakdown total must match input.monthlyBill exactly");
  assert.ok(highCb.fixedCharge > 0, "Fixed charges must be present");
  assert.ok(highCb.energyCharge > 0, "Energy charges must be present");
  assert.ok(highCb.wheelingFac > 0, "Wheeling and FAC charges must be reconciled when actual bill exceeds slab bill");
  assert.ok(highCb.duty > 0, "Electricity duty must be present");
  assert.equal(
    highCb.fixedCharge + highCb.energyCharge + highCb.wheelingFac + highCb.duty,
    highCb.total,
    "Reconciled components must sum up exactly to the total monthly bill (7200)"
  );

  // 2b. Bill lower than or equal to slab model
  const manualBillInput = makeInput({ monthlyUnits: 450, monthlyBill: 5800, capacityOverride: 4 });
  const manualEst = calculateEstimate(manualBillInput, DEFAULT_CONFIG);
  const manualOpt = manualEst.recommended;
  const cb = manualOpt.currentBillBreakdown;

  assert.equal(cb.total, 5800, "Current bill breakdown total must match input.monthlyBill exactly");
  assert.ok(cb.fixedCharge > 0, "Fixed charges must be present");
  assert.ok(cb.energyCharge > 0, "Energy charges must be present");
  assert.equal(cb.wheelingFac, 0, "Wheeling & FAC is 0 when bill is below slab model");
  assert.ok(cb.duty > 0, "Electricity duty must be present");
  assert.equal(
    cb.fixedCharge + cb.energyCharge + cb.wheelingFac + cb.duty,
    cb.total,
    "Reconciled components must sum up exactly to the total monthly bill (5800)"
  );

  // 3. Current Bill Breakdown with OCR extracted charges
  const ocrCharges = [
    { label: "Fixed Charges", amount: 128 },
    { label: "Energy Charges", amount: 3200 },
    { label: "Wheeling Charges", amount: 550 },
    { label: "FAC", amount: 220 },
    { label: "Electricity Duty", amount: 655 }
  ];
  const ocrInput = makeInput({
    monthlyUnits: 450,
    monthlyBill: 4753,
    charges: ocrCharges,
    capacityOverride: 4
  });
  const ocrEst = calculateEstimate(ocrInput, DEFAULT_CONFIG);
  const ocrOpt = ocrEst.recommended;
  const ocrCb = ocrOpt.currentBillBreakdown;

  assert.ok(ocrCb.items && ocrCb.items.length === 5, "OCR charges must be preserved in currentBillBreakdown.items");
  assert.equal(ocrCb.total, 4753, "Current bill total must match OCR total");
  assert.equal(ocrCb.items[0].label, "Fixed Charges");
  assert.equal(ocrCb.items[0].amount, 128);

  // 4. Save/mo (monthlySavings) calculation revision
  // When solar generation covers 100% or more of consumption:
  const largeSystemInput = makeInput({
    monthlyUnits: 300,
    monthlyBill: 4000,
    capacityOverride: 5 // Generates ~600 units, well above 300 units
  });
  const largeEst = calculateEstimate(largeSystemInput, DEFAULT_CONFIG);
  const largeOpt = largeEst.recommended;
  // When solar generation covers 100% or more of consumption:
  // Post-solar net payable retains the minimum connection fixed charge (₹130)
  // Net monthly savings = Total Current Bill (₹4000) - Post-Solar Payable (₹130) = ₹3870
  assert.equal(
    largeOpt.monthlySavings,
    3870,
    "100% solar offset Save/mo must equal Monthly bill minus retained Fixed Charges (₹4000 - ₹130 = ₹3870)"
  );
  assert.equal(
    largeOpt.postSolarBillBreakdown.netPayable,
    130,
    "Post-solar net payable must equal retained Fixed Charges (₹130)"
  );
  assert.equal(
    largeOpt.postSolarBillBreakdown.fixedCharge,
    130,
    "Post-solar fixed charge must match current bill fixed charge"
  );
  assert.equal(
    largeOpt.postSolarBillBreakdown.netPayable + largeOpt.monthlySavings,
    largeOpt.currentBillBreakdown.total,
    "Post-solar payable + Net monthly savings must exactly equal Current Bill total (₹4000)"
  );
  assert.equal(
    largeOpt.savingsBreakdown.energyChargeOffset,
    largeOpt.currentBillBreakdown.energyCharge,
    "Energy Charges Offset must match Current Bill Breakdown Energy Charges"
  );
  assert.equal(
    largeOpt.savingsBreakdown.dutyOffset,
    largeOpt.currentBillBreakdown.duty,
    "Electricity Duty Offset must match Current Bill Breakdown Electricity Duty"
  );
  assert.equal(
    largeOpt.savingsBreakdown.wheelingFacOffset,
    largeOpt.currentBillBreakdown.wheelingFac,
    "Wheeling Offset must match Current Bill Breakdown Wheeling FAC"
  );
  const totalItemizedSavings =
    largeOpt.savingsBreakdown.energyChargeOffset +
    largeOpt.savingsBreakdown.dutyOffset +
    largeOpt.savingsBreakdown.wheelingFacOffset;
  assert.equal(
    totalItemizedSavings,
    3870,
    "Itemized savings components must cleanly sum to net monthly savings (₹3870)"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Revised Pricing Rates & Separated Safety vs Wiring Tests
// ─────────────────────────────────────────────────────────────────────────────
{
  // 1. Verify default pricing values match requirements
  assert.equal(DEFAULT_CONFIG.pricing.panelDcrRatePerWp, 25, "Default DCR rate should be ₹25/Wp");
  assert.equal(DEFAULT_CONFIG.pricing.panelNonDcrRatePerWp, 15, "Default Non-DCR rate should be ₹15/Wp");
  assert.equal(DEFAULT_CONFIG.pricing.batteryRatePerWh, 17.5, "Default Battery rate should be ₹17.5/Wh");
  assert.equal(DEFAULT_CONFIG.pricing.structureRates.hotDip, 6, "Default Hot-dip structure rate should be ₹6/W");
  assert.equal(DEFAULT_CONFIG.pricing.structureRates.galvalume, 5.3, "Default Galvalume structure rate should be ₹5.3/W");
  assert.equal(DEFAULT_CONFIG.pricing.structureRates.gpPurlin, 4.8, "Default GP purlin structure rate should be ₹4.8/W");
  assert.equal(DEFAULT_CONFIG.pricing.wiringRatePerW, 0, "Default Wiring rate should be ₹0/W (excluding cable)");
  assert.equal(DEFAULT_CONFIG.pricing.installationRatePerW, 2.5, "Default Installation rate should be ₹2.5/W");
  assert.equal(DEFAULT_CONFIG.pricing.consultancyRatePerW, 1, "Default Consultancy rate should be ₹1/W");
  assert.equal(DEFAULT_CONFIG.pricing.contingencyRate, 0, "Default Contingency rate should be 0%");
  assert.equal(DEFAULT_CONFIG.pricing.marginRate, 25, "Default Margin rate should be 25%");

  // 2. Verify separation of safetyAndEarthing and wiringExcludingCable
  const testInput = makeInput({ capacityOverride: 10 });
  const estDefault = calculateEstimate(testInput, DEFAULT_CONFIG);
  const optDefault = estDefault.recommended;

  assert.equal(optDefault.costBreakup.wiringExcludingCable, 0, "Default wiring cost must be 0 when rate is 0");
  assert.ok(optDefault.costBreakup.safetyAndEarthing > 0, "Safety and earthing cost must be > 0 (hardware protection)");
  assert.equal(
    optDefault.costBreakup.electricalSafetyAndWiring,
    optDefault.costBreakup.safetyAndEarthing + optDefault.costBreakup.wiringExcludingCable,
    "electricalSafetyAndWiring should equal sum of safetyAndEarthing + wiringExcludingCable"
  );

  // 3. Verify with custom wiring rate
  const customWiringConfig = {
    ...DEFAULT_CONFIG,
    pricing: {
      ...DEFAULT_CONFIG.pricing,
      wiringRatePerW: 3,
    }
  };
  const estCustom = calculateEstimate(testInput, customWiringConfig);
  const optCustom = estCustom.recommended;
  const expectedWiringCost = Math.round(optCustom.dcCapacityKw * 1000 * 3);
  assert.equal(optCustom.costBreakup.wiringExcludingCable, expectedWiringCost, "Wiring cost must equal dcCapacityWp * wiringRatePerW");
  assert.equal(optCustom.costBreakup.safetyAndEarthing, optDefault.costBreakup.safetyAndEarthing, "Safety cost remains independent");
  assert.equal(
    optCustom.costBreakup.electricalSafetyAndWiring,
    optCustom.costBreakup.safetyAndEarthing + expectedWiringCost,
    "Combined electricalSafetyAndWiring must reflect both"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF Warranty & Details Section Tests
// ─────────────────────────────────────────────────────────────────────────────
{
  const mockCalls = [];
  globalThis.alert = () => {};
  globalThis.window = {
    jspdf: {
      jsPDF: class MockPDF {
        constructor() {
          globalThis.window.jspdf.lastInstance = this;
          this.pages = [1];
          this.lastAutoTable = { finalY: 50 };
          this.textCalls = [];
          this.internal = {
            pageSize: { getWidth: () => 210, getHeight: () => 297 },
            getNumberOfPages: () => this.pages.length,
          };
        }
        setFont() {}
        setFontSize() {}
        setTextColor() {}
        text(content, x, y, opts) {
          this.textCalls.push(content);
        }
        line() {}
        setDrawColor() {}
        setLineWidth() {}
        setFillColor() {}
        rect() {}
        roundedRect() {}
        addPage() { this.pages.push(this.pages.length + 1); }
        getNumberOfPages() { return this.pages.length; }
        setPage() {}
        addImage() {}
        output() { return 'pdf-blob'; }
        save(filename) { this.savedFilename = filename; }
        splitTextToSize(text) { return [text]; }
        autoTable(opts) {
          this.lastAutoTable = { finalY: (opts.startY || 50) + (opts.body ? opts.body.length * 6 : 20) };
          mockCalls.push(opts);
        }
      }
    }
  };
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillStyle: '', fillRect: () => {}, clearRect: () => {}, drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,123' }),
    getElementById: () => null
  };
  globalThis.Image = class {
    set src(url) {
      this.width = 100;
      this.height = 100;
      setTimeout(() => this.onload && this.onload(), 10);
    }
  };

  const { generateProposalPDF } = await import("../src/reportGenerator.js");
  const testInput = makeInput();
  const est = calculateEstimate(testInput, DEFAULT_CONFIG);
  await generateProposalPDF(est, est.recommended, { hidePayback: false });

  const warrantyTable = mockCalls.find(c => c.body && c.body.some(row => row[1] === "SOLAR PANEL"));
  assert.ok(warrantyTable, "Warranty table must be generated in proposal PDF");
  assert.equal(warrantyTable.head[0][0], "Sr. No.");
  assert.equal(warrantyTable.head[0][1], "Product");
  assert.equal(warrantyTable.head[0][2], "Make & Specification");
  assert.equal(warrantyTable.head[0][3], "Warranty");

  assert.equal(warrantyTable.body.length, 6, "Must contain all 6 specified product rows");
  assert.equal(warrantyTable.body[0][1], "SOLAR PANEL");
  assert.ok(warrantyTable.body[0][3].includes("12 Year"), "Solar panel warranty must include 12 Year");
  assert.equal(warrantyTable.body[1][1], "DCDB");
  assert.equal(warrantyTable.body[1][2], "HAVELLS 1 IN 1 OUT 600 V");
  assert.equal(warrantyTable.body[1][3], "5 Year");
  assert.equal(warrantyTable.body[2][1], "EARTHING");
  assert.equal(warrantyTable.body[3][1], "DC CABLE");
  assert.equal(warrantyTable.body[3][3], "20 Year");
  assert.equal(warrantyTable.body[4][1], "CIVIL CHAMBER");
  assert.equal(warrantyTable.body[4][3], "10 Year");
  assert.equal(warrantyTable.body[5][1], "ONGRID INVERTER");
  assert.ok(warrantyTable.body[5][3].includes("10 Year"), "Inverter warranty must be 10 Year");

  // Verify Warranty Terms & Conditions printed in PDF
  const flatTexts = [];
  // Find instance of MockPDF
  // In generateProposalPDF, new jsPDF() was instantiated
  const lastPdfInstance = globalThis.window.jspdf.lastInstance;
  assert.ok(lastPdfInstance, "MockPDF instance must be recorded");
  const allTexts = lastPdfInstance.textCalls.flat();

  assert.ok(allTexts.some(t => String(t).includes("Warranty and Details")), "Warranty and Details heading must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Terms and Conditions for Warranty")), "Terms and Conditions for Warranty heading must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Natural Calamity")), "Term 1: Natural Calamity must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Force Majeure")), "Term 2: Force Majeure must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Change in Government Policies")), "Term 3: Change in Government Policies must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Operation, Maintenance & Pass-Through Warranty")), "Term 4: Operation & Maintenance must be rendered");

  // Verify Corporate From & To cards, Ref Serial No, Scope of Work & Possible Savings table
  assert.ok(allTexts.some(t => String(t).includes("DATLION CNERGY PRIVATE LIMITED")), "DATLION CNERGY PRIVATE LIMITED must be rendered in From card");
  assert.ok(allTexts.some(t => String(t).includes("GSTIN: 27AALCD8550A1ZP")), "Company GSTIN must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("PROPOSAL REF: DC/2026-27/PROP-1140")), "Proposal reference serial number must be rendered");
  assert.equal(lastPdfInstance.savedFilename, "DC-2026-27-PROP-1140.pdf", "PDF must be saved as sanitized serial number filename");
  assert.ok(allTexts.some(t => String(t).includes("Scope of Work (Turnkey EPC Delivery)")), "Scope of Work card heading must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Solar Panels")), "Scope of Work must render Solar Panels");
  assert.ok(allTexts.some(t => String(t).includes("Mounting Structure")), "Scope of Work must render Mounting Structure");
  assert.ok(allTexts.some(t => String(t).includes("Inverter")), "Scope of Work must render Inverter");
  assert.ok(allTexts.some(t => String(t).includes("Safety and earthing")), "Scope of Work must render Safety and earthing");
  assert.ok(allTexts.some(t => String(t).includes("Wiring excluding cable cost")), "Scope of Work must render Wiring excluding cable cost");
  assert.ok(allTexts.some(t => String(t).includes("Installation & Commissioning")), "Scope of Work must render Installation & Commissioning");
  assert.ok(allTexts.some(t => String(t).includes("Consultancy")), "Scope of Work must render Consultancy");
  assert.ok(allTexts.some(t => String(t).includes("GST")), "Scope of Work must render GST");
  assert.ok(allTexts.some(t => String(t).includes("Note: All of the above are in line with MNRE guidelines")), "MNRE guidelines note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Note: Cabling/wiring charges will be at actual length of DC and AC cabling required")), "Wiring charges at actual length note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Note: MSEDCL Net Metering Liaisoning & Discom Documentation Support charges at actuals")), "MSEDCL Liaisoning note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Financial payback and bill savings projections are modeled on prevailing MSEDCL tariffs and MERC net metering regulations")), "Payback disclaimer note must be rendered and wrapped");
  assert.ok(allTexts.some(t => String(t).includes("Loan approval, interest rates, and final terms are governed exclusively by the lending bank")), "Bank loan disclaimer note must be rendered and wrapped");
  assert.ok(allTexts.some(t => String(t).includes("MSEDCL Electricity Bill Comparison & Projected Savings")), "MSEDCL comparison section heading must be rendered");

  // Verify older 4-column savings table is omitted
  const olderSavingsTable = mockCalls.find(c => c.head && c.head[0] && c.head[0][0] === "Offsettable Bill Component");
  assert.ok(!olderSavingsTable, "Older 4-column Offsettable Bill Component table must be omitted from PDF");

  // Verify Authentic MSEDCL Electricity Bill Comparison Side-by-Side Tables
  const msebCurrentTable = mockCalls.find(c => c.head && c.head[0] && c.head[0][0].includes("Current MSEDCL Bill (Before Solar)"));
  assert.ok(msebCurrentTable, "Current MSEDCL Bill (Before Solar) table must be generated in PDF");
  assert.ok(msebCurrentTable.body.some(r => r[0] === "Fixed Charges"), "Current MSEDCL bill table must include Fixed Charges");
  assert.ok(msebCurrentTable.body.some(r => r[0] === "Energy Charges"), "Current MSEDCL bill table must include Energy Charges");
  assert.ok(msebCurrentTable.body.some(r => r[0].includes("Wheeling Charges")), "Current MSEDCL bill table must include Wheeling Charges");
  assert.ok(msebCurrentTable.body.some(r => r[0].includes("Electricity Duty")), "Current MSEDCL bill table must include Electricity Duty");
  assert.ok(msebCurrentTable.body.some(r => r[0] === "Net Bill Payable"), "Current MSEDCL bill table must include Net Bill Payable");

  const msebPostSolarTable = mockCalls.find(c => c.head && c.head[0] && c.head[0][0].includes("With Rooftop Solar (After Solar)"));
  assert.ok(msebPostSolarTable, "With Rooftop Solar (After Solar) table must be generated in PDF");
  assert.ok(msebPostSolarTable.body.some(r => r[0] === "Solar Generation"), "Post-solar MSEDCL table must include Solar Generation");
  assert.ok(msebPostSolarTable.body.some(r => r[0] === "Fixed Charges"), "Post-solar MSEDCL table must retain Fixed Charges");
  assert.ok(msebPostSolarTable.body.some(r => r[0].includes("Energy Charges")), "Post-solar MSEDCL table must include Energy Charges offset");
  assert.ok(msebPostSolarTable.body.some(r => r[0] === "Net Bill Payable"), "Post-solar MSEDCL table must include Net Bill Payable");
  assert.ok(msebPostSolarTable.body.some(r => r[0] === "Net Monthly Savings"), "Post-solar MSEDCL table must include Net Monthly Savings");
  assert.ok(msebPostSolarTable.body.some(r => r[0] === "Projected Annual Savings"), "Post-solar MSEDCL table must include Projected Annual Savings");

  // Verify updated cost breakdown text labels
  const costTable = mockCalls.find(c => c.body && c.body.some(row => row[0] && row[0].includes("Total System Cost")));
  assert.ok(costTable, "Cost breakdown table must be generated in PDF");
  assert.ok(costTable.body.some(row => row[0].includes("Total System Cost (Inc. GST) (as payable to Datlion Cnergy Pvt. Ltd.)")), "Total System Cost label must match");
  assert.ok(costTable.body.some(row => row[0].includes("Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account)")), "Expected Subsidy label must match");
  assert.ok(costTable.body.some(row => row[0].includes("Net Payable Cost to customer")), "Net Payable Cost to customer label must match");

  // Verify Bank Partner Loan Proposal heading with disclaimer
  assert.ok(allTexts.some(t => String(t).includes("Bank Partner Loan Proposal") && String(t).includes("For illustrative purposes only actual cost depends on actual loan rates")), "Bank Partner Loan Proposal disclaimer title must be rendered");

  // Verify Comprehensive Section Terms and Proposal-Wide Terms (EPC Protections)
  assert.ok(allTexts.some(t => String(t).includes("System Design & Generation Feasibility Terms")), "System Design Terms category must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Rooftop Layout, Civil & Structural Responsibilities")), "Rooftop Layout Terms category must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Commercial, Pricing & Milestone Payment Terms")), "Commercial & Payment Terms category must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("MSEDCL Net Metering, Grid Interconnection & PM Surya Ghar Subsidy Terms")), "Net Metering & Subsidy Terms category must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Bank Partner Financing Facilitation Terms")), "Bank Partner Financing Terms category must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Proposal-Wide General EPC Terms & Conditions")), "Proposal-Wide General EPC Terms category must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Limitation of EPC Liability (Capped at 5%)")), "Limitation of Liability capped at 5% must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Pune, Maharashtra, India")), "Exclusive Pune jurisdiction must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Roof Structural Soundness & Load Capacity")), "Roof Structural Soundness term must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Statutory Taxes & On-Site Material Custody")), "Statutory Taxes term must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("PM Surya Ghar Central Subsidy (Direct Benefit Transfer)")), "PM Surya Ghar subsidy term must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Design & Generation Note")), "In-section System Design note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Structural & Layout Note")), "In-section CAD note must be rendered");

  // Verify Strategic Opportunity Cost & Loan EMI Note
  assert.ok(allTexts.some(t => String(t).includes("Strategic Opportunity Cost & Loan EMI Note")), "Strategic Opportunity Cost & Loan EMI Note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Loan EMI vs Current Bill Substitution")), "Loan EMI vs Current Bill Substitution bullet must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Save Upfront Cash & Invest in Business (Opportunity Cost)")), "Save Upfront Cash & Invest in Business bullet must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("electricity bill payments (current bill) will make the solar system 100% free in just")), "Bill-to-EMI substitution text must be rendered");
}

// Verify Panel Type and Specification helper
{
  const { getPanelSpecificationText } = await import("../src/config.js");
  assert.equal(getPanelSpecificationText("dcr", null, 550), "Tier-1 DCR Mono PERC / TOPCon (550 Wp)");
  assert.equal(getPanelSpecificationText("nonDcr", null, 550), "Tier-1 Non-DCR Mono PERC (550 Wp)");
  assert.equal(getPanelSpecificationText("dcr_bifacial", null, 550), "Tier-1 DCR Mono Bifacial Glass-to-Glass (550 Wp)");
  assert.equal(getPanelSpecificationText("mono_bifacial", null, 550), "Tier-1 Mono Bifacial (Non-DCR, 550 Wp)");
  assert.equal(getPanelSpecificationText("topcon_bifacial", null, 550), "Tier-1 N-Type TOPCon Bifacial (Non-DCR, 550 Wp)");
  assert.equal(getPanelSpecificationText("dcr_topcon", null, 550), "Tier-1 DCR N-Type TOPCon Bifacial (550 Wp)");
  assert.equal(getPanelSpecificationText("poly", null, 335), "Tier-1 Multi-Crystalline / Polycrystalline (335 Wp)");
  assert.equal(getPanelSpecificationText("dcr", "Waaree 545Wp Bifacial DCR", 550), "Waaree 545Wp Bifacial DCR");
}

// MNRE Guidelines 07.06.2024 PM Surya Ghar Rules Comprehensive Tests
{
  console.log("Testing MNRE Guidelines 07.06.2024 PM Surya Ghar rules...");
  
  // 1. Universal Hard Constraints: Ground-mount ineligibility
  assert.equal(calculateSubsidy("ongrid", "dcr", 3, { structureType: "ground" }).total, 0, "Ground-mounted systems must receive 0 CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3, { mountingType: "ground" }).total, 0, "Ground mountingType must receive 0 CFA");

  // 2. Universal Hard Constraints: RESCO exclusion
  assert.equal(calculateSubsidy("ongrid", "dcr", 3, { paymentMode: "resco" }).total, 0, "RESCO mode must receive 0 CFA");

  // 3. Universal Hard Constraints: Non-residential meters receive 0 CFA
  assert.equal(calculateSubsidy("ongrid", "dcr", 3, { consumerCategory: "LT-AG" }).total, 0, "Agricultural meters must receive 0 CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3, { consumerCategory: "HT-I" }).total, 0, "HT meters must receive 0 CFA");

  // 4. Special Category States (+10% CFA: 0 to 2 kWp @ 33k/kWp, >2 to 3 kWp @ 19.8k/kWp, Cap = 85.8k)
  // Direct flag
  assert.equal(calculateSubsidy("ongrid", "dcr", 0.8, { isSpecialCategoryState: true }).total, 26400); // 0.8 * 33k = 26,400
  assert.equal(calculateSubsidy("ongrid", "dcr", 1.2, { isSpecialCategoryState: true }).total, 39600); // 1.2 * 33k = 39,600
  assert.equal(calculateSubsidy("ongrid", "dcr", 2.0, { isSpecialCategoryState: true }).total, 66000); // 2.0 * 33k = 66,000
  assert.equal(calculateSubsidy("ongrid", "dcr", 2.9, { isSpecialCategoryState: true }).total, 83820); // 66k + 0.9 * 19.8k = 83,820
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { isSpecialCategoryState: true }).total, 85800);
  assert.equal(calculateSubsidy("ongrid", "dcr", 5.0, { isSpecialCategoryState: true }).total, 85800);

  // Auto-detection by address
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Dehradun, Uttarakhand" }).total, 85800, "Uttarakhand address must trigger +10% CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Shimla, Himachal Pradesh" }).total, 85800, "Himachal Pradesh address must trigger +10% CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Srinagar, Jammu & Kashmir" }).total, 85800, "J&K address must trigger +10% CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Gangtok, Sikkim" }).total, 85800, "Sikkim address must trigger +10% CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Guwahati, Assam" }).total, 85800, "Assam address must trigger +10% CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Port Blair, Andaman & Nicobar" }).total, 85800, "Andaman address must trigger +10% CFA");

  // Standard states retain standard slabs
  assert.equal(calculateSubsidy("ongrid", "dcr", 3.0, { address: "Pune, Maharashtra" }).total, 78000, "Maharashtra address must get standard 78k cap");

  // 5. Category C (GHS Common Facility Meter)
  // Standard rate: ₹18,000 / kW up to min(kW, (3 * houses) - residentCfa, 500)
  // Worked Example 1 (MNRE Clause 5h): 100 kW plant, 20 houses: min(100, 20 * 3) = 60 kWp -> 60 * 18,000 = ₹10,80,000
  assert.equal(calculateSubsidy("ongrid", "dcr", 100, { consumerCategory: "LT-I-GHS", numHouses: 20 }).total, 1080000, "100 kW plant for 20 houses must yield ₹10,80,000 CFA");
  // Worked Example 2 (MNRE Clause 5h): 100 kW plant, 50 houses: min(100, 50 * 3) = 100 kWp -> 100 * 18,000 = ₹18,00,000
  assert.equal(calculateSubsidy("ongrid", "dcr", 100, { consumerCategory: "LT-I-GHS", numHouses: 50 }).total, 1800000, "100 kW plant for 50 houses must yield ₹18,00,000 CFA");
  assert.equal(calculateSubsidy("ongrid", "dcr", 10, { consumerCategory: "LT-I-GHS", numHouses: 50 }).total, 180000);
  // Cap by society housing limit: 10 houses * 3 kW = 30 kW max
  assert.equal(calculateSubsidy("ongrid", "dcr", 50, { consumerCategory: "LT-I-GHS", numHouses: 10 }).total, 30 * 18000);
  // Deducting individual resident CFA: 10 houses * 3 = 30 kW, minus 10 kW resident = 20 kW max
  assert.equal(calculateSubsidy("ongrid", "dcr", 50, { consumerCategory: "LT-I-GHS", numHouses: 10, individualResidentCfaKw: 10 }).total, 20 * 18000);
  // Special State GHS rate: ₹19,800 / kW
  assert.equal(calculateSubsidy("ongrid", "dcr", 10, { consumerCategory: "LT-I-GHS", numHouses: 50, isSpecialCategoryState: true }).total, 198000);

  // 6. Category B (Multi-Meter Residential Building)
  const multiMeters = [
    { id: 1, allocatedKw: 1.5, consumerCategory: "LT-I" }, // 1.5 * 30k = 45,000
    { id: 2, allocatedKw: 2.2, consumerCategory: "LT-I" }, // 60k + 0.2 * 18k = 63,600
    { id: 3, allocatedKw: 4.0, consumerCategory: "LT-I" }, // Cap = 78,000
    { id: 4, allocatedKw: 3.0, consumerCategory: "LT-II" }, // Commercial = 0
  ];
  const mmSub = calculateSubsidy("ongrid", "dcr", 10.7, { meters: multiMeters });
  assert.equal(mmSub.total, 45000 + 63600 + 78000 + 0, "Multi-meter subsidy sum must strictly follow pro-rata slabs");
  assert.equal(mmSub.meterBreakdown[0].subsidy, 45000);
  assert.equal(mmSub.meterBreakdown[1].subsidy, 63600);
  assert.equal(mmSub.meterBreakdown[2].subsidy, 78000);
  assert.equal(mmSub.meterBreakdown[3].subsidy, 0);

  // Multi-Meter in Special Category State (+10%)
  const mmSubSpecial = calculateSubsidy("ongrid", "dcr", 10.7, { meters: multiMeters, isSpecialCategoryState: true });
  assert.equal(mmSubSpecial.total, 49500 + 69960 + 85800 + 0, "Multi-meter subsidy in special state must have +10%");

  // Multi-Meter with ground mount = 0
  const mmSubGround = calculateSubsidy("ongrid", "dcr", 10.7, { meters: multiMeters, structureType: "ground" });
  assert.equal(mmSubGround.total, 0, "Multi-meter on ground mount must have 0 total subsidy");

  console.log("✓ All MNRE Guidelines 07.06.2024 rules verified in calculator!");
}

// ─────────────────────────────────────────────────────────────────────────────
// Discrete Inverter Price Catalog Tests (Single Phase, Three Phase & Tiers)
// ─────────────────────────────────────────────────────────────────────────────
{
  // 1. Catalog Integrity
  assert.equal(INVERTER_PRICE_CATALOG.length, 27, "Catalog must contain exactly 27 inverter specifications");
  const singlePhaseItems = INVERTER_PRICE_CATALOG.filter(it => it.phase === "1-phase");
  const threePhaseItems = INVERTER_PRICE_CATALOG.filter(it => it.phase === "3-phase");
  assert.equal(singlePhaseItems.length, 7, "Catalog must have 7 single-phase models (2.2 kW to 5.0 kW)");
  assert.equal(threePhaseItems.length, 20, "Catalog must have 20 three-phase models (5.0 kW to 136.0 kW)");

  // 2. Single-Phase Lookup & Sizing
  // <= 2.2 kW -> 2.2Kw Single Phase (14,429 / 13,944)
  const inv1_5 = findInverterForCapacity(1.5, "1-phase", "price1");
  assert.equal(inv1_5.modelName, "2.2Kw Single Phase");
  assert.equal(inv1_5.cost, 14429);
  assert.equal(inv1_5.ratingKw, 2.2);

  const inv1_5_p2 = findInverterForCapacity(1.5, "1-phase", "price2");
  assert.equal(inv1_5_p2.cost, 13944);

  // 3.0 kW -> 3kw Single Phase (14,862 / 14,362)
  const inv3 = findInverterForCapacity(3.0, "1-phase", "price1");
  assert.equal(inv3.modelName, "3kw Single Phase");
  assert.equal(inv3.cost, 14862);

  // 3.3 kW -> 3.3Kw Single Phase (15,006 / 14,502)
  const inv3_3 = findInverterForCapacity(3.3, "1-phase", "price1");
  assert.equal(inv3_3.modelName, "3.3Kw Single Phase");
  assert.equal(inv3_3.cost, 15006);

  // 4.4 kW -> 5kw Single Phase (25,683 / 24,820)
  const inv4_4 = findInverterForCapacity(4.4, "1-phase", "price1");
  assert.equal(inv4_4.modelName, "5kw Single Phase");
  assert.equal(inv4_4.cost, 25683);
  assert.equal(inv4_4.ratingKw, 5.0);

  const inv4_4_p2 = findInverterForCapacity(4.4, "1-phase", "price2");
  assert.equal(inv4_4_p2.cost, 24820);

  // 3. Three-Phase Explicit Lookup
  // 3.0 kW with connectionPhase: '3-phase' -> 5Kw Three Phase (40,384 / 39,059)
  const inv3_3ph = findInverterForCapacity(3.0, "3-phase", "price1");
  assert.equal(inv3_3ph.modelName, "5Kw Three Phase");
  assert.equal(inv3_3ph.cost, 40384);
  assert.equal(inv3_3ph.ratingKw, 5.0);

  // 10.0 kW -> 10kw Three Phase (44,378 / 42,923)
  const inv10 = findInverterForCapacity(10.0, "3-phase", "price1");
  assert.equal(inv10.modelName, "10kw Three Phase");
  assert.equal(inv10.cost, 44378);

  // 50.0 kW -> 50KW Three Phase (1,08,398 / 1,04,784)
  const inv50 = findInverterForCapacity(50.0, "3-phase", "price1");
  assert.equal(inv50.modelName, "50KW Three Phase");
  assert.equal(inv50.cost, 108398);

  // 136.0 kW -> 136KW Three Phase (3,09,042 / 2,98,566)
  const inv136 = findInverterForCapacity(136.0, "3-phase", "price1");
  assert.equal(inv136.modelName, "136KW Three Phase");
  assert.equal(inv136.cost, 309042);

  // 4. Large System Combinations > 136 kW
  // 200 kW -> 1x 136 kW + 1x 80 kW = 216 kW rating, cost: 309042 + 203700 = 512,742
  const inv200 = findInverterForCapacity(200.0, "3-phase", "price1");
  assert.equal(inv200.cost, 309042 + 203700, "200 kW system must combine 136 kW + 80 kW inverters");
  assert.equal(inv200.ratingKw, 216.0);
  assert.ok(inv200.modelName.includes("136KW Three Phase"));
  assert.ok(inv200.modelName.includes("80KW Three Phase"));

  // 300 kW -> 2x 136 kW (272 kW) + 1x 30/33 kW (33 kW) = 305 kW rating, cost: 2*309042 + 75951 = 694,035
  const inv300 = findInverterForCapacity(300.0, "3-phase", "price1");
  assert.equal(inv300.cost, 2 * 309042 + 75951, "300 kW system must combine 2x 136 kW + 1x 30/33 kW");
  assert.equal(inv300.ratingKw, 305.0);

  // 5. Inverter Costing in Full System Proposal
  const estStandard = calculateEstimate(makeInput(), DEFAULT_CONFIG);
  assert.equal(estStandard.recommended.costBreakup.inverter, 25683, "Standard 4.4 kW system must select 5kw Single Phase inverter at ₹25,683");
  assert.equal(estStandard.recommended.inverterModel, "5kw Single Phase");
  assert.equal(estStandard.recommended.inverterRatingKw, 5.0);

  const customConfigPrice2 = {
    ...DEFAULT_CONFIG,
    pricing: {
      ...DEFAULT_CONFIG.pricing,
      inverterPriceTier: "price2",
    },
  };
  const estPrice2 = calculateEstimate(makeInput(), customConfigPrice2);
  assert.equal(estPrice2.recommended.costBreakup.inverter, 24820, "With price2 tier, 4.4 kW system must cost ₹24,820");

  const est3Phase = calculateEstimate(makeInput({ connectionPhase: "3-phase" }), DEFAULT_CONFIG);
  assert.equal(est3Phase.recommended.costBreakup.inverter, 40384, "With 3-phase connection, 4.4 kW system must select 5Kw Three Phase inverter at ₹40,384");
  assert.equal(est3Phase.recommended.inverterModel, "5Kw Three Phase");

  console.log("✓ Discrete Inverter Price Catalog and sizing logic verified successfully!");
}

console.log("calculator tests passed");


