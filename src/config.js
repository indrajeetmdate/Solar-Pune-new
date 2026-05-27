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
    subsidyType: "individual",
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

// ─── Default Config (backwards-compatible with existing LT-I Residential) ────

export const DEFAULT_CONFIG = {
  pricing: {
    panelDcrRatePerWp: 26,
    panelNonDcrRatePerWp: 17,
    batteryRatePerWh: 17.5,
    structureRates: {
      hotDip: 6,
      galvalume: 5.3,
      gpPurlin: 4.8,
    },
    wiringRatePerW: 3.5,
    installationRatePerW: 4,
    consultancyRatePerW: 3,
    contingencyRate: 3,
  },
  performance: {
    panelWp: 550,
    panelEfficiency: 21.5,
    dailyGenerationPerKw: 4.2,
    sqftPerKw: 120,
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
  dcr: "DCR",
  nonDcr: "Non-DCR",
};

export const STRUCTURE_LABELS = {
  hotDip: "Hot-dip galvanized",
  galvalume: "Galvalume",
  gpPurlin: "GP purlin",
};
