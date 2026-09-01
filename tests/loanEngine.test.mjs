import assert from "node:assert/strict";
import {
  calculateLoanTenureFromEmi,
  calculateLoanEmiFromTenure,
  calculateSolarFinancing,
} from "../src/loanEngine.js";

// Test 1: Standard EMI to Tenure calculation
// P = 150,000, r = 9.5%, EMI = 5,200
{
  const result = calculateLoanTenureFromEmi(150000, 9.5, 5200);
  assert.equal(result.valid, true);
  assert.ok(result.tenureMonths >= 30 && result.tenureMonths <= 40, `Tenure months should be ~33, got ${result.tenureMonths}`);
  assert.ok(result.totalInterest > 0);
  assert.equal(result.totalRepayment, result.tenureMonths * 5200);
}

// Test 2: Tenure to EMI calculation
// P = 150,000, r = 9.5%, n = 36 months
{
  const result = calculateLoanEmiFromTenure(150000, 9.5, 36);
  assert.equal(result.valid, true);
  assert.ok(result.monthlyEmi >= 4700 && result.monthlyEmi <= 4900, `Monthly EMI should be ~4805, got ${result.monthlyEmi}`);
  assert.ok(result.totalInterest > 0);
  assert.equal(result.totalRepayment, result.monthlyEmi * 36);
}

// Test 3: 0% Interest edge case
{
  const tenureRes = calculateLoanTenureFromEmi(100000, 0, 5000);
  assert.equal(tenureRes.tenureMonths, 20);
  assert.equal(tenureRes.totalInterest, 0);

  const emiRes = calculateLoanEmiFromTenure(100000, 0, 20);
  assert.equal(emiRes.monthlyEmi, 5000);
  assert.equal(emiRes.totalInterest, 0);
}

// Test 4: Insufficient EMI error handling (EMI < Monthly Interest)
{
  // P = 200,000, r = 12%, monthly interest = 2,000. EMI = 1,500
  const result = calculateLoanTenureFromEmi(200000, 12, 1500);
  assert.equal(result.valid, false);
  assert.ok(result.suggestedMinEmi > 1500);
}

// Test 5: Full Solar Financing calculation matching monthly bill
{
  const fin = calculateSolarFinancing({
    netCost: 160000,
    totalPreSubsidy: 238000,
    subsidy: 78000,
    monthlyBill: 5200,
    monthlySavings: 4800,
    lifetimeSavings: 1500000,
    paymentMode: "loan",
    interestRatePct: 9.5,
  });

  assert.equal(fin.principal, 160000);
  assert.equal(fin.monthlyEmi, 5200);
  assert.ok(fin.tenureYears > 2 && fin.tenureYears < 5);
  assert.ok(fin.freeElectricityYears > 20);
  assert.ok(fin.lifetimeNetGainWithLoan > 1000000);
}

// Test 6: Custom Loan Amount and Down Payment
{
  const fin = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 4000,
    monthlySavings: 3800,
    loanAmountOverride: 150000,
    interestRatePct: 10,
  });

  assert.equal(fin.principal, 150000);
  assert.equal(fin.downPayment, 50000);
  assert.equal(fin.monthlyEmi, 4000);
}

console.log("loanEngine tests passed successfully!");
