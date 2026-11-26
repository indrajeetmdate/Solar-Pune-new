import assert from "node:assert/strict";
import {
  calculateLoanTenureFromEmi,
  calculateLoanEmiFromTenure,
  calculateSolarFinancing,
  buildLoanScheduleSummary,
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

// Test 7: Dynamic Down Payment Percentage (0%, 10%, 20%, 30%)
{
  // 10% Down Payment
  const fin10 = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5000,
    monthlySavings: 4800,
    paymentMode: "loan",
    downPaymentPct: 10,
    interestRatePct: 7,
  });
  assert.equal(fin10.downPayment, 20000);
  assert.equal(fin10.principal, 180000);
  assert.equal(fin10.downPaymentPct, 10);

  // 20% Down Payment
  const fin20 = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5000,
    monthlySavings: 4800,
    paymentMode: "loan",
    downPaymentPct: 20,
    interestRatePct: 7,
  });
  assert.equal(fin20.downPayment, 40000);
  assert.equal(fin20.principal, 160000);
  assert.equal(fin20.downPaymentPct, 20);

  // 0% Down Payment
  const fin0 = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5000,
    monthlySavings: 4800,
    paymentMode: "loan",
    downPaymentPct: 0,
    interestRatePct: 7,
  });
  assert.equal(fin0.downPayment, 0);
  assert.equal(fin0.principal, 200000);
  assert.equal(fin0.downPaymentPct, 0);
}

// Test 8: Custom Tenure Override works even when Monthly Bill > 0 (Regression Fix)
{
  const finFixed = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5200,
    monthlySavings: 5000,
    paymentMode: "loan",
    downPaymentPct: 10,
    interestRatePct: 7,
    loanTenureMonthsOverride: 84,
  });
  assert.equal(finFixed.tenureMonths, 84, "Custom tenure must override auto bill-match even when monthlyBill > 0");
  assert.equal(finFixed.loanModeType, "custom_tenure");
  assert.ok(finFixed.monthlyEmi > 2500 && finFixed.monthlyEmi < 2900, `84m EMI on 1.8L @7% should be ~2717, got ${finFixed.monthlyEmi}`);
}

// Test 9: 100% Down Payment (Zero Loan Principal) must NOT trigger 60-month fallback
{
  const fin100 = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5200,
    monthlySavings: 5000,
    paymentMode: "loan",
    downPaymentPct: 100,
    interestRatePct: 7,
  });
  assert.equal(fin100.principal, 0);
  assert.equal(fin100.downPayment, 200000);
  assert.equal(fin100.tenureMonths, 0);
  assert.equal(fin100.monthlyEmi, 0);
  assert.equal(fin100.totalInterest, 0);
  assert.equal(fin100.isFallback, false, "Zero principal must not report EMI fallback");
  assert.equal(fin100.freeElectricityYears, 25);
}

// Test 10: Null Interest Rate defaults to 7%, while Explicit 0% Interest computes Rs 0 Interest
{
  const finNullRate = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5000,
    monthlySavings: 4800,
    downPaymentPct: 10,
    interestRatePct: null,
  });
  assert.equal(finNullRate.interestRatePct, 7);
  assert.ok(finNullRate.totalInterest > 0);

  const finZeroRate = calculateSolarFinancing({
    netCost: 200000,
    monthlyBill: 5000,
    monthlySavings: 4800,
    downPaymentPct: 10,
    interestRatePct: 0,
  });
  assert.equal(finZeroRate.interestRatePct, 0);
  assert.equal(finZeroRate.totalInterest, 0);
}

// Test 11: Low-EMI Fallback Diagnostics & Long Tenure Flag
{
  // Principal 270,000 @ 10% -> monthly interest ~2,250. Requested EMI 2,000 triggers fallback.
  const finFallback = calculateSolarFinancing({
    netCost: 300000,
    monthlyBill: 2000,
    monthlySavings: 2000,
    downPaymentPct: 10,
    interestRatePct: 10,
  });
  assert.equal(finFallback.isFallback, true);
  assert.equal(finFallback.tenureMonths, 60);
  assert.equal(finFallback.requestedEmi, 2000);
  assert.ok(finFallback.monthlyInterest >= 2200);
  assert.ok(finFallback.suggestedMinEmi > finFallback.monthlyInterest);

  // Small excess -> tenure > 120 mos -> isLongTenure: true
  const finLong = calculateSolarFinancing({
    netCost: 300000,
    monthlyBill: 2500,
    monthlySavings: 2400,
    downPaymentPct: 10,
    interestRatePct: 10,
  });
  assert.equal(finLong.isFallback, false);
  assert.equal(finLong.isLongTenure, true);
  assert.ok(finLong.tenureMonths > 120);
}

// Test 12: Yearly Loan Amortization Schedule Summary
{
  const emiInfo = calculateLoanEmiFromTenure(180000, 7, 60);
  const rows = buildLoanScheduleSummary(180000, 7, 60, emiInfo.monthlyEmi, 5000);
  assert.equal(rows.length, 5, "60 months must produce 5 annual summary rows");
  assert.equal(rows[0].year, 1);
  assert.equal(rows[0].openingBalance, 180000);
  assert.ok(rows[4].closingBalance <= 60, `Final year closing balance (${rows[4].closingBalance}) should amortize cleanly within EMI rounding`);
  const sumPrincipal = rows.reduce((s, r) => s + r.principalPaid, 0);
  assert.ok(Math.abs((sumPrincipal + rows[4].closingBalance) - 180000) <= 10, `Total principal accounted (${sumPrincipal} + ${rows[4].closingBalance}) must match 180,000`);
}

console.log("loanEngine tests passed successfully! 🎉");
