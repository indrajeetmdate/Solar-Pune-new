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
assert.ok(Array.isArray(parsedFlats.flats), "parsedFlats.flats must be an array");
assert.equal(parsedFlats[0].flatNo, "101");
assert.equal(parsedFlats[0].customerName, "Rahul Sharma");
assert.equal(parsedFlats[0].sanctionedLoad, 3);
assert.equal(parsedFlats[0].monthlyUnits, 280);

// 5. Test User's Exact TSV/CSV format with Tab Delimiters
const userTabCsv = `FlatNo\tCustomerName\tSanctionLoadKw\tCategory\tPhase\tMonthlyUnits\tMonthlyBill\tPaymentMode\tLoanDownPaymentPct\tLoanInterestRate
101\tAjay kulkarni\t5\tLT-I\t3-phase\t93\t1023\twithout_loan\t10\t7
102\tRuchi Bhindwale\t5\tLT-I\t3-phase\t153\t1836\twithout_loan\t10\t7
103\tAjay Uke\t4\tLT-I\t1-phase\t91\t910\twithout_loan\t10\t7
201\tAshok Mahajan\t5\tLT-I\t3-phase\t92\t1104\twithout_loan\t10\t7
202\tShriniwas Badrayani\t5\tLT-I\t3-phase\t376\t4512\twithout_loan\t10\t7
203\tSudhir Aptekar\t4\tLT-I\t1-phase\t194\t2134\twithout_loan\t10\t7
301\tShrirang Jamadagani\t5\tLT-I\t3-phase\t240\t2640\twithout_loan\t10\t7
302\tSanjeevani Toley\t5\tLT-I\t3-phase\t195\t2340\twithout_loan\t10\t7`;

const userParsedFlats = parseBuildingCSV(userTabCsv);
assert.equal(userParsedFlats.length, 8, "Must parse all 8 user records");
assert.equal(userParsedFlats[0].flatNo, "101");
assert.equal(userParsedFlats[0].customerName, "Ajay kulkarni");
assert.equal(userParsedFlats[0].sanctionedLoad, 5);
assert.equal(userParsedFlats[0].category, "LT-I");
assert.equal(userParsedFlats[0].phase, "3-phase");
assert.equal(userParsedFlats[0].monthlyUnits, 93);
assert.equal(userParsedFlats[0].monthlyBill, 1023);
assert.equal(userParsedFlats[0].paymentMode, "upfront");
assert.equal(userParsedFlats[0].loanMode, false);
assert.equal(userParsedFlats[0].loanDownPaymentPct, 10);
assert.equal(userParsedFlats[0].loanInterestRate, 7);

assert.equal(userParsedFlats[7].flatNo, "302");
assert.equal(userParsedFlats[7].customerName, "Sanjeevani Toley");
assert.equal(userParsedFlats[7].monthlyUnits, 195);
assert.equal(userParsedFlats[7].monthlyBill, 2340);

// Test building ledger calculation with user's flats
const userBuildingRes = calculateBuildingLedger({
  buildingName: "User Test Building",
  flats: userParsedFlats,
});
assert.equal(userBuildingRes.flatLedger.length, 8);
assert.ok(userBuildingRes.summary.totalBuildingCapacityKw > 0);
assert.ok(userBuildingRes.summary.totalSubsidy > 0);

// Export to CSV
const exportedCsv = exportBuildingToCSV(buildingRes.flatLedger);
assert.ok(exportedCsv.includes("Silver Oaks") || exportedCsv.includes("Rahul S"));
assert.ok(exportedCsv.includes("GrossCost"));

// 6. Test MNRE Guidelines 07.06.2024 Building Constraints
console.log("Testing MNRE Guidelines 07.06.2024 Multi-Customer Building Constraints...");

// Special Category State in calculateFixedQuantumSubsidy
assert.equal(calculateFixedQuantumSubsidy(1.5, "LT-I", { isSpecialCategoryState: true }), 33000);
assert.equal(calculateFixedQuantumSubsidy(2.5, "LT-I", { isSpecialCategoryState: true }), 66000);
assert.equal(calculateFixedQuantumSubsidy(3.5, "LT-I", { isSpecialCategoryState: true }), 85800);

// Building in Special Category State
const specialBuildingRes = calculateBuildingLedger({
  buildingName: "Himalayan View Apartments",
  buildingAddress: "Nainital, Uttarakhand",
  isSpecialCategoryState: true,
  flats: [
    { flatNo: "101", customerName: "A", monthlyUnits: 250, monthlyBill: 2800, sanctionedLoad: 3, consumerCategory: "LT-I" },
    { flatNo: "102", customerName: "B", monthlyUnits: 350, monthlyBill: 4000, sanctionedLoad: 4, consumerCategory: "LT-I" },
    { flatNo: "103", customerName: "C", monthlyUnits: 450, monthlyBill: 5200, sanctionedLoad: 5, consumerCategory: "LT-I" },
  ],
});
assert.equal(specialBuildingRes.totals.isSpecialCategoryState, true);
assert.equal(specialBuildingRes.flatLedger[2].subsidy, 85800, "Flat with >= 3 kW in special state must receive ₹85,800");

// Ground-Mounted Building System: ₹0 CFA for all flats
const groundBuildingRes = calculateBuildingLedger({
  buildingName: "Ground Mount Society",
  structureType: "ground",
  flats: sampleFlats.map(f => ({ ...f, monthlyBill: 3000, sanctionedLoad: 5, consumerCategory: "LT-I" })),
});
assert.equal(groundBuildingRes.totals.isGroundMount, true);
assert.equal(groundBuildingRes.totals.totalSubsidies, 0, "Ground-mounted building solar must receive ₹0 total CFA");
groundBuildingRes.flatLedger.forEach(f => {
  assert.equal(f.subsidy, 0, "Each individual flat on ground mount must receive ₹0 CFA");
});

// Non-DCR Building System: ₹0 CFA for all flats
const nonDcrBuildingRes = calculateBuildingLedger({
  buildingName: "Non-DCR Society",
  panelType: "nonDcr",
  flats: sampleFlats.map(f => ({ ...f, monthlyBill: 3000, sanctionedLoad: 5, consumerCategory: "LT-I" })),
});
assert.equal(nonDcrBuildingRes.totals.isDcr, false);
assert.equal(nonDcrBuildingRes.totals.totalSubsidies, 0, "Non-DCR building solar must receive ₹0 total CFA");

// Category B Shared Building Cap
assert.equal(buildingRes.totals.sharedBuildingCapKw, 9, "3 flats * 3 kW = 9 kW cap");
assert.ok(buildingRes.totals.cfaCategory.includes("Category B"));

console.log("✓ MNRE Guidelines 07.06.2024 Multi-Customer Building constraints verified!");

console.log("✓ CSV template, parsing, and export verified.");
console.log("ALL MULTI-CUSTOMER MANAGER TESTS PASSED! 🎉");
