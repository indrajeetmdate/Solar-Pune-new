// ─── Solar Bank Partner Loan Financing Engine ────────────────────────────────
// Models zero out-of-pocket bank loans where EMI = monthly electricity bill amount.

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
};

/**
 * Calculate loan tenure (in months and years) given principal, annual interest rate, and monthly EMI.
 * Formula: n = ln(E / (E - P * i)) / ln(1 + i) where i = r / (12 * 100)
 */
export function calculateLoanTenureFromEmi(principal, annualRatePct, monthlyEmi) {
  const P = Math.max(Number(principal) || 0, 0);
  const r = Math.max(Number(annualRatePct) || 0, 0);
  const E = Math.max(Number(monthlyEmi) || 0, 0);

  if (P <= 0) {
    return {
      tenureMonths: 0,
      tenureYears: 0,
      monthlyEmi: 0,
      principal: 0,
      totalInterest: 0,
      totalRepayment: 0,
      valid: true,
    };
  }

  if (E <= 0) {
    return {
      tenureMonths: 0,
      tenureYears: 0,
      monthlyEmi: 0,
      principal: P,
      totalInterest: 0,
      totalRepayment: P,
      valid: false,
      error: "Monthly EMI must be greater than zero.",
    };
  }

  // 0% interest case
  if (r <= 0) {
    const months = Math.ceil(P / E);
    const years = round(months / 12, 1);
    const repayment = months * E;
    return {
      tenureMonths: months,
      tenureYears: years,
      monthlyEmi: E,
      principal: P,
      totalInterest: 0,
      totalRepayment: repayment,
      valid: true,
    };
  }

  const i = r / (12 * 100);
  const monthlyInterest = P * i;

  // If monthly payment does not cover monthly interest, loan cannot be amortized
  if (E <= monthlyInterest) {
    // Return minimum required EMI for a 7-year (84 months) maximum tenure
    const maxMonths = 84;
    const minEmi = Math.ceil((P * i * ((1 + i) ** maxMonths)) / (((1 + i) ** maxMonths) - 1));
    return {
      tenureMonths: Infinity,
      tenureYears: Infinity,
      monthlyEmi: E,
      principal: P,
      totalInterest: Infinity,
      totalRepayment: Infinity,
      valid: false,
      monthlyInterest: round(monthlyInterest, 0),
      suggestedMinEmi: minEmi,
      error: `Monthly payment (Rs ${Math.round(E)}) is too low to service the monthly interest (Rs ${Math.round(monthlyInterest)}). Minimum suggested EMI is Rs ${minEmi} (for 7-year tenure).`,
    };
  }

  const n = Math.log(E / (E - monthlyInterest)) / Math.log(1 + i);
  const tenureMonths = Math.max(1, Math.ceil(n));
  const tenureYears = round(tenureMonths / 12, 1);
  const totalRepayment = Math.round(E * tenureMonths);
  const totalInterest = Math.max(0, totalRepayment - P);

  return {
    tenureMonths,
    tenureYears,
    monthlyEmi: E,
    principal: P,
    totalInterest,
    totalRepayment,
    valid: true,
  };
}

/**
 * Calculate monthly EMI given principal, annual interest rate, and tenure in months.
 * Formula: E = P * (i * (1 + i)^n) / ((1 + i)^n - 1)
 */
export function calculateLoanEmiFromTenure(principal, annualRatePct, tenureMonths) {
  const P = Math.max(Number(principal) || 0, 0);
  const r = Math.max(Number(annualRatePct) || 0, 0);
  const n = Math.max(Number(tenureMonths) || 0, 0);

  if (P <= 0 || n <= 0) {
    return {
      monthlyEmi: 0,
      tenureMonths: n,
      tenureYears: round(n / 12, 1),
      principal: P,
      totalInterest: 0,
      totalRepayment: P,
      valid: true,
    };
  }

  if (r <= 0) {
    const emi = Math.ceil(P / n);
    return {
      monthlyEmi: emi,
      tenureMonths: n,
      tenureYears: round(n / 12, 1),
      principal: P,
      totalInterest: 0,
      totalRepayment: emi * n,
      valid: true,
    };
  }

  const i = r / (12 * 100);
  const emi = Math.round((P * i * ((1 + i) ** n)) / (((1 + i) ** n) - 1));
  const totalRepayment = emi * n;
  const totalInterest = Math.max(0, totalRepayment - P);

  return {
    monthlyEmi: emi,
    tenureMonths: n,
    tenureYears: round(n / 12, 1),
    principal: P,
    totalInterest,
    totalRepayment,
    valid: true,
  };
}

/**
 * Complete Solar Financing calculation comparing Upfront vs Bank Partner Loan.
 */
