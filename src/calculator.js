import { DEFAULT_CONFIG } from "./config.js";

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

export function calculateSubsidy(systemType, panelType, dcCapacityKw, policy = DEFAULT_CONFIG.policy) {
  const isGridConnected = systemType === "ongrid" || systemType === "hybrid";
  if (!isGridConnected || panelType !== "dcr" || dcCapacityKw <= 0) {
    return 0;
  }

  const firstBand = Math.min(dcCapacityKw, 2) * policy.subsidyFirstTwoKw;
  const secondBand = Math.min(Math.max(dcCapacityKw - 2, 0), 1) * policy.subsidyNextOneKw;
  return round(Math.min(firstBand + secondBand, policy.subsidyCap), 0);
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

export function recommendCapacity(input, config = DEFAULT_CONFIG) {
  const performanceFactor = calculatePerformanceFactor(config.performance, input);
  const monthlyGenerationPerKw =
    config.performance.dailyGenerationPerKw * 30 * performanceFactor;

  const byConsumption =
    monthlyGenerationPerKw > 0 ? input.monthlyUnits / monthlyGenerationPerKw : 0;
  const byArea =
    config.performance.sqftPerKw > 0 ? input.roofArea / config.performance.sqftPerKw : 0;
  const byLoad = input.sanctionedLoad > 0 ? input.sanctionedLoad : Infinity;

  const recommended = Math.min(byConsumption || 0, byArea || 0, byLoad);
  const rounded = Math.max(1, Math.floor(recommended * 10) / 10);

  return {
    dcCapacityKw: round(rounded, 1),
    byConsumptionKw: round(byConsumption, 1),
    byAreaKw: round(byArea, 1),
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
  const monthlyGeneration = round(
    dcCapacityKw * config.performance.dailyGenerationPerKw * 30 * performanceFactor,
    0,
  );
  const offsetUnits = Math.min(monthlyGeneration, input.monthlyUnits);

  const currentBill = input.monthlyBill > 0
    ? { total: input.monthlyBill }
    : calculateBill(input.monthlyUnits, config.tariff);
  const postSolarBill = calculateBill(Math.max(input.monthlyUnits - offsetUnits, 0), config.tariff);
  const effectiveTariff = input.monthlyUnits > 0
    ? (input.monthlyBill || calculateBill(input.monthlyUnits, config.tariff).total) / input.monthlyUnits
    : 0;

  let monthlySavings;
  if (input.savingsMethod === "effective" || (input.savingsMethod === "auto" && input.monthlyBill > 0)) {
    monthlySavings = Math.min(offsetUnits * effectiveTariff, Math.max(currentBill.total - config.tariff.fixedCharge, 0));
  } else {
    monthlySavings = Math.max(currentBill.total - postSolarBill.total, 0);
  }

  if (systemType === "hybrid" || systemType === "offgrid") {
    monthlySavings *= 0.96;
  }

  const annualSavings = monthlySavings * 12;

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
    panelCost +
    structureCost +
    inverterCost +
    batteryCost +
    wiringCost +
    installationCost +
    protectionCost +
    netMeterCost +
    consultancyCost +
    liaisoningCost;

  const gst = preTaxSubtotal * ((pricing.gstRate || 0) / 100);
  const contingency = preTaxSubtotal * ((pricing.contingencyRate || 0) / 100);
  const totalPreSubsidy = preTaxSubtotal + gst + contingency;
  const subsidy = calculateSubsidy(systemType, panelType, dcCapacityKw, config.policy);
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
    totalPreSubsidy: round(totalPreSubsidy, 0),
    netCost: round(netCost, 0),
    paybackYears: Number.isFinite(paybackYears) ? round(paybackYears, 1) : Infinity,
    roiPercent: round(roiPercent, 1),
    sizing,
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

export function calculatePanelLayout(dcCapacityKw, availableAreaSqft) {
  // Standard panel: 1123mm × 2279mm = 2.559 m² ≈ 27.54 sq ft
  const panelWidthMm = 1123;
  const panelHeightMm = 2279;
  const panelAreaSqm = (panelWidthMm * panelHeightMm) / 1_000_000; // 2.559 m²
  const panelAreaSqft = panelAreaSqm * 10.7639;                     // ≈ 27.54 sq ft
  const panelWp = 550;

  const numPanels = Math.ceil((dcCapacityKw * 1000) / panelWp);
  const totalAreaSqft = round(numPanels * panelAreaSqft, 0);
  const totalAreaSqm = round(numPanels * panelAreaSqm, 1);
  const fitsInArea = availableAreaSqft > 0 ? totalAreaSqft <= availableAreaSqft : null;

  return {
    panelWidthMm,
    panelHeightMm,
    panelWp,
    numPanels,
    totalAreaSqft,
    totalAreaSqm,
    availableAreaSqft: round(availableAreaSqft, 0),
    fitsInArea,
    panelDimensions: `${panelWidthMm} × ${panelHeightMm} mm`,
  };
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
