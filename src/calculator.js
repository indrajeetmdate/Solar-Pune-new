import { DEFAULT_CONFIG, TARIFF_PROFILES } from "./config.js";

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function calculatePerformanceFactor(performance, input = {}) {
  const shading = clamp(performance.shadingLoss || 0, 0, 90) / 100;
  let orientation = clamp(performance.orientationLoss || 0, 0, 90) / 100;
  
  // Apply additional heuristic losses based on orientation if provided
  if (input.orientationDir) {
    const dirLosses = {
      "South": 0,
      "SouthEast": 0.05,
      "SouthWest": 0.05,
      "East": 0.15,
      "West": 0.15,
      "North": 0.30
    };
    const dirLoss = dirLosses[input.orientationDir] || 0;
    // Combine base orientation loss with direction loss
    orientation = clamp(orientation + dirLoss, 0, 0.9);
  }

  // Tilt loss heuristic: assuming ~18 deg is optimal for Pune region
  // For every 10 degrees away from optimal, add ~2% loss
  if (input.tiltAngle !== null && input.tiltAngle !== undefined) {
    const optimalTilt = 18; 
    const diff = Math.abs(input.tiltAngle - optimalTilt);
    const tiltLoss = (diff / 10) * 0.02;
    orientation = clamp(orientation + tiltLoss, 0, 0.9);
  }

  const system = clamp(performance.systemLoss || 0, 0, 90) / 100;
  return round((1 - shading) * (1 - orientation) * (1 - system), 4);
}

export function calculateSubsidy(systemType, panelType, dcCapacityKw, input = {}, policy = DEFAULT_CONFIG.policy) {
  const isGridConnected = systemType === "ongrid" || systemType === "hybrid";
  if (!isGridConnected || panelType !== "dcr" || dcCapacityKw <= 0) {
    return { total: 0, type: "none" };
  }

  const profile = TARIFF_PROFILES[input.consumerCategory] || TARIFF_PROFILES["LT-I"];
  const subsidyType = profile.subsidyType || "individual";

  if (subsidyType === "none") {
    return { total: 0, type: "none" };
  }

  if (subsidyType === "ghs") {
    // GHS: ₹18,000/kW flat, max 500kW, capped by 3kW per flat
    const maxByFlats = (input.numFlats || 100) * (policy.ghsPerFlatCapKw || 3);
    const maxCapacity = Math.min(policy.ghsSubsidyMaxKw || 500, maxByFlats);
    const eligibleKw = Math.min(dcCapacityKw, maxCapacity);
    return { total: round(eligibleKw * (policy.ghsSubsidyPerKw || 18000), 0), type: "ghs" };
  }

  // Individual residential: PM Surya Ghar bands
  const firstBand = Math.min(dcCapacityKw, 2) * policy.subsidyFirstTwoKw;
  const secondBand = Math.min(Math.max(dcCapacityKw - 2, 0), 1) * policy.subsidyNextOneKw;
  return { total: round(Math.min(firstBand + secondBand, policy.subsidyCap), 0), type: "individual" };
}

export function calculateBill(units, tariff = DEFAULT_CONFIG.tariff) {
  const monthlyUnits = Math.max(Number(units) || 0, 0);
  let remaining = monthlyUnits;
  let previousLimit = 0;
  let energyCharge = 0;

  for (const slab of tariff.slabs) {
    if (remaining <= 0) break;

    const slabLimit = Number.isFinite(slab.upto) ? slab.upto : monthlyUnits;
    const slabUnits = Math.min(remaining, slabLimit - previousLimit);
    energyCharge += slabUnits * slab.rate;
    remaining -= slabUnits;
    previousLimit = slabLimit;
  }

  const subtotal = energyCharge + (tariff.fixedCharge || 0);
  const duty = subtotal * ((tariff.electricityDuty || 0) / 100);

  return {
    energyCharge: round(energyCharge, 0),
    fixedCharge: round(tariff.fixedCharge || 0, 0),
    duty: round(duty, 0),
    total: round(subtotal + duty, 0),
  };
}

