// ─── Tariff Profiles per MSEDCL Consumer Category ───────────────────────────
// Based on Comprehensive_MSEDCL_Reference.md & Group_Housing_Solar_Subsidy_Rules.md
// Rates approximate FY 2024-25 MERC tariff order for Pune / Maharashtra.

export const TARIFF_PROFILES = {
  "LT-I": {
    label: "LT-I Residential",
    connectionType: "LT",
    billingUnit: "kWh",
    telescopic: true,
    slabs: [
      { upto: 100, rate: 5.56 },
      { upto: 300, rate: 12.40 },
      { upto: 500, rate: 16.64 },
      { upto: Infinity, rate: 19.13 },
    ],
    fixedChargePerConn: 130,
    fixedChargePerKw: 0,
    meterRent: { "1-phase": 35, "3-phase": 75 },
    dutyRate: 16,
    todRebatePerUnit: 0.80,   // ₹/unit rebate 09:00–17:00
    todRebatePct: null,
    todPeakPenaltyPct: 0,
    bankedEnergyPeakRestricted: false, // Residential can use banked any time
    bankingExemptUptoKw: 10,
    bankingChargePctLT: 12,
    bankingChargePctHT: 7.5,
    subsidyType: "individual",
    pfIncentiveApplicable: false,
  },

  "LT-I-GHS": {
    label: "LT-I Group Housing",
    connectionType: "LT",
    billingUnit: "kWh",
    telescopic: true,
    slabs: [
      { upto: 100, rate: 5.56 },
      { upto: 300, rate: 12.40 },
      { upto: 500, rate: 16.64 },
      { upto: Infinity, rate: 19.13 },
    ],
    fixedChargePerConn: 130,
    fixedChargePerKw: 0,
    meterRent: { "1-phase": 35, "3-phase": 75 },
    dutyRate: 16,
    todRebatePerUnit: 0.80,
    todRebatePct: null,
    todPeakPenaltyPct: 0,
    bankedEnergyPeakRestricted: false,
    bankingExemptUptoKw: 10,
    bankingChargePctLT: 12,
    bankingChargePctHT: 7.5,
    subsidyType: "ghs",       // ₹18,000/kW flat, up to 500kW
    pfIncentiveApplicable: false,
  },

  "LT-II": {
    label: "LT-II Commercial",
    connectionType: "LT",
    billingUnit: "kWh",
    telescopic: false,
    slabs: [
      { upto: Infinity, rate: 13.92 },
    ],
    fixedChargePerKw: 550,
    meterRent: { "1-phase": 35, "3-phase": 75 },
    dutyRate: 21,
    todRebatePerUnit: 0,
    todRebatePct: { summer: 20, winter: 30 }, // % of energy charge
    todPeakPenaltyPct: 25,
    bankedEnergyPeakRestricted: true, // Cannot offset 17:00–24:00 with banked
    bankingExemptUptoKw: 10,
    bankingChargePctLT: 12,
    bankingChargePctHT: 7.5,
    subsidyType: "none",
    pfIncentiveApplicable: false,
  },

  "LT-III": {
    label: "LT-III Industrial",
    connectionType: "LT",
    billingUnit: "kWh",
    telescopic: false,
    slabs: [
      { upto: Infinity, rate: 9.19 },
    ],
    fixedChargePerKw: 420,
    meterRent: { "1-phase": 35, "3-phase": 75 },
    dutyRate: 9.3,
    todRebatePerUnit: 0,
    todRebatePct: { summer: 20, winter: 30 },
    todPeakPenaltyPct: 25,
    bankedEnergyPeakRestricted: true,
    bankingExemptUptoKw: 10,
    bankingChargePctLT: 12,
    bankingChargePctHT: 7.5,
    subsidyType: "none",
    pfIncentiveApplicable: false,
  },

  "LT-AG": {
    label: "LT-AG Agricultural",
    connectionType: "LT",
    billingUnit: "kWh",
    telescopic: false,
    slabs: [
      { upto: Infinity, rate: 4.02 },
    ],
    fixedChargePerKw: 94,
    meterRent: { "1-phase": 0, "3-phase": 0 },
    dutyRate: 9.3,
    todRebatePerUnit: 0,
    todRebatePct: null,
    todPeakPenaltyPct: 0,
    bankedEnergyPeakRestricted: false,
    bankingExemptUptoKw: Infinity,
    bankingChargePctLT: 0,
    bankingChargePctHT: 0,
    subsidyType: "none",
    pfIncentiveApplicable: false,
  },

  "HT-I": {
    label: "HT-I Industrial",
    connectionType: "HT",
    billingUnit: "kVAh",
    telescopic: false,
    slabs: [
      { upto: Infinity, rate: 9.25 },
    ],
    demandChargePerKva: 650,
    fixedChargePerKw: 650,
    meterRent: { "3-phase": 200 },
    dutyRate: 9.3,
    todRebatePerUnit: 0,
    todRebatePct: { summer: 20, winter: 30 },
    todPeakPenaltyPct: 25,
    bankedEnergyPeakRestricted: true,
    bankingExemptUptoKw: 10,
    bankingChargePctLT: 12,
    bankingChargePctHT: 7.5,
    subsidyType: "none",
    pfIncentiveApplicable: true,
  },

  "HT-II": {
    label: "HT-II Commercial",
    connectionType: "HT",
    billingUnit: "kVAh",
    telescopic: false,
    slabs: [
      { upto: Infinity, rate: 14.53 },
    ],
    demandChargePerKva: 650,
    fixedChargePerKw: 650,
    meterRent: { "3-phase": 200 },
    dutyRate: 21,
    todRebatePerUnit: 0,
    todRebatePct: { summer: 20, winter: 30 },
    todPeakPenaltyPct: 25,
    bankedEnergyPeakRestricted: true,
    bankingExemptUptoKw: 10,
    bankingChargePctLT: 12,
    bankingChargePctHT: 7.5,
    subsidyType: "none",
    pfIncentiveApplicable: true,
  },
};

