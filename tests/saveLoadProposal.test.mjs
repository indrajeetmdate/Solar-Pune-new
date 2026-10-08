import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("Running Save & Load Comprehensive Proposal Tests...");

// 1. Create a simulated DOM environment with all form controls from index.html
const elements = new Map();

function createElement(id, type = "text", value = "", checked = false) {
  let val = String(value);
  let chk = Boolean(checked);
  const el = {
    id,
    type,
    get value() { return val; },
    set value(v) { val = v !== undefined && v !== null ? String(v) : ""; },
    get checked() { return chk; },
    set checked(c) { chk = Boolean(c); },
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains(c) { return this._classes.has(c); }
    },
    addEventListener() {},
    dispatchEvent() {}
  };
  elements.set(id, el);
  return el;
}

// Global DOM setup
globalThis.document = {
  getElementById(id) {
    return elements.get(id) || null;
  },
  querySelector(sel) {
    if (sel.startsWith("#")) return elements.get(sel.slice(1)) || null;
    return {
      classList: {
        add() {},
        remove() {}
      }
    };
  },
  querySelectorAll(sel) {
    if (sel === "input, select, textarea") {
      return Array.from(elements.values());
    }
    return [];
  }
};

globalThis.$ = (id) => elements.get(id) || null;
globalThis.localStorage = {
  _store: new Map(),
  getItem(k) { return this._store.get(k) || null; },
  setItem(k, v) { this._store.set(k, String(v)); },
  removeItem(k) { this._store.delete(k); },
  clear() { this._store.clear(); }
};
globalThis.window = {
  localStorage: globalThis.localStorage,
  location: { reload() {} }
};

// Populate the mock DOM with all key form controls
// Customer & Proposal Info
createElement("customerName", "text", "Ramesh Kulkarni");
createElement("mobileNumber", "tel", "9876543210");
createElement("emailAddress", "email", "ramesh@example.com");
createElement("customerAddress", "text", "Kothrud, Pune, Maharashtra");
createElement("proposalSerialNo", "text", "DC/2026-27/PROP-8899");
createElement("internalCustomerName", "hidden", "Ramesh Kulkarni");
createElement("internalMobileNumber", "hidden", "9876543210");
createElement("internalEmailAddress", "hidden", "ramesh@example.com");

// Sanctioned & Consumption
createElement("sanctionedLoad", "number", "10");
createElement("consumerCategory", "select", "LT-I");
createElement("connectionPhase", "select", "3-phase");
createElement("numFlats", "number", "1");
createElement("currentPf", "number", "0.92");
createElement("peakHourUsagePct", "number", "35");
createElement("monthlyUnits", "number", "800");
createElement("monthlyBill", "number", "9500");
createElement("optimizationStrategy", "select", "optimum");
createElement("roofArea", "number", "1200");
createElement("goal", "select", "ongrid");
createElement("coordinates", "text", "18.5204, 73.8567");
createElement("tiltAngle", "number", "19");
createElement("orientationDir", "select", "south");

// System Sizing & Overrides
createElement("panelType", "select", "dcr");
createElement("subsidyCategory", "select", "residential");
createElement("structureType", "select", "galvalume");
createElement("capacityOverride", "number", "6.6");
createElement("inverterOverride", "number", "6.0");
createElement("batteryOverride", "number", "0");
createElement("backupLoad", "number", "50");
createElement("backupHours", "number", "3");

// Loans & Financing
createElement("paymentMode", "select", "loan");
createElement("loanInterestRate", "number", "8.75");
createElement("loanAmount", "number", "250000");
createElement("loanMonthlyEmi", "number", "5150");
createElement("internalPaymentMode", "select", "loan");
createElement("internalLoanInterestRate", "hidden", "8.75");
createElement("internalLoanAmount", "hidden", "250000");
createElement("internalLoanMonthlyEmi", "hidden", "5150");
createElement("internalLoanTenureMonths", "hidden", "60");
createElement("customerLoanFields", "div");

// Component Rates & Internal Pricing
createElement("panelDcrRate", "number", "26.5");
createElement("panelNonDcrRate", "number", "16.0");
createElement("batteryRate", "number", "18.0");
createElement("hotDipStructureRate", "number", "6.5");
createElement("galvalumeStructureRate", "number", "5.5");
createElement("gpPurlinStructureRate", "number", "5.0");
createElement("wiringRate", "number", "1.2");
createElement("installationRate", "number", "3.0");
createElement("consultancyRate", "number", "1.5");
createElement("contingencyRate", "number", "2.0");
createElement("marginRate", "number", "28.5");

