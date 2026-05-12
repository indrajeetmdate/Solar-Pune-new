import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.js";
import {
  calculateBill,
  calculateEstimate,
  calculateSubsidy,
  recommendCapacity,
} from "../src/calculator.js";

function makeInput(overrides = {}) {
  return {
    monthlyUnits: 450,
    monthlyBill: 5200,
    roofArea: 650,
    sanctionedLoad: 5,
    goal: "maximumSavings",
    backupNeeded: true,
    panelType: "dcr",
    structureType: "hotDip",
    capacityOverride: 0,
    inverterOverride: 0,
    backupLoadKw: 1.5,
    backupHours: 4,
    savingsMethod: "auto",
    ...overrides,
  };
}

assert.equal(calculateSubsidy("ongrid", "dcr", 1), 30000);
assert.equal(calculateSubsidy("ongrid", "dcr", 2), 60000);
assert.equal(calculateSubsidy("ongrid", "dcr", 2.5), 69000);
assert.equal(calculateSubsidy("ongrid", "dcr", 3), 78000);
assert.equal(calculateSubsidy("ongrid", "dcr", 6), 78000);
assert.equal(calculateSubsidy("ongrid", "nonDcr", 3), 0);
assert.equal(calculateSubsidy("offgrid", "dcr", 3), 0);

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

const backupEstimate = calculateEstimate(makeInput({ goal: "backupSupport" }), DEFAULT_CONFIG);
assert.equal(backupEstimate.recommended.systemType, "hybrid");
assert.ok(backupEstimate.recommended.batteryCapacityKwh > 0);

const lowRoof = calculateEstimate(makeInput({ roofArea: 180, sanctionedLoad: 10 }), DEFAULT_CONFIG);
assert.ok(lowRoof.recommended.dcCapacityKw <= 1.5);

console.log("calculator tests passed");