// ─── Discrete Inverter Pricing Catalog ────────────────────────────────────────
// Standard discrete string inverter price list by capacity & connection phase.
// price1: Standard List Price, price2: Cash / Discounted Price.
export const INVERTER_PRICE_CATALOG = [
  // Single Phase (1-Phase)
  { capacityKw: 2.2, phase: "1-phase", label: "2.2Kw Single Phase", price1: 14429, price2: 13944 },
  { capacityKw: 2.7, phase: "1-phase", label: "2.7Kw Single Phase", price1: 14573, price2: 14083 },
  { capacityKw: 3.0, phase: "1-phase", label: "3kw Single Phase",   price1: 14862, price2: 14362 },
  { capacityKw: 3.3, phase: "1-phase", label: "3.3Kw Single Phase", price1: 15006, price2: 14502 },
  { capacityKw: 3.6, phase: "1-phase", label: "3.6Kw Single Phase", price1: 16016, price2: 15478 },
  { capacityKw: 4.0, phase: "1-phase", label: "4Kw Single Phase",   price1: 16449, price2: 15896 },
  { capacityKw: 5.0, phase: "1-phase", label: "5kw Single Phase",   price1: 25683, price2: 24820 },

  // Three Phase (3-Phase)
  { capacityKw: 5.0,   phase: "3-phase", label: "5Kw Three Phase",     price1: 40384,  price2: 39059 },
  { capacityKw: 6.0,   phase: "3-phase", label: "6kw Three Phase",     price1: 41863,  price2: 40490 },
  { capacityKw: 8.0,   phase: "3-phase", label: "8kw Three Phase",     price1: 43490,  price2: 42064 },
  { capacityKw: 10.0,  phase: "3-phase", label: "10kw Three Phase",    price1: 44378,  price2: 42923 },
  { capacityKw: 12.0,  phase: "3-phase", label: "12kw Three Phase",    price1: 45117,  price2: 43638 },
  { capacityKw: 15.0,  phase: "3-phase", label: "15kw Three Phase",    price1: 51653,  price2: 49931 },
  { capacityKw: 18.0,  phase: "3-phase", label: "18kw Three Phase",    price1: 56745,  price2: 54854 },
  { capacityKw: 20.0,  phase: "3-phase", label: "20kw Three Phase",    price1: 60383,  price2: 58370 },
  { capacityKw: 25.0,  phase: "3-phase", label: "25kw Three Phase",    price1: 65475,  price2: 63293 },
  { capacityKw: 33.0,  phase: "3-phase", label: "30/33KW Three Phase", price1: 75951,  price2: 73419 },
  { capacityKw: 35.0,  phase: "3-phase", label: "35KW Three Phase",    price1: 80316,  price2: 77639 },
  { capacityKw: 40.0,  phase: "3-phase", label: "40KW Three Phase",    price1: 98213,  price2: 94939 },
  { capacityKw: 50.0,  phase: "3-phase", label: "50KW Three Phase",    price1: 108398, price2: 104784 },
  { capacityKw: 60.0,  phase: "3-phase", label: "60KW Three Phase",    price1: 122220, price2: 118146 },
  { capacityKw: 80.0,  phase: "3-phase", label: "80KW Three Phase",    price1: 203700, price2: 196910 },
  { capacityKw: 90.0,  phase: "3-phase", label: "90KW Three Phase",    price1: 237505, price2: 229454 },
  { capacityKw: 100.0, phase: "3-phase", label: "100KW Three Phase",   price1: 244658, price2: 236365 },
  { capacityKw: 110.0, phase: "3-phase", label: "110KW Three Phase",   price1: 251812, price2: 243276 },
  { capacityKw: 125.0, phase: "3-phase", label: "125KW Three Phase",   price1: 294735, price2: 284744 },
  { capacityKw: 136.0, phase: "3-phase", label: "136KW Three Phase",   price1: 309042, price2: 298566 },
];

// ─── Default Config (backwards-compatible with existing LT-I Residential) ────

