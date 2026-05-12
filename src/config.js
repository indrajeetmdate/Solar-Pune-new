export const DEFAULT_CONFIG = {
  pricing: {
    panelDcrRatePerWp: 26,
    panelNonDcrRatePerWp: 17,
    batteryRatePerWh: 17.5,
    hybridInverterRatePerW: 23,
    offgridInverterRatePerW: 15,
    ongridInverterRatePerW: 8,
    structureRates: {
      hotDip: 6,
      galvalume: 5.3,
      gpPurlin: 4.8,
    },
    wiringRatePerW: 3.5,
    installationRatePerW: 4,
    protectionCost: 12000,
    netMeterCost: 7000,
    consultancyFee: 10000,
    liaisoningFee: 8000,
    gstRate: 13.8,
    contingencyRate: 3,
  },
  performance: {
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
    fixedCharge: 130,
    electricityDuty: 16,
    tariffEscalation: 3,
    slabs: [
      { upto: 100, rate: 5.52 },
      { upto: 300, rate: 10.6 },
      { upto: 500, rate: 13.71 },
      { upto: Infinity, rate: 15.17 },
    ],
  },
  policy: {
    subsidyFirstTwoKw: 30000,
    subsidyNextOneKw: 18000,
    subsidyCap: 78000,
  },
};

export const SYSTEM_LABELS = {
  ongrid: "On-grid",
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