// ─── Banking / Grid Support Charge Deduction ─────────────────────────────────
// MSEDCL deducts a % of energy INJECTED into the grid (not self-consumed).
// Systems ≤10 kW are fully exempt. LT >10kW = 12%, HT >10kW = 7.5%.
export function calculateBankingDeduction(systemCapacityKw, monthlyGen, selfConsumedUnits, input = {}) {
  const profile = TARIFF_PROFILES[input.consumerCategory] || TARIFF_PROFILES["LT-I"];
  const injected = Math.max(monthlyGen - selfConsumedUnits, 0);
  if (injected <= 0) return { deductedUnits: 0, usableInjected: injected };

  if (systemCapacityKw <= (profile.bankingExemptUptoKw || 10)) {
    return { deductedUnits: 0, usableInjected: injected };
  }

  const pct = profile.connectionType === "HT"
    ? (profile.bankingChargePctHT || 7.5) / 100
    : (profile.bankingChargePctLT || 12) / 100;

  const deducted = round(injected * pct, 0);
  return { deductedUnits: deducted, usableInjected: round(injected - deducted, 0) };
}

// ─── Time-of-Day (ToD) Savings ───────────────────────────────────────────────
// Solar generates during 09:00–17:00 (daytime). Some categories get a rebate
// on energy consumed in this window, and all non-residential pay a penalty
// for 17:00–24:00 (peak). Battery can avoid peak penalty.
export function calculateTodSavings(offsetUnits, energyChargePerUnit, input = {}) {
  const profile = TARIFF_PROFILES[input.consumerCategory] || TARIFF_PROFILES["LT-I"];
  let daytimeRebate = 0;
  let peakPenaltyAvoided = 0;

  // Daytime rebate on behind-the-meter consumption during solar hours
  // Assume ~60% of offset is self-consumed during 09:00–17:00
  const selfConsumedDaytime = offsetUnits * 0.6;

  if (profile.todRebatePerUnit > 0) {
    daytimeRebate = round(selfConsumedDaytime * profile.todRebatePerUnit, 0);
  } else if (profile.todRebatePct) {
    // C&I: percentage of energy charge, averaged summer/winter
    const avgPct = ((profile.todRebatePct.summer || 0) + (profile.todRebatePct.winter || 0)) / 2 / 100;
    daytimeRebate = round(selfConsumedDaytime * energyChargePerUnit * avgPct, 0);
  }

  // Peak penalty avoidance: battery can discharge 17:00–24:00
  // Only relevant for categories with todPeakPenaltyPct > 0 and hybrid/offgrid
  if (profile.todPeakPenaltyPct > 0 && input.backupNeeded) {
    const peakUsagePct = (input.peakHourUsagePct || 30) / 100;
    const peakUnits = input.monthlyUnits * peakUsagePct;
    const batteryCanCover = Math.min(peakUnits, offsetUnits * 0.3); // battery covers ~30% of gen
    peakPenaltyAvoided = round(batteryCanCover * energyChargePerUnit * (profile.todPeakPenaltyPct / 100), 0);
  }

  return { daytimeRebate, peakPenaltyAvoided, totalTod: daytimeRebate + peakPenaltyAvoided };
}

// ─── Power Factor Incentive ──────────────────────────────────────────────────
// HT & LT >20kW billed in kVAh. Smart inverters improve PF → 0.5–3.5% discount.
export function calculatePfIncentive(currentPf, improvedPf, energyCharge, input = {}) {
  const profile = TARIFF_PROFILES[input.consumerCategory] || TARIFF_PROFILES["LT-I"];
  if (!profile.pfIncentiveApplicable) return 0;
  if (!currentPf || currentPf >= 0.95) return 0;

  // Incentive tiers: PF 0.95–0.97 = 0.5%, 0.97–0.99 = 1.5%, 0.99–1.0 = 3.5%
  const targetPf = Math.min(improvedPf || 0.97, 1.0);
  let incentivePct = 0;
  if (targetPf >= 0.99) incentivePct = 3.5;
  else if (targetPf >= 0.97) incentivePct = 1.5;
  else if (targetPf >= 0.95) incentivePct = 0.5;

  return round(energyCharge * (incentivePct / 100), 0);
}

