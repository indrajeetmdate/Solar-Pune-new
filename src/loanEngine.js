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
  downPaymentPct = null,
  downPaymentOverride = null,
  interestRatePct = 7,
  loanMonthlyEmiOverride = null,
  loanTenureMonthsOverride = null,
} = {}) {
  const cleanNetCost = Math.round(Math.max(Number(netCost) || 0, 0));
  const cleanPreSubsidy = Math.round(Math.max(Number(totalPreSubsidy) || cleanNetCost, cleanNetCost));
  const cleanSubsidy = Math.round(Math.max(Number(subsidy) || 0, 0));
  const cleanMonthlyBill = Math.round(Math.max(Number(monthlyBill) || 0, 0));
  const cleanMonthlySavings = Math.round(Math.max(Number(monthlySavings) || 0, 0));
  const hasExplicitRate = interestRatePct !== null && interestRatePct !== undefined && interestRatePct !== "" && Number.isFinite(Number(interestRatePct));
  const cleanRate = hasExplicitRate ? Math.max(0, Number(interestRatePct)) : 7;

  // Loan Principal & Down Payment calculation
  let loanPrincipal = cleanNetCost;
  let downPayment = 0;
  if (loanAmountOverride !== null && loanAmountOverride !== undefined && loanAmountOverride !== "" && !isNaN(loanAmountOverride) && Number(loanAmountOverride) > 0) {
    loanPrincipal = Math.round(Math.max(0, Number(loanAmountOverride)));
    downPayment = Math.max(0, cleanNetCost - loanPrincipal);
  } else if (downPaymentOverride !== null && downPaymentOverride !== undefined && downPaymentOverride !== "" && !isNaN(downPaymentOverride) && Number(downPaymentOverride) >= 0) {
    downPayment = Math.round(Math.min(cleanNetCost, Math.max(0, Number(downPaymentOverride))));
    loanPrincipal = Math.max(0, cleanNetCost - downPayment);
  } else if (downPaymentPct !== null && downPaymentPct !== undefined && downPaymentPct !== "" && !isNaN(downPaymentPct) && Number(downPaymentPct) >= 0) {
    const clampedPct = Math.min(100, Math.max(0, Number(downPaymentPct)));
    downPayment = Math.round(cleanNetCost * (clampedPct / 100));
    loanPrincipal = Math.max(0, cleanNetCost - downPayment);
  } else {
    downPayment = 0;
    loanPrincipal = cleanNetCost;
  }

  let loanResult;
  const hasCustomEmi = loanMonthlyEmiOverride !== null && loanMonthlyEmiOverride !== undefined && loanMonthlyEmiOverride !== "" && Number(loanMonthlyEmiOverride) > 0;
  const hasCustomTenure = loanTenureMonthsOverride !== null && loanTenureMonthsOverride !== undefined && loanTenureMonthsOverride !== "" && Number(loanTenureMonthsOverride) > 0;

  // Target EMI: custom EMI or monthly electricity bill amount (zero out-of-pocket match)
  let targetEmi = cleanMonthlyBill > 0 ? cleanMonthlyBill : cleanMonthlySavings;
  if (hasCustomEmi) {
    targetEmi = Number(loanMonthlyEmiOverride);
  }

  let loanModeType = "auto_bill";
  if (loanPrincipal <= 0) {
    loanModeType = "zero_principal";
    loanResult = {
      tenureMonths: 0,
      tenureYears: 0,
      monthlyEmi: 0,
      principal: 0,
      totalInterest: 0,
      totalRepayment: 0,
      valid: true,
    };
  } else if (hasCustomTenure && !hasCustomEmi) {
    // Explicit loan tenure always computes the required EMI
    loanModeType = "custom_tenure";
    loanResult = calculateLoanEmiFromTenure(loanPrincipal, cleanRate, Number(loanTenureMonthsOverride));
  } else {
    loanModeType = hasCustomEmi ? "custom_emi" : "auto_bill";
    if (targetEmi <= 0) {
      // Fallback: 5-year loan EMI when neither bill nor custom EMI is provided
      targetEmi = calculateLoanEmiFromTenure(loanPrincipal, cleanRate, 60).monthlyEmi;
    }

    loanResult = calculateLoanTenureFromEmi(loanPrincipal, cleanRate, targetEmi);
  }

  // Handle invalid/infinite tenure fallback only when loan principal is positive
  let tenureMonths = loanResult.tenureMonths;
  let tenureYears = loanResult.tenureYears;
  let monthlyEmi = loanResult.monthlyEmi;
  let totalInterest = loanResult.totalInterest;
  let totalRepayment = loanResult.totalRepayment;
  let isFallback = false;

  if (loanPrincipal > 0 && (!loanResult.valid || !Number.isFinite(tenureMonths) || tenureMonths <= 0)) {
    // Default to 5-year (60 mo) standard solar loan when EMI cannot service monthly interest
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
  const monthlyOutflowDuringLoan = loanPrincipal > 0 ? (monthlyEmi + postSolarResidualBill) : postSolarResidualBill;

  // Value proposition metrics
  const freeElectricityYears = Math.max(0, round(25 - tenureYears, 1));
  const cleanLifetimeSavings = lifetimeSavings > 0 ? lifetimeSavings : (cleanMonthlySavings * 12 * 25);

  // 25-Year Net Financial Gain after loan cost vs Upfront
  const totalLoanCost = totalRepayment + downPayment;
  const lifetimeNetGainWithLoan = Math.max(0, Math.round(cleanLifetimeSavings - totalLoanCost));
  const lifetimeNetGainUpfront = Math.max(0, Math.round(cleanLifetimeSavings - cleanNetCost));

  // Determine if it qualifies as "Zero Out-of-Pocket" (monthly EMI is close to or less than current bill)
  const isZeroOutOfPocket = cleanMonthlyBill > 0 && monthlyOutflowDuringLoan <= (cleanMonthlyBill * 1.08);
  const isLongTenure = tenureMonths > 120; // > 10 years exceeds standard solar loan tenures

  const tenureFormatted = tenureMonths <= 0
    ? "Immediate (0 mos)"
    : (tenureYears >= 1
        ? `${tenureYears} yrs (${tenureMonths} mos)`
        : `${tenureMonths} mos`);

  const effectiveDownPaymentPct = (downPaymentPct !== null && downPaymentPct !== undefined && downPaymentPct !== "" && !isNaN(downPaymentPct) && Number(downPaymentPct) >= 0)
    ? Math.min(100, Math.max(0, Number(downPaymentPct)))
    : (cleanNetCost > 0 ? Math.round((downPayment / cleanNetCost) * 100) : 0);

  return {
    paymentMode, // 'upfront' | 'loan'
    loanModeType,
    principal: loanPrincipal,
    downPayment,
    downPaymentPct: effectiveDownPaymentPct,
    interestRatePct: cleanRate,
    monthlyEmi,
    requestedEmi: targetEmi,
    monthlyInterest: loanResult.monthlyInterest || Math.round(loanPrincipal * (cleanRate / (12 * 100))),
    suggestedMinEmi: loanResult.suggestedMinEmi || null,
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
    isLongTenure,
    error: loanResult.error || null,
  };
}

/**
 * Generates a compact year-by-year amortization and solar cashflow schedule.
 */
export function buildLoanScheduleSummary(principal, annualRatePct, tenureMonths, monthlyEmi, monthlySavings = 0) {
  const P = Math.max(Number(principal) || 0, 0);
  const r = Math.max(Number(annualRatePct) || 0, 0);
  const n = Math.max(Math.round(Number(tenureMonths) || 0), 0);
  const E = Math.max(Number(monthlyEmi) || 0, 0);
  const sav = Math.max(Number(monthlySavings) || 0, 0);

  if (P <= 0 || n <= 0 || E <= 0) return [];

  const monthlyRate = r / (12 * 100);
  const totalYears = Math.ceil(n / 12);
  let balance = P;
  const rows = [];

  for (let yr = 1; yr <= totalYears; yr++) {
    const startBal = Math.round(balance);
    let yrInterest = 0;
    let yrPrincipal = 0;
    let yrPaid = 0;
    const startMonth = (yr - 1) * 12 + 1;
    const endMonth = Math.min(yr * 12, n);

    for (let m = startMonth; m <= endMonth; m++) {
      if (balance <= 0) break;
      const interest = balance * monthlyRate;
      const payment = Math.min(E, balance + interest);
      const prin = Math.max(0, payment - interest);
      yrInterest += interest;
      yrPrincipal += prin;
      yrPaid += payment;
      balance = Math.max(0, balance - prin);
    }

    const yrMonths = Math.max(0, endMonth - startMonth + 1);
    rows.push({
      year: yr,
      openingBalance: startBal,
      emiPaid: Math.round(yrPaid),
      principalPaid: Math.round(yrPrincipal),
      interestPaid: Math.round(yrInterest),
      closingBalance: Math.round(balance),
      solarSavings: Math.round(sav * 12),
      monthsActive: yrMonths,
    });
  }

  return rows;
}