export function calculateSolarFinancing({
  netCost = 0,
  totalPreSubsidy = 0,
  subsidy = 0,
  monthlyBill = 0,
  monthlySavings = 0,
  lifetimeSavings = 0,
  paymentMode = "upfront",
  loanAmountOverride = null,
  interestRatePct = 9.5,
  loanMonthlyEmiOverride = null,
  loanTenureMonthsOverride = null,
} = {}) {
  const cleanNetCost = Math.round(Math.max(Number(netCost) || 0, 0));
  const cleanPreSubsidy = Math.round(Math.max(Number(totalPreSubsidy) || cleanNetCost, cleanNetCost));
  const cleanSubsidy = Math.round(Math.max(Number(subsidy) || 0, 0));
  const cleanMonthlyBill = Math.round(Math.max(Number(monthlyBill) || 0, 0));
  const cleanMonthlySavings = Math.round(Math.max(Number(monthlySavings) || 0, 0));
  const cleanRate = Number.isFinite(Number(interestRatePct)) ? Number(interestRatePct) : 9.5;

  // Loan Principal: defaults to net cost (after subsidy) or user override
  let loanPrincipal = cleanNetCost;
  if (loanAmountOverride !== null && loanAmountOverride !== undefined && !isNaN(loanAmountOverride) && Number(loanAmountOverride) > 0) {
    loanPrincipal = Math.round(Math.max(0, Number(loanAmountOverride)));
  }

  const downPayment = Math.max(0, cleanNetCost - loanPrincipal);

  let loanResult;

  if (loanTenureMonthsOverride !== null && loanTenureMonthsOverride !== undefined && Number(loanTenureMonthsOverride) > 0) {
    // Calculate EMI from custom tenure
    loanResult = calculateLoanEmiFromTenure(loanPrincipal, cleanRate, Number(loanTenureMonthsOverride));
  } else {
    // Target EMI: defaults to monthly electricity bill amount (zero extra burden)
    let targetEmi = cleanMonthlyBill > 0 ? cleanMonthlyBill : cleanMonthlySavings;
    if (loanMonthlyEmiOverride !== null && loanMonthlyEmiOverride !== undefined && Number(loanMonthlyEmiOverride) > 0) {
      targetEmi = Number(loanMonthlyEmiOverride);
    }
    if (targetEmi <= 0) {
      // Fallback: 5-year loan EMI
      targetEmi = calculateLoanEmiFromTenure(loanPrincipal, cleanRate, 60).monthlyEmi;
    }

    loanResult = calculateLoanTenureFromEmi(loanPrincipal, cleanRate, targetEmi);
  }

  // Handle invalid/infinite tenure fallback
  let tenureMonths = loanResult.tenureMonths;
  let tenureYears = loanResult.tenureYears;
  let monthlyEmi = loanResult.monthlyEmi;
  let totalInterest = loanResult.totalInterest;
  let totalRepayment = loanResult.totalRepayment;
  let isFallback = false;

  if (!loanResult.valid || !Number.isFinite(tenureMonths) || tenureMonths <= 0) {
    // Default to 5-year (60 mo) standard solar loan
    isFallback = true;
    const fallback = calculateLoanEmiFromTenure(loanPrincipal, cleanRate, 60);
    tenureMonths = fallback.tenureMonths;
    tenureYears = fallback.tenureYears;
    monthlyEmi = fallback.monthlyEmi;
    totalInterest = fallback.totalInterest;
    totalRepayment = fallback.totalRepayment;
  }

  // Post-solar residual bill during loan
  const postSolarResidualBill = Math.max(0, cleanMonthlyBill - cleanMonthlySavings);
  const monthlyOutflowDuringLoan = monthlyEmi + postSolarResidualBill;

  // Value proposition metrics
  const freeElectricityYears = Math.max(0, round(25 - tenureYears, 1));
  const cleanLifetimeSavings = lifetimeSavings > 0 ? lifetimeSavings : (cleanMonthlySavings * 12 * 25);

  // 25-Year Net Financial Gain after loan cost vs Upfront
  const totalLoanCost = totalRepayment + downPayment;
  const lifetimeNetGainWithLoan = Math.max(0, Math.round(cleanLifetimeSavings - totalLoanCost));
  const lifetimeNetGainUpfront = Math.max(0, Math.round(cleanLifetimeSavings - cleanNetCost));

  // Determine if it qualifies as "Zero Out-of-Pocket" (monthly EMI is close to or less than current bill)
  const isZeroOutOfPocket = cleanMonthlyBill > 0 && monthlyOutflowDuringLoan <= (cleanMonthlyBill * 1.08);

  const tenureFormatted = tenureYears >= 1 
    ? `${tenureYears} yrs (${tenureMonths} mos)` 
    : `${tenureMonths} mos`;

  return {
    paymentMode, // 'upfront' | 'loan'
    principal: loanPrincipal,
    downPayment,
    interestRatePct: cleanRate,
    monthlyEmi,
    targetBillAmount: cleanMonthlyBill,
    tenureMonths,
    tenureYears,
    tenureFormatted,
    totalInterest,
    totalRepayment,
    totalLoanCost,
    upfrontNetCost: cleanNetCost,
    totalPreSubsidy: cleanPreSubsidy,
    subsidy: cleanSubsidy,
    monthlySavings: cleanMonthlySavings,
    postSolarResidualBill,
    monthlyOutflowDuringLoan,
    freeElectricityYears,
    lifetimeSavings: cleanLifetimeSavings,
    lifetimeNetGainWithLoan,
    lifetimeNetGainUpfront,
    isZeroOutOfPocket,
    isFallback,
    error: loanResult.error || null,
  };
}
