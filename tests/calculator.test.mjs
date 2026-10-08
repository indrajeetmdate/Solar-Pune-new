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
  // When solar generation covers 100% or more of consumption, Save/mo and EMI must match the monthly bill
  assert.equal(
    largeOpt.monthlySavings,
    4000,
    "100% solar offset Save/mo must match the Monthly bill (₹4000)"
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
    largeOpt.savingsBreakdown.wheelingFacOffset +
    largeOpt.savingsBreakdown.todDaytimeRebate +
    largeOpt.savingsBreakdown.promptPayDiscount;
  assert.equal(
    totalItemizedSavings,
    4000,
    "Itemized savings components must cleanly sum to the monthly bill (₹4000)"
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
  assert.equal(DEFAULT_CONFIG.pricing.marginRate, 30, "Default Margin rate should be 30%");

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
  assert.ok(allTexts.some(t => String(t).includes("PROPOSAL REF: DC/2026-27/PROP-101")), "Proposal reference serial number must be rendered");
  assert.equal(lastPdfInstance.savedFilename, "DC-2026-27-PROP-101.pdf", "PDF must be saved as sanitized serial number filename");
  assert.ok(allTexts.some(t => String(t).includes("Note: All of the above are in line with MNRE guidelines")), "MNRE guidelines note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Note: Cabling/wiring charges will be at actual length of DC and AC cabling required")), "Wiring charges at actual length note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Note: MSEDCL Net Metering Liaisoning & Discom Documentation Support charges at actuals")), "MSEDCL Liaisoning note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Possible Savings Breakdown (Solar Offset)")), "Possible Savings Breakdown section heading must be rendered");

  const savingsTable = mockCalls.find(c => c.body && c.body.some(row => row[0] && row[0].includes("Estimated Savings / Month")));
  assert.ok(savingsTable, "Possible savings table must be generated in PDF");
  assert.equal(savingsTable.head[0][0], "Offsettable Bill Component");
  assert.equal(savingsTable.head[0][1], "Monthly Savings");
  assert.equal(savingsTable.head[0][2], "Annual Savings");

  assert.ok(savingsTable.body.some(row => row[0] === "Energy Charges Offset"), "Savings table must include Energy Charges Offset");
  assert.ok(savingsTable.body.some(row => row[0] === "Electricity Duty Offset"), "Savings table must include Electricity Duty Offset");
  assert.ok(savingsTable.body.some(row => row[0] === "ToD Daytime Solar Generation Credit"), "Savings table must include ToD Daytime Solar Generation Credit");
  assert.ok(savingsTable.body.some(row => row[0] === "Prompt pay discount"), "Savings table must include Prompt pay discount");

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
  assert.ok(allTexts.some(t => String(t).includes("Design & Generation Note")), "In-section System Design note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Structural & Layout Note")), "In-section CAD note must be rendered");

  // Verify Strategic Opportunity Cost & Loan EMI Note
  assert.ok(allTexts.some(t => String(t).includes("Strategic Opportunity Cost & Loan EMI Note")), "Strategic Opportunity Cost & Loan EMI Note must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Loan EMI vs Current Bill Substitution")), "Loan EMI vs Current Bill Substitution bullet must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("Save Upfront Cash & Invest in Business (Opportunity Cost)")), "Save Upfront Cash & Invest in Business bullet must be rendered");
  assert.ok(allTexts.some(t => String(t).includes("electricity bill payments (current bill) will make the solar system 100% free in just")), "Bill-to-EMI substitution text must be rendered");
}

console.log("calculator tests passed");