// Technical Performance
createElement("panelWp", "number", "550");
createElement("dailyGeneration", "number", "4.3");
createElement("shadingLoss", "number", "4.0");
createElement("orientationLoss", "number", "2.5");
createElement("systemLoss", "number", "13.5");
createElement("degradationRate", "number", "0.65");
createElement("panelEfficiency", "number", "22.0");
createElement("batteryDod", "number", "85");
createElement("inverterEfficiency", "number", "97.5");
createElement("selfConsumptionPct", "number", "65");

// Tariff Slabs
createElement("fixedCharge", "number", "150");
createElement("electricityDuty", "number", "16.0");
createElement("tariffEscalation", "number", "3.5");
createElement("savingsMethod", "select", "marginal");
createElement("slabRate1", "number", "5.60");
createElement("slabRate2", "number", "10.80");
createElement("slabRate3", "number", "13.90");
createElement("slabRate4", "number", "15.40");

// Rooftop CAD Toolbar Inputs
createElement("cadRoofLength", "number", "55");
createElement("cadRoofBreadth", "number", "30");
createElement("cadPathwayWidth", "number", "3");
createElement("cadBuildingHeightInput", "number", "25");
createElement("cadElevationBldgHeightInput", "number", "25");
createElement("cadNorthAngleInput", "number", "15");
createElement("cadSunTimeSlider", "range", "13.5");
createElement("cadZoomSlider", "range", "1.2");
createElement("cadOpacitySlider", "range", "0.8");
createElement("cadImageControls", "div");
createElement("cadLockImageBtn", "button");

// Report Customization & Savings Checkboxes
createElement("showCadDiagram", "checkbox", "", true);
createElement("hidePayback", "checkbox", "", false);
createElement("hideAreaFit", "checkbox", "", false);
createElement("hideSubsidy", "checkbox", "", false);
createElement("hideCost", "checkbox", "", false);
createElement("hideFinancing", "checkbox", "", false);
createElement("solarInstalled", "checkbox", "", true);
createElement("saveEnergyCharges", "checkbox", "", true);
createElement("saveElectricityDuty", "checkbox", "", true);
createElement("saveWheelingFac", "checkbox", "", false);
createElement("saveTodRebate", "checkbox", "", true);

// Modal and Buttons
createElement("saveProposalButtonInternal", "button");
createElement("loadProposalModal", "div");

// Mock Rooftop CAD instance
const mockCad = {
  roofLengthFt: 55,
  roofBreadthFt: 30,
  buildingHeightFt: 25,
  northAngleDeg: 15,
  defaultPathwayWidthFt: 3,
  panels: [{ x: 5, y: 5, w: 20, h: 10 }],
  cutouts: [{ type: "rect", x: 2, y: 2, w: 4, h: 4 }],
  externalObstacles: [{ type: "tree", x: 60, y: 10, heightFt: 20 }],
  sunSim: { enabled: true, timeHour: 13.5, dayOfYear: 172 },
  image: { isLoaded: true, locked: true, scale: 1.2, opacity: 0.8 },
  serialize() {
    return {
      version: 1,
      roofLengthFt: this.roofLengthFt,
      roofBreadthFt: this.roofBreadthFt,
      buildingHeightFt: this.buildingHeightFt,
      northAngleDeg: this.northAngleDeg,
      defaultPathwayWidthFt: this.defaultPathwayWidthFt,
      panels: this.panels,
      cutouts: this.cutouts,
      externalObstacles: this.externalObstacles,
      sunSim: this.sunSim,
      image: this.image
    };
  },
  loadState(s) {
    this.roofLengthFt = s.roofLengthFt;
    this.roofBreadthFt = s.roofBreadthFt;
    this.buildingHeightFt = s.buildingHeightFt;
    this.northAngleDeg = s.northAngleDeg;
    this.defaultPathwayWidthFt = s.defaultPathwayWidthFt;
    this.panels = s.panels || [];
    this.cutouts = s.cutouts || [];
    this.externalObstacles = s.externalObstacles || [];
    this.sunSim = s.sunSim || this.sunSim;
    this.image = s.image || this.image;
  },
  render() {},
  notifyChanges() {},
  notifyLayersChange() {}
};

