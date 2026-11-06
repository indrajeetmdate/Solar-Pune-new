import assert from "node:assert/strict";
import {
  calculateFixedQuantumSubsidy,
  allocatePanelsByConsumption,
  calculateBuildingLedger,
  generateBuildingCSVTemplate,
  parseBuildingCSV,
  exportBuildingToCSV,
} from "../src/multiCustomerManager.js";

console.log("Starting Multi-Customer Building Manager Tests...");

// 1. Fixed Quantum Subsidy Tests
// User Rule: Fixed quantums: 1kW = 30k, 2kW = 60k, >=3kW = 78k (no linear scaling)
assert.equal(calculateFixedQuantumSubsidy(0.5, "LT-I"), 0, "Capacity < 1 kW must get ₹0 subsidy");
assert.equal(calculateFixedQuantumSubsidy(0.99, "LT-I"), 0, "Capacity < 1 kW must get ₹0 subsidy");

assert.equal(calculateFixedQuantumSubsidy(1.0, "LT-I"), 30000, "1.0 kW must get ₹30,000 subsidy");
assert.equal(calculateFixedQuantumSubsidy(1.5, "LT-I"), 30000, "1.5 kW must get ₹30,000 (fixed quantum for 1 kW slab)");
assert.equal(calculateFixedQuantumSubsidy(1.9, "LT-I"), 30000, "1.9 kW must get ₹30,000 (fixed quantum for 1 kW slab)");

assert.equal(calculateFixedQuantumSubsidy(2.0, "LT-I"), 60000, "2.0 kW must get ₹60,000 subsidy");
assert.equal(calculateFixedQuantumSubsidy(2.2, "LT-I"), 60000, "2.2 kW must get ₹60,000 (fixed quantum for 2 kW slab)");
assert.equal(calculateFixedQuantumSubsidy(2.9, "LT-I"), 60000, "2.9 kW must get ₹60,000 (fixed quantum for 2 kW slab)");

assert.equal(calculateFixedQuantumSubsidy(3.0, "LT-I"), 78000, "3.0 kW must get ₹78,000 subsidy cap");
assert.equal(calculateFixedQuantumSubsidy(4.4, "LT-I"), 78000, "4.4 kW must get ₹78,000 subsidy cap");
assert.equal(calculateFixedQuantumSubsidy(10.0, "LT-I"), 78000, "10 kW must get ₹78,000 subsidy cap");

// Commercial / non-residential meters must get ₹0 subsidy
assert.equal(calculateFixedQuantumSubsidy(3.0, "LT-II"), 0, "Commercial LT-II must get ₹0 subsidy");
assert.equal(calculateFixedQuantumSubsidy(5.0, "LT-III"), 0, "Industrial LT-III must get ₹0 subsidy");

console.log("✓ Fixed Quantum Subsidy slabs verified (0, 30k, 60k, 78k).");

// 2. Consumption-Proportional Panel Allocation
const sampleFlats = [
  { flatNo: "101", customerName: "Flat 101", monthlyUnits: 200 },
  { flatNo: "102", customerName: "Flat 102", monthlyUnits: 400 },
  { flatNo: "103", customerName: "Flat 103", monthlyUnits: 600 },
];
// Total units = 1200. Proportions: 101 -> 1/6 (16.7%), 102 -> 2/6 (33.3%), 103 -> 3/6 (50%)
// For 12 panels: 101 gets 2, 102 gets 4, 103 gets 6
const allocated = allocatePanelsByConsumption(12, sampleFlats, 550);
assert.equal(allocated.length, 3);
assert.equal(allocated[0].panels, 2);
assert.equal(allocated[1].panels, 4);
assert.equal(allocated[2].panels, 6);
const sumPanels = allocated.reduce((s, f) => s + f.panels, 0);
assert.equal(sumPanels, 12, "Sum of allocated panels must exactly equal total panels");

console.log("✓ Panel allocation proportional to monthly units verified.");

// 3. Complete Building Ledger Calculations
const buildingRes = calculateBuildingLedger({
  buildingName: "Silver Oaks CHS",
  buildingAddress: "Baner, Pune",
  roofAreaSqft: 2000,
  panelMake: "Waaree Energies",
  panelRate: 25,
  panelWp: 550,
  flats: [
    { flatNo: "101", customerName: "Rahul S", monthlyUnits: 250, monthlyBill: 2800, sanctionedLoad: 3, consumerCategory: "LT-I", paymentMode: "upfront" },
    { flatNo: "102", customerName: "Priya K", monthlyUnits: 350, monthlyBill: 4000, sanctionedLoad: 4, consumerCategory: "LT-I", paymentMode: "upfront" },
    { flatNo: "201", customerName: "Amit J", monthlyUnits: 450, monthlyBill: 5200, sanctionedLoad: 5, consumerCategory: "LT-I", paymentMode: "loan", loanDownPaymentPct: 15 },
  ],
});

assert.ok(buildingRes.totals);
assert.equal(buildingRes.totals.totalFlats, 3);
assert.ok(buildingRes.totals.totalPanels > 0);
assert.ok(buildingRes.totals.totalCapacityKw > 0);
assert.ok(buildingRes.totals.totalSubsidies > 0);
assert.ok(buildingRes.totals.totalNetCost > 0);
assert.equal(buildingRes.flatLedger.length, 3);

// Verify per-flat subsidy matches fixed quantum slabs
buildingRes.flatLedger.forEach((flat) => {
  if (flat.allocatedKw >= 3.0) {
    assert.equal(flat.subsidy, 78000);
  } else if (flat.allocatedKw >= 2.0) {
    assert.equal(flat.subsidy, 60000);
  } else if (flat.allocatedKw >= 1.0) {
    assert.equal(flat.subsidy, 30000);
  } else {
    assert.equal(flat.subsidy, 0);
  }
  assert.ok(flat.grossCost > 0);
  assert.equal(flat.netCost, flat.grossCost - flat.subsidy);
  assert.ok(flat.monthlySavings > 0);
  assert.ok(flat.paybackYears > 0);
});

console.log("✓ Building ledger totals and per-flat financials verified.");

// 4. CSV Template Generation & Parsing
const csvTemplate = generateBuildingCSVTemplate();
assert.ok(csvTemplate.includes("FlatNo"));
assert.ok(csvTemplate.includes("MonthlyUnits"));
assert.ok(csvTemplate.includes("MonthlyBill"));

const parsedFlats = parseBuildingCSV(csvTemplate);
assert.ok(parsedFlats.length >= 5, "Template should parse into at least 5 flats");
assert.equal(parsedFlats[0].flatNo, "101");
assert.equal(parsedFlats[0].customerName, "Rahul Sharma");
assert.equal(parsedFlats[0].sanctionedLoad, 3);
assert.equal(parsedFlats[0].monthlyUnits, 280);

// Export to CSV
const exportedCsv = exportBuildingToCSV(buildingRes.flatLedger);
assert.ok(exportedCsv.includes("Silver Oaks") || exportedCsv.includes("Rahul S"));
assert.ok(exportedCsv.includes("GrossCost"));

console.log("✓ CSV template, parsing, and export verified.");
console.log("ALL MULTI-CUSTOMER MANAGER TESTS PASSED! 🎉");