export const DEFAULT_CONFIG = {
  pricing: {
    panelDcrRatePerWp: 25,
    panelNonDcrRatePerWp: 15,
    inverterPriceTier: "price1", // 'price1' (Standard / List Price) or 'price2' (Cash / Discounted Price)
    batteryRatePerWh: 17.5,
    structureRates: {
      hotDip: 6,
      galvalume: 5.3,
      gpPurlin: 4.8,
      ground: 4.5,
    },
    wiringRatePerW: 0,
    installationRatePerW: 2.5,
    consultancyRatePerW: 1,
    contingencyRate: 0,
    marginRate: 30, // Default 30% margin on total component costs incl. of GST
  },
  performance: {
    panelWp: 550,
    panelEfficiency: 21.5,
    dailyGenerationPerKw: 4.2,

    shadingLoss: 5,
    orientationLoss: 4,
    systemLoss: 8,
    degradationRate: 0.5,
    batteryDod: 90,
    inverterEfficiency: 92,
  },
  tariff: {
    financialYear: "FY 2026-27",
    consumerCategory: "LT-I",
    fixedCharge: 130,
    electricityDuty: 7,        // Corrected: 7% per MSEDCL reference (was 16%)
    tariffEscalation: 3,
    slabs: TARIFF_PROFILES["LT-I"].slabs,
  },
  policy: {
    subsidyFirstTwoKw: 30000,
    subsidyNextOneKw: 18000,
    subsidyCap: 78000,
    ghsSubsidyPerKw: 18000,
    ghsSubsidyMaxKw: 500,
    ghsPerFlatCapKw: 3,
    // MNRE 07.06.2024 Guidelines: Special Category States (+10% CFA)
    // Uttarakhand, HP, J&K, Ladakh, NE States (incl. Sikkim), A&N Islands, Lakshadweep
    isSpecialCategoryState: false,
    specialStateSubsidyFirstTwoKw: 33000,
    specialStateSubsidyNextOneKw: 19800,
    specialStateSubsidyCap: 85800,
    specialStateGhsSubsidyPerKw: 19800,
    minElevatedClearanceFt: 8,
    deemedApprovalMaxKw: 10,
  },
  financing: {
    defaultInterestRatePct: 7,
    defaultDownPaymentPct: 10,
    defaultPaymentMode: "upfront", // 'upfront' | 'loan'
  },
};

export const SYSTEM_LABELS = {
  ongrid: "On-grid",
  ongrid_basic_backup: "Semi-hybrid (1100VA)",
  ongrid_standard_backup: "Semi-hybrid (2100VA)",
  hybrid: "Hybrid",
  offgrid: "Off-grid with grid charging",
};

export const PANEL_LABELS = {
  dcr: "DCR Mono PERC",
  nonDcr: "Non-DCR Mono PERC",
  mono_bifacial: "Mono Bifacial",
  dcr_bifacial: "DCR Mono Bifacial",
  nondcr_bifacial: "Non-DCR Mono Bifacial",
  topcon_bifacial: "TOPCon Bifacial",
  dcr_topcon: "DCR TOPCon",
  poly: "Polycrystalline",
};

export const STRUCTURE_LABELS = {
  hotDip: "Hot-dip galvanized elevated (≥ 8 ft clearance)",
  galvalume: "Galvalume (Rooftop / Terrace)",
  gpPurlin: "GP purlin (Rooftop / Balcony)",
  ground: "Ground-mounted (Ineligible for MNRE CFA)",
};

export function getPanelSpecificationText(panelType, customSpec, panelWp = 550, panelMake = "") {
  if (customSpec && typeof customSpec === "string" && customSpec.trim()) {
    return customSpec.trim();
  }
  const wp = panelWp || 550;
  const p = (panelType || "").toLowerCase();
  const prefix = (panelMake && typeof panelMake === "string" && panelMake.trim())
    ? panelMake.trim()
    : "Tier-1";

  if (p === "dcr_bifacial") {
    return `${prefix} DCR Mono Bifacial Glass-to-Glass (${wp} Wp)`;
  }
  if (p === "mono_bifacial" || p === "nondcr_bifacial") {
    return `${prefix} Mono Bifacial (Non-DCR, ${wp} Wp)`;
  }
  if (p === "dcr_topcon") {
    return `${prefix} DCR N-Type TOPCon Bifacial (${wp} Wp)`;
  }
  if (p === "topcon_bifacial") {
    return `${prefix} N-Type TOPCon Bifacial (Non-DCR, ${wp} Wp)`;
  }
  if (p === "poly") {
    return `${prefix} Multi-Crystalline / Polycrystalline (${wp < 400 ? wp : 335} Wp)`;
  }
  if (p === "nondcr" || p === "non_dcr") {
    return `${prefix} Non-DCR Mono PERC (${wp} Wp)`;
  }
  if (p === "dcr") {
    return `${prefix} DCR Mono PERC / TOPCon (${wp} Wp)`;
  }
  return `${prefix} Mono PERC / TOPCon (${wp} Wp)`;
}