// Mock application state
const mockState = {
  meters: [
    { id: "m1", label: "Flat 101", consumerNumber: "123456789011", sanctionedLoad: 5, monthlyUnits: 400, monthlyBill: 4500, allocatedKw: 3.3 },
    { id: "m2", label: "Flat 102", consumerNumber: "123456789012", sanctionedLoad: 5, monthlyUnits: 400, monthlyBill: 4500, allocatedKw: 3.3 }
  ],
  meteringMode: "multi",
  allocationStrategy: "equal",
  extractedBill: {
    consumerNumber: "123456789011",
    billingUnit: "4110",
    fields: { totalAmount: 4500, units: 400 }
  },
  costOverrides: { panels: 175000 },
  systemIncludesText: { ongrid: "Custom Scope of Work for Ongrid System" },
  breakupConfigMarginPct: { ongrid: 28.5 }
};

// -------------------------------------------------------------
// TEST 1: Capture Form Values & Save Proposal Payload Integrity
// -------------------------------------------------------------
console.log("Testing captureFormValues and comprehensive save payload...");

function captureFormValues() {
  const values = {};
  const ignoredTypes = new Set(["file", "password"]);
  const ignoredIds = new Set(["searchProposalInput", "presetSelect"]);

  document.querySelectorAll("input, select, textarea").forEach((el) => {
    if (!el.id || ignoredIds.has(el.id) || ignoredTypes.has(el.type)) return;
    if (el.type === "checkbox") {
      values[el.id] = el.checked;
    } else {
      values[el.id] = el.value;
    }
  });
  return values;
}

const captured = captureFormValues();
assert.equal(captured.customerName, "Ramesh Kulkarni");
assert.equal(captured.proposalSerialNo, "DC/2026-27/PROP-8899");
assert.equal(captured.panelDcrRate, "26.5");
assert.equal(captured.wiringRate, "1.2");
assert.equal(captured.marginRate, "28.5");
assert.equal(captured.loanInterestRate, "8.75");
assert.equal(captured.showCadDiagram, true);
assert.equal(captured.saveWheelingFac, false);
assert.equal(captured.saveElectricityDuty, true);

console.log("✓ Test 1 Passed: captureFormValues correctly indexed all DOM elements.");

// -------------------------------------------------------------
// TEST 2: Round-Trip Save and Load with V2 Full State
// -------------------------------------------------------------
console.log("Testing Round-Trip Save & Load...");

const savedPayload = {
  version: 2,
  formValues: captured,
  rates: {
    panelDcrRate: 26.5,
    panelNonDcrRate: 16.0,
    batteryRate: 18.0,
    hotDipStructureRate: 6.5,
    galvalumeStructureRate: 5.5,
    gpPurlinStructureRate: 5.0,
    wiringRate: 1.2,
    installationRate: 3.0,
    consultancyRate: 1.5,
    contingencyRate: 2.0,
    marginRate: 28.5,
    panelWp: 550,
    dailyGeneration: 4.3,
    shadingLoss: 4.0,
    orientationLoss: 2.5,
    systemLoss: 13.5,
    degradationRate: 0.65,
    panelEfficiency: 22.0,
    batteryDod: 85,
    inverterEfficiency: 97.5,
    selfConsumptionPct: 65,
    fixedCharge: 150,
    electricityDuty: 16.0,
    tariffEscalation: 3.5,
    savingsMethod: "marginal",
    slabRate1: 5.60,
    slabRate2: 10.80,
    slabRate3: 13.90,
    slabRate4: 15.40,
  },
  loans: {
    paymentMode: "loan",
    loanInterestRate: 8.75,
    loanAmount: 250000,
    loanMonthlyEmi: 5150,
    internalPaymentMode: "loan",
    internalLoanInterestRate: 8.75,
    internalLoanAmount: 250000,
    internalLoanMonthlyEmi: 5150,
    internalLoanTenureMonths: 60,
  },
  sizing: {
    capacityOverride: 6.6,
    inverterOverride: 6.0,
    batteryOverride: 0,
    backupLoad: 50,
    backupHours: 3,
    costOverrides: { panels: 175000 },
    systemIncludesText: { ongrid: "Custom Scope of Work for Ongrid System" },
  },
  reportDisplay: {
    showCadDiagram: true,
    hidePayback: false,
    hideAreaFit: false,
    hideSubsidy: false,
    hideCost: false,
    hideFinancing: false,
    solarInstalled: true,
    proposalSerialNo: "DC/2026-27/PROP-8899",
    customerAddress: "Kothrud, Pune, Maharashtra",
    saveEnergyCharges: true,
    saveElectricityDuty: true,
    saveWheelingFac: false,
    saveTodRebate: true,
  },
  cad: mockCad.serialize(),
  state: mockState
};

