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

// 1. Pro-Rata Subsidy Tests (MNRE Guidelines 07.06.2024 & MERC Regulations)
// Slab: 0 to 2 kWp: ₹30,000/kWp; >2 to 3 kWp: ₹18,000/kWp; >3 kWp: max cap ₹78,000
assert.equal(calculateFixedQuantumSubsidy(0.5, "LT-I"), 15000, "0.5 kW must get ₹15,000 subsidy");
assert.equal(calculateFixedQuantumSubsidy(1.0, "LT-I"), 30000, "1.0 kW must get ₹30,000 subsidy");
assert.equal(calculateFixedQuantumSubsidy(1.5, "LT-I"), 45000, "1.5 kW must get ₹45,000 (MNRE Clause 5h worked example 1)");
assert.equal(calculateFixedQuantumSubsidy(2.0, "LT-I"), 60000, "2.0 kW must get ₹60,000 subsidy");
assert.equal(calculateFixedQuantumSubsidy(2.2, "LT-I"), 63600, "2.2 kW must get ₹63,600 (60k + 0.2*18k)");
assert.equal(calculateFixedQuantumSubsidy(2.5, "LT-I"), 69000, "2.5 kW must get ₹69,000 (MNRE Clause 5h worked example 2)");
assert.equal(calculateFixedQuantumSubsidy(3.0, "LT-I"), 78000, "3.0 kW must get ₹78,000 subsidy cap");
assert.equal(calculateFixedQuantumSubsidy(4.4, "LT-I"), 78000, "4.4 kW must get ₹78,000 subsidy cap");
assert.equal(calculateFixedQuantumSubsidy(6.0, "LT-I"), 78000, "6.0 kW must get ₹78,000 (MNRE Clause 5h worked example 3)");
assert.equal(calculateFixedQuantumSubsidy(10.0, "LT-I"), 78000, "10 kW must get ₹78,000 subsidy cap");

// Commercial / non-residential meters must get ₹0 subsidy
assert.equal(calculateFixedQuantumSubsidy(3.0, "LT-II"), 0, "Commercial LT-II must get ₹0 subsidy");
assert.equal(calculateFixedQuantumSubsidy(5.0, "LT-III"), 0, "Industrial LT-III must get ₹0 subsidy");

console.log("✓ Pro-Rata Subsidy slabs verified (0-2kW @ 30k/kW, 2-3kW @ 18k/kW, cap 78k).");

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