// ─── Prompt Payment Discount ─────────────────────────────────────────────────
// 1% of monthly bill (excluding taxes/duties) if paid within 7 days.
export function calculatePromptPayDiscount(energyCharge, fixedCharge) {
  return round((energyCharge + fixedCharge) * 0.01, 0);
}

export function recommendCapacity(input, config = DEFAULT_CONFIG) {
  const performanceFactor = calculatePerformanceFactor(config.performance, input);
  const monthlyGenerationPerKw =
    config.performance.dailyGenerationPerKw * 30 * performanceFactor;

  let targetUnits = input.monthlyUnits;
  if (input.optimizationStrategy === "summer_proof") {
    // Size for the absolute peak month, assuming 30% higher if no exact history exists
    targetUnits = input.extractedPeakUnits || (input.monthlyUnits * 1.3);
  }

  const byConsumption =
    monthlyGenerationPerKw > 0 ? targetUnits / monthlyGenerationPerKw : 0;
  const byArea =
    config.performance.sqftPerKw > 0 && input.roofArea > 0
      ? input.roofArea / config.performance.sqftPerKw
      : 0;
  const byLoad = input.sanctionedLoad > 0 ? input.sanctionedLoad : Infinity;

  // BUG #1 FIX: Only include constraints that are actively set (> 0).
  // Previously, a blank roofArea (0) would force the recommendation to 0,
  // then Math.max(1, ...) would snap it to 1 kWp regardless of consumption.
  const candidates = [];
  if (byConsumption > 0) candidates.push(byConsumption);
  if (byArea > 0) candidates.push(byArea);
  if (Number.isFinite(byLoad) && byLoad > 0) candidates.push(byLoad);

  const recommended = candidates.length > 0 ? Math.min(...candidates) : 0;
  const rounded = recommended > 0 ? Math.max(0.5, Math.floor(recommended * 10) / 10) : 0;

  return {
    dcCapacityKw: round(rounded, 1),
    byConsumptionKw: round(byConsumption, 1),
    byAreaKw: byArea > 0 ? round(byArea, 1) : null,
    byLoadKw: Number.isFinite(byLoad) ? round(byLoad, 1) : null,
    performanceFactor,
  };
}

function getPanelRate(panelType, pricing) {
  return panelType === "dcr" ? pricing.panelDcrRatePerWp : pricing.panelNonDcrRatePerWp;
}

function getInverterRate(systemType, pricing) {
  if (systemType === "hybrid") return pricing.hybridInverterRatePerW;
  if (systemType === "offgrid") return pricing.offgridInverterRatePerW;
  return pricing.ongridInverterRatePerW;
}

function getBatteryCapacityKwh(systemType, input, performance) {
  if (systemType === "ongrid" || !input.backupNeeded) return 0;
  const dod = clamp(performance.batteryDod || 90, 1, 100) / 100;
  const efficiency = clamp(performance.inverterEfficiency || 92, 1, 100) / 100;
  const required =
    (Math.max(input.backupLoadKw, 0) * Math.max(input.backupHours, 0)) /
    (dod * efficiency);
  return round(Math.max(required, 2), 1);
}

function calculateLifetimeSavings(annualSavings, config) {
  let total = 0;
  const degradation = clamp(config.performance.degradationRate || 0, 0, 10) / 100;
  const escalation = clamp(config.tariff.tariffEscalation || 0, 0, 20) / 100;

  for (let year = 0; year < 25; year += 1) {
    const generationFactor = (1 - degradation) ** year;
    const tariffFactor = (1 + escalation) ** year;
    total += annualSavings * generationFactor * tariffFactor;
  }

  return round(total, 0);
}