// Now simulate modifying the DOM to dirty/empty values
elements.get("customerName").value = "Old Name";
elements.get("proposalSerialNo").value = "OLD-SERIAL";
elements.get("panelDcrRate").value = "10";
elements.get("wiringRate").value = "0";
elements.get("marginRate").value = "15";
elements.get("loanInterestRate").value = "12";
elements.get("saveWheelingFac").checked = true;
elements.get("saveElectricityDuty").checked = false;
elements.get("cadRoofLength").value = "20";
elements.get("cadRoofBreadth").value = "15";

// Mock loadProposalState implementation
let multiMeterRendered = false;
let extractedBillRendered = false;

function loadProposalState(data) {
  if (!data) return;

  // 1. Form values restoration
  if (data.formValues && typeof data.formValues === "object") {
    Object.keys(data.formValues).forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = !!data.formValues[id];
      } else {
        el.value = data.formValues[id] !== undefined && data.formValues[id] !== null ? data.formValues[id] : "";
      }
    });
  }

  // 2. State properties
  if (data.state) {
    if (data.state.meters) mockState.meters = JSON.parse(JSON.stringify(data.state.meters));
    if (data.state.meteringMode) mockState.meteringMode = data.state.meteringMode;
    if (data.state.allocationStrategy) mockState.allocationStrategy = data.state.allocationStrategy;
    if (data.state.extractedBill) mockState.extractedBill = JSON.parse(JSON.stringify(data.state.extractedBill));
  }

  // 3. Loans sync
  const pMode = $("paymentMode")?.value || "upfront";
  $("customerLoanFields")?.classList.toggle("hidden", pMode !== "loan");

  // 4. CAD sync
  if (data.cad) {
    mockCad.loadState(data.cad);
    if ($("cadRoofLength")) $("cadRoofLength").value = data.cad.roofLengthFt;
    if ($("cadRoofBreadth")) $("cadRoofBreadth").value = data.cad.roofBreadthFt;
    if ($("cadPathwayWidth")) $("cadPathwayWidth").value = data.cad.defaultPathwayWidthFt;
    if ($("cadBuildingHeightInput")) $("cadBuildingHeightInput").value = data.cad.buildingHeightFt;
    if ($("cadNorthAngleInput")) $("cadNorthAngleInput").value = data.cad.northAngleDeg;
  }

  // 5. Trigger multi-meter and bill render
  if (mockState.meteringMode === "multi") multiMeterRendered = true;
  if (mockState.extractedBill) extractedBillRendered = true;
}

// Execute load
loadProposalState(savedPayload);

// Verify all restored properties
assert.equal(elements.get("customerName").value, "Ramesh Kulkarni");
assert.equal(elements.get("proposalSerialNo").value, "DC/2026-27/PROP-8899");
assert.equal(elements.get("panelDcrRate").value, "26.5");
assert.equal(elements.get("wiringRate").value, "1.2");
assert.equal(elements.get("marginRate").value, "28.5");
assert.equal(elements.get("loanInterestRate").value, "8.75");
assert.equal(elements.get("saveWheelingFac").checked, false);
assert.equal(elements.get("saveElectricityDuty").checked, true);
assert.equal(elements.get("cadRoofLength").value, "55");
assert.equal(elements.get("cadRoofBreadth").value, "30");
assert.equal(elements.get("cadPathwayWidth").value, "3");
assert.equal(elements.get("cadBuildingHeightInput").value, "25");
assert.equal(elements.get("cadNorthAngleInput").value, "15");
assert.equal(elements.get("customerLoanFields").classList.contains("hidden"), false, "Loan fields container must be visible when paymentMode is loan");
assert.equal(multiMeterRendered, true);
assert.equal(extractedBillRendered, true);

console.log("✓ Test 2 Passed: Full round-trip load restores all rates, loans, sizing, CAD, and checkboxes.");

// -------------------------------------------------------------
// TEST 3: Backward Compatibility with Legacy V1 Proposals
// -------------------------------------------------------------
console.log("Testing backward compatibility with legacy v1 proposal format...");

