import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import {
  calculateSingleMeterSubsidy,
  distributeCapacityAcrossMeters,
  calculateSubsidy,
  calculateEstimate,
} from "../src/calculator.js";

console.log("Running Multi-Meter & Multi-Subsidy Tests...");

// 1. Single Meter Subsidy (PM Surya Ghar rules)
// Up to 2 kW: ₹30,000/kW
// Next 1 kW: ₹18,000/kW
// 3 kW and above: capped at ₹78,000 for residential LT-I
assert.equal(calculateSingleMeterSubsidy(1, "LT-I"), 30000);
assert.equal(calculateSingleMeterSubsidy(2, "LT-I"), 60000);
assert.equal(calculateSingleMeterSubsidy(2.5, "LT-I"), 69000);
assert.equal(calculateSingleMeterSubsidy(3, "LT-I"), 78000);
assert.equal(calculateSingleMeterSubsidy(5, "LT-I"), 78000);
assert.equal(calculateSingleMeterSubsidy(10, "LT-I"), 78000);

// Non-residential or commercial categories get ₹0 PM Surya Ghar subsidy
assert.equal(calculateSingleMeterSubsidy(3, "LT-II"), 0);
assert.equal(calculateSingleMeterSubsidy(3, "LT-IX"), 0);

// GHS (Group Housing Society) common meter: flat ₹18,000/kW
assert.equal(calculateSingleMeterSubsidy(10, "LT-I-GHS"), 180000);

console.log("✓ Single meter subsidy tests passed.");

// 2. Multi-Meter Subsidy Calculation (Building with 6 flats, total 13 kW)
// Example from user request: 13 kW distributed across 6 bills as [2, 2, 2, 2, 2, 3] kW
const sixFlats = [
  { id: "m1", label: "Flat 101", consumerNumber: "123456789011", sanctionedLoad: 3, monthlyUnits: 250, monthlyBill: 2800, allocatedKw: 2 },
  { id: "m2", label: "Flat 102", consumerNumber: "123456789012", sanctionedLoad: 3, monthlyUnits: 250, monthlyBill: 2800, allocatedKw: 2 },
  { id: "m3", label: "Flat 201", consumerNumber: "123456789013", sanctionedLoad: 3, monthlyUnits: 250, monthlyBill: 2800, allocatedKw: 2 },
  { id: "m4", label: "Flat 202", consumerNumber: "123456789014", sanctionedLoad: 3, monthlyUnits: 250, monthlyBill: 2800, allocatedKw: 2 },
  { id: "m5", label: "Flat 301", consumerNumber: "123456789015", sanctionedLoad: 3, monthlyUnits: 250, monthlyBill: 2800, allocatedKw: 2 },
  { id: "m6", label: "Flat 302 (Penthouse)", consumerNumber: "123456789016", sanctionedLoad: 5, monthlyUnits: 450, monthlyBill: 5000, allocatedKw: 3 },
];

const subsidyResult = calculateSubsidy("ongrid", "dcr", 13, { meters: sixFlats }, DEFAULT_CONFIG.policy);
assert.equal(subsidyResult.type, "multi_meter");
assert.equal(subsidyResult.perMeter.length, 6);

// Verify individual allocations and subsidies:
// 5 flats @ 2 kW each = 5 * ₹60,000 = ₹3,00,000
// 1 flat @ 3 kW = ₹78,000
// Total = ₹3,78,000
assert.equal(subsidyResult.perMeter[0].subsidy, 60000);
assert.equal(subsidyResult.perMeter[1].subsidy, 60000);
assert.equal(subsidyResult.perMeter[2].subsidy, 60000);
assert.equal(subsidyResult.perMeter[3].subsidy, 60000);
assert.equal(subsidyResult.perMeter[4].subsidy, 60000);
assert.equal(subsidyResult.perMeter[5].subsidy, 78000);
assert.equal(subsidyResult.total, 378000);

console.log("✓ Multi-meter 13 kW across 6 bills (2,2,2,2,2,3 kW -> ₹3,78,000) verified successfully.");

// 3. Load Distribution Strategies
// Equal distribution of 12 kW across 6 meters -> 2 kW each
const equalDist = distributeCapacityAcrossMeters(12, sixFlats, "equal");
assert.equal(equalDist.length, 6);
equalDist.forEach((m) => {
  assert.equal(m.allocatedKw, 2);
});

// Proportional distribution
const propDist = distributeCapacityAcrossMeters(13, sixFlats, "proportional");
assert.equal(propDist.length, 6);
const totalPropAllocated = Math.round(propDist.reduce((s, m) => s + m.allocatedKw, 0));
assert.equal(totalPropAllocated, 13);
// Higher consumption meter (Flat 302, 450 units) should get larger allocation than Flat 101 (250 units)
assert.ok(propDist[5].allocatedKw > propDist[0].allocatedKw);

// Preserve strategy retains current values
const preserved = distributeCapacityAcrossMeters(13, sixFlats, "preserve");
assert.equal(preserved[0].allocatedKw, 2);
assert.equal(preserved[5].allocatedKw, 3);

console.log("✓ Capacity distribution strategies (equal, proportional, preserve) verified successfully.");

// 4. Compulsory Field Validation
function validateMeters(meters) {
  return meters.filter(
    (m) => !m.consumerNumber?.trim() || !m.label?.trim() || !(Number(m.sanctionedLoad) > 0)
  );
}

// All valid
assert.equal(validateMeters(sixFlats).length, 0);

// Missing consumerNumber
const missingConsumerNo = [{ ...sixFlats[0], consumerNumber: "" }];
assert.equal(validateMeters(missingConsumerNo).length, 1);

// Missing label / flat identifier
const missingLabel = [{ ...sixFlats[0], label: "" }];
assert.equal(validateMeters(missingLabel).length, 1);

// Missing or zero sanctioned load
const missingLoad = [{ ...sixFlats[0], sanctionedLoad: 0 }];
assert.equal(validateMeters(missingLoad).length, 1);

console.log("✓ Compulsory meter fields validation verified successfully.");

// 5. Integration with calculateEstimate
const input = {
  monthlyUnits: 1700,
  monthlyBill: 19000,
  roofArea: 1500,
  sanctionedLoad: 20,
  goal: "ongrid",
  backupNeeded: false,
  panelType: "dcr",
  structureType: "hotDip",
  capacityOverride: 13,
  inverterOverride: 0,
  meters: sixFlats,
  meteringMode: "multi",
  savingsMethod: "auto",
};

const est = calculateEstimate(input, DEFAULT_CONFIG);
assert.ok(est.recommended);
assert.equal(est.recommended.subsidy, 378000);
assert.ok(est.recommended.meterBreakdown);
assert.equal(est.recommended.meterBreakdown.length, 6);
assert.equal(est.recommended.meterBreakdown[0].subsidy, 60000);
assert.equal(est.recommended.meterBreakdown[5].subsidy, 78000);
assert.ok(est.recommended.netCost < est.recommended.totalPreSubsidy);

console.log("✓ calculateEstimate multi-meter integration verified successfully.");
console.log("ALL MULTI-METER TESTS PASSED! 🎉");