export function calculateSystemOption(systemType, panelType, input, config = DEFAULT_CONFIG) {
  const sizing = recommendCapacity(input, config);
  const dcCapacityKw = input.capacityOverride > 0 ? input.capacityOverride : sizing.dcCapacityKw;
  const dcCapacityWp = dcCapacityKw * 1000;
  const inverterCapacityKw =
    input.inverterOverride > 0
      ? input.inverterOverride
      : Math.max(dcCapacityKw, systemType === "ongrid" ? 0 : input.backupLoadKw || 0);
  const inverterCapacityW = inverterCapacityKw * 1000;
  const batteryCapacityKwh = getBatteryCapacityKwh(systemType, input, config.performance);
  const batteryCapacityWh = batteryCapacityKwh * 1000;

  const performanceFactor = calculatePerformanceFactor(config.performance, input);
  let monthlyGeneration = round(
    dcCapacityKw * config.performance.dailyGenerationPerKw * 30 * performanceFactor,
    0,
  );

  // Battery round-trip efficiency loss for hybrid/offgrid
  if (systemType === "hybrid" || systemType === "offgrid") {
    const batteryRoundTrip = (clamp(config.performance.batteryDod || 90, 1, 100) / 100)
      * (clamp(config.performance.inverterEfficiency || 92, 1, 100) / 100);
    const batteryFraction = 0.5;
    const effectiveGenFactor = (1 - batteryFraction) + batteryFraction * batteryRoundTrip;
    monthlyGeneration = round(monthlyGeneration * effectiveGenFactor, 0);
  }

  // Banking deduction: MSEDCL takes % of grid-injected energy
  const selfConsumedEstimate = Math.min(monthlyGeneration, input.monthlyUnits * 0.6);
  const banking = calculateBankingDeduction(dcCapacityKw, monthlyGeneration, selfConsumedEstimate, input);
  const usableGeneration = selfConsumedEstimate + banking.usableInjected;
  const offsetUnits = Math.min(usableGeneration, input.monthlyUnits);

  // Bill calculation
  const modelCurrentBill = calculateBill(input.monthlyUnits, config.tariff);
  const postSolarBill = calculateBill(Math.max(input.monthlyUnits - offsetUnits, 0), config.tariff);

  const userBillForEnergy = input.monthlyBill > 0
    ? Math.max(input.monthlyBill - (config.tariff.fixedCharge || 0), 0)
    : modelCurrentBill.energyCharge;
  const dutyRate = (config.tariff.electricityDuty || 0) / 100;
  const energyOnlyBill = userBillForEnergy / (1 + dutyRate);
  const effectiveTariff = input.monthlyUnits > 0 ? energyOnlyBill / input.monthlyUnits : 0;

  let baseSavings;
  if (input.savingsMethod === "effective" || (input.savingsMethod === "auto" && input.monthlyBill > 0)) {
    const energySaved = offsetUnits * effectiveTariff;
    const dutySaved = energySaved * dutyRate;
    baseSavings = Math.min(energySaved + dutySaved, Math.max(modelCurrentBill.total - (config.tariff.fixedCharge || 0), 0));
  } else {
    baseSavings = Math.max(modelCurrentBill.total - postSolarBill.total, 0);
  }

  // Category-aware bonus savings
  const avgRate = input.monthlyUnits > 0 ? modelCurrentBill.energyCharge / input.monthlyUnits : 0;
  const todSavings = calculateTodSavings(offsetUnits, avgRate, input);
  const pfIncentive = calculatePfIncentive(input.currentPf, input.improvedPf, modelCurrentBill.energyCharge, input);
  const promptPay = calculatePromptPayDiscount(postSolarBill.energyCharge, postSolarBill.fixedCharge);

  const monthlySavings = round(baseSavings + todSavings.totalTod + pfIncentive + promptPay, 0);
  const annualSavings = monthlySavings * 12;

  // Cost breakup
  const pricing = config.pricing;
  const panelCost = dcCapacityWp * getPanelRate(panelType, pricing);
  const structureCost = dcCapacityWp * pricing.structureRates[input.structureType];
  const inverterCost = inverterCapacityW * getInverterRate(systemType, pricing);
  const batteryCost = batteryCapacityWh * pricing.batteryRatePerWh;
  const wiringCost = dcCapacityWp * pricing.wiringRatePerW;
  const installationCost = dcCapacityWp * pricing.installationRatePerW;
  const protectionCost = pricing.protectionCost;
  const netMeterCost = systemType === "offgrid" ? 0 : pricing.netMeterCost;
  const consultancyCost = pricing.consultancyFee;
  const liaisoningCost = systemType === "offgrid" ? 0 : pricing.liaisoningFee;

  const preTaxSubtotal =
    panelCost + structureCost + inverterCost + batteryCost +
    wiringCost + installationCost + protectionCost +
    netMeterCost + consultancyCost + liaisoningCost;

  const gst = preTaxSubtotal * ((pricing.gstRate || 0) / 100);
  const contingency = preTaxSubtotal * ((pricing.contingencyRate || 0) / 100);
  const totalPreSubsidy = preTaxSubtotal + gst + contingency;
  const subsidyResult = calculateSubsidy(systemType, panelType, dcCapacityKw, input, config.policy);
  const subsidy = subsidyResult.total;
  const netCost = Math.max(totalPreSubsidy - subsidy, 0);
  const paybackYears = annualSavings > 0 ? netCost / annualSavings : Infinity;
  const roiPercent = netCost > 0 ? (annualSavings / netCost) * 100 : 0;

  return {
    systemType,
    panelType,
    dcCapacityKw: round(dcCapacityKw, 1),
    inverterCapacityKw: round(inverterCapacityKw, 1),
    batteryCapacityKwh: round(batteryCapacityKwh, 1),
    monthlyGeneration,
    offsetUnits: round(offsetUnits, 0),
    monthlySavings: round(monthlySavings, 0),
    annualSavings: round(annualSavings, 0),
    lifetimeSavings: calculateLifetimeSavings(annualSavings, config),
    subsidy: round(subsidy, 0),
    subsidyType: subsidyResult.type,
    totalPreSubsidy: round(totalPreSubsidy, 0),
    netCost: round(netCost, 0),
    paybackYears: Number.isFinite(paybackYears) ? round(paybackYears, 1) : Infinity,
    roiPercent: round(roiPercent, 1),
    sizing,
    savingsBreakdown: {
      baseSavings: round(baseSavings, 0),
      bankingLoss: round(banking.deductedUnits * avgRate, 0),
      todDaytimeRebate: todSavings.daytimeRebate,
      todPeakAvoided: todSavings.peakPenaltyAvoided,
      pfIncentive: round(pfIncentive, 0),
      promptPayDiscount: round(promptPay, 0),
    },
    costBreakup: {
      panels: round(panelCost, 0),
      structure: round(structureCost, 0),
      inverter: round(inverterCost, 0),
      battery: round(batteryCost, 0),
      wiring: round(wiringCost, 0),
      installation: round(installationCost, 0),
      protection: round(protectionCost, 0),
      netMeter: round(netMeterCost, 0),
      consultancy: round(consultancyCost, 0),
      liaisoning: round(liaisoningCost, 0),
      gst: round(gst, 0),
      contingency: round(contingency, 0),
    },
  };
}