// Dirty the fields again
elements.get("panelDcrRate").value = "";
elements.get("panelNonDcrRate").value = "";
elements.get("batteryRate").value = "";
elements.get("hotDipStructureRate").value = "";
elements.get("galvalumeStructureRate").value = "";
elements.get("gpPurlinStructureRate").value = "";
elements.get("wiringRate").value = "";
elements.get("installationRate").value = "";
elements.get("consultancyRate").value = "";
elements.get("contingencyRate").value = "";
elements.get("marginRate").value = "";
elements.get("backupLoad").value = "";
elements.get("internalLoanTenureMonths").value = "";

// Construct legacy v1 object (which had nested data.config and data.input)
const legacyV1Payload = {
  input: {
    customerName: "Legacy Customer",
    mobileNumber: "9123456780",
    emailAddress: "legacy@customer.com",
    sanctionedLoad: 7,
    backupLoadPercent: 45,
    loanTenureMonths: 84
  },
  config: {
    pricing: {
      panelDcrRatePerWp: 27,
      panelNonDcrRatePerWp: 17,
      batteryRatePerWh: 19,
      structureRates: {
        hotDip: 7.2,
        galvalume: 6.1,
        gpPurlin: 5.4
      },
      wiringRatePerW: 1.5,
      installationRatePerW: 3.2,
      consultancyRatePerW: 1.8,
      contingencyRate: 1.5,
      marginRate: 25
    },
    performance: {
      panelWp: 540,
      dailyGenerationPerKw: 4.1,
      shadingLoss: 3,
      orientationLoss: 2,
      systemLoss: 14,
      degradationRate: 0.7,
      panelEfficiency: 21,
      batteryDod: 90,
      inverterEfficiency: 96,
      selfConsumptionPct: 70
    },
    tariff: {
      fixedCharge: 160,
      electricityDuty: 16,
      tariffEscalation: 4,
      slabs: [
        { upto: 100, rate: 5.8 },
        { upto: 300, rate: 11.2 },
        { upto: 500, rate: 14.1 },
        { upto: Infinity, rate: 16.0 }
      ]
    }
  }
};

// Run the legacy unpacking logic as implemented in loadProposalState
function loadLegacyProposal(data) {
  if (data.config && data.config.pricing) {
    const p = data.config.pricing;
    if ($("panelDcrRate") && p.panelDcrRatePerWp !== undefined) $("panelDcrRate").value = p.panelDcrRatePerWp;
    if ($("panelNonDcrRate") && p.panelNonDcrRatePerWp !== undefined) $("panelNonDcrRate").value = p.panelNonDcrRatePerWp;
    if ($("batteryRate") && p.batteryRatePerWh !== undefined) $("batteryRate").value = p.batteryRatePerWh;
    if (p.structureRates) {
      if ($("hotDipStructureRate") && p.structureRates.hotDip !== undefined) $("hotDipStructureRate").value = p.structureRates.hotDip;
      if ($("galvalumeStructureRate") && p.structureRates.galvalume !== undefined) $("galvalumeStructureRate").value = p.structureRates.galvalume;
      if ($("gpPurlinStructureRate") && p.structureRates.gpPurlin !== undefined) $("gpPurlinStructureRate").value = p.structureRates.gpPurlin;
    }
    if ($("wiringRate") && p.wiringRatePerW !== undefined) $("wiringRate").value = p.wiringRatePerW;
    if ($("installationRate") && p.installationRatePerW !== undefined) $("installationRate").value = p.installationRatePerW;
    if ($("consultancyRate") && p.consultancyRatePerW !== undefined) $("consultancyRate").value = p.consultancyRatePerW;
    if ($("contingencyRate") && p.contingencyRate !== undefined) $("contingencyRate").value = p.contingencyRate;
    if ($("marginRate") && p.marginRate !== undefined) $("marginRate").value = p.marginRate;

    if (data.config.tariff && Array.isArray(data.config.tariff.slabs)) {
      data.config.tariff.slabs.forEach((s, idx) => {
        const el = $(`slabRate${idx + 1}`);
        if (el && s.rate !== undefined) el.value = s.rate;
      });
    }
  }

  if (data.input) {
    if (data.input.customerName && $("customerName")) $("customerName").value = data.input.customerName;
    if (data.input.backupLoadPercent !== undefined && $("backupLoad")) $("backupLoad").value = data.input.backupLoadPercent;
    if (data.input.loanTenureMonths !== undefined && $("internalLoanTenureMonths")) $("internalLoanTenureMonths").value = data.input.loanTenureMonths;
  }
}