// Verify per-flat subsidy matches pro-rata slabs
buildingRes.flatLedger.forEach((flat) => {
  if (flat.allocatedKw >= 3.0) {
    assert.equal(flat.subsidy, 78000);
  } else if (flat.allocatedKw > 2.0) {
    assert.equal(flat.subsidy, Math.round(60000 + (flat.allocatedKw - 2.0) * 18000));
  } else if (flat.allocatedKw > 0) {
    assert.equal(flat.subsidy, Math.round(flat.allocatedKw * 30000));
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

// Verify Flat 202 (376 units, 5 kW load) gets close to 3.58 kW requirement: approx 6 panels of 550 Wp = 3.3 kWp, ₹78k subsidy
const flat202 = userBuildingRes.flatLedger.find(f => f.flatNo === "202");
assert.ok(flat202, "Flat 202 must exist in building ledger");
assert.equal(flat202.panels, 6, "Flat 202 (376 units) must be recommended 6 panels (3.3 kW)");
assert.equal(flat202.allocatedKw, 3.3, "Flat 202 must have 3.3 kWp allocated");
assert.equal(flat202.subsidy, 78000, "Flat 202 (3.3 kWp >= 3 kW) must receive completed ₹78,000 subsidy");
assert.ok(flat202.monthlyGeneration >= 340 && flat202.monthlyGeneration <= 355, `Flat 202 generation should be ~347 kWh/mo, got: ${flat202.monthlyGeneration}`);

// Test with full 27-flat dataset
const user27Flats = [
  { flatNo: "101", customerName: "Ajay kulkarni", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 93, monthlyBill: 1023 },
  { flatNo: "102", customerName: "Ruchi Bhindwale", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 153, monthlyBill: 1836 },
  { flatNo: "103", customerName: "Ajay Uke", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 91, monthlyBill: 910 },
  { flatNo: "201", customerName: "Ashok Mahajan", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 92, monthlyBill: 1104 },
  { flatNo: "202", customerName: "Shriniwas Badrayani", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 376, monthlyBill: 4512 },
  { flatNo: "203", customerName: "Sudhir Aptekar", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 194, monthlyBill: 2134 },
  { flatNo: "301", customerName: "Shrirang Jamadagani", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 240, monthlyBill: 2640 },
  { flatNo: "302", customerName: "Sanjeevani Toley", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 195, monthlyBill: 2340 },
  { flatNo: "303", customerName: "Vivekanand Shetty", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 131, monthlyBill: 1048 },
  { flatNo: "401", customerName: "Prasad Bhogle", sanctionedLoad: 4.98, category: "LT-I", monthlyUnits: 88, monthlyBill: 880 },
  { flatNo: "402", customerName: "Amit Ponkshe", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 326, monthlyBill: 4890 },
  { flatNo: "403", customerName: "Kiran Kanaskar", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 170, monthlyBill: 1700 },
  { flatNo: "501", customerName: "Supriya Potnis", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 127, monthlyBill: 1524 },
  { flatNo: "502", customerName: "Amruta Kulkarni", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 300, monthlyBill: 3900 },
  { flatNo: "503", customerName: "Anagha Naik", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 106, monthlyBill: 954 },
  { flatNo: "601", customerName: "Sandeep Kadu", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 100, monthlyBill: 1200 },
  { flatNo: "602", customerName: "Sonali Saraf", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 167, monthlyBill: 1837 },
  { flatNo: "603", customerName: "Swati Kulkarni", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 255, monthlyBill: 2805 },
  { flatNo: "701", customerName: "Prasad Deshmukh", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 304, monthlyBill: 3648 },
  { flatNo: "702", customerName: "Advait Inamdar", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 120, monthlyBill: 1440 },
  { flatNo: "703", customerName: "Archana Tikotekar", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 108, monthlyBill: 1080 },
  { flatNo: "801", customerName: "Amruta Bedekar", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 227, monthlyBill: 2724 },
  { flatNo: "802", customerName: "Jitendra Balkundi", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 300, monthlyBill: 5100 },
  { flatNo: "803", customerName: "Atul Hindlekar", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 163, monthlyBill: 1630 },
  { flatNo: "901", customerName: "Madhav Phatak", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 148, monthlyBill: 1628 },
  { flatNo: "902", customerName: "Nikhil Kirtikar", sanctionedLoad: 5, category: "LT-I", monthlyUnits: 330, monthlyBill: 3960 },
  { flatNo: "903", customerName: "Amol Kulkarni", sanctionedLoad: 4, category: "LT-I", monthlyUnits: 300, monthlyBill: 3300 },
];
const bldg27Res = calculateBuildingLedger({
  buildingName: "27 Flats Society",
  flats: user27Flats,
});
assert.equal(bldg27Res.flatLedger.length, 27);
const flat202In27 = bldg27Res.flatLedger.find(f => f.flatNo === "202");
assert.equal(flat202In27.panels, 6, "Flat 202 must get 6 panels even in large 27-flat society without arbitrary throttling");
assert.equal(flat202In27.allocatedKw, 3.3);
assert.equal(flat202In27.subsidy, 78000);
assert.ok(bldg27Res.summary.totalBuildingPanels >= 80, `Total panels for 27 flats should be ~85-95, got: ${bldg27Res.summary.totalBuildingPanels}`);
assert.ok(bldg27Res.summary.requiredRoofAreaSqft >= 3000, `Required roof area should be >= 3000 sq ft, got: ${bldg27Res.summary.requiredRoofAreaSqft}`);

// Export to CSV
const exportedCsv = exportBuildingToCSV(buildingRes.flatLedger);
assert.ok(exportedCsv.includes("Silver Oaks") || exportedCsv.includes("Rahul S"));
assert.ok(exportedCsv.includes("GrossCost"));

// 6. Test MNRE Guidelines 07.06.2024 Building Constraints
console.log("Testing MNRE Guidelines 07.06.2024 Multi-Customer Building Constraints...");

// Special Category State in calculateFixedQuantumSubsidy
assert.equal(calculateFixedQuantumSubsidy(1.5, "LT-I", { isSpecialCategoryState: true }), 49500); // 1.5 * 33k
assert.equal(calculateFixedQuantumSubsidy(2.5, "LT-I", { isSpecialCategoryState: true }), 75900); // 66k + 0.5 * 19.8k
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

// 7. Test Separate Inverters for Separate Flats in Building Ledger
console.log("Testing Separate Inverters for Separate Flats in Building Ledger...");
assert.equal(buildingRes.summary.totalInverters, 3, "Building must have 3 separate inverters for 3 flats");
assert.ok(buildingRes.summary.inverterModelSummary.includes("Separate Inverters"));

const flat1 = buildingRes.flatLedger[0];
assert.ok(flat1.inverterModel, "Each flat must have a separate inverter model");
assert.ok(flat1.inverterRatingKw >= flat1.allocatedKw, "Flat inverter rating must meet allocated capacity");
assert.ok(flat1.inverterCost > 0, "Flat inverter must have discrete cost");

// Test Flat 202 in 27 flats
const flat202Ledger = bldg27Res.flatLedger.find(f => f.flatNo === "202");
assert.equal(flat202Ledger.allocatedKw, 3.3);
assert.equal(flat202Ledger.inverterModel, "3.3Kw Single Phase", "Flat 202 (3.3 kW) must receive dedicated 3.3Kw Single Phase inverter");
assert.equal(flat202Ledger.inverterRatingKw, 3.3);
assert.equal(flat202Ledger.inverterCost, 15006);

// Verify total building inverters count equals total flats
assert.equal(bldg27Res.summary.totalInverters, 27, "Large society must have 27 separate inverters for 27 flats");
console.log("✓ Separate inverters for separate flats in Building Ledger verified!");

console.log("✓ MNRE Guidelines 07.06.2024 Multi-Customer Building constraints verified!");

console.log("✓ CSV template, parsing, and export verified.");
console.log("ALL MULTI-CUSTOMER MANAGER TESTS PASSED! 🎉");