// Helper: Get valid factor pairs avoiding oblong layouts (1*N or N*1)
function getValidFactorPairs(n) {
  const configs = [];
  for (let rows = 1; rows <= n; rows++) {
    if (n % rows !== 0) continue;
    const cols = n / rows;
    // Skip oblong configurations where rows or cols is 1
    if (rows === 1 || cols === 1) continue;
    configs.push({ rows, cols });
  }
  return configs;
}

export function calculatePanelLayout(dcCapacityKw, availableAreaSqft) {
  // Standard panel: 1123mm × 2279mm = 2.559 m² ≈ 27.54 sq ft
  const panelWidthMm = 1123;
  const panelHeightMm = 2279;
  const panelAreaSqm = (panelWidthMm * panelHeightMm) / 1_000_000; // 2.559 m²
  const panelAreaSqft = panelAreaSqm * 10.7639;                     // ≈ 27.54 sq ft
  const panelWp = 550;

  // BUG #9 FIX: Include spacing multiplier for inter-row shading clearance,
  // maintenance walkways, and edge setbacks. Industry standard is ~1.5×.
  // This aligns the area-fit check with the sqftPerKw sizing constraint (~120 sqft/kWp
  // vs raw panel area of ~55 sqft/kWp).
  const spacingMultiplier = 1.5;

  const numPanels = Math.ceil((dcCapacityKw * 1000) / panelWp);
  const panelOnlyAreaSqft = round(numPanels * panelAreaSqft, 0);
  const panelOnlyAreaSqm = round(numPanels * panelAreaSqm, 1);
  const requiredAreaSqft = round(panelOnlyAreaSqft * spacingMultiplier, 0);
  const requiredAreaSqm = round(panelOnlyAreaSqm * spacingMultiplier, 1);
  const fitsInArea = availableAreaSqft > 0 ? requiredAreaSqft <= availableAreaSqft : null;

  return {
    panelWidthMm,
    panelHeightMm,
    panelWp,
    numPanels,
    panelOnlyAreaSqft,
    panelOnlyAreaSqm,
    totalAreaSqft: requiredAreaSqft,
    totalAreaSqm: requiredAreaSqm,
    availableAreaSqft: round(availableAreaSqft, 0),
    fitsInArea,
    panelDimensions: `${panelWidthMm} × ${panelHeightMm} mm`,
  };
}