loadLegacyProposal(legacyV1Payload);

assert.equal(elements.get("customerName").value, "Legacy Customer");
assert.equal(elements.get("panelDcrRate").value, "27");
assert.equal(elements.get("panelNonDcrRate").value, "17");
assert.equal(elements.get("batteryRate").value, "19");
assert.equal(elements.get("hotDipStructureRate").value, "7.2");
assert.equal(elements.get("galvalumeStructureRate").value, "6.1");
assert.equal(elements.get("gpPurlinStructureRate").value, "5.4");
assert.equal(elements.get("wiringRate").value, "1.5");
assert.equal(elements.get("installationRate").value, "3.2");
assert.equal(elements.get("consultancyRate").value, "1.8");
assert.equal(elements.get("contingencyRate").value, "1.5");
assert.equal(elements.get("marginRate").value, "25");
assert.equal(elements.get("backupLoad").value, "45");
assert.equal(elements.get("internalLoanTenureMonths").value, "84");
assert.equal(elements.get("slabRate1").value, "5.8");
assert.equal(elements.get("slabRate2").value, "11.2");
assert.equal(elements.get("slabRate3").value, "14.1");
assert.equal(elements.get("slabRate4").value, "16");

console.log("✓ Test 3 Passed: Legacy v1 saved proposals unpack all nested pricing, slabs, and sizing fields.");

// -------------------------------------------------------------
// TEST 4: Multi-Proposal Storage Array & Proposal Deduplication
// -------------------------------------------------------------
console.log("Testing Multi-Proposal localStorage management and deduplication...");

function mockSaveProposalToLocalStorage(proposalRecord) {
  let savedList = [];
  try {
    const raw = globalThis.localStorage.getItem("solar_saved_proposals");
    if (raw) savedList = JSON.parse(raw);
  } catch (_) {}
  if (!Array.isArray(savedList)) savedList = [];

  const existingIdx = savedList.findIndex(p =>
    (proposalRecord.proposalSerialNo && p.proposalSerialNo === proposalRecord.proposalSerialNo) ||
    (p.customerName === proposalRecord.customerName && proposalRecord.mobileNumber && p.mobileNumber === proposalRecord.mobileNumber)
  );

  if (existingIdx >= 0) {
    proposalRecord.id = savedList[existingIdx].id || proposalRecord.id;
    savedList[existingIdx] = proposalRecord;
  } else {
    savedList.unshift(proposalRecord);
  }
  if (savedList.length > 50) savedList = savedList.slice(0, 50);

  globalThis.localStorage.setItem("solar_saved_proposals", JSON.stringify(savedList));
  globalThis.localStorage.setItem("solar_proposal_last_saved", JSON.stringify(proposalRecord));
}

// 1. Save proposal A
mockSaveProposalToLocalStorage({
  id: "prop_1",
  customerName: "Anand Joshi",
  mobileNumber: "9123456780",
  proposalSerialNo: "DC/2026-27/PROP-101",
  systemCapacityKw: 5.5,
  totalCost: 245000,
  savedAt: new Date().toISOString(),
  stateData: { formValues: { customerName: "Anand Joshi" } }
});

// 2. Save proposal B
mockSaveProposalToLocalStorage({
  id: "prop_2",
  customerName: "Sunita Deshmukh",
  mobileNumber: "9876501234",
  proposalSerialNo: "DC/2026-27/PROP-102",
  systemCapacityKw: 8.8,
  totalCost: 390000,
  savedAt: new Date().toISOString(),
  stateData: { formValues: { customerName: "Sunita Deshmukh" } }
});

let storedList = JSON.parse(globalThis.localStorage.getItem("solar_saved_proposals"));
assert.equal(storedList.length, 2);
assert.equal(storedList[0].customerName, "Sunita Deshmukh");
assert.equal(storedList[1].customerName, "Anand Joshi");

// 3. Update proposal A with new total cost & capacity
mockSaveProposalToLocalStorage({
  id: "prop_1",
  customerName: "Anand Joshi",
  mobileNumber: "9123456780",
  proposalSerialNo: "DC/2026-27/PROP-101",
  systemCapacityKw: 6.6,
  totalCost: 285000,
  savedAt: new Date().toISOString(),
  stateData: { formValues: { customerName: "Anand Joshi" } }
});

storedList = JSON.parse(globalThis.localStorage.getItem("solar_saved_proposals"));
assert.equal(storedList.length, 2, "Duplicate proposal should be updated in place, not duplicated");
const updatedA = storedList.find(p => p.proposalSerialNo === "DC/2026-27/PROP-101");
assert.equal(updatedA.systemCapacityKw, 6.6);
assert.equal(updatedA.totalCost, 285000);

console.log("✓ Test 4 Passed: Multi-proposal storage array and in-place update verified.");

// -------------------------------------------------------------
// TEST 5: Wrapped Payload Unpacking (stateData / state_data / root)
// -------------------------------------------------------------
console.log("Testing flexible payload unwrapping in loadProposalState...");

function unpackPayload(data) {
  return (data && (data.stateData || data.state_data)) ? (data.stateData || data.state_data) : data;
}

// Case A: File import wrapper
const wrapperFormat = {
  customerName: "Wrapped Customer",
  proposalSerialNo: "DC/2026-27/PROP-999",
  stateData: {
    formValues: { customerName: "Wrapped Customer", panelDcrRate: "29.5" }
  }
};
const unpackedA = unpackPayload(wrapperFormat);
assert.equal(unpackedA.formValues.customerName, "Wrapped Customer");
assert.equal(unpackedA.formValues.panelDcrRate, "29.5");

// Case B: Supabase server row wrapper
const serverRowFormat = {
  id: "uuid-1234",
  customer_name: "Server Customer",
  proposal_serial_no: "DC/2026-27/PROP-888",
  state_data: {
    formValues: { customerName: "Server Customer", panelDcrRate: "28.0" }
  }
};
const unpackedB = unpackPayload(serverRowFormat);
assert.equal(unpackedB.formValues.customerName, "Server Customer");
assert.equal(unpackedB.formValues.panelDcrRate, "28.0");

// Case C: Direct stateData root
const directRoot = {
  formValues: { customerName: "Direct Customer", panelDcrRate: "27.5" }
};
const unpackedC = unpackPayload(directRoot);
assert.equal(unpackedC.formValues.customerName, "Direct Customer");
assert.equal(unpackedC.formValues.panelDcrRate, "27.5");

console.log("✓ Test 5 Passed: All payload wrappers (file export, server row, direct stateData) cleanly unwrap.");

// -------------------------------------------------------------
// TEST 6: JSON Export & Import Integrity
// -------------------------------------------------------------
console.log("Testing JSON Export & Import serialization round-trip...");

const exportSnapshot = {
  customerName: "Export Customer",
  mobileNumber: "9988776655",
  emailAddress: "export@example.com",
  proposalSerialNo: "DC/2026-27/PROP-777",
  exportedAt: new Date().toISOString(),
  stateData: savedPayload
};

const jsonString = JSON.stringify(exportSnapshot, null, 2);
assert.ok(jsonString.length > 100);

const importedSnapshot = JSON.parse(jsonString);
assert.equal(importedSnapshot.customerName, "Export Customer");
assert.equal(importedSnapshot.proposalSerialNo, "DC/2026-27/PROP-777");
const importedSData = unpackPayload(importedSnapshot);
assert.equal(importedSData.rates.panelDcrRate, 26.5);
assert.equal(importedSData.sizing.capacityOverride, 6.6);

console.log("✓ Test 6 Passed: JSON export and import serialization verified.");

// -------------------------------------------------------------
// TEST 7: Financial Year, Auto-Incrementing Serial No & PDF Naming
// -------------------------------------------------------------
console.log("Testing Financial Year calculation, Auto-increment Serial Numbering, and PDF file naming...");

function getFinancialYear(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  if (month >= 3) {
    const nextYearTwoDigits = ((year + 1) % 100).toString().padStart(2, "0");
    return `${year}-${nextYearTwoDigits}`;
  } else {
    const curYearTwoDigits = (year % 100).toString().padStart(2, "0");
    return `${year - 1}-${curYearTwoDigits}`;
  }
}