export function getPanelConfigurations(numPanels) {
  const panelWidthMm = 1123;
  const panelHeightMm = 2279;
  const configs = [];

  for (let rows = 1; rows <= numPanels; rows++) {
    if (numPanels % rows !== 0) continue;
    const cols = numPanels / rows;
    // Skip oblong configurations (1*N or N*1)
    if (rows === 1 || cols === 1) continue;
    const totalWidthMm = cols * panelWidthMm;
    const totalHeightMm = rows * panelHeightMm;
    configs.push({
      rows,
      cols,
      label: `${rows} × ${cols}`,
      totalWidthMm,
      totalHeightMm,
      totalWidthM: round(totalWidthMm / 1000, 2),
      totalHeightM: round(totalHeightMm / 1000, 2),
    });
  }

  // If no valid configs (e.g., prime numbers), create a balanced fallback
  if (configs.length === 0) {
    const rows = Math.ceil(Math.sqrt(numPanels));
    const cols = Math.ceil(numPanels / rows);
    const totalWidthMm = cols * panelWidthMm;
    const totalHeightMm = rows * panelHeightMm;
    configs.push({
      rows,
      cols,
      label: `${rows} × ${cols}`,
      totalWidthMm,
      totalHeightMm,
      totalWidthM: round(totalWidthMm / 1000, 2),
      totalHeightM: round(totalHeightMm / 1000, 2),
    });
  }

  return configs;
}

export function calculateEstimate(input, config = DEFAULT_CONFIG) {
  const panelType = input.panelType || "dcr";
  const options = [
    calculateSystemOption("ongrid", panelType, input, config),
    calculateSystemOption("hybrid", panelType, input, config),
    calculateSystemOption("offgrid", panelType === "dcr" ? "nonDcr" : panelType, input, config),
  ];

  const recommended = chooseRecommendedOption(options, input.goal);
  const sanctionedStatus = getSanctionedStatus(recommended.dcCapacityKw, input.sanctionedLoad);
  const panelLayout = calculatePanelLayout(recommended.dcCapacityKw, input.roofArea || 0);

  return {
    input,
    options,
    recommended,
    sanctionedStatus,
    panelLayout,
  };
}

export function chooseRecommendedOption(options, goal) {
  const finitePayback = (option) => (Number.isFinite(option.paybackYears) ? option.paybackYears : 999);

  if (goal === "backupSupport") {
    return options.find((option) => option.systemType === "hybrid") || options[0];
  }

  if (goal === "lowestUpfront") {
    return [...options].sort((a, b) => a.netCost - b.netCost)[0];
  }

  if (goal === "bestRoi") {
    return [...options].sort((a, b) => b.roiPercent - a.roiPercent)[0];
  }

  return [...options].sort((a, b) => finitePayback(a) - finitePayback(b))[0];
}

export function getSanctionedStatus(dcCapacityKw, sanctionedLoadKw) {
  if (!sanctionedLoadKw || sanctionedLoadKw <= 0) {
    return {
      level: "review",
      label: "Sanctioned load missing",
      message: "Add sanctioned load for grid feasibility review.",
    };
  }

  if (dcCapacityKw <= sanctionedLoadKw) {
    return {
      level: "ok",
      label: "Within sanctioned load",
      message: "Recommended capacity is within the entered sanctioned load.",
    };
  }

  return {
    level: "warn",
    label: "Load enhancement may be needed",
    message: "Recommended capacity is above the entered sanctioned load.",
  };
}