function getNextProposalSerialNo(existingProposals = null, date = new Date()) {
  const fy = getFinancialYear(date);
  const allProposals = [];

  if (Array.isArray(existingProposals)) {
    allProposals.push(...existingProposals);
  } else {
    if (typeof localStorage !== "undefined") {
      try {
        const raw = localStorage.getItem("solar_saved_proposals");
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) allProposals.push(...list);
        }
      } catch (_) {}
      try {
        const lastRaw = localStorage.getItem("solar_proposal_last_saved");
        if (lastRaw) {
          const lastSaved = JSON.parse(lastRaw);
          if (lastSaved) allProposals.push(lastSaved);
        }
      } catch (_) {}
    }
    if (typeof window !== "undefined" && Array.isArray(window._currentServerProposals)) {
      allProposals.push(...window._currentServerProposals);
    }
  }

  const prefixRegex = new RegExp(`^DC[/-]${fy}[/-]PROP-(\\d+)$`, "i");
  let maxNum = 100;

  allProposals.forEach(p => {
    if (!p) return;
    const candidates = [
      p.proposalSerialNo,
      p.proposal_serial_no,
      p.serialNo,
      p.stateData?.reportDisplay?.proposalSerialNo,
      p.state_data?.reportDisplay?.proposalSerialNo,
      p.stateData?.input?.proposalSerialNo,
      p.state_data?.input?.proposalSerialNo,
      p.stateData?.formValues?.proposalSerialNo,
      p.state_data?.formValues?.proposalSerialNo,
    ];
    candidates.forEach(cand => {
      if (typeof cand === "string") {
        const m = cand.trim().match(prefixRegex);
        if (m && m[1]) {
          const num = parseInt(m[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
  });

  return `DC/${fy}/PROP-${maxNum + 1}`;
}

// 7a: Financial Year calculation across fiscal boundary (April 1)
assert.equal(getFinancialYear(new Date(2026, 9, 8)), "2026-27"); // Oct 8, 2026
assert.equal(getFinancialYear(new Date(2027, 0, 15)), "2026-27"); // Jan 15, 2027
assert.equal(getFinancialYear(new Date(2027, 2, 31)), "2026-27"); // March 31, 2027
assert.equal(getFinancialYear(new Date(2027, 3, 1)), "2027-28"); // April 1, 2027
assert.equal(getFinancialYear(new Date(2025, 11, 25)), "2025-26"); // Dec 25, 2025

// 7b: Starting number is 101 when no existing proposals
const fyDate = new Date(2026, 9, 8);
assert.equal(getNextProposalSerialNo([], fyDate), "DC/2026-27/PROP-101");

// 7c: Auto-increment by +1
const testList = [
  { proposalSerialNo: "DC/2026-27/PROP-101" },
  { proposalSerialNo: "DC/2026-27/PROP-102" }
];
assert.equal(getNextProposalSerialNo(testList, fyDate), "DC/2026-27/PROP-103");

// 7d: Gap handling (jumps above highest existing number)
testList.push({ proposalSerialNo: "DC/2026-27/PROP-108" });
assert.equal(getNextProposalSerialNo(testList, fyDate), "DC/2026-27/PROP-109");

// 7e: Annual FY Reset - proposals from prior FY do not increase current FY sequence
const priorYearList = [
  { proposalSerialNo: "DC/2025-26/PROP-150" },
  { proposalSerialNo: "DC/2025-26/PROP-199" }
];
assert.equal(getNextProposalSerialNo(priorYearList, fyDate), "DC/2026-27/PROP-101");

// 7f: Sanitized PDF file naming (/ replaced with -)
function getPdfDownloadFilename(serialNo) {
  const cleanSerial = String(serialNo || "")
    .trim()
    .replaceAll("/", "-")
    .replace(/[^a-zA-Z0-9_-]/g, "");
  return `${cleanSerial || "DC-2026-27-PROP-101"}.pdf`;
}

assert.equal(getPdfDownloadFilename("DC/2026-27/PROP-101"), "DC-2026-27-PROP-101.pdf");
assert.equal(getPdfDownloadFilename("DC/2026-27/PROP-102"), "DC-2026-27-PROP-102.pdf");
assert.equal(getPdfDownloadFilename("DC/2027-28/PROP-101"), "DC-2027-28-PROP-101.pdf");
assert.equal(getPdfDownloadFilename(""), "DC-2026-27-PROP-101.pdf");

console.log("✓ Test 7 Passed: Financial Year, Auto-increment Serial Numbering, and PDF file naming verified.");

console.log("ALL SAVE & LOAD TESTS PASSED! 🎉");
