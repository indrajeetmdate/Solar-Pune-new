import { DEFAULT_CONFIG, TARIFF_PROFILES, PANEL_LABELS, STRUCTURE_LABELS, SYSTEM_LABELS } from "./config.js";
import { calculateEstimate, calculateSolarFinancing, getPanelConfigurations, calculateSingleMeterSubsidy, distributeCapacityAcrossMeters } from "./calculator.js";
import { parseMsebBillFile, parseMultipleMsebBillFiles } from "./billParser.js";
import { isSupportedBillFile } from "./ocrExtractor.js";
import { drawPanelArray, initRooftopCAD, getActiveRooftopCAD } from "./panelDiagram.js";

const INTERNAL_PASSPHRASE_KEY = "puneSolarInternalPassphrase";

const $ = (id) => document.getElementById(id);

const state = {
  internalUnlocked: false,
  activeTab: "system",
  extractedBill: null,
  ongridBackup: "none",
  selectedSystemIndex: null,
  meteringMode: "single",
  meters: [],
  allocationStrategy: "proportional",
};

const ASSUMPTION_IDS = [
  "panelType", "structureType", "capacityOverride", "inverterOverride", "batteryOverride", "backupLoad", "backupHours",
  "panelDcrRate", "panelNonDcrRate", "batteryRate",
  "hotDipStructureRate", "galvalumeStructureRate", "gpPurlinStructureRate", "wiringRate", "installationRate", "consultancyRate",
  "contingencyRate", "marginRate",
  "panelWp", "panelEfficiency",
  "dailyGeneration", "shadingLoss", "orientationLoss", "systemLoss", "degradationRate", "batteryDod", "inverterEfficiency", "selfConsumptionPct",
  "savingsMethod", "fixedCharge", "electricityDuty", "tariffEscalation",
  "slabRate1", "slabRate2", "slabRate3", "slabRate4",
  "internalPaymentMode", "internalLoanInterestRate", "internalLoanAmount", "internalLoanMonthlyEmi", "internalLoanTenureMonths"
];

const PRESETS_STORAGE_KEY = "solar_calculator_presets";

const ids = [
  "customerName",
  "mobileNumber",
  "emailAddress",
  "internalCustomerName",
  "internalMobileNumber",
  "internalEmailAddress",
  "monthlyUnits",
  "monthlyBill",
  "roofArea",
  "sanctionedLoad",
  "consumerCategory",
  "connectionPhase",
  "numFlats",
  "currentPf",
  "peakHourUsagePct",
  "goal",
  "coordinates",
  "tiltAngle",
  "orientationDir",
  "backupNeeded",
  "customerView",
  "paymentMode",
  "internalPaymentMode",
  "loanAmount",
  "internalLoanAmount",
  "loanInterestRate",
  "internalLoanInterestRate",
  "loanMonthlyEmi",
  "internalLoanMonthlyEmi",
  "internalLoanTenureMonths",
  "hideFinancing",
  "panelType",
  "structureType",
  "capacityOverride",
  "inverterOverride",
  "batteryOverride",
  "backupLoad",
  "backupHours",
  "panelDcrRate",
  "panelNonDcrRate",
  "batteryRate",
  "hotDipStructureRate",
  "galvalumeStructureRate",
  "gpPurlinStructureRate",
  "wiringRate",
  "installationRate",
  "consultancyRate",
  "contingencyRate",
  "marginRate",
  "panelWp",
  "panelEfficiency",
  "dailyGeneration",

  "shadingLoss",
  "orientationLoss",
  "systemLoss",
  "degradationRate",
  "batteryDod",
  "inverterEfficiency",
  "selfConsumptionPct",
  "savingsMethod",
  "fixedCharge",
  "electricityDuty",
  "tariffEscalation",
  "slabRate1",
  "slabRate2",
  "slabRate3",
  "slabRate4",
];

function numberValue(id) {
  const el = $(id);
  if (!el) return 0;
  const value = parseFloat(el.value);
  return Number.isFinite(value) ? value : 0;
}

function money(value) {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function units(value) {
  return `${Math.round(value).toLocaleString("en-IN")} units`;
}

function years(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} yrs` : "Review";
}

function plainValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function readInput() {
  const safeStr = (id) => { const el = $(id); return el ? el.value.trim() : ""; };
  const safeChecked = (id) => { const el = $(id); return el ? el.checked : false; };

  const isMulti = state.meteringMode === "multi" && state.meters.length > 0;
  const multiUnits = isMulti ? state.meters.reduce((s, m) => s + (Number(m.monthlyUnits) || 0), 0) : 0;
  const multiBill = isMulti ? state.meters.reduce((s, m) => s + (Number(m.monthlyBill) || 0), 0) : 0;
  const multiLoad = isMulti ? state.meters.reduce((s, m) => s + (Number(m.sanctionedLoad) || 0), 0) : 0;

  return {
    customerName: state.internalUnlocked ? (safeStr("internalCustomerName") || safeStr("customerName")) : safeStr("customerName"),
    mobileNumber: state.internalUnlocked ? (safeStr("internalMobileNumber") || safeStr("mobileNumber")) : safeStr("mobileNumber"),
    emailAddress: state.internalUnlocked ? (safeStr("internalEmailAddress") || safeStr("emailAddress")) : safeStr("emailAddress"),
    customerAddress: safeStr("customerAddress") || "Pune, Maharashtra",
    proposalSerialNo: safeStr("proposalSerialNo") || "DC/2026-27/PROP-1001",
    monthlyUnits: isMulti ? multiUnits : numberValue("monthlyUnits"),
    monthlyBill: isMulti ? multiBill : numberValue("monthlyBill"),
    roofArea: numberValue("roofArea"),
    sanctionedLoad: isMulti ? multiLoad : numberValue("sanctionedLoad"),
    consumerCategory: safeStr("consumerCategory") || "LT-I",
    connectionPhase: safeStr("connectionPhase") || "1-phase",
    numFlats: isMulti ? state.meters.length : numberValue("numFlats"),
    meters: isMulti ? state.meters : null,
    meteringMode: state.meteringMode,
    allocationStrategy: state.allocationStrategy || "proportional",
    currentPf: numberValue("currentPf") || null,
    improvedPf: 0.97,  // Smart inverters typically bring PF to 0.97+
    peakHourUsagePct: numberValue("peakHourUsagePct") || 30,
    goal: safeStr("goal"),
    coordinates: safeStr("coordinates"),
    tiltAngle: safeStr("tiltAngle") !== "" ? numberValue("tiltAngle") : null,
    orientationDir: safeStr("orientationDir"),
    optimizationStrategy: safeStr("optimizationStrategy") || "optimum",
    extractedPeakUnits: state.extractedBill?.fields?.peakUnitsKwh || null,
    charges: (state.extractedBill?.charges && Array.isArray(state.extractedBill.charges) && state.extractedBill.charges.length > 0)
      ? state.extractedBill.charges
      : null,
    backupNeeded: true,
    customerView: false,
    panelType: safeStr("panelType"),
    subsidyCategory: safeStr("subsidyCategory"),
    structureType: safeStr("structureType"),
    capacityOverride: numberValue("capacityOverride"),
    inverterOverride: numberValue("inverterOverride"),
    costOverrides: state.costOverrides || {},
    batteryOverride: numberValue("batteryOverride"),
    backupLoadPercent: numberValue("backupLoad"),
    backupHours: numberValue("backupHours"),
    savingsMethod: safeStr("savingsMethod"),
    ongridBackup: state.ongridBackup,
    paymentMode: state.internalUnlocked
      ? (safeStr("internalPaymentMode") || safeStr("paymentMode") || "upfront")
      : (safeStr("paymentMode") || "upfront"),
    loanAmount: state.internalUnlocked
      ? (numberValue("internalLoanAmount") || numberValue("loanAmount"))
      : numberValue("loanAmount"),
    loanInterestRate: state.internalUnlocked
      ? (numberValue("internalLoanInterestRate") || numberValue("loanInterestRate") || 9.5)
      : (numberValue("loanInterestRate") || 9.5),
    loanMonthlyEmi: state.internalUnlocked
      ? (numberValue("internalLoanMonthlyEmi") || numberValue("loanMonthlyEmi"))
      : numberValue("loanMonthlyEmi"),
    loanTenureMonths: state.internalUnlocked
      ? numberValue("internalLoanTenureMonths")
      : 0,
  };
}

function readConfig() {
  const category = ($("consumerCategory") ? $("consumerCategory").value : "LT-I") || "LT-I";
  const profile = TARIFF_PROFILES[category] || TARIFF_PROFILES["LT-I"];

  // Build slabs: use UI overrides if set, else fall back to profile defaults
  const profileSlabs = profile.slabs || DEFAULT_CONFIG.tariff.slabs;
  const slabs = [];
  for (let i = 0; i < profileSlabs.length; i++) {
    const uiRate = numberValue(`slabRate${i + 1}`);
    slabs.push({ upto: profileSlabs[i].upto, rate: uiRate || profileSlabs[i].rate });
  }
  // If profile has fewer than 4 slabs, pad remaining UI fields to 0
  if (slabs.length === 0) slabs.push({ upto: Infinity, rate: profileSlabs[0]?.rate || 5 });

  return {
    pricing: {
      panelDcrRatePerWp: $("panelDcrRate") && $("panelDcrRate").value !== "" ? numberValue("panelDcrRate") : DEFAULT_CONFIG.pricing.panelDcrRatePerWp,
      panelNonDcrRatePerWp: $("panelNonDcrRate") && $("panelNonDcrRate").value !== "" ? numberValue("panelNonDcrRate") : DEFAULT_CONFIG.pricing.panelNonDcrRatePerWp,
      batteryRatePerWh: $("batteryRate") && $("batteryRate").value !== "" ? numberValue("batteryRate") : DEFAULT_CONFIG.pricing.batteryRatePerWh,
      structureRates: {
        hotDip: $("hotDipStructureRate") && $("hotDipStructureRate").value !== "" ? numberValue("hotDipStructureRate") : DEFAULT_CONFIG.pricing.structureRates.hotDip,
        galvalume: $("galvalumeStructureRate") && $("galvalumeStructureRate").value !== "" ? numberValue("galvalumeStructureRate") : DEFAULT_CONFIG.pricing.structureRates.galvalume,
        gpPurlin: $("gpPurlinStructureRate") && $("gpPurlinStructureRate").value !== "" ? numberValue("gpPurlinStructureRate") : DEFAULT_CONFIG.pricing.structureRates.gpPurlin,
      },
      wiringRatePerW: numberValue("wiringRate"),
      installationRatePerW: $("installationRate") && $("installationRate").value !== "" ? numberValue("installationRate") : DEFAULT_CONFIG.pricing.installationRatePerW,
      consultancyRatePerW: $("consultancyRate") && $("consultancyRate").value !== "" ? numberValue("consultancyRate") : DEFAULT_CONFIG.pricing.consultancyRatePerW,
      contingencyRate: $("contingencyRate") && $("contingencyRate").value !== "" ? numberValue("contingencyRate") : 0,
      marginRate: $("marginRate") && $("marginRate").value !== "" ? numberValue("marginRate") : 30,
    },
    performance: {
      panelWp: numberValue("panelWp") || 550,
      panelEfficiency: numberValue("panelEfficiency") || 21.5,
      dailyGenerationPerKw: numberValue("dailyGeneration"),

      shadingLoss: numberValue("shadingLoss"),
      orientationLoss: numberValue("orientationLoss"),
      systemLoss: numberValue("systemLoss"),
      degradationRate: numberValue("degradationRate"),
      batteryDod: numberValue("batteryDod"),
      inverterEfficiency: numberValue("inverterEfficiency"),
      selfConsumptionPct: numberValue("selfConsumptionPct") || 60,
    },
    tariff: {
      consumerCategory: category,
      fixedCharge: numberValue("fixedCharge") || (profile.fixedChargePerConn !== undefined ? profile.fixedChargePerConn : (profile.fixedChargePerKw * (numberValue("sanctionedLoad") || 5))),
      electricityDuty: numberValue("electricityDuty") || profile.dutyRate || 7,
      tariffEscalation: numberValue("tariffEscalation"),
      slabs,
    },
    policy: DEFAULT_CONFIG.policy,
  };
}

function getGoalReason(goal, option) {
  if (goal === "hybrid") {
    return "Prioritizes backup support while keeping solar savings visible.";
  }
  if (goal === "offgrid") {
    return "Fully independent system prioritizing complete grid independence.";
  }
  if (goal === "ongrid") {
    return "Prioritizes maximum ROI and lowest upfront cost.";
  }
  if (option.subsidy > 0) {
    return "Best payback among compared options with current subsidy assumptions.";
  }
  return "Best payback among compared options.";
}

function getOptionNotes(option, input) {
  const notes = [];

  if (option.systemType === "offgrid") {
    notes.push("Off-grid with grid charging is treated as no-subsidy.");
  } else if (option.panelType === "dcr") {
    notes.push("Subsidy shown only for compliant residential grid-connected DCR systems.");
  } else {
    notes.push("Non-DCR systems are shown without PM Surya Ghar subsidy.");
  }

  if (option.systemType === "hybrid") {
    notes.push("Battery cost is not subsidized; subsidy is considered only on eligible solar capacity.");
  }

  if (option.batteryCapacityKwh > 0) {
    notes.push(`Estimated battery backup: ${option.batteryCapacityKwh} kWh for about ${input.backupHours} hours at ${input.backupLoadPercent}% load.`);
  }

  notes.push("Fixed charges and minimum charges may remain even after solar installation.");
  notes.push("All values are estimates for consultation and should be reviewed before quotation.");

  return notes;
}

function renderComparison(options, recommended) {
  const input = readInput();
  const isLoan = input.paymentMode === "loan";

  $("comparisonRows").innerHTML = options
    .map((option, index) => {
      const isSelected = state.selectedSystemIndex !== null 
        ? state.selectedSystemIndex === index 
        : option.systemType === recommended.systemType;
        
      const selectedClass = isSelected ? "selected-row" : "";
      
      let systemCell = SYSTEM_LABELS[option.systemType] || SYSTEM_LABELS[option.systemType.split('_')[0]];
      
      if (option.systemType === "ongrid" || option.systemType === "ongrid_basic_backup" || option.systemType === "ongrid_standard_backup") {
        const cat = $("consumerCategory")?.value || "LT-I";
        if (cat.startsWith("LT-I")) {
          systemCell = `
            <select class="table-select system-select" onclick="event.stopPropagation()">
              <option value="none" ${state.ongridBackup === 'none' ? 'selected' : ''}>On-grid</option>
              <option value="basic" ${state.ongridBackup === 'basic' ? 'selected' : ''}>Semi-hybrid (1100VA)</option>
              <option value="standard" ${state.ongridBackup === 'standard' ? 'selected' : ''}>Semi-hybrid (2100VA)</option>
            </select>
          `;
        } else {
          systemCell = "On-grid";
        }
      }

      const costDisplay = isLoan && option.financing
        ? `${money(option.netCost)}<br><small style="color:var(--brand-green);font-weight:600;">EMI: ${money(option.financing.monthlyEmi)}/mo</small>`
        : money(option.netCost);

      const savingsDisplay = isLoan && option.financing
        ? `${money(option.financing.monthlyEmi)}<br><small style="color:var(--text-muted);">(EMI)</small>`
        : money(option.monthlySavings);

      const paybackDisplay = isLoan && option.financing
        ? `<span title="Loan Payoff: ${option.financing.tenureFormatted}">${option.financing.tenureFormatted}</span>`
        : years(option.paybackYears);

      return `
        <tr class="${selectedClass}" style="cursor: pointer;" data-index="${index}">
          <td style="text-align: center;"><input type="radio" name="systemSelection" ${isSelected ? 'checked' : ''} style="cursor: pointer;" onclick="event.stopPropagation(); this.closest('tr').click();"></td>
          <td>${systemCell}</td>
          <td>${PANEL_LABELS[option.panelType]}</td>
          <td>${option.inverterCapacityKw} kW</td>
          <td>${option.batteryCapacityKwh > 0 ? option.batteryCapacityKwh + ' kWh' : '—'}</td>
          <td>${costDisplay}</td>
          <td class="subsidy-col">${money(option.subsidy)}</td>
          <td>${savingsDisplay}</td>
          <td class="payback-col">${paybackDisplay}</td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll(".system-select").forEach(select => {
    select.addEventListener("change", (e) => {
      state.ongridBackup = e.target.value;
      render();
    });
  });

  document.querySelectorAll("#comparisonRows tr").forEach(row => {
    row.addEventListener("click", () => {
      state.selectedSystemIndex = parseInt(row.dataset.index, 10);
      render();
    });
  });
}

function renderBreakup(option, input, customerView, config) {
  const isInternal = state.internalUnlocked;
  const sysType = option.systemType;
  const dcWp = option.dcCapacityKw * 1000;
  const costPerWatt = dcWp > 0 ? (option.totalPreSubsidy / dcWp) : 0;
  const exceeds60 = costPerWatt > 60;

  let itemsHtml = "";
  
  if (isInternal) {
    // Use costBreakupList (has computed .value) for display, state.breakupConfig for mutations
    let displayList = option.costBreakupList || [];
    let configList = state.breakupConfig[sysType] || [];

    // Build the default "System Includes" text from visible items
    let visibleLabels = displayList.filter(it => !it.isHidden && !it.isHeader).map(it => it.label);
    let defaultIncludesText = visibleLabels.join(", ") + ", and GST.";
    let currentIncludesText = (state.systemIncludesText && state.systemIncludesText[sysType]) || defaultIncludesText;
    currentIncludesText = currentIncludesText.replace(/,?\s*(?:and\s+)?contingency\.?/gi, "").trim();
    if (!currentIncludesText.endsWith(".")) currentIncludesText += ".";

    // Scope of Work editable textarea
    itemsHtml += `
    <div style="margin-bottom: 10px;">
      <label style="font-size: 12px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 4px;">Scope of Work (shown in report)</label>
      <textarea class="system-includes-text" data-sys="${sysType}" rows="2" style="width: 100%; font-size: 12px; padding: 6px 8px; border: 1px solid var(--line); border-radius: var(--radius); resize: vertical; line-height: 1.4; font-family: inherit;">${currentIncludesText}</textarea>
      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
        <div style="font-size: 12px; font-weight: 700; color: #16a34a; background: #ecfdf5; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #10b981;">• Note: All of the above are in line with MNRE guidelines.</div>
        <div style="font-size: 12px; font-weight: 700; color: #92400e; background: #fffbeb; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #f59e0b;">• Note: Cabling/wiring charges will be at actual length of DC and AC cabling required.</div>
        <div style="font-size: 12px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #3b82f6;">• Note: MSEDCL Net Metering Liaisoning & Discom Documentation Support charges at actuals.</div>
      </div>
    </div>`;

    // Build calculation detail map for each cost item
    const pricing = config?.pricing || {};
    const calcDetails = {};
    const panelRate = input.panelType === 'nonDcr' ? pricing.panelNonDcrRatePerWp : pricing.panelDcrRatePerWp;
    calcDetails['panels'] = `${panelRate} Rs/Wp × ${dcWp.toLocaleString('en-IN')} Wp`;
    const structRate = pricing.structureRates?.[input.structureType] || 0;
    calcDetails['structure'] = `${structRate} Rs/W × ${dcWp.toLocaleString('en-IN')} W`;
    const invKw = option.inverterCapacityKw;
    calcDetails['inverter'] = `${invKw} kW inverter (rate by capacity tier)`;
    if (option.costBreakup.backupInverter > 0) {
      calcDetails['backupInverter'] = `Fixed cost for backup inverter`;
    }
    if (option.costBreakup.battery > 0) {
      const battKwh = option.batteryCapacityKwh;
      calcDetails['battery'] = `${battKwh} kWh × ${pricing.batteryRatePerWh || 0} Rs/Wh`;
    }
    const wiringRateVal = pricing.wiringRatePerW !== undefined && pricing.wiringRatePerW !== null && !isNaN(pricing.wiringRatePerW)
      ? Number(pricing.wiringRatePerW)
      : 0;
    calcDetails['safetyAndEarthing'] = `Earthing, DCDB, ACDB, LA & surge protection`;
    calcDetails['wiringExcludingCable'] = wiringRateVal > 0
      ? `${wiringRateVal} Rs/W × ${dcWp.toLocaleString('en-IN')} W`
      : `0 Rs/W (excluded - cabling at actuals)`;
    calcDetails['electricalSafetyAndWiring'] = wiringRateVal > 0
      ? `${wiringRateVal} Rs/W × ${dcWp.toLocaleString('en-IN')} W + protection`
      : `Protection switchgear only`;
    calcDetails['installation'] = `${pricing.installationRatePerW || 0} Rs/W × ${dcWp.toLocaleString('en-IN')} W`;
    calcDetails['consultancy'] = `${pricing.consultancyRatePerW || 0} Rs/W × ${dcWp.toLocaleString('en-IN')} W`;

    // Compact cost table
    itemsHtml += `<table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
    
    displayList.forEach((item, index) => {
      if (item.isHeader) return;
      let displayVal = item.value || 0;
      let formattedVal = money(displayVal);
      let isOverridden = configList[index]?.isOverride;
      let hiddenStyle = item.isHidden ? 'opacity: 0.45; text-decoration: line-through;' : '';
      let rowBg = index % 2 === 0 ? 'background: var(--bg-alt, #fafafa);' : '';
      let detail = calcDetails[item.id] || '';

      itemsHtml += `
      <tr style="${rowBg}">
        <td style="padding: 5px 6px 0; ${hiddenStyle} vertical-align: top;">
          ${item.label}
          ${detail ? `<div style="font-size: 10px; font-style: italic; color: var(--text-muted); padding: 1px 0 4px; ${isOverridden ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${detail}</div>` : ''}
        </td>
        <td style="padding: 5px 2px 0; text-align: right; width: 85px; vertical-align: top;">
          <input type="number" class="override-value" data-sys="${sysType}" data-idx="${index}" value="${Math.round(displayVal)}"
            style="width: 78px; text-align: right; padding: 3px 4px; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid ${isOverridden ? 'var(--primary)' : 'var(--line)'}; border-radius: 4px; ${item.isHidden ? 'opacity: 0.45;' : ''}">
        </td>
        <td style="padding: 5px 4px 0; text-align: right; font-size: 11px; color: var(--text-muted); width: 72px; ${hiddenStyle} vertical-align: top;">${formattedVal}</td>
        <td style="width: 28px; text-align: center; padding: 0; vertical-align: top;">
          <button class="icon-btn action-btn" data-action="toggle-hide" data-idx="${index}" title="${item.isHidden ? 'Show' : 'Hide'}" style="cursor:pointer; background:none; border:none; padding:2px; font-size: 14px; margin-top: 3px;">${item.isHidden ? '🙈' : '👁️'}</button>
        </td>
      </tr>`;
    });

    let gstVal = state.breakupConfigGst && state.breakupConfigGst[sysType] !== undefined ? state.breakupConfigGst[sysType] : option.costBreakup.gst;
    let contVal = state.breakupConfigContingency && state.breakupConfigContingency[sysType] !== undefined ? state.breakupConfigContingency[sysType] : option.costBreakup.contingency;
    let defaultMarginRate = (config && config.pricing && config.pricing.marginRate !== undefined) ? config.pricing.marginRate : 30;
    let marginPct = (state.breakupConfigMarginPct && state.breakupConfigMarginPct[sysType] !== undefined)
      ? state.breakupConfigMarginPct[sysType]
      : (option.costBreakup.marginRate !== undefined ? option.costBreakup.marginRate : defaultMarginRate);
    let baseCost = option.costBreakup.baseCostInclGst !== undefined
      ? option.costBreakup.baseCostInclGst
      : (displayList.reduce((sum, it) => sum + (it.isHidden || it.isHeader ? 0 : (it.value || 0)), 0) + gstVal + contVal);
    let marginVal = option.costBreakup.margin !== undefined ? option.costBreakup.margin : Math.round(baseCost * (marginPct / 100));

    itemsHtml += `
      <tr style="border-top: 1px solid var(--line);">
        <td style="padding: 5px 6px;">
          GST (${option.costBreakup.effectiveGstRate}%)
          <div style="font-size: 10px; font-style: italic; color: var(--text-muted);">70% goods @ 5% + 30% services @ 18%</div>
        </td>
        <td style="padding: 3px 2px; text-align: right; vertical-align: top;">
          <input type="number" class="override-gst" data-sys="${sysType}" value="${Math.round(gstVal)}"
            style="width: 78px; text-align: right; padding: 3px 4px; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid var(--line); border-radius: 4px;">
        </td>
        <td style="padding: 3px 4px; text-align: right; font-size: 11px; color: var(--text-muted); vertical-align: top;">${money(gstVal)}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding: 5px 6px;">
          Contingency
          <div style="font-size: 10px; font-style: italic; color: var(--text-muted);">${pricing.contingencyRate || 0}% of pre-tax subtotal</div>
        </td>
        <td style="padding: 3px 2px; text-align: right; vertical-align: top;">
          <input type="number" class="override-contingency" data-sys="${sysType}" value="${Math.round(contVal)}"
            style="width: 78px; text-align: right; padding: 3px 4px; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid var(--line); border-radius: 4px;">
        </td>
        <td style="padding: 3px 4px; text-align: right; font-size: 11px; color: var(--text-muted); vertical-align: top;">${money(contVal)}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding: 5px 6px;">
          Margin (${marginPct}%)
          <div style="font-size: 10px; font-style: italic; color: var(--text-muted);">${marginPct}% of total component costs incl. GST</div>
        </td>
        <td style="padding: 3px 2px; text-align: right; vertical-align: top;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 2px;">
            <input type="number" step="0.5" min="0" class="override-margin-pct" data-sys="${sysType}" value="${marginPct}"
              style="width: 58px; text-align: right; padding: 3px 4px; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid var(--line); border-radius: 4px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">%</span>
          </div>
        </td>
        <td style="padding: 3px 4px; text-align: right; font-size: 11px; color: var(--text-muted); vertical-align: top;">${money(marginVal)}</td>
        <td></td>
      </tr>
    </table>`;

    // Totals summary (non-editable)
    itemsHtml += `
    <div style="margin-top: 8px; padding-top: 8px; border-top: 2px solid var(--line); font-size: 13px;">
      <div style="display:flex; justify-content:space-between; margin-bottom: 3px;">
        <span style="font-weight: 600;">Total (Inc. GST & Margin)</span>
        <span style="font-weight: 600;">${money(option.totalPreSubsidy)} <span style="font-size: 11px; font-weight: normal; color: ${exceeds60 ? '#dc2626' : 'var(--text-muted)'};">(₹${costPerWatt.toFixed(1)}/W)</span></span>
      </div>
      <div style="display:flex; justify-content:space-between; margin-bottom: 3px; color: var(--primary);">
        <span>Subsidy</span><span>- ${money(option.subsidy)}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-weight: 700; font-size: 14px; padding-top: 4px; border-top: 1px solid var(--line);">
        <span>Net Customer Cost</span><span>${money(option.netCost)}</span>
      </div>
      ${exceeds60 ? `
      <div class="cost-per-watt-alert" style="margin-top: 8px; padding: 7px 10px; background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 12px; font-weight: 600;">
        ⚠️ Warning: Total cost before subsidy after margin is ₹${costPerWatt.toFixed(1)}/W, exceeding the ₹60/W benchmark!
      </div>` : ''}
    </div>`;
  } else {
    let visibleItems = option.costBreakupList.filter(it => !it.isHidden && !it.isHeader);

    // Use custom system includes text if set, otherwise auto-generate
    let includesText;
    if (state.systemIncludesText && state.systemIncludesText[option.systemType]) {
      includesText = state.systemIncludesText[option.systemType];
    } else {
      includesText = visibleItems.map(it => it.label).join(", ") + ", and GST.";
    }
    includesText = includesText.replace(/,?\s*(?:and\s+)?contingency\.?/gi, "").trim();
    if (!includesText.endsWith(".")) includesText += ".";

    itemsHtml = `<div style="margin-bottom: 12px; font-size: 13px; color: var(--text-light); line-height: 1.4;">
      <strong>Scope of Work:</strong> ${includesText}
      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
        <div style="font-size: 12px; font-weight: 700; color: #16a34a; background: #ecfdf5; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #10b981;">• Note: All of the above are in line with MNRE guidelines.</div>
        <div style="font-size: 12px; font-weight: 700; color: #92400e; background: #fffbeb; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #f59e0b;">• Note: Cabling/wiring charges will be at actual length of DC and AC cabling required.</div>
        <div style="font-size: 12px; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #3b82f6;">• Note: MSEDCL Net Metering Liaisoning & Discom Documentation Support charges at actuals.</div>
      </div>
    </div>`;

    itemsHtml += `<div><dt style="font-weight: bold; color: var(--text);">Total System Cost (Inc. GST)</dt><dd style="font-weight: bold;">${money(option.totalPreSubsidy)}</dd></div>`;
    
    if (!$("hideSubsidy")?.checked) {
      itemsHtml += `<div><dt>Expected Subsidy</dt><dd style="color: var(--primary);">- ${money(option.subsidy)}</dd></div>`;
    }
    
    itemsHtml += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--line);">
      <dt style="font-weight: bold; color: var(--text); font-size: 1.1em;">Net customer cost</dt>
      <dd style="font-weight: bold; font-size: 1.1em;">${money(option.netCost)}</dd>
    </div>`;

    if (exceeds60) {
      itemsHtml += `
      <div class="cost-per-watt-alert" style="margin-top: 10px; padding: 7px 10px; background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 12px; font-weight: 600;">
        ⚠️ Warning: Total cost before subsidy after margin is ₹${costPerWatt.toFixed(1)}/W, exceeding the ₹60/W benchmark!
      </div>`;
    }
  }

  $("costBreakup").innerHTML = itemsHtml;

  if (isInternal) {
    document.querySelectorAll(".override-value").forEach(el => {
      el.addEventListener("change", (e) => {
        let idx = parseInt(e.target.dataset.idx);
        let val = parseFloat(e.target.value);
        if (isNaN(val)) {
          state.breakupConfig[sysType][idx].isOverride = false;
        } else {
          state.breakupConfig[sysType][idx].isOverride = true;
          state.breakupConfig[sysType][idx].overrideValue = val;
        }
        render();
      });
    });
    document.querySelectorAll(".override-gst").forEach(el => {
      el.addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (!state.breakupConfigGst) state.breakupConfigGst = {};
        if (isNaN(val)) delete state.breakupConfigGst[sysType];
        else state.breakupConfigGst[sysType] = val;
        render();
      });
    });
    document.querySelectorAll(".override-contingency").forEach(el => {
      el.addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (!state.breakupConfigContingency) state.breakupConfigContingency = {};
        if (isNaN(val)) delete state.breakupConfigContingency[sysType];
        else state.breakupConfigContingency[sysType] = val;
        render();
      });
    });
    document.querySelectorAll(".override-margin-pct").forEach(el => {
      el.addEventListener("change", (e) => {
        let val = parseFloat(e.target.value);
        if (!state.breakupConfigMarginPct) state.breakupConfigMarginPct = {};
        if (isNaN(val)) delete state.breakupConfigMarginPct[sysType];
        else state.breakupConfigMarginPct[sysType] = val;
        render();
      });
    });
    document.querySelectorAll(".action-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        let btn = e.target.closest("button");
        if (!btn) return;
        let action = btn.dataset.action;
        let idx = parseInt(btn.dataset.idx);
        let list = state.breakupConfig[sysType];

        if (action === "toggle-hide") {
          list[idx].isHidden = !list[idx].isHidden;
        }
        render();
      });
    });
    // System Includes text editor
    document.querySelectorAll(".system-includes-text").forEach(el => {
      el.addEventListener("input", (e) => {
        if (!state.systemIncludesText) state.systemIncludesText = {};
        state.systemIncludesText[e.target.dataset.sys] = e.target.value;
      });
    });
  }
}

function renderFinancing(option, input) {
  const fin = option.financing;
  const container = $("financingBreakdownContent");
  const badge = $("financingStatusBadge");
  const card = $("financingProposalCard");
  const hideFin = $("hideFinancing")?.checked || $("hideCost")?.checked;

  if (card) {
    card.style.display = hideFin ? "none" : "";
  }
  if (!fin || !container) return;

  if (badge) {
    badge.textContent = fin.isZeroOutOfPocket ? "Zero Out-of-Pocket" : "Bank Partner Loan";
    badge.className = fin.isZeroOutOfPocket ? "status-pill" : "status-pill review";
  }

  // Update customer live preview badge in Step 2 if present
  const custPreview = $("customerLoanTenurePreview");
  if (custPreview) {
    custPreview.textContent = `${fin.tenureFormatted} (at ${money(fin.monthlyEmi)}/mo)`;
  }

  // Value proposition hero box
  let html = `
  <div style="background: var(--surface-soft, #eef3ec); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px;">
    <div style="font-weight: 700; color: var(--brand-green, #63923E); font-size: 14px; margin-bottom: 4px;">
      💡 Pay Your Electricity Bill to the Bank &rarr; Free Solar in ${fin.tenureFormatted}
    </div>
    <div style="font-size: 12px; color: var(--ink); line-height: 1.5;">
      ${fin.isZeroOutOfPocket 
        ? `Your regular monthly electricity bill of <strong>${money(fin.targetBillAmount)}/mo</strong> is redirected to pay the loan installment (<strong>${money(fin.monthlyEmi)}/mo</strong>). You incur <strong>₹0 extra monthly burden</strong>, and after <strong>${fin.tenureFormatted}</strong>, the system is 100% paid off, generating pure free electricity for the remaining <strong>${fin.freeElectricityYears} years</strong> of system life!`
        : `Pay <strong>${money(fin.monthlyEmi)}/mo</strong> EMI for <strong>${fin.tenureFormatted}</strong>, after which you enjoy 100% free solar power for the remaining <strong>${fin.freeElectricityYears} years</strong> of system life.`}
    </div>
  </div>`;

  // Comparison Table: Upfront Cash vs Bank Partner Loan
  html += `
  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
    <thead>
      <tr style="border-bottom: 2px solid var(--line); background: var(--surface-alt, #f8f9f7);">
        <th style="text-align: left; padding: 6px 8px;">Commercial Feature</th>
        <th style="text-align: right; padding: 6px 8px;">Option A: Upfront Cash</th>
        <th style="text-align: right; padding: 6px 8px; color: var(--brand-green, #63923E);">Option B: Bank Partner Loan (EMI)</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid var(--line);">
        <td style="padding: 6px 8px;">Upfront Customer Payment</td>
        <td style="text-align: right; padding: 6px 8px; font-weight: 600;">${money(fin.totalPreSubsidy)}</td>
        <td style="text-align: right; padding: 6px 8px; font-weight: 600; color: var(--brand-green);">${money(fin.downPayment)}</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line); background: var(--bg-alt, #fafafa);">
        <td style="padding: 6px 8px;">Loan Principal Amount</td>
        <td style="text-align: right; padding: 6px 8px; color: var(--text-muted);">—</td>
        <td style="text-align: right; padding: 6px 8px;">${money(fin.principal)}</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line);">
        <td style="padding: 6px 8px;">Bank Partner Interest Rate</td>
        <td style="text-align: right; padding: 6px 8px; color: var(--text-muted);">—</td>
        <td style="text-align: right; padding: 6px 8px;">${fin.interestRatePct}% p.a.</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line); background: var(--bg-alt, #fafafa);">
        <td style="padding: 6px 8px; font-weight: 600;">Monthly Installment (EMI)</td>
        <td style="text-align: right; padding: 6px 8px; color: var(--text-muted); font-weight: 600;">₹0 / mo</td>
        <td style="text-align: right; padding: 6px 8px; font-weight: 700; color: var(--brand-green);">${money(fin.monthlyEmi)} / mo</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line);">
        <td style="padding: 6px 8px;">Loan Duration (Payoff Period)</td>
        <td style="text-align: right; padding: 6px 8px; color: var(--text-muted);">Immediate</td>
        <td style="text-align: right; padding: 6px 8px; font-weight: 600;">${fin.tenureFormatted}</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line); background: var(--bg-alt, #fafafa);">
        <td style="padding: 6px 8px;">Total Interest Paid</td>
        <td style="text-align: right; padding: 6px 8px; color: var(--text-muted);">₹0</td>
        <td style="text-align: right; padding: 6px 8px;">${money(fin.totalInterest)}</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line);">
        <td style="padding: 6px 8px;">Total Outflow over Life</td>
        <td style="text-align: right; padding: 6px 8px;">${money(fin.upfrontNetCost)}</td>
        <td style="text-align: right; padding: 6px 8px;">${money(fin.totalLoanCost)}</td>
      </tr>
      <tr style="border-bottom: 1px solid var(--line); background: var(--bg-alt, #fafafa);">
        <td style="padding: 6px 8px; font-weight: 600;">100% Free Solar Years</td>
        <td style="text-align: right; padding: 6px 8px; font-weight: 600;">25.0 yrs</td>
        <td style="text-align: right; padding: 6px 8px; font-weight: 700; color: var(--brand-green);">${fin.freeElectricityYears} yrs</td>
      </tr>
      <tr style="border-top: 2px solid var(--line); font-weight: bold; background: var(--surface-soft, #eef3ec);">
        <td style="padding: 8px;">25-Year Net Financial Gain</td>
        <td style="text-align: right; padding: 8px; color: var(--brand-green);">${money(fin.lifetimeNetGainUpfront)}</td>
        <td style="text-align: right; padding: 8px; color: var(--brand-green);">${money(fin.lifetimeNetGainWithLoan)}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid var(--brand-green, #63923E); border-radius: var(--radius); padding: 12px 14px;">
    <div style="font-weight: 700; color: #166534; font-size: 13.5px; margin-bottom: 5px;">
      💼 Strategic Opportunity Cost & Loan EMI Note (Option B vs Upfront Cash):
    </div>
    <div style="font-size: 12.5px; color: #1e293b; line-height: 1.55;">
      • <strong>Loan EMI vs Current Bill Substitution:</strong> Paying EMI (<strong>${money(fin.monthlyEmi)}/mo</strong>) to the bank instead of current electricity bill payments makes the solar system <strong>100% free in just ${fin.tenureFormatted}</strong>, followed by <strong>${fin.freeElectricityYears} years</strong> of ₹0 electricity bills.<br/>
      • <strong>Save Upfront Cash & Invest in Business (Opportunity Cost):</strong> Preserve <strong>${money(fin.totalPreSubsidy)}</strong> in upfront cash and invest it in your business or commercial expansion (earning 15%–25%+ annual business returns) while your existing electricity bill budget pays off the entire solar power plant!
    </div>
  </div>`;

  container.innerHTML = html;
}

function renderNotes(option, input) {
  $("notesList").innerHTML = getOptionNotes(option, input)
    .map((note) => `<li>${note}</li>`)
    .join("");
}

function renderExtractedBill(result) {
  if (!result) {
    $("billExtractPanel").classList.add("hidden");
    return;
  }

  const { fields, charges, history, warnings, confidence, extractionMethod } = result;
  $("billExtractPanel").classList.remove("hidden");
  $("extractedFileName").textContent = plainValue(fields.fileName);
  $("extractedName").textContent = plainValue(fields.name);
  $("extractedAddress").textContent = plainValue(fields.address);
  $("extractedBillMonth").textContent = plainValue(fields.billMonth);
  $("extractedSanctionLoad").textContent = plainValue(fields.sanctionedLoadKw, " kW");
  $("extractedBillAmount").textContent = fields.billAmountRs ? money(fields.billAmountRs) : "-";
  $("extractedUnits").textContent = fields.unitsConsumedKwh ? `${fields.unitsConsumedKwh} kWh` : "-";
  $("extractedYearlyAvg").textContent = fields.yearlyAvgUnitsKwh ? `${fields.yearlyAvgUnitsKwh} kWh` : "-";

  // Extra fields from Gemini
  const extraEl = $("extractedExtra");
  if (extraEl) {
    let pfText = fields.powerFactor ? `PF: ${fields.powerFactor}` : null;
    if (fields.powerFactor && fields.powerFactor < 0.9) {
      pfText += ` <i class="warning-tip" data-tip="Low power factor (<0.9) incurs PF penalties. APFC panels or Solar inverters can improve this.">!</i>`;
    }
    let mdText = fields.maximumDemandKva ? `MD: ${fields.maximumDemandKva} kVA` : null;
    if (fields.maximumDemandKva && fields.sanctionedLoadKw && fields.maximumDemandKva > fields.sanctionedLoadKw) {
      mdText += ` <i class="warning-tip" data-tip="Maximum demand exceeded sanctioned load. This usually attracts excess demand penalties.">!</i>`;
    }

    const extras = [
      fields.tariffCategory && `Category: ${fields.tariffCategory}`,
      fields.connectionPhase && `Phase: ${fields.connectionPhase}`,
      fields.meterNumber && `Meter: ${fields.meterNumber}`,
      fields.dueDate && `Due: ${fields.dueDate}`,
      pfText,
      mdText,
    ].filter(Boolean);
    extraEl.innerHTML = extras.join(" &middot; ") || "";
    extraEl.classList.toggle("hidden", !extras.length);
  }

  // Charge breakdown table
  const chargeEl = $("extractedChargesTable");
  if (chargeEl && charges && charges.length > 0) {
    chargeEl.classList.remove("hidden");
    const chargeDiv = chargeEl.querySelector("div");
    const rows = charges.map(c => {
      const isNeg = c.amount < 0;
      let label = c.label;
      if (/(penalty|pf penalty|tod penalty|excess)/i.test(label) && c.amount > 0) {
          label += ` <i class="warning-tip" data-tip="This penalty increases your bill. It may be mitigated by load management, APFC, or solar installation.">!</i>`;
      }
      return `<tr class="${isNeg ? 'rebate-row' : ''}">
        <td>${label}</td>
        <td style="text-align:right;font-variant-numeric:tabular-nums;">${isNeg ? '−' : ''}${money(Math.abs(c.amount))}</td>
      </tr>`;
    }).join("");

    const totalRow = fields.billAmountRs
      ? `<tr class="total-row"><td><strong>Current Bill Total</strong></td><td style="text-align:right;"><strong>${money(fields.billAmountRs)}</strong></td></tr>`
      : "";

    if (chargeDiv) {
      chargeDiv.innerHTML = `<table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;padding:4px 6px;border-bottom:2px solid var(--line);">Charge</th><th style="text-align:right;padding:4px 6px;border-bottom:2px solid var(--line);">Amount (₹)</th></tr></thead>
        <tbody>${rows}${totalRow}</tbody>
      </table>`;
    }
  } else if (chargeEl) {
    chargeEl.classList.add("hidden");
    const cd = chargeEl.querySelector("div");
    if (cd) cd.innerHTML = "";
  }

  // Billing history table
  const histEl = $("extractedHistoryTable");
  if (histEl && history && history.length > 0) {
    histEl.classList.remove("hidden");
    const histDiv = histEl.querySelector("div");
    const hRows = history.map(h => `<tr>
      <td>${h.month || '-'}</td>
      <td style="text-align:right;">${h.units != null ? h.units : '-'}</td>
      <td style="text-align:right;">${h.amount != null ? money(h.amount) : '-'}</td>
    </tr>`).join("");

    if (histDiv) {
      histDiv.innerHTML = `<table style="width:100%;font-size:12px;border-collapse:collapse;">
        <thead><tr><th style="text-align:left;padding:4px 6px;border-bottom:2px solid var(--line);">Month</th><th style="text-align:right;padding:4px 6px;border-bottom:2px solid var(--line);">Units</th><th style="text-align:right;padding:4px 6px;border-bottom:2px solid var(--line);">Amount (₹)</th></tr></thead>
        <tbody>${hRows}</tbody>
      </table>`;
    }
  } else if (histEl) {
    histEl.classList.add("hidden");
    const hd = histEl.querySelector("div");
    if (hd) hd.innerHTML = "";
  }

  const methodLabel = extractionMethod === "gemini-structured" ? "Gemini AI" : "Text regex";
  $("billExtractWarnings").textContent = warnings.length
    ? `${confidence}% · ${methodLabel}. ${warnings.join(" ")}`
    : `${confidence}% · ${methodLabel}. All fields detected.`;
}

function applyExtractedBill() {
  const result = state.extractedBill;
  if (!result?.fields) return;
  const fields = result.fields;

  // Reset billConfig so newly extracted bill items take effect
  state.billConfig = {};

  if (fields.name) $("customerName").value = fields.name;
  
  // Prefer the calculated yearly average, fallback to the current month's consumption
  const targetUnits = fields.yearlyAvgUnitsKwh || fields.unitsConsumedKwh;
  if (targetUnits) $("monthlyUnits").value = Math.round(targetUnits);
  if (fields.billAmountRs) $("monthlyBill").value = Math.round(fields.billAmountRs);
  if (fields.sanctionedLoadKw) $("sanctionedLoad").value = fields.sanctionedLoadKw;

  // Auto-set category from extracted tariff
  if (fields.tariffCategory) {
    const cat = $("consumerCategory");
    if (cat) {
      const tc = fields.tariffCategory.toUpperCase();
      if (tc.includes("LT-I") && tc.includes("GHS")) cat.value = "LT-I-GHS";
      else if (tc.includes("LT-I") || tc.includes("RESIDENTIAL")) cat.value = "LT-I";
      else if (tc.includes("LT-II") || tc.includes("COMMERCIAL")) cat.value = "LT-II";
      else if (tc.includes("LT-III") || tc.includes("INDUSTRIAL")) cat.value = "LT-III";
      else if (tc.includes("HT-I")) cat.value = "HT-I";
      else if (tc.includes("HT-II")) cat.value = "HT-II";
      else if (tc.includes("AG")) cat.value = "LT-AG";
      cat.dispatchEvent(new Event("change"));
    }
  }

  // Auto-set power factor if extracted
  if (fields.powerFactor) {
    const pfEl = $("currentPf");
    if (pfEl) pfEl.value = fields.powerFactor;
  }

  render();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateMultiMeterKPIs() {
  const totalMeters = state.meters.length;
  const totalLoad = state.meters.reduce((s, m) => s + (Number(m.sanctionedLoad) || 0), 0);
  const totalUnits = state.meters.reduce((s, m) => s + (Number(m.monthlyUnits) || 0), 0);
  const totalAllocatedKw = round(state.meters.reduce((s, m) => s + (Number(m.allocatedKw) || 0), 0), 2);
  let totalSubsidies = 0;
  state.meters.forEach((m) => {
    totalSubsidies += calculateSingleMeterSubsidy(Number(m.allocatedKw) || 0, m.consumerCategory || "LT-I");
  });

  if ($("mmTotalMetersCount")) $("mmTotalMetersCount").textContent = `${totalMeters} Flats`;
  if ($("mmTotalSanctionedLoad")) $("mmTotalSanctionedLoad").textContent = `${totalLoad} kW`;
  if ($("mmTotalMonthlyUnits")) $("mmTotalMonthlyUnits").textContent = `${totalUnits.toLocaleString('en-IN')} kWh`;
  if ($("mmTotalSubsidies")) $("mmTotalSubsidies").textContent = `₹${totalSubsidies.toLocaleString('en-IN')}`;
  if ($("mmAllocatedKwSum")) $("mmAllocatedKwSum").textContent = `${totalAllocatedKw.toFixed(1)} kW`;

  const targetCapacity = state.estimates?.recommended?.dcCapacityKw || 0;
  if ($("mmSystemSizeTarget")) $("mmSystemSizeTarget").textContent = `${targetCapacity.toFixed(1)} kW`;

  const badge = $("mmAllocationBalanceBadge");
  if (badge) {
    const diff = round(totalAllocatedKw - targetCapacity, 1);
    if (Math.abs(diff) <= 0.05 || targetCapacity === 0) {
      badge.textContent = "Balanced ✓";
      badge.style.background = "#dcfce7";
      badge.style.color = "#15803d";
    } else if (diff > 0) {
      badge.textContent = `⚠️ Over by ${diff.toFixed(1)} kW`;
      badge.style.background = "#fee2e2";
      badge.style.color = "#b91c1c";
    } else {
      badge.textContent = `⚠️ Under by ${Math.abs(diff).toFixed(1)} kW`;
      badge.style.background = "#fef3c7";
      badge.style.color = "#b45309";
    }
  }

  // Check compulsory fields
  let hasIncomplete = false;
  state.meters.forEach((m) => {
    if (!m.consumerNumber || !m.label || !(Number(m.sanctionedLoad) > 0)) {
      hasIncomplete = true;
    }
  });
  const warningEl = $("mmCompulsoryWarning");
  if (warningEl) {
    warningEl.style.display = hasIncomplete && totalMeters > 0 ? "block" : "none";
  }
}

function renderMultiMeterTable() {
  const tbody = $("mmMetersTableBody");
  if (!tbody) return;

  const totalMeters = state.meters.length;

  let totalSubsidies = 0;
  const rowsHtml = state.meters.map((meter) => {
    const isMissingNo = !meter.consumerNumber;
    const isMissingLabel = !meter.label;
    const isMissingLoad = !(Number(meter.sanctionedLoad) > 0);
    const sub = calculateSingleMeterSubsidy(Number(meter.allocatedKw) || 0, meter.consumerCategory || "LT-I");
    totalSubsidies += sub;

    return `
      <tr data-meter-id="${meter.id}" style="border-bottom: 1px solid #e2e8f0; transition: background 0.15s;">
        <td style="padding: 4px 6px;">
          <input type="text" class="mm-input mm-field-label ${isMissingLabel ? 'input-error' : ''}" data-id="${meter.id}" data-field="label" value="${escapeHtml(meter.label || '')}" placeholder="e.g. Flat 101" style="width: 85px; font-size: 11px; padding: 3px 4px; border: 1px solid ${isMissingLabel ? '#ef4444' : '#cbd5e1'}; border-radius: 4px;">
        </td>
        <td style="padding: 4px 6px;">
          <input type="text" class="mm-input mm-field-cons ${isMissingNo ? 'input-error' : ''}" data-id="${meter.id}" data-field="consumerNumber" value="${escapeHtml(meter.consumerNumber || '')}" placeholder="12-digit No." style="width: 95px; font-size: 11px; padding: 3px 4px; border: 1px solid ${isMissingNo ? '#ef4444' : '#cbd5e1'}; border-radius: 4px;">
        </td>
        <td style="padding: 4px 6px;">
          <input type="number" class="mm-input mm-field-load ${isMissingLoad ? 'input-error' : ''}" data-id="${meter.id}" data-field="sanctionedLoad" min="0.5" step="0.5" value="${meter.sanctionedLoad || ''}" placeholder="kW" style="width: 50px; font-size: 11px; padding: 3px 4px; border: 1px solid ${isMissingLoad ? '#ef4444' : '#cbd5e1'}; border-radius: 4px;">
        </td>
        <td style="padding: 4px 6px;">
          <input type="number" class="mm-input mm-field-units" data-id="${meter.id}" data-field="monthlyUnits" min="0" step="1" value="${meter.monthlyUnits || 0}" style="width: 55px; font-size: 11px; padding: 3px 4px; border: 1px solid #cbd5e1; border-radius: 4px;">
        </td>
        <td style="padding: 4px 6px;">
          <input type="number" class="mm-input mm-field-bill" data-id="${meter.id}" data-field="monthlyBill" min="0" step="50" value="${meter.monthlyBill || 0}" style="width: 60px; font-size: 11px; padding: 3px 4px; border: 1px solid #cbd5e1; border-radius: 4px;">
        </td>
        <td style="padding: 4px 6px;">
          <input type="number" class="mm-input mm-field-alloc" data-id="${meter.id}" data-field="allocatedKw" min="0" max="500" step="0.1" value="${meter.allocatedKw || 0}" style="width: 58px; font-size: 11px; padding: 3px 4px; border: 1px solid #38bdf8; border-radius: 4px; font-weight: 600; color: #0284c7;">
        </td>
        <td style="padding: 4px 6px; white-space: nowrap;">
          <span class="mm-subsidy-badge" style="font-size: 10.5px; font-weight: 600; color: #16a34a; background: #dcfce7; padding: 2px 5px; border-radius: 4px;">₹${sub.toLocaleString('en-IN')}</span>
        </td>
        <td style="padding: 4px 4px; text-align: center;">
          <button type="button" class="mm-del-meter-btn" data-id="${meter.id}" title="Remove Flat" style="background: none; border: none; color: #ef4444; font-size: 13px; cursor: pointer; padding: 2px 4px;">✕</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rowsHtml || `<tr><td colspan="8" style="padding: 14px; text-align: center; color: var(--muted); font-style: italic;">No meters added yet. Click "+ Add Flat / Meter" or upload bills above.</td></tr>`;

  updateMultiMeterKPIs();

  // Attach input event listeners
  tbody.querySelectorAll(".mm-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const id = e.target.getAttribute("data-id");
      const field = e.target.getAttribute("data-field");
      const meter = state.meters.find((m) => m.id === id);
      if (meter) {
        if (field === "sanctionedLoad" || field === "monthlyUnits" || field === "monthlyBill" || field === "allocatedKw") {
          meter[field] = Number(e.target.value) || 0;
        } else {
          meter[field] = e.target.value;
        }
        // If editing allocatedKw, update subsidy badge immediately without losing focus
        if (field === "allocatedKw") {
          const row = e.target.closest("tr");
          const subBadge = row?.querySelector(".mm-subsidy-badge");
          const newSub = calculateSingleMeterSubsidy(meter.allocatedKw, meter.consumerCategory || "LT-I");
          if (subBadge) subBadge.textContent = `₹${newSub.toLocaleString('en-IN')}`;
          updateMultiMeterKPIs();
        }
      }
    });

    input.addEventListener("change", () => {
      render();
    });
  });

  tbody.querySelectorAll(".mm-del-meter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      state.meters = state.meters.filter((m) => m.id !== id);
      renderMultiMeterTable();
      render();
    });
  });
}

function setMeteringMode(mode) {
  state.meteringMode = mode;
  const singleBtn = $("meteringModeSingleBtn");
  const multiBtn = $("meteringModeMultiBtn");
  const multiSection = $("multiMeterSection");
  const singleGrid = $("singleMeterInputsGrid");

  if (mode === "multi") {
    singleBtn?.classList.remove("active");
    if (singleBtn) {
      singleBtn.style.background = "transparent";
      singleBtn.style.color = "var(--muted)";
      singleBtn.style.boxShadow = "none";
    }
    multiBtn?.classList.add("active");
    if (multiBtn) {
      multiBtn.style.background = "#ffffff";
      multiBtn.style.color = "var(--ink)";
      multiBtn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
    }
    if (multiSection) multiSection.style.display = "block";
    if (singleGrid) singleGrid.style.display = "none";

    // If no meters exist yet, seed first meter from current single meter inputs
    if (state.meters.length === 0) {
      state.meters.push({
        id: "meter_" + Date.now(),
        label: $("customerName")?.value ? `${$("customerName").value}'s Flat` : "Flat 101",
        consumerNumber: "",
        consumerName: $("customerName")?.value || "",
        sanctionedLoad: Number($("sanctionedLoad")?.value) || 5,
        monthlyUnits: Number($("monthlyUnits")?.value) || 450,
        monthlyBill: Number($("monthlyBill")?.value) || 5200,
        consumerCategory: $("consumerCategory")?.value || "LT-I",
        connectionPhase: $("connectionPhase")?.value || "1-phase",
        allocatedKw: 0,
        subsidy: 0,
      });
    }
    renderMultiMeterTable();
  } else {
    multiBtn?.classList.remove("active");
    if (multiBtn) {
      multiBtn.style.background = "transparent";
      multiBtn.style.color = "var(--muted)";
      multiBtn.style.boxShadow = "none";
    }
    singleBtn?.classList.add("active");
    if (singleBtn) {
      singleBtn.style.background = "#ffffff";
      singleBtn.style.color = "var(--ink)";
      singleBtn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.08)";
    }
    if (multiSection) multiSection.style.display = "none";
    if (singleGrid) singleGrid.style.display = "grid";
  }

  render();
}

function render() {
  const input = readInput();
  const config = readConfig();
  const estimate = calculateEstimate(input, config);
  applyBillConfig(estimate, input);
  applySavingsConfig(estimate, input);
  applyBreakupConfig(estimate, input, config);
  state.estimates = estimate;
  const option = (state.selectedSystemIndex !== null && state.selectedSystemIndex >= 0 && state.selectedSystemIndex < estimate.options.length)
    ? estimate.options[state.selectedSystemIndex]
    : estimate.recommended;

  const isOverride = state.selectedSystemIndex !== null && estimate.options[state.selectedSystemIndex] !== estimate.recommended;
  const reasonText = isOverride ? "Manually selected option." : getGoalReason(input.goal, option);

  $("recommendationTitle").textContent = `${SYSTEM_LABELS[option.systemType] || SYSTEM_LABELS[option.systemType.split('_')[0]]} ${PANEL_LABELS[option.panelType]} solar`;
  $("recommendationReason").textContent = reasonText;
  $("recommendedCapacity").textContent = `${option.dcCapacityKw.toFixed(1)} kWp`;
  $("monthlyGeneration").textContent = units(option.monthlyGeneration);
  
  const isLoan = input.paymentMode === "loan";
  const fin = option.financing;
  if (isLoan && fin) {
    $("monthlySavings").textContent = money(fin.monthlyEmi);
    if ($("monthlySavings")?.previousElementSibling) {
      $("monthlySavings").previousElementSibling.innerHTML = `Loan EMI <i class="info-tip" data-tip="Monthly loan installment to bank partner, matched with your average electricity bill.">i</i>`;
    }
    $("payback").textContent = fin.tenureFormatted;
    if ($("payback")?.previousElementSibling) {
      $("payback").previousElementSibling.innerHTML = `Loan Payoff <i class="info-tip" data-tip="Time to 100% free solar system ownership. After this, your electricity is completely free.">i</i>`;
    }
  } else {
    $("monthlySavings").textContent = money(option.monthlySavings);
    if ($("monthlySavings")?.previousElementSibling) {
      $("monthlySavings").previousElementSibling.innerHTML = `Save/mo <i class="info-tip" data-tip="How much your monthly electricity bill will reduce. Includes tariff savings, ToD rebates, and other applicable benefits.">i</i>`;
    }
    $("payback").textContent = years(option.paybackYears);
    if ($("payback")?.previousElementSibling) {
      $("payback").previousElementSibling.innerHTML = `Payback <i class="info-tip" data-tip="Time to recover your investment. After this period, your solar system generates pure profit through bill savings.">i</i>`;
    }
  }

  // Update sticky header quick-stats ribbon KPIs
  const ribbonCap = $("ribbonCapacity");
  if (ribbonCap) ribbonCap.textContent = `${option.dcCapacityKw.toFixed(1)} kWp`;
  const ribbonSav = $("ribbonSavings");
  if (ribbonSav) ribbonSav.textContent = money(option.monthlySavings);
  const ribbonPay = $("ribbonPayback");
  if (ribbonPay) ribbonPay.textContent = isLoan && fin ? fin.tenureFormatted : years(option.paybackYears);

  // Update Financials tab summary metrics
  const finTotal = $("financialTotalCost");
  if (finTotal) finTotal.textContent = money(option.totalPreSubsidy);
  const finSub = $("financialSubsidy");
  if (finSub) finSub.textContent = `- ${money(option.subsidy)}`;
  const finNet = $("financialNetCost");
  if (finNet) finNet.textContent = money(option.netCost);

  // Check cost per watt limit (> 60 Rs/W)
  const dcWp = option.dcCapacityKw * 1000;
  const costPerWatt = dcWp > 0 ? (option.totalPreSubsidy / dcWp) : 0;
  const costPerWattWarnEl = $("financialCostPerWattWarning");
  const costPerWattMsgEl = $("financialCostPerWattMsg");
  if (costPerWattWarnEl) {
    if (costPerWatt > 60) {
      costPerWattWarnEl.style.display = "block";
      if (costPerWattMsgEl) {
        costPerWattMsgEl.innerHTML = `Total cost before subsidy after margin is <strong>₹${costPerWatt.toFixed(1)}/W</strong>, which exceeds the benchmark of <strong>₹60/W</strong>. Consider adjusting margin or component rates.`;
      }
    } else {
      costPerWattWarnEl.style.display = "none";
    }
  }

  // Update Multi-Meter Financial Subsidy Card if active
  const multiSubCard = $("financialMultiSubsidyCard");
  const multiSubList = $("financialMultiSubsidyList");
  const multiSubCount = $("financialMultiSubsidyCount");

  if (multiSubCard && multiSubList) {
    if (state.meteringMode === "multi" && option.meterBreakdown && option.meterBreakdown.length > 1) {
      multiSubCard.style.display = "block";
      if (multiSubCount) {
        const eligibleCount = option.meterBreakdown.filter((m) => m.subsidy > 0).length;
        multiSubCount.textContent = `${eligibleCount} of ${option.meterBreakdown.length} Flats Eligible for PM Surya Ghar`;
      }
      multiSubList.innerHTML = option.meterBreakdown
        .map((m) => `
          <div style="background: #ffffff; border: 1px solid #dcfce7; border-radius: 6px; padding: 6px 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
              <strong style="font-size: 11.5px; color: var(--ink);">${escapeHtml(m.label || m.consumerName || 'Flat')}</strong>
              <span style="font-size: 11px; font-weight: 600; color: #15803d;">₹${m.subsidy.toLocaleString('en-IN')}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--muted); display: flex; justify-content: space-between;">
              <span>${m.allocatedKw} kWp Allocated</span>
              <span>${m.monthlyUnits} kWh/mo</span>
            </div>
          </div>
        `)
        .join("");
    } else {
      multiSubCard.style.display = "none";
    }
  }

  // Update allocation bar targets in multi-meter panel
  if (state.meteringMode === "multi") {
    updateMultiMeterKPIs();
  }

  $("sanctionStatus").textContent = estimate.sanctionedStatus.label;
  $("sanctionStatus").className = `status-pill ${estimate.sanctionedStatus.level}`;

  const isInstalled = $("solarInstalled")?.checked;
  if (isInstalled) {
    $("recommendationTitle").textContent = `${SYSTEM_LABELS[option.systemType] || SYSTEM_LABELS[option.systemType.split('_')[0]]} ${PANEL_LABELS[option.panelType]} solar`;
    $("recommendedCapacity").previousElementSibling.innerHTML = `Installed capacity <i class="info-tip" data-tip="The capacity of the solar system already installed.">i</i>`;
  } else {
    $("recommendationTitle").textContent = `${SYSTEM_LABELS[option.systemType] || SYSTEM_LABELS[option.systemType.split('_')[0]]} ${PANEL_LABELS[option.panelType]} solar`;
    $("recommendedCapacity").previousElementSibling.innerHTML = `Size <i class="info-tip" data-tip="Recommended solar system capacity in kilowatts peak (kWp). Based on your consumption, roof area, and sanctioned load.">i</i>`;
  }

  // Bill breakdown
  const bbEl = $("billBreakdownPanel");
  if (bbEl && option.currentBillBreakdownList) {
    if (state.internalUnlocked) {
      let html = `<div style="font-weight: 600; margin-bottom: 8px;">Current Bill Breakdown</div><table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
      option.currentBillBreakdownList.forEach((item, index) => {
        let isOverridden = state.billConfig[option.systemType][index]?.isOverride;
        let hiddenStyle = item.isHidden ? 'opacity: 0.45; text-decoration: line-through;' : '';
        let rowBg = index % 2 === 0 ? 'background: var(--bg-alt, #fafafa);' : '';
        let colorStyle = item.isRed && !item.isHidden ? 'color: #d32f2f;' : '';
        
        html += `
        <tr style="${rowBg}">
          <td style="padding: 5px 6px 0; ${hiddenStyle} ${colorStyle}">${item.label}</td>
          <td style="padding: 5px 2px 0; text-align: right; width: 85px;">
            <input type="number" class="override-bill" data-sys="${option.systemType}" data-idx="${index}" value="${Math.round(item.value)}"
              style="width: 78px; text-align: right; padding: 3px 4px; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid ${isOverridden ? 'var(--primary)' : 'var(--line)'}; border-radius: 4px; ${item.isHidden ? 'opacity: 0.45;' : ''} ${colorStyle}">
          </td>
          <td style="padding: 5px 4px 0; text-align: right; font-size: 11px; color: var(--text-muted); width: 72px; ${hiddenStyle}">${money(item.value)}/mo</td>
          <td style="width: 28px; text-align: center; padding: 0;">
            <button class="icon-btn action-btn bill-toggle-hide" data-idx="${index}" data-sys="${option.systemType}" title="${item.isHidden ? 'Show' : 'Hide'}" style="cursor:pointer; background:none; border:none; padding:2px; font-size: 14px; margin-top: 3px;">${item.isHidden ? '👁️' : '🚫'}</button>
          </td>
        </tr>`;
      });
      html += `
        <tr>
          <td style="padding: 8px 6px 4px; font-weight: bold;">Estimated Current Bill</td>
          <td colspan="3" style="padding: 8px 4px 4px; text-align: right; font-weight: bold;">${money(option.currentBillBreakdown.total)}/mo</td>
        </tr>
      </table>`;
      bbEl.innerHTML = html;
      bbEl.classList.remove("hidden");
      
      bbEl.querySelectorAll(".override-bill").forEach(el => {
        el.addEventListener("change", (e) => {
          let sys = e.target.dataset.sys;
          let idx = parseInt(e.target.dataset.idx);
          let val = parseFloat(e.target.value);
          if (!isNaN(val)) {
            state.billConfig[sys][idx].isOverride = true;
            state.billConfig[sys][idx].overrideValue = val;
            render();
          }
        });
      });
      
      bbEl.querySelectorAll(".bill-toggle-hide").forEach(el => {
        el.addEventListener("click", (e) => {
          let btn = e.target.closest("button");
          if (!btn) return;
          let sys = btn.dataset.sys;
          let idx = parseInt(btn.dataset.idx);
          state.billConfig[sys][idx].isHidden = !state.billConfig[sys][idx].isHidden;
          render();
        });
      });
    } else {
      const items = option.currentBillBreakdownList.filter(it => !it.isHidden && it.value !== 0);
      if (items.length > 0) {
        bbEl.classList.remove("hidden");
        let html = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px;">Current Bill Breakdown</div>`;
        html += items.map(item => {
          let colorStyle = item.isRed ? 'color: #d32f2f; font-weight: 500;' : '';
          return `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; ${colorStyle}"><div><span>${item.label}</span></div><div>${money(Math.abs(item.value))}/mo</div></div>`;
        }).join("");
        html += `<div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--line); font-weight: bold;"><div>Total Current Bill</div><div>${money(option.currentBillBreakdown.total)}/mo</div></div>`;
        bbEl.innerHTML = html;
      } else {
        bbEl.classList.add("hidden");
      }
    }
  }

  // Savings breakdown: Possible Savings Breakdown (Solar Offset)
  const sbEl = $("savingsBreakdownPanel");
  if (sbEl && option.savingsBreakdownList) {
    if (state.internalUnlocked) {
      let html = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px;">Possible Savings Breakdown (Solar Offset)</div><table style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
      option.savingsBreakdownList.forEach((item, index) => {
        let isOverridden = state.savingsConfig[option.systemType][index]?.isOverride;
        let hiddenStyle = item.isHidden ? 'opacity: 0.45; text-decoration: line-through;' : '';
        let rowBg = index % 2 === 0 ? 'background: var(--bg-alt, #fafafa);' : '';
        
        html += `
        <tr style="${rowBg}">
          <td style="padding: 5px 6px 0; ${hiddenStyle}">${item.label}</td>
          <td style="padding: 5px 2px 0; text-align: right; width: 85px;">
            <input type="number" class="override-savings" data-sys="${option.systemType}" data-idx="${index}" value="${Math.round(item.value)}"
              style="width: 78px; text-align: right; padding: 3px 4px; font-size: 12px; font-variant-numeric: tabular-nums; border: 1px solid ${isOverridden ? 'var(--primary)' : 'var(--line)'}; border-radius: 4px; ${item.isHidden ? 'opacity: 0.45;' : ''}">
          </td>
          <td style="padding: 5px 4px 0; text-align: right; font-size: 11px; color: var(--text-muted); width: 72px; ${hiddenStyle}">${money(item.value)}/mo</td>
          <td style="width: 28px; text-align: center; padding: 0;">
            <button class="icon-btn action-btn savings-toggle-hide" data-idx="${index}" data-sys="${option.systemType}" title="${item.isHidden ? 'Show' : 'Hide'}" style="cursor:pointer; background:none; border:none; padding:2px; font-size: 14px; margin-top: 3px;">${item.isHidden ? '🙈' : '👁️'}</button>
          </td>
        </tr>`;
      });
      html += `
        <tr>
          <td style="padding: 8px 6px 4px; font-weight: bold;">Total Savings / Month</td>
          <td colspan="3" style="padding: 8px 4px 4px; text-align: right; font-weight: bold; color: var(--brand-green);">${money(option.monthlySavings)}/mo</td>
        </tr>
      </table>`;
      sbEl.innerHTML = html;
      sbEl.classList.remove("hidden");
      
      sbEl.querySelectorAll(".override-savings").forEach(el => {
        el.addEventListener("change", (e) => {
          let sys = e.target.dataset.sys;
          let idx = parseInt(e.target.dataset.idx);
          let val = parseFloat(e.target.value);
          if (isNaN(val)) {
            state.savingsConfig[sys][idx].isOverride = false;
          } else {
            state.savingsConfig[sys][idx].isOverride = true;
            state.savingsConfig[sys][idx].overrideValue = val;
          }
          render();
        });
      });
      
      sbEl.querySelectorAll(".savings-toggle-hide").forEach(el => {
        el.addEventListener("click", (e) => {
          let btn = e.target.closest("button");
          if (!btn) return;
          let sys = btn.dataset.sys;
          let idx = parseInt(btn.dataset.idx);
          state.savingsConfig[sys][idx].isHidden = !state.savingsConfig[sys][idx].isHidden;
          render();
        });
      });
    } else {
      const tipMap = {
        "Energy Charges Offset": "Direct slab-wise energy charge reduction from solar generation.",
        "Electricity Duty Offset": "Avoided state electricity duty on self-generated solar units.",
        "Wheeling & Fuel Adjustment (FAC) Offset": "Avoided DISCOM wheeling and fuel adjustment charges.",
        "ToD Daytime Solar Generation Credit": "Solar generates during daytime peak hours (09:00–17:00), earning ToD tariff rebates from MSEDCL.",
        "Peak penalty avoided": "Battery discharges during expensive peak hours (5PM-10PM), avoiding the highest tariff rates.",
        "PF improvement": "Smart inverters improve your Power Factor, earning a discount from MSEDCL on your bill.",
        "Prompt pay discount": "1% discount for paying your reduced bill on time. Solar makes this easier with lower bills.",
        "Banking loss": "MSEDCL charges a grid-support fee on excess solar units exported to the grid.",
      };
      const items = option.savingsBreakdownList.filter(it => !it.isHidden && it.value > 0);
      if (items.length > 0) {
        sbEl.classList.remove("hidden");
        let html = `<div style="font-weight: 600; margin-bottom: 8px; font-size: 13px;">Possible Savings Breakdown (Solar Offset)</div>`;
        html += items
          .map(item => {
            const tip = tipMap[item.label] || "";
            const icon = tip ? ` <i class="info-tip" data-tip="${tip}">i</i>` : "";
            return `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><div><span style="font-weight: 600;">${item.label}</span>${icon}</div><div>+${money(item.value)}/mo</div></div>`;
          })
          .join("");
        html += `<div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px dashed var(--line); font-weight: bold;"><div>Total Savings / Month</div><div style="color: var(--brand-green);">${money(option.monthlySavings)}/mo</div></div>`;
        sbEl.innerHTML = html;
      } else {
        sbEl.classList.add("hidden");
      }
    }
  }

  // Panel layout
  const pl = estimate.panelLayout;
  if ($("panelCount")) $("panelCount").textContent = `${pl.numPanels} panels`;
  if ($("panelAreaRequired")) $("panelAreaRequired").textContent = `${pl.totalAreaSqft} sq ft (${pl.totalAreaSqm} m²)`;
  if ($("panelSpec")) $("panelSpec").textContent = `${pl.panelDimensions} · ${pl.panelWp} Wp`;
  if ($("areaFitStatus")) {
    if (pl.fitsInArea === null) {
      $("areaFitStatus").textContent = "Area not specified";
      $("areaFitStatus").className = "status-pill review";
    } else if (pl.fitsInArea) {
      $("areaFitStatus").textContent = `Fits in ${pl.availableAreaSqft} sq ft`;
      $("areaFitStatus").className = "status-pill";
    } else {
      const deficit = pl.totalAreaSqft - pl.availableAreaSqft;
      $("areaFitStatus").textContent = `Needs ${deficit} sq ft more`;
      $("areaFitStatus").className = "status-pill warn";
    }
  }

  renderComparison(estimate.options, option);
  renderBreakup(option, input, input.customerView, config);
  renderFinancing(option, input);
  renderNotes(option, input);
  renderExtractedBill(state.extractedBill);
  renderDiagram(pl, input);

  // Sync Proposal Preview Card: Prepared For (To)
  if ($("proposalToCustomerName")) {
    $("proposalToCustomerName").textContent = input.customerName || "Valued Customer";
  }
  if ($("proposalToCustomerAddress")) {
    $("proposalToCustomerAddress").textContent = input.customerAddress || "Pune, Maharashtra";
  }
  if ($("proposalToCustomerPhone")) {
    $("proposalToCustomerPhone").textContent = input.mobileNumber || "—";
  }
  if ($("proposalToCustomerLoad")) {
    $("proposalToCustomerLoad").textContent = `${input.sanctionedLoad || 5} kW`;
  }
  if ($("proposalToCustomerCategory")) {
    $("proposalToCustomerCategory").textContent = input.consumerCategory || "LT-I Residential";
  }
  if ($("proposalToCustomerUnits")) {
    $("proposalToCustomerUnits").textContent = `${input.monthlyUnits || 450} units`;
  }

  // Report Display: toggle visibility of optional sections
  const hidePayback = $("hidePayback")?.checked || $("hideCost")?.checked;
  const hideAreaFit = $("hideAreaFit")?.checked;
  const hideSubsidy = $("hideSubsidy")?.checked;
  const hideFinancing = $("hideFinancing")?.checked || $("hideCost")?.checked;
  
  if ($("costBreakup")?.closest("details")) {
    $("costBreakup").closest("details").style.display = $("hideCost")?.checked ? "none" : "";
  }

  if ($("financingProposalCard")) {
    $("financingProposalCard").style.display = hideFinancing ? "none" : "";
  }

  // Payback card in summary metrics
  if ($("paybackCard")) $("paybackCard").style.display = hidePayback ? "none" : "";
  // Payback column in comparison table
  document.querySelectorAll(".payback-col").forEach(el => el.style.display = hidePayback ? "none" : "");

  // Area fit status pill
  if ($("areaFitStatus")) $("areaFitStatus").style.display = hideAreaFit ? "none" : "";

  // Subsidy column in comparison table + subsidy row in cost breakup
  document.querySelectorAll(".subsidy-col").forEach(el => el.style.display = hideSubsidy ? "none" : "");
}

let cadListenersAttached = false;

function renderLayersPanel(cad, state) {
  const container = $("cadLayersList");
  if (!container || !state) return;

  const totalLayersCount = $("cadLayersTotalCount");
  if (totalLayersCount) {
    const activeElements =
      (state.cutouts?.length || 0) +
      (state.pathways?.length || 0) +
      (state.panelsCount || 0) +
      (state.imageLoaded ? 1 : 0) +
      1;
    totalLayersCount.textContent = `${state.order.length} Layers (${activeElements} items)`;
  }

  // Display topmost layer at the top of the stack (standard CAD hierarchy)
  const displayOrder = [...state.order].reverse();

  let html = "";

  displayOrder.forEach((layerName) => {
    const isVisible = state.visible[layerName] !== false;
    const opacity = state.opacity[layerName] ?? 1.0;
    const opacityPercent = Math.round(opacity * 100);

    let layerIcon = "📄";
    let layerTitle = layerName;
    let countBadge = "";
    let itemsHtml = "";
    let isLayerActive = false;

    if (layerName === "panels") {
      layerIcon = "☀️";
      layerTitle = "Solar Panels";
      countBadge = `${state.panelsCount} placed`;
      isLayerActive = state.selectedItem && state.selectedItem.type === "panel";

      if (state.panels && state.panels.length > 0) {
        itemsHtml = state.panels
          .map((p) => {
            const isItemActive = cad.isSelected ? cad.isSelected("panel", p) : (state.selectedItem && state.selectedItem.id === p.id);
            const pOpPercent = Math.round((p.opacity ?? 1.0) * 100);
            return `
              <div class="cad-component-row ${isItemActive ? "active" : ""}" data-comp-type="panel" data-comp-id="${p.id}" title="Click to select on canvas">
                <div class="cad-component-info">
                  <span>☀️</span>
                  <span>Panel #${p.index}</span>
                  <span style="color: #64748b; font-size: 10px;">(${pOpPercent}%)</span>
                </div>
                <div class="cad-component-actions">
                  <button type="button" class="cad-layer-btn comp-move-up-btn" data-type="panel" data-id="${p.id}" title="Move Up in stack">▲</button>
                  <button type="button" class="cad-layer-btn comp-move-down-btn" data-type="panel" data-id="${p.id}" title="Move Down in stack">▼</button>
                  <button type="button" class="cad-layer-btn comp-del-btn" data-type="panel" data-id="${p.id}" style="color: #f87171;" title="Delete & return to latent pool">✕</button>
                </div>
              </div>
            `;
          })
          .join("");
      } else {
        itemsHtml = `<div style="font-size: 10.5px; color: #64748b; padding: 4px 6px; font-style: italic;">No panels placed yet (Latent pool ready)</div>`;
      }
    } else if (layerName === "cutouts") {
      layerIcon = "➖";
      layerTitle = "Cutout Obstacles";
      countBadge = `${state.cutouts.length} zones`;
      isLayerActive = state.selectedItem && state.selectedItem.type === "cutout";

      if (state.cutouts && state.cutouts.length > 0) {
        itemsHtml = state.cutouts
          .map((c, idx) => {
            const isItemActive = cad.isSelected ? cad.isSelected("cutout", c) : (state.selectedItem && state.selectedItem.id === c.id);
            const shapeIcon = c.shape === "circle" ? "⚪" : c.shape === "l_shape" ? "⌐" : "▭";
            const cOpPercent = Math.round((c.opacity ?? 1.0) * 100);
            return `
              <div class="cad-component-row ${isItemActive ? "active" : ""}" data-comp-type="cutout" data-comp-id="${c.id}" title="Click to select on canvas">
                <div class="cad-component-info">
                  <span>${shapeIcon}</span>
                  <span>${c.label || "Cutout " + (idx + 1)}</span>
                  <span style="color: #ef4444; font-size: 10px;">(${cOpPercent}%)</span>
                </div>
                <div class="cad-component-actions">
                  <button type="button" class="cad-layer-btn comp-move-up-btn" data-type="cutout" data-id="${c.id}" title="Move Up in stack">▲</button>
                  <button type="button" class="cad-layer-btn comp-move-down-btn" data-type="cutout" data-id="${c.id}" title="Move Down in stack">▼</button>
                  <button type="button" class="cad-layer-btn comp-del-btn" data-type="cutout" data-id="${c.id}" style="color: #f87171;" title="Delete obstacle">✕</button>
                </div>
              </div>
            `;
          })
          .join("");
      } else {
        itemsHtml = `<div style="font-size: 10.5px; color: #64748b; padding: 4px 6px; font-style: italic;">No cutouts drawn</div>`;
      }
    } else if (layerName === "pathways") {
      layerIcon = "🚶";
      layerTitle = "Walkways";
      countBadge = `${state.pathways.length} corridors`;
      isLayerActive = state.selectedItem && state.selectedItem.type === "pathway";

      if (state.pathways && state.pathways.length > 0) {
        itemsHtml = state.pathways
          .map((pw, idx) => {
            const isItemActive = cad.isSelected ? cad.isSelected("pathway", pw) : (state.selectedItem && state.selectedItem.id === pw.id);
            const pwOpPercent = Math.round((pw.opacity ?? 1.0) * 100);
            return `
              <div class="cad-component-row ${isItemActive ? "active" : ""}" data-comp-type="pathway" data-comp-id="${pw.id}" title="Click to select on canvas">
                <div class="cad-component-info">
                  <span>🚶</span>
                  <span>${pw.label || "Walkway " + (idx + 1)}</span>
                  <span style="color: #eab308; font-size: 10px;">(${pwOpPercent}%)</span>
                </div>
                <div class="cad-component-actions">
                  <button type="button" class="cad-layer-btn comp-move-up-btn" data-type="pathway" data-id="${pw.id}" title="Move Up in stack">▲</button>
                  <button type="button" class="cad-layer-btn comp-move-down-btn" data-type="pathway" data-id="${pw.id}" title="Move Down in stack">▼</button>
                  <button type="button" class="cad-layer-btn comp-del-btn" data-type="pathway" data-id="${pw.id}" style="color: #f87171;" title="Delete walkway">✕</button>
                </div>
              </div>
            `;
          })
          .join("");
      } else {
        itemsHtml = `<div style="font-size: 10.5px; color: #64748b; padding: 4px 6px; font-style: italic;">No walkways placed</div>`;
      }
    } else if (layerName === "roof") {
      layerIcon = "📐";
      layerTitle = "Base Roof Boundary";
      countBadge = `${state.roofLengthFt || 30} × ${state.roofBreadthFt || 20} ft`;
      isLayerActive = state.selectedItem && state.selectedItem.type === "roof";
      itemsHtml = `
        <div class="cad-component-row ${isLayerActive ? "active" : ""}" data-comp-type="roof" data-comp-id="roof_main" title="Click to select base roof">
          <div class="cad-component-info">
            <span>🟢</span>
            <span>Measured Boundary (${(state.roofLengthFt || 30) * (state.roofBreadthFt || 20)} sq ft)</span>
          </div>
        </div>
      `;
    } else if (layerName === "image") {
      layerIcon = "🖼️";
      layerTitle = "Aerial Roof Image";
      countBadge = state.imageLoaded ? "Active" : "None";
      isLayerActive = state.selectedItem && state.selectedItem.type === "image";
      itemsHtml = `
        <div class="cad-component-row ${isLayerActive ? "active" : ""}" data-comp-type="image" data-comp-id="roof_image" title="Click to select image">
          <div class="cad-component-info">
            <span>🖼️</span>
            <span>${state.imageLoaded ? "Imported Site Photo" : "No image imported"}</span>
          </div>
        </div>
      `;
    }

    html += `
      <div class="cad-layer-card ${isLayerActive ? "active" : ""}" data-layer-name="${layerName}">
        <div class="cad-layer-top-row">
          <div class="cad-layer-title" data-layer-name="${layerName}" title="Layer: ${layerTitle}">
            <span>${layerIcon}</span>
            <span>${layerTitle}</span>
            <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">(${countBadge})</span>
          </div>
          <div class="cad-layer-actions">
            ${layerName === "panels" ? '<button type="button" class="cad-layer-btn select-all-panels-btn" title="Select All Panels (or drag-select on canvas)" style="font-size: 10px; font-weight: 600; color: #38bdf8;">⊞ All</button>' : ''}
            <button type="button" class="cad-layer-btn layer-vis-btn" data-layer="${layerName}" title="${isVisible ? "Hide Layer" : "Show Layer"}">${isVisible ? "👁️" : "🕶️"}</button>
            <button type="button" class="cad-layer-btn layer-up-btn" data-layer="${layerName}" title="Move Layer Up (draw on top of other layers)">🔼</button>
            <button type="button" class="cad-layer-btn layer-down-btn" data-layer="${layerName}" title="Move Layer Down (draw below other layers)">🔽</button>
          </div>
        </div>

        <div class="cad-layer-slider-row">
          <span>Layer Opacity:</span>
          <input type="range" class="layer-opacity-slider" data-layer="${layerName}" min="0.1" max="1.0" step="0.05" value="${opacity}">
          <span style="min-width: 28px; text-align: right; font-variant-numeric: tabular-nums;">${opacityPercent}%</span>
        </div>

        <div class="cad-layer-items-list">
          ${itemsHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Select all panels button
  container.querySelectorAll(".select-all-panels-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      cad.selectAllPanels();
    });
  });

  // Event handlers for layer controls
  container.querySelectorAll(".layer-vis-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lName = btn.getAttribute("data-layer");
      cad.setLayerVisibility(lName, !state.visible[lName]);
    });
  });

  container.querySelectorAll(".layer-up-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lName = btn.getAttribute("data-layer");
      cad.moveLayerUp(lName);
    });
  });

  container.querySelectorAll(".layer-down-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lName = btn.getAttribute("data-layer");
      cad.moveLayerDown(lName);
    });
  });

  container.querySelectorAll(".layer-opacity-slider").forEach((slider) => {
    slider.addEventListener("input", (e) => {
      const lName = slider.getAttribute("data-layer");
      cad.setLayerOpacity(lName, Number(e.target.value));
    });
  });

  // Component row selection (supports Shift/Ctrl/Cmd multi-selection)
  container.querySelectorAll(".cad-component-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (
        e.target.closest(".comp-move-up-btn") ||
        e.target.closest(".comp-move-down-btn") ||
        e.target.closest(".comp-del-btn")
      ) {
        return;
      }
      const cType = row.getAttribute("data-comp-type");
      const cId = row.getAttribute("data-comp-id");
      const isMulti = e.shiftKey || e.ctrlKey || e.metaKey;
      cad.selectComponent(cType, cId, isMulti);
    });
  });

  // Component move up / down
  container.querySelectorAll(".comp-move-up-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cType = btn.getAttribute("data-type");
      const cId = btn.getAttribute("data-id");
      cad.moveComponent(cType, cId, "up");
    });
  });

  container.querySelectorAll(".comp-move-down-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cType = btn.getAttribute("data-type");
      const cId = btn.getAttribute("data-id");
      cad.moveComponent(cType, cId, "down");
    });
  });

  // Component delete
  container.querySelectorAll(".comp-del-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cType = btn.getAttribute("data-type");
      const cId = btn.getAttribute("data-id");
      cad.removeComponent(cType, cId);
    });
  });
}

function setupCadEventListeners(cad) {
  if (cadListenersAttached) return;
  cadListenersAttached = true;

  // Length & Breadth inputs
  const lenInput = $("cadRoofLength");
  const brInput = $("cadRoofBreadth");
  const pwInput = $("cadPathwayWidth");

  const syncDimensions = () => {
    const l = Math.max(5, Number(lenInput?.value) || 26);
    const b = Math.max(5, Number(brInput?.value) || 25);
    cad.setRoofDimensions(l, b);
    const stats = cad.getAreaStats();
    const roofInput = $("roofArea");
    if (roofInput && document.activeElement !== roofInput) {
      roofInput.value = stats.netUsableSqft;
      render();
    }
  };

  lenInput?.addEventListener("input", syncDimensions);
  brInput?.addEventListener("input", syncDimensions);
  pwInput?.addEventListener("input", () => {
    cad.defaultPathwayWidthFt = Math.max(1, Number(pwInput.value) || 2.5);
  });

  // Tool selection buttons
  const toolBtns = [
    { id: "cadToolSelectBtn", tool: "select" },
    { id: "cadToolPanelBtn", tool: "panel" },
    { id: "cadToolSubtractBtn", tool: "subtract" },
    { id: "cadToolPathwayBtn", tool: "pathway" },
    { id: "cadToolRoofBtn", tool: "roof" },
    { id: "cadToolPanBtn", tool: "image_pan" },
  ];

  toolBtns.forEach(({ id, tool }) => {
    $(id)?.addEventListener("click", () => {
      toolBtns.forEach((t) => $(t.id)?.classList.remove("active"));
      $(id)?.classList.add("active");
      cad.setTool(tool);
    });
  });

  // Toggle Layers Panel & Collapse Button
  const toggleLayersPanel = () => {
    const panel = $("cadLayersPanel");
    const toggleBtn = $("cadToggleLayersBtn");
    const collapseBtn = $("cadCollapseLayersBtn");
    if (!panel) return;
    const isCollapsed = panel.classList.toggle("collapsed");
    toggleBtn?.classList.toggle("active", !isCollapsed);
    if (collapseBtn) collapseBtn.textContent = isCollapsed ? "◀" : "▶";
  };

  $("cadToggleLayersBtn")?.addEventListener("click", toggleLayersPanel);
  $("cadCollapseLayersBtn")?.addEventListener("click", toggleLayersPanel);

  // Collapsible Minimizable Drawers
  const drawerConfigs = [
    { btnId: "cadToggleNorthDrawerBtn", drawerId: "cadNorthDrawer" },
    { btnId: "cadToggleSunDrawerBtn", drawerId: "cadSunToolbar" },
    { btnId: "cadToggleRoofDrawerBtn", drawerId: "cadRoofDrawer" },
    { btnId: "cadToggleImageDrawerBtn", drawerId: "cadImageDrawer" },
  ];

  drawerConfigs.forEach(({ btnId, drawerId }) => {
    const btn = $(btnId);
    const drawer = $(drawerId);
    if (btn && drawer) {
      btn.addEventListener("click", () => {
        const isOpen = drawer.style.display !== "none";
        drawer.style.display = isOpen ? "none" : "flex";
        btn.classList.toggle("active", !isOpen);
      });
    }
  });

  document.querySelectorAll(".cad-drawer-close").forEach((closeBtn) => {
    closeBtn.addEventListener("click", () => {
      const targetId = closeBtn.getAttribute("data-close");
      const target = $(targetId);
      if (target) {
        target.style.display = "none";
        const cfg = drawerConfigs.find((c) => c.drawerId === targetId);
        if (cfg) $(cfg.btnId)?.classList.remove("active");
      }
    });
  });

  // Bulk Multi-Select Action Buttons
  $("cadRotateSelectedBtn")?.addEventListener("click", () => {
    cad.rotateSelectedPanels(90);
  });

  $("cadScaleUpSelectedBtn")?.addEventListener("click", () => {
    cad.scaleSelectedItems(1.1);
  });

  $("cadScaleDownSelectedBtn")?.addEventListener("click", () => {
    cad.scaleSelectedItems(0.9);
  });

  $("cadDeleteSelectedBtn")?.addEventListener("click", () => {
    cad.removeSelectedItems();
  });

  // Shape picker buttons for Cutouts (Rectangle, Circle, L-Shape)
  const shapeBtns = [
    { id: "cadShapeRectBtn", shape: "rectangle" },
    { id: "cadShapeCircleBtn", shape: "circle" },
    { id: "cadShapeLBtn", shape: "l_shape" },
  ];

  shapeBtns.forEach(({ id, shape }) => {
    $(id)?.addEventListener("click", () => {
      shapeBtns.forEach((s) => $(s.id)?.classList.remove("active"));
      $(id)?.classList.add("active");
      cad.setShapeType(shape);
      // Switch active tool to subtract
      toolBtns.forEach((t) => $(t.id)?.classList.remove("active"));
      $("cadToolSubtractBtn")?.classList.add("active");
      cad.setTool("subtract");
    });
  });

  // Contextual Properties Inspector UI sync
  const updateInspectorUI = (sel, selectedItems) => {
    const icon = $("inspectorIcon");
    const title = $("inspectorTypeTitle");
    const labelGroup = $("inspectorLabelGroup");
    const labelInput = $("inspectorLabel");
    const lenGroup = $("inspectorLengthGroup");
    const lenInput = $("inspectorLength");
    const brGroup = $("inspectorBreadthGroup");
    const brInput = $("inspectorBreadth");
    const diaGroup = $("inspectorDiameterGroup");
    const diaInput = $("inspectorDiameter");
    const distXGroup = $("inspectorDistXGroup");
    const distXInput = $("inspectorDistX");
    const distYGroup = $("inspectorDistYGroup");
    const distYInput = $("inspectorDistY");
    const heightGroup = $("inspectorHeightGroup");
    const heightInput = $("inspectorHeight");
    const areaVal = $("inspectorAreaValue");
    const delBtn = $("inspectorDeleteBtn");
    const deselectBtn = $("inspectorDeselectBtn");
    const opacityInput = $("inspectorOpacity");
    const opacityVal = $("inspectorOpacityVal");
    const zOrderGroup = $("inspectorZOrderGroup");

    const multi = selectedItems || (cad.selectedItems && cad.selectedItems.length > 1 ? cad.selectedItems : null);

    if (multi && multi.length > 1) {
      if (icon) icon.textContent = "📦";
      if (title) title.textContent = `${multi.length} Items Selected`;
      if (labelGroup) labelGroup.style.display = "none";
      if (lenGroup) lenGroup.style.display = "none";
      if (brGroup) brGroup.style.display = "none";
      if (diaGroup) diaGroup.style.display = "none";
      if (distXGroup) distXGroup.style.display = "none";
      if (distYGroup) distYGroup.style.display = "none";
      if (heightGroup) heightGroup.style.display = "none";
      if (opacityInput) {
        const firstOp = multi[0]?.item?.opacity ?? 1.0;
        opacityInput.value = firstOp;
        if (opacityVal) opacityVal.textContent = `${Math.round(firstOp * 100)}%`;
      }
      if (zOrderGroup) zOrderGroup.style.display = "none";
      if (delBtn) delBtn.style.display = "inline-flex";
      if (deselectBtn) deselectBtn.style.display = "inline-flex";

      let totalArea = 0;
      multi.forEach((s) => {
        if (s.type === "panel") totalArea += (cad.panelStandardLengthFt * cad.panelStandardBreadthFt);
        else if (s.type === "cutout") {
          if (s.item.shape === "circle") {
            const r = (s.item.radius || s.item.w / 2) / cad.scalePxPerFt;
            totalArea += Math.PI * r * r;
          } else if (s.item.shape === "l_shape") {
            totalArea += (s.item.lengthFt || 10) * (s.item.breadthFt || 10) * 0.75;
          } else {
            totalArea += (s.item.lengthFt || 10) * (s.item.breadthFt || 5);
          }
        } else if (s.type === "obstacle") {
          totalArea += (s.item.lengthFt || 10) * (s.item.breadthFt || 5);
        }
      });
      if (areaVal) areaVal.textContent = `${Math.round(totalArea)} sq ft`;
      return;
    }

    if (!sel || !sel.item || sel.type === "roof") {
      if (icon) icon.textContent = "🟢";
      if (title) title.textContent = "Base Roof";
      if (labelGroup) labelGroup.style.display = "none";
      if (lenGroup) lenGroup.style.display = "flex";
      if (lenInput) lenInput.value = cad.roofLengthFt;
      if (brGroup) brGroup.style.display = "flex";
      if (brInput) brInput.value = cad.roofBreadthFt;
      if (diaGroup) diaGroup.style.display = "none";
      if (distXGroup) distXGroup.style.display = "none";
      if (distYGroup) distYGroup.style.display = "none";
      if (heightGroup) heightGroup.style.display = "none";
      if (areaVal) areaVal.textContent = `${Math.round(cad.roofLengthFt * cad.roofBreadthFt)} sq ft`;
      if (delBtn) delBtn.style.display = "none";
      if (deselectBtn) deselectBtn.style.display = sel ? "inline-flex" : "none";
      if (opacityInput) opacityInput.value = cad.roofOpacity || 1.0;
      if (opacityVal) opacityVal.textContent = `${Math.round((cad.roofOpacity || 1.0) * 100)}%`;
      if (zOrderGroup) zOrderGroup.style.display = "none";
      return;
    }

    const it = sel.item;
    if (deselectBtn) deselectBtn.style.display = "inline-flex";
    if (delBtn) delBtn.style.display = "inline-flex";

    const itemOpacity = it.opacity ?? 1.0;
    if (opacityInput) opacityInput.value = itemOpacity;
    if (opacityVal) opacityVal.textContent = `${Math.round(itemOpacity * 100)}%`;
    if (zOrderGroup) zOrderGroup.style.display = "flex";

    // By default hide obstacle-only fields
    if (distXGroup) distXGroup.style.display = "none";
    if (distYGroup) distYGroup.style.display = "none";
    if (heightGroup) heightGroup.style.display = "none";

    if (sel.type === "cutout") {
      if (it.shape === "circle") {
        if (icon) icon.textContent = "⚪";
        if (title) title.textContent = "Obstacle (Circle)";
        if (labelGroup) labelGroup.style.display = "flex";
        if (labelInput) labelInput.value = it.label || "Round Tank";
        if (lenGroup) lenGroup.style.display = "none";
        if (brGroup) brGroup.style.display = "none";
        if (diaGroup) diaGroup.style.display = "flex";
        if (diaInput) diaInput.value = it.diameterFt || Number(((it.radius * 2) / cad.scalePxPerFt).toFixed(1));
        const rFt = (it.radius || it.w / 2) / cad.scalePxPerFt;
        if (areaVal) areaVal.textContent = `${Math.round(Math.PI * rFt * rFt)} sq ft`;
      } else if (it.shape === "l_shape") {
        if (icon) icon.textContent = "⌐";
        if (title) title.textContent = "Obstacle (L-Shape)";
        if (labelGroup) labelGroup.style.display = "flex";
        if (labelInput) labelInput.value = it.label || "L-Obstacle";
        if (lenGroup) lenGroup.style.display = "flex";
        if (lenInput) lenInput.value = it.lengthFt;
        if (brGroup) brGroup.style.display = "flex";
        if (brInput) brInput.value = it.breadthFt;
        if (diaGroup) diaGroup.style.display = "none";
        if (areaVal) areaVal.textContent = `${Math.round(it.lengthFt * it.breadthFt * 0.75)} sq ft`;
      } else {
        if (icon) icon.textContent = "🔴";
        if (title) title.textContent = "Obstacle (Rect)";
        if (labelGroup) labelGroup.style.display = "flex";
        if (labelInput) labelInput.value = it.label || "Obstacle";
        if (lenGroup) lenGroup.style.display = "flex";
        if (lenInput) lenInput.value = it.lengthFt;
        if (brGroup) brGroup.style.display = "flex";
        if (brInput) brInput.value = it.breadthFt;
        if (diaGroup) diaGroup.style.display = "none";
        if (areaVal) areaVal.textContent = `${Math.round(it.lengthFt * it.breadthFt)} sq ft`;
      }
    } else if (sel.type === "pathway") {
      if (icon) icon.textContent = "🚶";
      if (title) title.textContent = "Walkway Corridor";
      if (labelGroup) labelGroup.style.display = "flex";
      if (labelInput) labelInput.value = it.label || "Walkway";
      if (lenGroup) lenGroup.style.display = "flex";
      if (lenInput) lenInput.value = it.lengthFt;
      if (brGroup) brGroup.style.display = "flex";
      if (brInput) brInput.value = it.breadthFt;
      if (diaGroup) diaGroup.style.display = "none";
      if (areaVal) areaVal.textContent = `${Math.round(it.lengthFt * it.breadthFt)} sq ft`;
    } else if (sel.type === "panel") {
      if (icon) icon.textContent = "☀️";
      if (title) title.textContent = "Solar Panel";
      if (labelGroup) labelGroup.style.display = "none";
      if (lenGroup) lenGroup.style.display = "flex";
      if (lenInput) lenInput.value = (it.w / cad.scalePxPerFt).toFixed(1);
      if (brGroup) brGroup.style.display = "flex";
      if (brInput) brInput.value = (it.h / cad.scalePxPerFt).toFixed(1);
      if (diaGroup) diaGroup.style.display = "none";
      if (areaVal) areaVal.textContent = `${Math.round((it.w * it.h) / (cad.scalePxPerFt * cad.scalePxPerFt))} sq ft`;
    } else if (sel.type === "image") {
      if (icon) icon.textContent = "🖼️";
      if (title) title.textContent = "Aerial Image";
      if (labelGroup) labelGroup.style.display = "none";
      if (lenGroup) lenGroup.style.display = "none";
      if (brGroup) brGroup.style.display = "none";
      if (diaGroup) diaGroup.style.display = "none";
      if (areaVal) areaVal.textContent = "Site Photo";
      if (delBtn) delBtn.style.display = "none";
      if (zOrderGroup) zOrderGroup.style.display = "none";
    } else if (sel.type === "obstacle") {
      const obsIcons = {
        tree: "🌳",
        pole: "🗼",
        building: "🏢",
        wall: "🧱",
      };
      if (icon) icon.textContent = obsIcons[it.type] || "🌲";
      if (title) title.textContent = `Obstacle (${it.label || it.type})`;
      if (labelGroup) labelGroup.style.display = "flex";
      if (labelInput) labelInput.value = it.label || it.type;

      if (it.shape === "circle") {
        if (lenGroup) lenGroup.style.display = "none";
        if (brGroup) brGroup.style.display = "none";
        if (diaGroup) diaGroup.style.display = "flex";
        if (diaInput) diaInput.value = it.diameterFt || 10;
      } else {
        if (lenGroup) lenGroup.style.display = "flex";
        if (lenInput) lenInput.value = it.lengthFt;
        if (brGroup) brGroup.style.display = "flex";
        if (brInput) brInput.value = it.breadthFt;
        if (diaGroup) diaGroup.style.display = "none";
      }

      if (distXGroup) distXGroup.style.display = "flex";
      if (distXInput) distXInput.value = it.distanceFromRoofX;
      if (distYGroup) distYGroup.style.display = "flex";
      if (distYInput) distYInput.value = it.distanceFromRoofY;
      if (heightGroup) heightGroup.style.display = "flex";
      if (heightInput) heightInput.value = it.heightFt;

      if (areaVal) areaVal.textContent = `${it.lengthFt}×${it.breadthFt} ft (H: ${it.heightFt} ft)`;
      if (zOrderGroup) zOrderGroup.style.display = "none";
    }
  };

  cad.onSelectionChange = (sel, selectedItems) => {
    updateInspectorUI(sel, selectedItems);
  };

  cad.onLayersChange = (layerState) => {
    renderLayersPanel(cad, layerState);
    if (cad.selectedItem || (cad.selectedItems && cad.selectedItems.length > 0)) {
      updateInspectorUI(cad.selectedItem, cad.selectedItems);
    }
  };

  // Two-way Inspector Input Listeners
  $("inspectorLength")?.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if (!cad.selectedItem || cad.selectedItem.type === "roof") {
      cad.setRoofDimensions(val, cad.roofBreadthFt);
      if ($("cadRoofLength")) $("cadRoofLength").value = val;
    } else {
      cad.updateSelectedItem({ lengthFt: val });
    }
  });

  $("inspectorBreadth")?.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if (!cad.selectedItem || cad.selectedItem.type === "roof") {
      cad.setRoofDimensions(cad.roofLengthFt, val);
      if ($("cadRoofBreadth")) $("cadRoofBreadth").value = val;
    } else {
      cad.updateSelectedItem({ breadthFt: val });
    }
  });

  $("inspectorDiameter")?.addEventListener("input", (e) => {
    cad.updateSelectedItem({ diameterFt: Number(e.target.value) });
  });

  $("inspectorDistX")?.addEventListener("input", (e) => {
    if (cad.selectedItem && cad.selectedItem.type === "obstacle") {
      cad.updateSelectedItem({ distanceFromRoofX: Number(e.target.value) });
    }
  });

  $("inspectorDistY")?.addEventListener("input", (e) => {
    if (cad.selectedItem && cad.selectedItem.type === "obstacle") {
      cad.updateSelectedItem({ distanceFromRoofY: Number(e.target.value) });
    }
  });

  $("inspectorHeight")?.addEventListener("input", (e) => {
    if (cad.selectedItem && cad.selectedItem.type === "obstacle") {
      cad.updateSelectedItem({ heightFt: Number(e.target.value) });
    }
  });

  $("inspectorLabel")?.addEventListener("input", (e) => {
    cad.updateSelectedItem({ label: e.target.value });
  });

  $("inspectorOpacity")?.addEventListener("input", (e) => {
    const val = Number(e.target.value);
    if ($("inspectorOpacityVal")) $("inspectorOpacityVal").textContent = `${Math.round(val * 100)}%`;
    if (!cad.selectedItem || cad.selectedItem.type === "roof") {
      cad.setLayerOpacity("roof", val);
    } else if (cad.selectedItem.type === "image") {
      cad.setImageOpacity(val);
      if ($("cadOpacitySlider")) $("cadOpacitySlider").value = val;
    } else {
      cad.updateSelectedItem({ opacity: val });
    }
  });

  $("inspectorMoveUpBtn")?.addEventListener("click", () => cad.moveSelectedItemUp());
  $("inspectorMoveDownBtn")?.addEventListener("click", () => cad.moveSelectedItemDown());
  $("inspectorBringToFrontBtn")?.addEventListener("click", () => cad.bringSelectedItemToFront());
  $("inspectorSendToBackBtn")?.addEventListener("click", () => cad.sendSelectedItemToBack());

  $("inspectorDeleteBtn")?.addEventListener("click", () => {
    cad.removeSelectedItem();
  });

  $("inspectorDeselectBtn")?.addEventListener("click", () => {
    cad.selectItem(null, null);
  });

  // Multi-View Elevation Switcher (Top Plan, Front Elevation, Side Elevation)
  const viewBtns = [
    { id: "cadViewTopBtn", view: "top" },
    { id: "cadViewFrontBtn", view: "front" },
    { id: "cadViewSideBtn", view: "side" },
  ];

  const elevBldgHGroup = $("cadElevationBldgHeightGroup");
  const elevBldgHInput = $("cadElevationBldgHeightInput");

  const updateActiveViewButtons = (currentView) => {
    viewBtns.forEach(({ id, view }) => {
      const btn = $(id);
      if (btn) {
        btn.classList.toggle("active", view === currentView);
      }
    });
    if (elevBldgHGroup) {
      elevBldgHGroup.style.display = (currentView === "front" || currentView === "side") ? "inline-flex" : "none";
    }
  };

  viewBtns.forEach(({ id, view }) => {
    $(id)?.addEventListener("click", () => {
      cad.setActiveView(view);
      updateActiveViewButtons(view);
    });
  });

  cad.onViewChange = (view) => {
    updateActiveViewButtons(view);
  };

  // True North Alignment Controls
  const northAngleInput = $("cadNorthAngleInput");
  const updateNorth = (deg) => {
    cad.setNorthAngle(deg);
    if (northAngleInput) northAngleInput.value = cad.northAngleDeg;
  };

  northAngleInput?.addEventListener("input", (e) => {
    cad.setNorthAngle(Number(e.target.value));
  });
  northAngleInput?.addEventListener("change", (e) => {
    cad.setNorthAngle(Number(e.target.value));
  });

  $("cadNorthMinus15Btn")?.addEventListener("click", () => {
    cad.rotateNorth(-15);
    if (northAngleInput) northAngleInput.value = cad.northAngleDeg;
  });

  $("cadNorthPlus15Btn")?.addEventListener("click", () => {
    cad.rotateNorth(15);
    if (northAngleInput) northAngleInput.value = cad.northAngleDeg;
  });

  $("cadNorthResetBtn")?.addEventListener("click", () => {
    cad.setNorthAngle(0);
    if (northAngleInput) northAngleInput.value = 0;
  });

  cad.onNorthChange = (deg) => {
    if (northAngleInput && !northAngleInput.matches(":focus")) {
      northAngleInput.value = deg;
    }
  };

  // Building Height Inputs (Drawer and Quick Elevation Control)
  const bldgHInput = $("cadBuildingHeightInput");
  const updateBldgHeight = (val) => {
    const h = Math.max(5, Math.min(150, Number(val) || 18));
    cad.setBuildingHeight(h);
    if (bldgHInput && document.activeElement !== bldgHInput) bldgHInput.value = h;
    if (elevBldgHInput && document.activeElement !== elevBldgHInput) elevBldgHInput.value = h;
  };

  bldgHInput?.addEventListener("input", (e) => updateBldgHeight(e.target.value));
  bldgHInput?.addEventListener("change", (e) => updateBldgHeight(e.target.value));
  elevBldgHInput?.addEventListener("input", (e) => updateBldgHeight(e.target.value));
  elevBldgHInput?.addEventListener("change", (e) => updateBldgHeight(e.target.value));

  cad.onBuildingHeightChange = (heightFt) => {
    if (bldgHInput && document.activeElement !== bldgHInput) {
      bldgHInput.value = heightFt;
    }
    if (elevBldgHInput && document.activeElement !== elevBldgHInput) {
      elevBldgHInput.value = heightFt;
    }
  };

  // Surrounding Obstacles in Yard
  $("cadAddTreeBtn")?.addEventListener("click", () => cad.addExternalObstacle("tree"));
  $("cadAddPoleBtn")?.addEventListener("click", () => cad.addExternalObstacle("pole"));
  $("cadAddNeighborBtn")?.addEventListener("click", () => cad.addExternalObstacle("building"));
  $("cadAddWallBtn")?.addEventListener("click", () => cad.addExternalObstacle("wall"));
  $("cadClearObstaclesBtn")?.addEventListener("click", () => cad.clearAllObstacles());

  // Astronomical 2D Sun Path & Shadow Simulation Controls
  const toggleSunSimBtn = $("cadToggleSunSimBtn");
  const sunControls = $("cadSunControls");
  const playSunBtn = $("cadPlaySunBtn");
  const sunTimeSlider = $("cadSunTimeSlider");
  const sunTimeLabel = $("cadSunTimeLabel");

  const seasonBtns = [
    { id: "cadSeasonWinterBtn", day: 355 },
    { id: "cadSeasonEquinoxBtn", day: 80 },
    { id: "cadSeasonSummerBtn", day: 172 },
  ];

  seasonBtns.forEach(({ id, day }) => {
    $(id)?.addEventListener("click", () => {
      seasonBtns.forEach((s) => $(s.id)?.classList.remove("active"));
      $(id)?.classList.add("active");
      cad.setSunDate(day);
    });
  });

  toggleSunSimBtn?.addEventListener("click", () => {
    const isEnabled = cad.toggleSunSimulation();
    if (toggleSunSimBtn) {
      toggleSunSimBtn.textContent = isEnabled ? "☀️ Sun Simulation: ON" : "☀️ Sun Simulation: OFF";
      toggleSunSimBtn.classList.toggle("active", isEnabled);
    }
    if (sunControls) {
      sunControls.style.display = isEnabled ? "inline-flex" : "none";
    }
  });

  playSunBtn?.addEventListener("click", () => {
    if (cad.sunSim.isPlaying) {
      cad.pauseSunAnimation();
      if (playSunBtn) playSunBtn.textContent = "▶ Play";
    } else {
      cad.playSunAnimation();
      if (playSunBtn) playSunBtn.textContent = "⏸ Pause";
    }
  });

  sunTimeSlider?.addEventListener("input", (e) => {
    cad.setSunTime(Number(e.target.value));
  });

  cad.onSunChange = ({ enabled, isPlaying, timeHour, dayOfYear, solarPos, stats }) => {
    if (toggleSunSimBtn) {
      toggleSunSimBtn.textContent = enabled ? "☀️ Sun Simulation: ON" : "☀️ Sun Simulation: OFF";
      toggleSunSimBtn.classList.toggle("active", enabled);
    }
    if (sunControls) {
      sunControls.style.display = enabled ? "inline-flex" : "none";
    }
    if (playSunBtn) {
      playSunBtn.textContent = isPlaying ? "⏸ Pause" : "▶ Play";
    }
    if (sunTimeSlider && !sunTimeSlider.matches(":active")) {
      sunTimeSlider.value = timeHour.toFixed(2);
    }
    if (sunTimeLabel) {
      const h = Math.floor(timeHour);
      const m = Math.round((timeHour - h) * 60);
      const ampm = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 === 0 ? 12 : h % 12;
      sunTimeLabel.textContent = `${displayH}:${m.toString().padStart(2, "0")} ${ampm}`;
    }
    if ($("cadSolarAlt") && solarPos) {
      $("cadSolarAlt").textContent = `${solarPos.altitudeDeg.toFixed(1)}°`;
    }
    if ($("cadSolarAz") && solarPos) {
      $("cadSolarAz").textContent = `${solarPos.azimuthDeg.toFixed(1)}°`;
    }
    const lossEl = $("cadShadingLossVal");
    if (lossEl && stats) {
      lossEl.textContent = `${stats.arrayShadingLossPct.toFixed(1)}%`;
      if (stats.arrayShadingLossPct > 15) {
        lossEl.style.color = "#f87171";
      } else if (stats.arrayShadingLossPct > 0) {
        lossEl.style.color = "#fbbf24";
      } else {
        lossEl.style.color = "#4ade80";
      }
    }
  };

  // Panel placement actions
  $("cadAddSinglePanelBtn")?.addEventListener("click", () => cad.placePanel());
  $("cadAddBlockBtn")?.addEventListener("click", () => cad.placePanelBlock(2, 2));
  $("cadAutoPlaceBtn")?.addEventListener("click", () => cad.autoPlaceRemainingPanels());
  $("cadAddHorizPathwayBtn")?.addEventListener("click", () => cad.addDefaultHorizontalPathway());
  $("cadClearPanelsBtn")?.addEventListener("click", () => cad.clearAllPanels());
  $("cadClearCutoutsBtn")?.addEventListener("click", () => cad.clearAllCutouts());

  // Render initial Layers Panel
  renderLayersPanel(cad, cad.getLayerState());

  // Image import
  const imgInput = $("cadImageInput");
  const imgControls = $("cadImageControls");

  const updateLockBtnUI = () => {
    const lockBtn = $("cadLockImageBtn");
    if (!lockBtn) return;
    if (cad.image.locked) {
      lockBtn.textContent = "🔒 Locked";
      lockBtn.style.color = "#38bdf8";
      lockBtn.title = "Image is locked in place. Click to unlock for editing.";
    } else {
      lockBtn.textContent = "🔓 Unlocked";
      lockBtn.style.color = "#fbbf24";
      lockBtn.title = "Image is unlocked. Click to lock in place.";
    }
  };

  imgInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      cad.loadCustomImage(e.target.files[0]);
      if (imgControls) imgControls.style.display = "flex";
      updateLockBtnUI();
      // Switch active tool to move image so user can immediately reposition it
      toolBtns.forEach(t => $(t.id)?.classList.remove("active"));
      $("cadToolPanBtn")?.classList.add("active");
      cad.setTool("image_pan");
    }
  });

  $("cadLockImageBtn")?.addEventListener("click", () => {
    cad.setImageLocked(!cad.image.locked);
    updateLockBtnUI();
  });

  $("cadZoomSlider")?.addEventListener("input", (e) => cad.setImageZoom(e.target.value));
  $("cadZoomInBtn")?.addEventListener("click", () => {
    cad.setImageZoom(cad.image.scale * 1.02);
    if ($("cadZoomSlider")) $("cadZoomSlider").value = cad.image.scale;
  });
  $("cadZoomOutBtn")?.addEventListener("click", () => {
    cad.setImageZoom(cad.image.scale * 0.98);
    if ($("cadZoomSlider")) $("cadZoomSlider").value = cad.image.scale;
  });
  $("cadRotateImageBtn")?.addEventListener("click", () => cad.rotateImage90());
  $("cadOpacitySlider")?.addEventListener("input", (e) => cad.setImageOpacity(e.target.value));
  $("cadFitImageBtn")?.addEventListener("click", () => {
    cad.resetImageTransform();
    if ($("cadZoomSlider")) $("cadZoomSlider").value = cad.image.scale;
  });
  $("cadRemoveImageBtn")?.addEventListener("click", () => {
    cad.removeCustomImage();
    if (imgControls) imgControls.style.display = "none";
    if (imgInput) imgInput.value = "";
  });

  // Sync Net Area to Calculator
  $("cadSyncNetAreaBtn")?.addEventListener("click", () => {
    const stats = cad.getAreaStats();
    const roofInput = $("roofArea");
    if (roofInput) {
      roofInput.value = stats.netUsableSqft;
      roofInput.dispatchEvent(new Event("input", { bubbles: true }));
      roofInput.dispatchEvent(new Event("change", { bubbles: true }));

      const btn = $("cadSyncNetAreaBtn");
      if (btn) {
        const origText = btn.textContent;
        btn.textContent = `✓ ${stats.netUsableSqft} sq ft Applied!`;
        btn.style.background = "var(--brand-green)";
        btn.style.color = "#ffffff";
        setTimeout(() => {
          btn.textContent = origText;
          btn.style.background = "";
          btn.style.color = "var(--brand-green)";
        }, 2500);
      }
    }
  });
}

function solveRoofDimensions(targetGrossSqft, preferredRatio = 1.35) {
  const area = Math.max(25, Number(targetGrossSqft) || 650);
  let bestL = 0, bestB = 0, bestRatioDiff = Infinity;
  const targetL = Math.sqrt(area * preferredRatio);
  const minL = Math.max(5, Math.floor(Math.sqrt(area)));
  const maxL = Math.max(minL, Math.ceil(Math.sqrt(area * 2.5)));

  // 1. Check exact integer factors within a balanced aspect ratio (1.0 to 2.2)
  for (let l = minL; l <= maxL; l++) {
    if (area % l === 0) {
      const b = area / l;
      const ratio = l / b;
      const ratioDiff = Math.abs(ratio - preferredRatio);
      if (ratio >= 1.0 && ratio <= 2.2 && ratioDiff < bestRatioDiff) {
        bestRatioDiff = ratioDiff;
        bestL = l;
        bestB = b;
      }
    }
  }
  if (bestL > 0) return { l: bestL, b: bestB };

  // 2. Try half-integer (0.5 ft) factors
  for (let l2 = Math.floor(minL * 2); l2 <= Math.ceil(maxL * 2); l2++) {
    const l = l2 / 2;
    const b = area / l;
    if (Math.abs(Math.round(b * 2) - b * 2) < 0.001) {
      const bHalf = Math.round(b * 2) / 2;
      const ratio = l / bHalf;
      const ratioDiff = Math.abs(ratio - preferredRatio);
      if (ratio >= 1.0 && ratio <= 2.2 && ratioDiff < bestRatioDiff) {
        bestRatioDiff = ratioDiff;
        bestL = l;
        bestB = bHalf;
      }
    }
  }
  if (bestL > 0) return { l: bestL, b: bestB };

  // 3. Clean integer L, rounded B so that L * B matches targetGrossSqft
  const roundL = Math.max(5, Math.round(targetL));
  const roundB = Math.max(5, Math.round((area / roundL) * 10) / 10);
  return { l: roundL, b: roundB };
}

function renderDiagram(pl, input) {
  const section = $("panelDiagramSection");
  const canvas = $("panelDiagramCanvas");

  if (!section || !canvas) return;
  if (!pl || pl.numPanels <= 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  const targetUsableArea = Math.max(25, Number(input.roofArea) || 650);

  let cad = getActiveRooftopCAD();
  if (!cad || cad.canvas !== canvas) {
    // Initial CAD creation: derive dimensions directly from input.roofArea
    const { l: initialLen, b: initialBr } = solveRoofDimensions(targetUsableArea, 1.35);

    if ($("cadRoofLength")) $("cadRoofLength").value = initialLen;
    if ($("cadRoofBreadth")) $("cadRoofBreadth").value = initialBr;

    cad = initRooftopCAD(canvas, {
      roofLengthFt: initialLen,
      roofBreadthFt: initialBr,
      requiredPanels: pl.numPanels,
      panelWidthMm: pl.panelWidthMm,
      panelHeightMm: pl.panelHeightMm,
      onStatsChange: (stats) => {
        if ($("cadGrossArea")) $("cadGrossArea").textContent = stats.grossSqft;
        if ($("cadCutoutArea")) $("cadCutoutArea").textContent = stats.cutoutSqft + stats.pathwaySqft;
        if ($("cadNetArea")) $("cadNetArea").textContent = stats.netUsableSqft;
      },
      onPanelsChange: (pStats) => {
        if ($("cadInventoryCount")) {
          $("cadInventoryCount").textContent = `${pStats.placed} / ${pStats.required} Placed (${pStats.remaining} Remaining)`;
        }
        if ($("cadIslandsCount")) {
          $("cadIslandsCount").textContent = `${pStats.islandsCount} Array Island${pStats.islandsCount === 1 ? "" : "s"}`;
        }
      },
      onLayersChange: (layerState) => {
        renderLayersPanel(cad, layerState);
      },
    });
    setupCadEventListeners(cad);
    if (state.pendingCadState) {
      cad.loadState(state.pendingCadState);
      state.pendingCadState = null;
    }
  } else {
    cad.setRequiredPanels(pl.numPanels, pl.panelWidthMm, pl.panelHeightMm);
    if (state.pendingCadState) {
      cad.loadState(state.pendingCadState);
      state.pendingCadState = null;
    } else if (!state.isRestoringProposal) {
      const currentStats = cad.getAreaStats();
      const isEditingCadDirectly = document.activeElement === $("cadRoofLength") || document.activeElement === $("cadRoofBreadth");

      // When Usable Roof Area changes in input, reflect it as it is in Rooftop CAD
      if (!isEditingCadDirectly && Math.abs(currentStats.netUsableSqft - targetUsableArea) >= 1) {
        const deductions = (currentStats.cutoutSqft || 0) + (currentStats.pathwaySqft || 0);
        const targetGross = targetUsableArea + deductions;
        let preferredRatio = 1.35;
        if (cad.roofLengthFt > 0 && cad.roofBreadthFt > 0) {
          const r = cad.roofLengthFt / cad.roofBreadthFt;
          if (r >= 0.8 && r <= 2.5) preferredRatio = r;
        }
        const { l, b } = solveRoofDimensions(targetGross, preferredRatio);
        cad.setRoofDimensions(l, b);
      }
    }
  }

  // Update initial UI stats
  const stats = cad.getAreaStats();
  const isEditingCad = document.activeElement === $("cadRoofLength") || document.activeElement === $("cadRoofBreadth");
  if ($("cadGrossArea")) $("cadGrossArea").textContent = stats.grossSqft;
  if ($("cadCutoutArea")) $("cadCutoutArea").textContent = stats.cutoutSqft + stats.pathwaySqft;
  if ($("cadNetArea")) $("cadNetArea").textContent = stats.netUsableSqft;
  if ($("cadRoofLength") && !isEditingCad) $("cadRoofLength").value = cad.roofLengthFt;
  if ($("cadRoofBreadth") && !isEditingCad) $("cadRoofBreadth").value = cad.roofBreadthFt;
  if ($("cadPathwayWidth")) $("cadPathwayWidth").value = cad.defaultPathwayWidthFt;
  if ($("cadNorthAngleInput")) $("cadNorthAngleInput").value = cad.northAngleDeg;
  if ($("cadBuildingHeightInput")) $("cadBuildingHeightInput").value = cad.buildingHeightFt;
  if ($("cadElevationBldgHeightInput")) $("cadElevationBldgHeightInput").value = cad.buildingHeightFt;
  if ($("cadInventoryCount")) {
    const remaining = Math.max(0, pl.numPanels - cad.panels.length);
    $("cadInventoryCount").textContent = `${cad.panels.length} / ${pl.numPanels} Placed (${remaining} Remaining)`;
  }
  renderLayersPanel(cad, cad.getLayerState());
}


function lockInternal() {
  state.internalUnlocked = false;
  $("internalPanel")?.classList.add("hidden");
  $("easyModeButton")?.classList.add("active");
  $("internalModeButton")?.classList.remove("active");

  const ratesPill = $("ratesPillBtn");
  if (ratesPill) ratesPill.style.display = "none";
  const ratesRail = $("ratesRailBtn");
  if (ratesRail) ratesRail.style.display = "none";

  if (state.activeSidebarCategory === "rates") {
    switchSidebarCategory("contact");
  }

  document.querySelectorAll('.wizard-actions').forEach(el => el.classList.remove('hidden'));
  render();
}

function openInternalDialog() {
  if (state.internalUnlocked) {
    openInternal();
    return;
  }
  const dialog = document.getElementById("passwordDialog");
  if (dialog) {
    document.getElementById("passwordError")?.classList.add("hidden");
    document.getElementById("internalPassword").value = "";
    dialog.showModal();
  }
}

function unlockInternal() {
  const pwd = document.getElementById("internalPassword")?.value;
  if (pwd === "solar2026") {
    document.getElementById("passwordDialog")?.close();
    openInternal();
  } else {
    document.getElementById("passwordError")?.classList.remove("hidden");
  }
}

function openInternal() {
  state.internalUnlocked = true;
  $("internalPanel")?.classList.remove("hidden");
  const resultsPanel = document.querySelector('.results-panel');
  if (resultsPanel) resultsPanel.classList.remove('blurred-overlay');
  $("easyModeButton")?.classList.remove("active");
  $("internalModeButton")?.classList.add("active");

  const ratesPill = $("ratesPillBtn");
  if (ratesPill) ratesPill.style.display = "inline-flex";
  const ratesRail = $("ratesRailBtn");
  if (ratesRail) ratesRail.style.display = "flex";
  switchSidebarCategory("rates");

  const intCustName = document.getElementById("internalCustomerName");
  const extCustName = document.getElementById("customerName");
  if (intCustName && extCustName && !intCustName.value) {
    intCustName.value = extCustName.value;
  }
  
  const intMobile = document.getElementById("internalMobileNumber");
  const extMobile = document.getElementById("mobileNumber");
  if (intMobile && extMobile && !intMobile.value) {
    intMobile.value = extMobile.value;
  }

  const intEmail = document.getElementById("internalEmailAddress");
  const extEmail = document.getElementById("emailAddress");
  if (intEmail && extEmail && !intEmail.value) {
    intEmail.value = extEmail.value;
  }

  document.querySelectorAll('.wizard-actions').forEach(el => el.classList.add('hidden'));

  render();
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.panel !== tab);
  });
}

function switchWorkspaceTab(tabId) {
  state.activeWorkspaceTab = tabId;
  document.querySelectorAll(".workspace-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".workspace-tab-pane").forEach((pane) => {
    const isActive = pane.dataset.pane === tabId;
    pane.classList.toggle("active", isActive);
    pane.style.display = isActive ? "block" : "none";
  });
  const wsHeader = document.querySelector(".workspace-header");
  if (wsHeader) {
    const rect = wsHeader.getBoundingClientRect();
    if (rect.top < 55) {
      wsHeader.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  if (tabId === "cad") {
    const cad = getActiveRooftopCAD();
    if (cad) {
      setTimeout(() => {
        cad.resizeCanvas();
        cad.render();
      }, 50);
    }
  }
}

function switchSidebarCategory(catId) {
  state.activeSidebarCategory = catId;
  document.querySelectorAll(".sidebar-pill-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.cat === catId);
  });
  document.querySelectorAll(".rail-icon-btn").forEach((btn) => {
    if (btn.id !== "expandSidebarBtn") {
      btn.classList.toggle("active", btn.dataset.cat === catId);
    }
  });
  document.querySelectorAll(".cat-section").forEach((sec) => {
    const isActive = sec.dataset.cat === catId;
    sec.classList.toggle("active", isActive);
    sec.style.display = isActive ? "block" : "none";
  });
  const layout = $("mainLayout");
  if (layout?.classList.contains("sidebar-collapsed")) {
    toggleSidebar(false);
  }
}

function toggleSidebar(collapsed) {
  const layout = $("mainLayout");
  const sidebar = $("sidebarPanel");
  const rail = $("sidebarRail");
  const body = $("sidebarBody");
  const headerPills = $("sidebarNavPills");
  
  const isCurrentlyCollapsed = layout?.classList.contains("sidebar-collapsed");
  const shouldCollapse = collapsed !== undefined ? collapsed : !isCurrentlyCollapsed;
  
  if (layout) layout.classList.toggle("sidebar-collapsed", shouldCollapse);
  if (sidebar) sidebar.classList.toggle("collapsed", shouldCollapse);
  if (rail) rail.style.display = shouldCollapse ? "flex" : "none";
  if (body) body.style.display = shouldCollapse ? "none" : "block";
  if (headerPills) headerPills.style.display = shouldCollapse ? "none" : "flex";
  
  const cad = getActiveRooftopCAD();
  if (cad) {
    setTimeout(() => {
      cad.resizeCanvas();
      cad.render();
    }, 250);
  }
}

function resetForm() {
  window.location.reload();
}

function updatePresetDropdown() {
  const select = $("presetSelect");
  if (!select) return;
  
  const presets = JSON.parse(window.localStorage.getItem(PRESETS_STORAGE_KEY) || "{}");
  const presetNames = Object.keys(presets);
  
  const currentValue = select.value;
  
  let html = '<option value="">Load Preset...</option>';
  presetNames.forEach(name => {
    html += `<option value="${name}">${name}</option>`;
  });
  
  select.innerHTML = html;
  if (presetNames.includes(currentValue)) {
    select.value = currentValue;
  }
}

function savePreset() {
  const name = prompt("Enter a name for this preset:");
  if (!name || !name.trim()) return;
  
  const presetData = {};
  ASSUMPTION_IDS.forEach(id => {
    const el = $(id);
    if (el) presetData[id] = el.value;
  });
  
  const presets = JSON.parse(window.localStorage.getItem(PRESETS_STORAGE_KEY) || "{}");
  presets[name.trim()] = presetData;
  window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  
  updatePresetDropdown();
  $("presetSelect").value = name.trim();
  alert(`Preset "${name.trim()}" saved successfully!`);
}

function loadPreset(name) {
  if (!name) return;
  const presets = JSON.parse(window.localStorage.getItem(PRESETS_STORAGE_KEY) || "{}");
  const presetData = presets[name];
  if (!presetData) return;
  
  ASSUMPTION_IDS.forEach(id => {
    const el = $(id);
    if (el && presetData[id] !== undefined) {
      el.value = presetData[id];
    }
  });
  
  render();
}

function attachEvents() {
  ids.forEach((id) => {
    const element = $(id);
    if (!element) return;
    element.addEventListener("input", render);
    element.addEventListener("change", render);
  });

  $("resetButton")?.addEventListener("click", resetForm);
  $("applyExtractedBill")?.addEventListener("click", applyExtractedBill);

  $("goal")?.addEventListener("change", () => {
    state.selectedSystemIndex = null;
    render();
  });

  $("savePresetButton")?.addEventListener("click", savePreset);
  $("presetSelect")?.addEventListener("change", (e) => loadPreset(e.target.value));

  // Self-consumption slider live label
  $("panelWp")?.addEventListener("input", (e) => {
    $("panelWpLabel").textContent = `${e.target.value} Wp`;
  });

  $("panelEfficiency")?.addEventListener("input", (e) => {
    $("panelEfficiencyLabel").textContent = `${e.target.value}%`;
  });

  $("selfConsumptionPct")?.addEventListener("input", (e) => {
    const label = $("selfConsumptionLabel");
    if (label) label.textContent = `${e.target.value}%`;
    render();
  });

  // Report Display hide toggles
  ["hidePayback", "hideAreaFit", "hideSubsidy", "hideCost", "hideFinancing", "solarInstalled"].forEach(id => {
    $(id)?.addEventListener("change", render);
  });

  // Payment & Financing sync listeners
  $("paymentMode")?.addEventListener("change", (e) => {
    const isLoan = e.target.value === "loan";
    $("customerLoanFields")?.classList.toggle("hidden", !isLoan);
    if ($("internalPaymentMode")) $("internalPaymentMode").value = e.target.value;
    render();
  });
  $("internalPaymentMode")?.addEventListener("change", (e) => {
    if ($("paymentMode")) {
      $("paymentMode").value = e.target.value;
      $("customerLoanFields")?.classList.toggle("hidden", e.target.value !== "loan");
    }
    render();
  });
  $("loanInterestRate")?.addEventListener("input", (e) => {
    if ($("internalLoanInterestRate")) $("internalLoanInterestRate").value = e.target.value;
  });
  $("internalLoanInterestRate")?.addEventListener("input", (e) => {
    if ($("loanInterestRate")) $("loanInterestRate").value = e.target.value;
  });
  $("loanAmount")?.addEventListener("input", (e) => {
    if ($("internalLoanAmount")) $("internalLoanAmount").value = e.target.value;
  });
  $("internalLoanAmount")?.addEventListener("input", (e) => {
    if ($("loanAmount")) $("loanAmount").value = e.target.value;
  });
  $("loanMonthlyEmi")?.addEventListener("input", (e) => {
    if ($("internalLoanMonthlyEmi")) $("internalLoanMonthlyEmi").value = e.target.value;
  });
  $("internalLoanMonthlyEmi")?.addEventListener("input", (e) => {
    if ($("loanMonthlyEmi")) $("loanMonthlyEmi").value = e.target.value;
  });

  // Mode buttons
  $("easyModeButton")?.addEventListener("click", lockInternal);
  $("internalModeButton")?.addEventListener("click", openInternalDialog);

  // Dialog buttons
  $("unlockButton")?.addEventListener("click", unlockInternal);
  
  $("internalPassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockInternal();
    }
  });

  // Consumer category change: toggle conditional fields and update slab defaults
  $("consumerCategory")?.addEventListener("change", () => {
    const cat = $("consumerCategory").value;
    const profile = TARIFF_PROFILES[cat];
    if (!profile) return;

    // Toggle conditional fields
    const sub = $("subsidyCategory")?.value;
    $("numFlatsField")?.classList.toggle("hidden", cat !== "LT-I-GHS" && sub !== "ghs");
    $("powerFactorField")?.classList.toggle("hidden", !profile.pfIncentiveApplicable);
    $("peakUsageField")?.classList.toggle("hidden", profile.todPeakPenaltyPct <= 0);
    $("subsidyCategoryContainer")?.classList.toggle("hidden", profile.subsidyType === "none");
    $("panelType")?.closest("label")?.classList.toggle("hidden", profile.subsidyType === "none");

    // Update slab rate fields to reflect profile defaults
    const slabs = profile.slabs || [];
    for (let i = 1; i <= 4; i++) {
      const el = $(`slabRate${i}`);
      if (el && slabs[i - 1]) {
        el.value = slabs[i - 1].rate;
      } else if (el) {
        el.value = "";
      }
    }

    // Update fixed charge and duty defaults
    const fcEl = $("fixedCharge");
    if (fcEl) fcEl.value = Math.round(profile.fixedChargePerKw * (numberValue("sanctionedLoad") || 5));
    const dutyEl = $("electricityDuty");
    if (dutyEl) dutyEl.value = profile.dutyRate || 7;

    render();
  });

  $("fetchLocationButton")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    const btn = $("fetchLocationButton");
    btn.textContent = "Fetching...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        $("coordinates").value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        // Suggest tilt angle = latitude (rounded)
        if ($("tiltAngle").value === "") {
          $("tiltAngle").value = Math.max(0, Math.round(lat));
        }
        btn.textContent = "Auto-fetch";
        render();
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Failed to fetch location. Please check browser permissions.");
        btn.textContent = "Auto-fetch";
      }
    );
  });


  // Metering Mode Selector Buttons
  $("meteringModeSingleBtn")?.addEventListener("click", () => setMeteringMode("single"));
  $("meteringModeMultiBtn")?.addEventListener("click", () => setMeteringMode("multi"));

  // Multi-Meter Action Buttons
  $("mmAddMeterBtn")?.addEventListener("click", () => {
    const nextIndex = state.meters.length + 1;
    state.meters.push({
      id: "meter_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      label: `Flat ${nextIndex}`,
      consumerNumber: "",
      consumerName: `Flat ${nextIndex}`,
      sanctionedLoad: 3,
      monthlyUnits: 300,
      monthlyBill: 3500,
      consumerCategory: $("consumerCategory")?.value || "LT-I",
      connectionPhase: $("connectionPhase")?.value || "1-phase",
      allocatedKw: 0,
      subsidy: 0,
    });
    const targetCapacity = state.estimates?.recommended?.dcCapacityKw || 0;
    if (targetCapacity > 0) {
      state.meters = distributeCapacityAcrossMeters(targetCapacity, state.meters, state.allocationStrategy || "proportional");
    }
    renderMultiMeterTable();
    render();
  });

  $("mmAutoDistributeBtn")?.addEventListener("click", () => {
    state.allocationStrategy = "proportional";
    const targetCapacity = state.estimates?.recommended?.dcCapacityKw || 0;
    if (targetCapacity > 0 && state.meters.length > 0) {
      state.meters = distributeCapacityAcrossMeters(targetCapacity, state.meters, "proportional");
      renderMultiMeterTable();
      render();
    }
  });

  $("mmEqualDistributeBtn")?.addEventListener("click", () => {
    state.allocationStrategy = "equal";
    const targetCapacity = state.estimates?.recommended?.dcCapacityKw || 0;
    if (targetCapacity > 0 && state.meters.length > 0) {
      state.meters = distributeCapacityAcrossMeters(targetCapacity, state.meters, "equal");
      renderMultiMeterTable();
      render();
    }
  });

  $("billUpload").addEventListener("change", async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      state.extractedBill = null;
      $("billUploadStatus").textContent = "";
      $("billUploadStatus").className = "";
      render();
      return;
    }

    const statusEl = $("billUploadStatus");
    statusEl.className = "upload-status-loading";

    if (files.length > 1 || state.meteringMode === "multi") {
      setMeteringMode("multi");
      statusEl.innerHTML = `<span class="spinner"></span> Processing ${files.length} bill(s)...`;
      try {
        const batchResults = await parseMultipleMsebBillFiles(files, (progress) => {
          statusEl.textContent = `Processing bill ${progress.current} of ${progress.total} (${progress.fileName})…`;
        });

        const newMeters = [];
        batchResults.forEach((res, idx) => {
          if (res.success && res.meter) {
            const m = res.meter;
            newMeters.push({
              id: "meter_" + Date.now() + "_" + idx,
              label: m.label || `Flat ${idx + 1}`,
              consumerNumber: m.consumerNumber || "",
              consumerName: m.consumerName || "",
              sanctionedLoad: m.sanctionedLoad || 5,
              monthlyUnits: m.monthlyUnits || 0,
              monthlyBill: m.monthlyBill || 0,
              consumerCategory: m.consumerCategory || "LT-I",
              connectionPhase: m.connectionPhase || "1-phase",
              allocatedKw: 0,
              subsidy: 0,
            });
          }
        });

        if (newMeters.length > 0) {
          const hasRealMeters = state.meters.some((m) => m.consumerNumber);
          if (!hasRealMeters) {
            state.meters = newMeters;
          } else {
            state.meters = [...state.meters, ...newMeters];
          }

          const targetCapacity = state.estimates?.recommended?.dcCapacityKw || 0;
          if (targetCapacity > 0) {
            state.meters = distributeCapacityAcrossMeters(targetCapacity, state.meters, state.allocationStrategy || "proportional");
          }
        }

        statusEl.className = "upload-status-success";
        const successCount = batchResults.filter((r) => r.success).length;
        statusEl.textContent = `✓ Processed ${successCount} of ${files.length} bill(s) successfully.`;
        renderMultiMeterTable();
        render();
      } catch (err) {
        statusEl.className = "upload-status-error";
        statusEl.textContent = `✗ Batch bill processing failed: ${err.message}`;
      }
      return;
    }

    // Single file processing
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isAI = isSupportedBillFile(file) && ext !== "txt" && ext !== "csv";

    if (isAI) {
      statusEl.innerHTML = `<span class="spinner"></span> Analyzing ${file.name} with Gemini AI… this may take a few seconds.`;
    } else {
      statusEl.textContent = `Extracting ${file.name}…`;
    }

    try {
      state.extractedBill = await parseMsebBillFile(file);
      applyExtractedBill();
      statusEl.className = "upload-status-success";
      const method = state.extractedBill?.extractionMethod === "gemini-structured" ? "Gemini AI" : "text";
      statusEl.textContent = `✓ ${file.name} — extracted via ${method} and applied.`;
    } catch (error) {
      state.extractedBill = null;
      statusEl.className = "upload-status-error";
      statusEl.textContent = `✗ ${file.name}: ${error.message}`;
      render();
    }
  });

  $("downloadProposalButton")?.addEventListener("click", () => {
    if (state.estimates) {
      // Validate compulsory multi-meter fields before generating PDF
      if (state.meteringMode === "multi" && state.meters.length > 0) {
        const invalidMeters = state.meters.filter(m => !m.consumerNumber?.trim() || !m.label?.trim() || !(Number(m.sanctionedLoad) > 0));
        if (invalidMeters.length > 0) {
          alert(`Cannot generate proposal: ${invalidMeters.length} flat/meter(s) are missing compulsory details.\n\nEvery meter must have at minimum:\n1. Consumer Number\n2. Consumer Name / Flat Identifier\n3. Sanctioned Load (kW)\n\nPlease complete these in the Multi-Meter panel before downloading.`);
          const warningEl = $("mmCompulsoryWarning");
          if (warningEl) {
            warningEl.style.display = "block";
            warningEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      }

      saveProposalData(); // Automatically save data when downloading report
      const btn = $("downloadProposalButton");
      const origText = btn?.textContent;
      btn.textContent = "Generating PDF...";
      btn.disabled = true;

      // Determine the selected option (user pick or auto-recommended)
      const est = state.estimates;
      const selectedOption = (state.selectedSystemIndex !== null && state.selectedSystemIndex >= 0 && state.selectedSystemIndex < est.options.length)
        ? est.options[state.selectedSystemIndex]
        : est.recommended;
        
      if (state.internalUnlocked && state.costBreakupList) {
        selectedOption.costBreakupList = state.costBreakupList;
      }
      if (state.systemIncludesText && state.systemIncludesText[selectedOption.systemType]) {
        selectedOption.systemIncludesText = state.systemIncludesText[selectedOption.systemType];
      }
      const hideFlags = {
        showCadDiagram: $("showCadDiagram")?.checked !== false,
        hidePayback: $("hidePayback")?.checked || false,
        hideAreaFit: $("hideAreaFit")?.checked || false,
        hideSubsidy: $("hideSubsidy")?.checked || false,
        hideCost: $("hideCost")?.checked || false,
        hideFinancing: $("hideFinancing")?.checked || false,
        solarInstalled: $("solarInstalled")?.checked || false,
        proposalSerialNo: $("proposalSerialNo")?.value || "DC/2026-27/PROP-1001",
        customerAddress: $("customerAddress")?.value || "Pune, Maharashtra",
        saveEnergyCharges: $("saveEnergyCharges")?.checked !== false,
        saveElectricityDuty: $("saveElectricityDuty")?.checked !== false,
        saveWheelingFac: $("saveWheelingFac")?.checked !== false,
        saveTodRebate: $("saveTodRebate")?.checked !== false,
      };

      setTimeout(() => {
        import(`./reportGenerator.js?v=${Date.now()}`).then((module) => {
          if (module && module.generateProposalPDF) {
            module.generateProposalPDF(est, selectedOption, hideFlags);
          } else if (window.generateProposalPDF) {
            window.generateProposalPDF(est, selectedOption, hideFlags);
          }
        }).catch(err => {
          console.error("Failed to load PDF generator", err);
          alert("Failed to generate PDF: " + err.message);
        }).finally(() => {
          if (btn) { btn.textContent = origText; btn.disabled = false; }
        });
      }, 100);
    } else {
      alert("Please ensure all inputs are filled to calculate the estimate before downloading.");
    }
  });

  const handleSaveClick = () => {
    if (!state.estimates) {
      try { render(); } catch (_) {}
    }
    saveProposalData();
  };

  $("saveProposalButtonInternal")?.addEventListener("click", handleSaveClick);
  $("sidebarSaveProposalBtn")?.addEventListener("click", handleSaveClick);

  $("openLoadProposalModalButton")?.addEventListener("click", () => {
    const modal = $("loadProposalModal");
    if (modal) {
      modal.style.display = "flex";
      searchProposals("");
    }
  });

  $("closeLoadProposalModal")?.addEventListener("click", () => {
    const modal = $("loadProposalModal");
    if (modal) modal.style.display = "none";
  });

  $("searchProposalBtn")?.addEventListener("click", () => {
    const query = $("searchProposalInput")?.value || "";
    searchProposals(query);
  });

  $("searchProposalInput")?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      searchProposals(e.target.value);
    }
  });

  $("importJsonProposalBtn")?.addEventListener("click", () => {
    $("loadProposalFileInput")?.click();
  });

  $("loadProposalFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      window.importProposalJSONFile(file);
      e.target.value = "";
    }
  });

  $("exportJsonProposalBtn")?.addEventListener("click", () => {
    window.exportCurrentProposalJSON();
  });

  $("downloadProposalButtonInternal")?.addEventListener("click", () => {
    if (state.estimates) {
      // Validate compulsory multi-meter fields before generating PDF
      if (state.meteringMode === "multi" && state.meters.length > 0) {
        const invalidMeters = state.meters.filter(m => !m.consumerNumber?.trim() || !m.label?.trim() || !(Number(m.sanctionedLoad) > 0));
        if (invalidMeters.length > 0) {
          alert(`Cannot generate proposal: ${invalidMeters.length} flat/meter(s) are missing compulsory details.\n\nEvery meter must have at minimum:\n1. Consumer Number\n2. Consumer Name / Flat Identifier\n3. Sanctioned Load (kW)\n\nPlease complete these in the Multi-Meter panel before downloading.`);
          const warningEl = $("mmCompulsoryWarning");
          if (warningEl) {
            warningEl.style.display = "block";
            warningEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      }

      const btn = $("downloadProposalButtonInternal");
      const origText = btn?.textContent;
      if (btn) { btn.textContent = "Generating PDF..."; btn.disabled = true; }

      const est = state.estimates;
      const selectedOption = (state.selectedSystemIndex !== null && state.selectedSystemIndex >= 0 && state.selectedSystemIndex < est.options.length)
        ? est.options[state.selectedSystemIndex]
        : est.recommended;
        
      if (state.internalUnlocked && state.costBreakupList) {
        selectedOption.costBreakupList = state.costBreakupList;
      }
      if (state.systemIncludesText && state.systemIncludesText[selectedOption.systemType]) {
        selectedOption.systemIncludesText = state.systemIncludesText[selectedOption.systemType];
      }
      const hideFlags = {
        showCadDiagram: $("showCadDiagram")?.checked !== false,
        hidePayback: $("hidePayback")?.checked || false,
        hideAreaFit: $("hideAreaFit")?.checked || false,
        hideSubsidy: $("hideSubsidy")?.checked || false,
        hideCost: $("hideCost")?.checked || false,
        hideFinancing: $("hideFinancing")?.checked || false,
        solarInstalled: $("solarInstalled")?.checked || false,
        proposalSerialNo: $("proposalSerialNo")?.value || "DC/2026-27/PROP-1001",
        customerAddress: $("customerAddress")?.value || "Pune, Maharashtra",
        saveEnergyCharges: $("saveEnergyCharges")?.checked !== false,
        saveElectricityDuty: $("saveElectricityDuty")?.checked !== false,
        saveWheelingFac: $("saveWheelingFac")?.checked !== false,
        saveTodRebate: $("saveTodRebate")?.checked !== false,
      };

      setTimeout(() => {
        import(`./reportGenerator.js?v=${Date.now()}`).then((module) => {
          if (module && module.generateProposalPDF) {
            module.generateProposalPDF(est, selectedOption, hideFlags);
          } else if (window.generateProposalPDF) {
            window.generateProposalPDF(est, selectedOption, hideFlags);
          }
        }).catch(err => {
          console.error("Failed to load PDF generator", err);
          alert("Failed to generate PDF: " + err.message);
        }).finally(() => {
          if (btn) { btn.textContent = origText; btn.disabled = false; }
        });
      }, 100);
    } else {
      alert("Please calculate an estimate first before downloading the proposal.");
    }
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  // Workspace Tabs
  document.querySelectorAll(".workspace-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchWorkspaceTab(btn.dataset.tab));
  });

  // Sidebar Category Pills
  document.querySelectorAll(".sidebar-pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchSidebarCategory(btn.dataset.cat));
  });

  // Sidebar Rail Icon Buttons
  document.querySelectorAll(".rail-icon-btn").forEach((btn) => {
    if (btn.id !== "expandSidebarBtn") {
      btn.addEventListener("click", () => switchSidebarCategory(btn.dataset.cat));
    }
  });

  // Sidebar Collapse / Expand Toggles
  $("toggleSidebarBtn")?.addEventListener("click", () => toggleSidebar());
  $("collapseSidebarBtn")?.addEventListener("click", () => toggleSidebar(true));
  $("expandSidebarBtn")?.addEventListener("click", () => toggleSidebar(false));

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
    }
  });

  // Quick Action Buttons
  $("sidebarCalculateBtn")?.addEventListener("click", () => render());
  $("ribbonDownloadPdfBtn")?.addEventListener("click", () => {
    $("downloadProposalButtonInternal")?.click();
  });

  // Synchronize CAD Report Toggle Button <-> #showCadDiagram Checkbox
  const cadTogglePdfBtn = $("cadTogglePdfReportBtn");
  const showCadCb = $("showCadDiagram");
  if (cadTogglePdfBtn && showCadCb) {
    const updateCadPdfBtnVisual = () => {
      if (showCadCb.checked) {
        cadTogglePdfBtn.classList.add("active");
        cadTogglePdfBtn.title = "Blueprint will appear in PDF report (Click to hide)";
        cadTogglePdfBtn.style.borderColor = "var(--primary-green, #16a34a)";
        cadTogglePdfBtn.style.color = "var(--primary-green, #16a34a)";
      } else {
        cadTogglePdfBtn.classList.remove("active");
        cadTogglePdfBtn.title = "Blueprint hidden from PDF report (Click to include)";
        cadTogglePdfBtn.style.borderColor = "var(--line, #cbd5e1)";
        cadTogglePdfBtn.style.color = "var(--text-muted, #64748b)";
      }
    };
    cadTogglePdfBtn.addEventListener("click", () => {
      showCadCb.checked = !showCadCb.checked;
      updateCadPdfBtnVisual();
      render();
    });
    showCadCb.addEventListener("change", updateCadPdfBtnVisual);
    updateCadPdfBtnVisual();
  }

  $("panelConfigSelect")?.addEventListener("change", () => {
    const pl = state.estimates?.panelLayout;
    const input = readInput();
    if (pl) renderDiagram(pl, input);
  });
}

let slackSent = false;
let whatsappSent = false;

window.goToStep = function(step) {
  if (step > 1) {
    const mobile = document.getElementById('mobileNumber').value.trim();
    if (!mobile) {
      alert("Please enter your Mobile Number before proceeding.");
      return;
    }

    const name = document.getElementById('customerName').value.trim();
    const email = document.getElementById('emailAddress').value.trim();

    if (!slackSent) {
      const payload = {
        text: `*New Solar Calculator Lead*\n*Name:* ${name || 'N/A'}\n*Mobile:* ${mobile}\n*Email:* ${email || 'N/A'}`
      };

      fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.error("Slack proxy error:", err));
      
      slackSent = true;
    }

    // Send WhatsApp welcome message (once per session)
    if (!whatsappSent) {
      const today = new Date().toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric"
      });

      fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: mobile,
          name: name || 'Customer',
          visitType: 'solar consultation',
          visitDate: today,
          surveyMinutes: '2'
        })
      })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            console.log("WhatsApp message sent:", data.messageId);
          } else {
            console.warn("WhatsApp send issue:", data.error, data.details);
          }
        })
        .catch(err => console.error("WhatsApp proxy error:", err));

      whatsappSent = true;
    }
    
    // Remove blur overlay when customer basics are filled
    const resultsPanel = document.querySelector('.results-panel');
    if (resultsPanel) resultsPanel.classList.remove('blurred-overlay');
  } else {
    // If going back to step 1, optionally re-blur if slack isn't sent yet
    const resultsPanel = document.querySelector('.results-panel');
    if (resultsPanel && !slackSent) {
      resultsPanel.classList.add('blurred-overlay');
    }
  }

  // Only apply step hiding if not in internal mode
  if (!state.internalUnlocked) {
    document.querySelectorAll('.wizard-step').forEach((el, index) => {
      if (index + 1 === step) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  }
}

window.finishWizard = function() {
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    document.querySelector('.results-panel').scrollIntoView({ behavior: 'smooth' });
  } else {
    alert('Results are updated on the right panel!');
  }
}

updatePresetDropdown();
attachEvents();
render();

function applySavingsConfig(estimate, input) {
  if (!state.savingsConfig) state.savingsConfig = {};
  
  estimate.options.forEach(option => {
    let sysType = option.systemType;
    let sb = option.savingsBreakdown;
    const hasBattery = (option.batteryCapacityKwh > 0) || (option.costBreakup && option.costBreakup.battery > 0);
    
    let defaultItems = [
      { id: 'energyChargeOffset', label: 'Energy Charges Offset', value: sb.energyChargeOffset !== undefined ? sb.energyChargeOffset : sb.baseSavings },
      { id: 'dutyOffset', label: 'Electricity Duty Offset', value: sb.dutyOffset || 0 },
    ];
    if (sb.wheelingFacOffset > 0) {
      defaultItems.push({ id: 'wheelingFacOffset', label: 'Wheeling & Fuel Adjustment (FAC) Offset', value: sb.wheelingFacOffset });
    }
    if (sb.todDaytimeRebate > 0) {
      defaultItems.push({ id: 'todDaytimeRebate', label: 'ToD Daytime Solar Generation Credit', value: sb.todDaytimeRebate });
    }
    // Only include Peak penalty avoided for systems with a battery
    if (hasBattery && sb.todPeakAvoided > 0) {
      defaultItems.push({ id: 'todPeakAvoided', label: 'Peak penalty avoided', value: sb.todPeakAvoided });
    }
    if (sb.pfIncentive > 0) {
      defaultItems.push({ id: 'pfIncentive', label: 'PF improvement', value: sb.pfIncentive });
    }
    if (sb.promptPayDiscount > 0) {
      defaultItems.push({ id: 'promptPayDiscount', label: 'Prompt pay discount', value: sb.promptPayDiscount });
    }
    
    // Purge any legacy baseSavings/slab offset or bankingLoss from saved or active config
    if (state.savingsConfig[sysType]) {
      const hasLegacy = state.savingsConfig[sysType].some(x => x.id === 'baseSavings' || (x.label && x.label.toLowerCase().includes('slab')));
      if (hasLegacy) {
        delete state.savingsConfig[sysType];
      } else {
        state.savingsConfig[sysType] = state.savingsConfig[sysType].filter(item => {
          if (item.id === 'bankingLoss' || (item.label && item.label.toLowerCase().includes('banking'))) return false;
          if (!hasBattery && (item.id === 'todPeakAvoided' || (item.label && item.label.toLowerCase().includes('peak penalty')))) return false;
          return true;
        });
      }
    }

    if (!state.savingsConfig[sysType] || state.savingsConfig[sysType].length === 0) {
      state.savingsConfig[sysType] = defaultItems.map(di => ({
        id: di.id,
        label: di.label,
        isHidden: false,
        isOverride: false,
        overrideValue: di.value
      }));
    } else {
      defaultItems.forEach(di => {
        if (!state.savingsConfig[sysType].some(x => x.id === di.id)) {
          state.savingsConfig[sysType].push({
            id: di.id,
            label: di.label,
            isHidden: false,
            isOverride: false,
            overrideValue: di.value
          });
        }
      });
    }
    
    let configList = state.savingsConfig[sysType];
    let finalSavingsItems = [];
    let totalMonthlySavings = 0;
    
    configList.forEach(c => {
      if (c.id === 'bankingLoss' || (c.label && c.label.toLowerCase().includes('banking'))) return;
      if (!hasBattery && (c.id === 'todPeakAvoided' || (c.label && c.label.toLowerCase().includes('peak penalty')))) return;

      let item = { ...c };
      let di = defaultItems.find(x => x.id === c.id);
      let computedValue = di ? di.value : 0;
      item.value = c.isOverride ? c.overrideValue : computedValue;
      if (di) item.label = di.label;
      
      // Negative value components should not be included in estimated savings
      if (item.value < 0) return;

      if (!c.isHidden && item.value > 0) {
        totalMonthlySavings += item.value;
      }
      finalSavingsItems.push(item);
    });
    
    option.savingsBreakdownList = finalSavingsItems;
    
    // Update calculated totals based on visible savings components, matching effective monthly bill
    const effBill = input.monthlyBill > 0 ? input.monthlyBill : (option.currentBillBreakdown?.total || totalMonthlySavings);
    const hasAnyOverride = configList.some(c => c.isOverride);
    if (!hasAnyOverride) {
      if (option.offsetUnits >= (input.monthlyUnits || 0) && input.monthlyUnits > 0) {
        totalMonthlySavings = effBill;
      } else if (effBill > 0) {
        totalMonthlySavings = Math.min(totalMonthlySavings, effBill);
      }
    }

    option.monthlySavings = totalMonthlySavings;
    option.annualSavings = totalMonthlySavings * 12;
    // Basic recalculation of lifetime assuming default escalation, or just simple multiple
    option.lifetimeSavings = option.annualSavings * 25; 
  });
}

function applyBillConfig(estimate, input) {
  if (!state.billConfig) state.billConfig = {};
  
  estimate.options.forEach(option => {
    let sysType = option.systemType;
    let cb = option.currentBillBreakdown;
    if (!cb) return;
    
    let defaultItems = [];
    if (cb.items && cb.items.length > 0) {
      defaultItems = cb.items.map((item, idx) => ({
        id: `ocr_item_${idx}`,
        label: item.label,
        value: item.amount,
        isRed: !item.label.toLowerCase().includes("fixed") && !item.label.toLowerCase().includes("demand")
      }));
    } else {
      defaultItems.push({ id: 'fixedCharge', label: 'Fixed Charges', value: cb.fixedCharge, isRed: false });
      defaultItems.push({ id: 'energyCharge', label: 'Energy Charges', value: cb.energyCharge, isRed: true });
      if (cb.wheelingFac > 0) {
        defaultItems.push({ id: 'wheelingFac', label: 'Wheeling & Fuel Adj. (FAC)', value: cb.wheelingFac, isRed: true });
      }
      defaultItems.push({ id: 'duty', label: 'Electricity Duty', value: cb.duty, isRed: true });
      if (cb.todPenalty > 0) {
        defaultItems.push({ id: 'todPenalty', label: 'ToD Peak Penalty', value: cb.todPenalty, isRed: true });
      }
    }
    
    const hasOcrItems = state.billConfig[sysType]?.some(x => x.id.startsWith("ocr_item_"));
    if (!state.billConfig[sysType] || (cb.items && state.billConfig[sysType].length !== defaultItems.length) || (!cb.items && hasOcrItems)) {
      state.billConfig[sysType] = defaultItems.map(di => ({
        id: di.id,
        label: di.label,
        isHidden: false,
        isOverride: false,
        overrideValue: di.value,
        isRed: di.isRed
      }));
    } else {
      defaultItems.forEach(di => {
        if (!state.billConfig[sysType].some(x => x.id === di.id)) {
          state.billConfig[sysType].push({
            id: di.id,
            label: di.label,
            isHidden: false,
            isOverride: false,
            overrideValue: di.value,
            isRed: di.isRed
          });
        }
      });
    }
    
    let configList = state.billConfig[sysType];
    let finalBillItems = [];
    let totalBill = 0;
    
    configList.forEach(c => {
      let item = { ...c };
      let di = defaultItems.find(x => x.id === c.id);
      let computedValue = di ? di.value : 0;
      item.value = c.isOverride ? c.overrideValue : computedValue;
      if (di) {
        item.label = di.label;
        item.isRed = di.isRed;
      }
      
      if (!c.isHidden && item.value !== 0) {
        totalBill += item.value;
      }
      finalBillItems.push(item);
    });
    
    option.currentBillBreakdownList = finalBillItems;
    option.currentBillBreakdown.total = totalBill;
  });
}

function applyBreakupConfig(estimate, input, config = readConfig()) {
  if (!state.breakupConfig) state.breakupConfig = {};

  estimate.options.forEach(option => {
    let sysType = option.systemType;
    let mainInverterPrefix = sysType === "hybrid" ? "Hybrid" : (sysType === "offgrid" ? "Off-grid" : "On-grid");

    let defaultItems = [
      { id: 'panels', label: 'Solar Panels', value: option.costBreakup.panels },
      { id: 'structure', label: `Mounting Structure (${STRUCTURE_LABELS[input.structureType]})`, value: option.costBreakup.structure },
      { id: 'inverter', label: `${mainInverterPrefix} Inverter`, value: option.costBreakup.inverter },
    ];
    if (option.costBreakup.backupInverter > 0) {
      defaultItems.push({ id: 'backupInverter', label: 'Backup Off-grid Inverter', value: option.costBreakup.backupInverter });
    }
    if (option.costBreakup.battery > 0) {
      defaultItems.push({ id: 'battery', label: option.costBreakup.backupInverter > 0 ? 'Backup Battery Storage' : 'Battery Storage', value: option.costBreakup.battery });
    }
    defaultItems.push(
      { id: 'safetyAndEarthing', label: 'Safety and earthing', value: option.costBreakup.safetyAndEarthing },
      { id: 'wiringExcludingCable', label: 'Wiring excluding cable cost', value: option.costBreakup.wiringExcludingCable },
      { id: 'installation', label: 'Installation & Commissioning', value: option.costBreakup.installation },
      { id: 'consultancy', label: 'Consultancy', value: option.costBreakup.consultancy }
    );

    // If config doesn't exist for this sysType, seed it
    if (!state.breakupConfig[sysType]) {
      state.breakupConfig[sysType] = defaultItems.map(di => ({
        id: di.id,
        label: di.label,
        isHeader: false,
        isHidden: false,
        isOverride: false,
        overrideValue: di.value
      }));
    } else {
      // Migrate legacy electricalSafetyAndWiring to separate items if present
      const oldIdx = state.breakupConfig[sysType].findIndex(x => x.id === 'electricalSafetyAndWiring');
      if (oldIdx !== -1) {
        const oldItem = state.breakupConfig[sysType][oldIdx];
        state.breakupConfig[sysType].splice(oldIdx, 1,
          {
            id: 'safetyAndEarthing',
            label: 'Safety and earthing',
            isHeader: false,
            isHidden: oldItem.isHidden,
            isOverride: false,
            overrideValue: option.costBreakup.safetyAndEarthing,
          },
          {
            id: 'wiringExcludingCable',
            label: 'Wiring excluding cable cost',
            isHeader: false,
            isHidden: oldItem.isHidden,
            isOverride: false,
            overrideValue: option.costBreakup.wiringExcludingCable,
          }
        );
      }
    }

    let configList = state.breakupConfig[sysType];
    let preTaxSubtotal = 0;
    let finalItems = [];

    configList.forEach(c => {
      let item = { ...c };
      if (!c.isHeader) {
        let di = defaultItems.find(x => x.id === c.id);
        let computedValue = di ? di.value : 0;
        item.value = c.isOverride ? c.overrideValue : computedValue;
        if (!c.isHidden) {
          preTaxSubtotal += item.value;
        }
      }
      finalItems.push(item);
    });

    const goodsShare = 0.70;
    const servicesShare = 0.30;
    const effectiveGstRate = (goodsShare * 5) + (servicesShare * 18);
    
    // Check if GST is overridden
    let configGst = state.breakupConfigGst && state.breakupConfigGst[sysType] !== undefined ? state.breakupConfigGst[sysType] : null;
    const gst = configGst !== null ? configGst : preTaxSubtotal * (effectiveGstRate / 100);
    
    // Contingency
    let configContingency = state.breakupConfigContingency && state.breakupConfigContingency[sysType] !== undefined ? state.breakupConfigContingency[sysType] : null;
    const contingency = configContingency !== null ? configContingency : preTaxSubtotal * ((input.contingencyRate || 0) / 100);

    const baseCostInclGst = preTaxSubtotal + gst + contingency;

    // Margin (default 30% of total component costs incl. of GST)
    let defaultMarginRate = (config && config.pricing && config.pricing.marginRate !== undefined) ? config.pricing.marginRate : 30;
    let marginRate = (state.breakupConfigMarginPct && state.breakupConfigMarginPct[sysType] !== undefined)
      ? state.breakupConfigMarginPct[sysType]
      : defaultMarginRate;
    const margin = baseCostInclGst * (marginRate / 100);

    option.costBreakup.effectiveGstRate = effectiveGstRate;
    option.costBreakup.gst = gst;
    option.costBreakup.contingency = contingency;
    option.costBreakup.baseCostInclGst = baseCostInclGst;
    option.costBreakup.marginRate = marginRate;
    option.costBreakup.margin = margin;

    let effectiveSubsidy = $("hideSubsidy")?.checked ? 0 : option.subsidy;
    
    if ($("hideCost")?.checked) {
      option.totalPreSubsidy = 0;
      effectiveSubsidy = 0;
      option.subsidy = 0;
      option.netCost = 0;
    } else {
      option.totalPreSubsidy = baseCostInclGst + margin;
      option.netCost = Math.max(option.totalPreSubsidy - effectiveSubsidy, 0);
    }
    
    option.paybackYears = option.annualSavings > 0 && option.netCost > 0 ? option.netCost / option.annualSavings : 0;
    option.roiPercent = option.netCost > 0 ? (option.annualSavings / option.netCost) * 100 : Infinity;

    if (option.financing) {
      const effBill = input.monthlyBill > 0 ? input.monthlyBill : (option.currentBillBreakdown?.total || 0);
      option.financing = calculateSolarFinancing({
        netCost: option.netCost,
        totalPreSubsidy: option.totalPreSubsidy,
        subsidy: option.subsidy,
        monthlyBill: effBill,
        monthlySavings: option.monthlySavings,
        lifetimeSavings: option.lifetimeSavings,
        paymentMode: input.paymentMode || "upfront",
        loanAmountOverride: input.loanAmount,
        interestRatePct: input.loanInterestRate ?? 9.5,
        loanMonthlyEmiOverride: input.loanMonthlyEmi,
        loanTenureMonthsOverride: input.loanTenureMonths,
      });
    }

    option.costBreakupList = finalItems;
  });
}

function captureFormValues() {
  const values = {};
  const ignoredTypes = new Set(["file", "password"]);
  const ignoredIds = new Set(["searchProposalInput", "presetSelect"]);

  document.querySelectorAll("input, select, textarea").forEach((el) => {
    if (!el.id || ignoredIds.has(el.id) || ignoredTypes.has(el.type)) return;
    if (el.type === "checkbox") {
      values[el.id] = el.checked;
    } else {
      values[el.id] = el.value;
    }
  });
  return values;
}

function buildProposalSnapshot() {
  const input = readInput();
  const config = readConfig();
  const formValues = captureFormValues();

  // Structured Rates snapshot for direct inspection and export
  const rates = {
    panelDcrRate: numberValue("panelDcrRate"),
    panelNonDcrRate: numberValue("panelNonDcrRate"),
    batteryRate: numberValue("batteryRate"),
    hotDipStructureRate: numberValue("hotDipStructureRate"),
    galvalumeStructureRate: numberValue("galvalumeStructureRate"),
    gpPurlinStructureRate: numberValue("gpPurlinStructureRate"),
    wiringRate: numberValue("wiringRate"),
    installationRate: numberValue("installationRate"),
    consultancyRate: numberValue("consultancyRate"),
    contingencyRate: numberValue("contingencyRate"),
    marginRate: numberValue("marginRate"),
    panelWp: numberValue("panelWp"),
    dailyGeneration: numberValue("dailyGeneration"),
    shadingLoss: numberValue("shadingLoss"),
    orientationLoss: numberValue("orientationLoss"),
    systemLoss: numberValue("systemLoss"),
    degradationRate: numberValue("degradationRate"),
    panelEfficiency: numberValue("panelEfficiency"),
    batteryDod: numberValue("batteryDod"),
    inverterEfficiency: numberValue("inverterEfficiency"),
    selfConsumptionPct: numberValue("selfConsumptionPct"),
    fixedCharge: numberValue("fixedCharge"),
    electricityDuty: numberValue("electricityDuty"),
    tariffEscalation: numberValue("tariffEscalation"),
    savingsMethod: $("savingsMethod")?.value || "marginal",
    slabRate1: numberValue("slabRate1"),
    slabRate2: numberValue("slabRate2"),
    slabRate3: numberValue("slabRate3"),
    slabRate4: numberValue("slabRate4"),
  };

  // Structured Loans snapshot
  const loans = {
    paymentMode: $("paymentMode")?.value || "upfront",
    loanInterestRate: numberValue("loanInterestRate") || 9.5,
    loanAmount: numberValue("loanAmount") || 0,
    loanMonthlyEmi: numberValue("loanMonthlyEmi") || 0,
    internalPaymentMode: $("internalPaymentMode")?.value || "upfront",
    internalLoanInterestRate: numberValue("internalLoanInterestRate") || 9.5,
    internalLoanAmount: numberValue("internalLoanAmount") || 0,
    internalLoanMonthlyEmi: numberValue("internalLoanMonthlyEmi") || 0,
    internalLoanTenureMonths: numberValue("internalLoanTenureMonths") || 60,
  };

  // Structured Sizing & Overrides snapshot
  const sizing = {
    capacityOverride: numberValue("capacityOverride"),
    inverterOverride: numberValue("inverterOverride"),
    batteryOverride: numberValue("batteryOverride"),
    backupLoad: numberValue("backupLoad"),
    backupHours: numberValue("backupHours"),
    savingsMethod: $("savingsMethod")?.value || "marginal",
    goal: $("goal")?.value || "ongrid",
    panelType: $("panelType")?.value || "dcr",
    subsidyCategory: $("subsidyCategory")?.value || "residential",
    structureType: $("structureType")?.value || "galvalume",
    selectedSystemIndex: state.selectedSystemIndex,
    ongridBackup: state.ongridBackup,
    costOverrides: state.costOverrides ? JSON.parse(JSON.stringify(state.costOverrides)) : {},
    systemIncludesText: state.systemIncludesText ? JSON.parse(JSON.stringify(state.systemIncludesText)) : {},
    breakupConfig: state.breakupConfig ? JSON.parse(JSON.stringify(state.breakupConfig)) : null,
    breakupConfigGst: state.breakupConfigGst ? JSON.parse(JSON.stringify(state.breakupConfigGst)) : null,
    breakupConfigContingency: state.breakupConfigContingency ? JSON.parse(JSON.stringify(state.breakupConfigContingency)) : null,
    breakupConfigMarginPct: state.breakupConfigMarginPct ? JSON.parse(JSON.stringify(state.breakupConfigMarginPct)) : null,
    savingsConfig: state.savingsConfig ? JSON.parse(JSON.stringify(state.savingsConfig)) : null,
    billConfig: state.billConfig ? JSON.parse(JSON.stringify(state.billConfig)) : null,
  };

  const reportDisplay = {
    showCadDiagram: $("showCadDiagram")?.checked !== false,
    hidePayback: $("hidePayback")?.checked || false,
    hideAreaFit: $("hideAreaFit")?.checked || false,
    hideSubsidy: $("hideSubsidy")?.checked || false,
    hideCost: $("hideCost")?.checked || false,
    hideFinancing: $("hideFinancing")?.checked || false,
    solarInstalled: $("solarInstalled")?.checked || false,
    proposalSerialNo: $("proposalSerialNo")?.value || "DC/2026-27/PROP-1001",
    customerAddress: $("customerAddress")?.value || "Pune, Maharashtra",
    saveEnergyCharges: $("saveEnergyCharges")?.checked !== false,
    saveElectricityDuty: $("saveElectricityDuty")?.checked !== false,
    saveWheelingFac: $("saveWheelingFac")?.checked !== false,
    saveTodRebate: $("saveTodRebate")?.checked !== false,
  };

  const cad = getActiveRooftopCAD();
  const cadState = cad && typeof cad.serialize === "function" ? cad.serialize() : null;

  const serializedState = {
    meters: state.meters ? JSON.parse(JSON.stringify(state.meters)) : [],
    meteringMode: state.meteringMode || "single",
    allocationStrategy: state.allocationStrategy || "proportional",
    extractedBill: state.extractedBill ? JSON.parse(JSON.stringify(state.extractedBill)) : null,
    costOverrides: state.costOverrides ? JSON.parse(JSON.stringify(state.costOverrides)) : {},
    systemIncludesText: state.systemIncludesText ? JSON.parse(JSON.stringify(state.systemIncludesText)) : {},
    breakupConfig: state.breakupConfig ? JSON.parse(JSON.stringify(state.breakupConfig)) : {},
    breakupConfigGst: state.breakupConfigGst ? JSON.parse(JSON.stringify(state.breakupConfigGst)) : {},
    breakupConfigContingency: state.breakupConfigContingency ? JSON.parse(JSON.stringify(state.breakupConfigContingency)) : {},
    breakupConfigMarginPct: state.breakupConfigMarginPct ? JSON.parse(JSON.stringify(state.breakupConfigMarginPct)) : {},
    savingsConfig: state.savingsConfig ? JSON.parse(JSON.stringify(state.savingsConfig)) : {},
    billConfig: state.billConfig ? JSON.parse(JSON.stringify(state.billConfig)) : {},
    selectedSystemIndex: state.selectedSystemIndex,
    ongridBackup: state.ongridBackup,
  };

  const stateData = {
    version: 2,
    formValues,
    rates,
    loans,
    sizing,
    reportDisplay,
    cad: cadState,
    state: serializedState,
    input,
    config,
  };

  const custName = input.customerName || $("internalCustomerName")?.value || $("customerName")?.value || "Draft Customer";
  const mobile = input.mobileNumber || $("internalMobileNumber")?.value || $("mobileNumber")?.value || "";
  const email = input.emailAddress || $("internalEmailAddress")?.value || $("emailAddress")?.value || "";
  const serialNo = reportDisplay.proposalSerialNo || $("proposalSerialNo")?.value || "DC/2026-27/PROP-1001";
  const sysCap = state.estimates?.recommended?.dcCapacityKw || formValues.capacityOverride || "";
  const totCost = state.estimates?.recommended?.netCost || 0;

  return {
    customerName: custName,
    mobileNumber: mobile,
    emailAddress: email,
    proposalSerialNo: serialNo,
    systemCapacityKw: sysCap,
    totalCost: totCost,
    stateData
  };
}

async function saveProposalData() {
  const btnInternal = $("saveProposalButtonInternal");
  const btnSidebar = $("sidebarSaveProposalBtn");
  const origTextInternal = btnInternal ? btnInternal.textContent : "Save Data 💾";
  const origTextSidebar = btnSidebar ? btnSidebar.textContent : "Save Data 💾";

  const setButtonsText = (txt, color) => {
    if (btnInternal) {
      btnInternal.textContent = txt;
      if (color) {
        btnInternal.style.borderColor = color;
        btnInternal.style.color = color;
      }
    }
    if (btnSidebar) {
      btnSidebar.textContent = txt;
      if (color) {
        btnSidebar.style.borderColor = color;
        btnSidebar.style.color = color;
      }
    }
  };

  const resetButtons = () => {
    if (btnInternal) {
      btnInternal.textContent = origTextInternal;
      btnInternal.style.borderColor = "var(--line)";
      btnInternal.style.color = "";
    }
    if (btnSidebar) {
      btnSidebar.textContent = origTextSidebar;
      btnSidebar.style.borderColor = "";
      btnSidebar.style.color = "";
    }
  };

  setButtonsText("Saving...", null);

  const snapshot = buildProposalSnapshot();
  const proposalRecord = {
    id: "prop_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    customerName: snapshot.customerName,
    mobileNumber: snapshot.mobileNumber,
    emailAddress: snapshot.emailAddress,
    proposalSerialNo: snapshot.proposalSerialNo,
    systemCapacityKw: snapshot.systemCapacityKw,
    totalCost: snapshot.totalCost,
    savedAt: new Date().toISOString(),
    stateData: snapshot.stateData
  };

  // 1. Cache to local storage immediately for multi-proposal history & offline recovery
  try {
    localStorage.setItem("solar_proposal_last_saved", JSON.stringify(proposalRecord));

    let savedList = [];
    try {
      const raw = localStorage.getItem("solar_saved_proposals");
      if (raw) savedList = JSON.parse(raw);
    } catch (_) {}
    if (!Array.isArray(savedList)) savedList = [];

    const existingIdx = savedList.findIndex(p =>
      (snapshot.proposalSerialNo && p.proposalSerialNo === snapshot.proposalSerialNo) ||
      (p.customerName === snapshot.customerName && snapshot.mobileNumber && p.mobileNumber === snapshot.mobileNumber)
    );
    if (existingIdx >= 0) {
      proposalRecord.id = savedList[existingIdx].id || proposalRecord.id;
      savedList[existingIdx] = proposalRecord;
    } else {
      savedList.unshift(proposalRecord);
    }
    if (savedList.length > 50) savedList = savedList.slice(0, 50);
    localStorage.setItem("solar_saved_proposals", JSON.stringify(savedList));
  } catch (err) {
    console.warn("Could not save to localStorage", err);
  }

  // 2. Persist to backend server / database (safe and non-blocking)
  let serverSaved = false;
  try {
    const res = await fetch("/api/save-proposal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: snapshot.customerName,
        mobileNumber: snapshot.mobileNumber,
        emailAddress: snapshot.emailAddress,
        proposalSerialNo: snapshot.proposalSerialNo,
        systemCapacityKw: snapshot.systemCapacityKw,
        totalCost: snapshot.totalCost,
        stateData: snapshot.stateData
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        serverSaved = true;
        console.log("Proposal saved to server:", data.id);
      }
    }
  } catch (e) {
    console.warn("Server save skipped or offline:", e);
  }

  if (serverSaved) {
    setButtonsText("Saved! ✅", "var(--primary-green, #10b981)");
  } else {
    setButtonsText("Saved locally! 💾", "var(--primary-green, #10b981)");
  }
  setTimeout(resetButtons, 2500);
}

function exportCurrentProposalJSON() {
  const snapshot = buildProposalSnapshot();
  const exportPayload = {
    customerName: snapshot.customerName,
    mobileNumber: snapshot.mobileNumber,
    emailAddress: snapshot.emailAddress,
    proposalSerialNo: snapshot.proposalSerialNo,
    exportedAt: new Date().toISOString(),
    stateData: snapshot.stateData
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeFilename = `${snapshot.proposalSerialNo}_${snapshot.customerName}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  a.href = url;
  a.download = `Solar_Proposal_${safeFilename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importProposalJSONFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data) throw new Error("Empty JSON");
      window.loadProposalState(data);
      const name = data.customerName || data.stateData?.input?.customerName || data.state_data?.input?.customerName || "Proposal";
      alert(`Proposal "${name}" successfully loaded from file!`);
    } catch (err) {
      console.error("Failed to parse JSON proposal file", err);
      alert("Invalid proposal file format. Please ensure you are uploading a valid Solar Calculator JSON backup.");
    }
  };
  reader.readAsText(file);
}

async function searchProposals(query) {
  const listEl = $("proposalList");
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Searching saved proposals...</div>';

  // 1. Gather local proposals from solar_saved_proposals and solar_proposal_last_saved
  let localProposals = [];
  try {
    const raw = localStorage.getItem("solar_saved_proposals");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localProposals = parsed;
    }
  } catch (_) {}

  try {
    const lastRaw = localStorage.getItem("solar_proposal_last_saved");
    if (lastRaw) {
      const lastSaved = JSON.parse(lastRaw);
      const exists = localProposals.some(p =>
        (lastSaved.proposalSerialNo && p.proposalSerialNo === lastSaved.proposalSerialNo) ||
        (lastSaved.id && p.id === lastSaved.id)
      );
      if (!exists && (lastSaved.customerName || lastSaved.stateData)) {
        localProposals.unshift(lastSaved);
      }
    }
  } catch (_) {}

  const q = (query || "").toLowerCase().trim();
  const filteredLocal = localProposals.filter(p => {
    if (!q) return true;
    const name = (p.customerName || p.stateData?.input?.customerName || "").toLowerCase();
    const mob = (p.mobileNumber || p.stateData?.input?.mobileNumber || "");
    const serial = (p.proposalSerialNo || p.stateData?.reportDisplay?.proposalSerialNo || "").toLowerCase();
    const email = (p.emailAddress || p.stateData?.input?.emailAddress || "").toLowerCase();
    return name.includes(q) || mob.includes(q) || serial.includes(q) || email.includes(q);
  });

  window._currentLocalProposals = filteredLocal;

  let localHtml = "";
  if (filteredLocal.length > 0) {
    localHtml = filteredLocal.map((p, idx) => {
      const serialNo = p.proposalSerialNo || p.stateData?.reportDisplay?.proposalSerialNo || "Draft";
      const capKw = p.systemCapacityKw || p.stateData?.state?.estimates?.recommended?.dcCapacityKw || p.stateData?.formValues?.capacityOverride || "";
      const costVal = p.totalCost || p.stateData?.state?.estimates?.recommended?.netCost || 0;
      const dateStr = p.savedAt ? new Date(p.savedAt).toLocaleString() : "";
      return `
        <div style="padding: 10px 14px; border: 1px solid #86efac; background: #f0fdf4; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 3px; flex-wrap: wrap;">
              <span style="font-size: 10px; font-weight: 700; background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px;">⚡ Local Save</span>
              ${serialNo ? `<span style="font-size: 11px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 1px 6px; border-radius: 4px;">${serialNo}</span>` : ""}
              ${capKw ? `<span style="font-size: 11px; font-weight: 600; color: #166534; background: #dcfce7; padding: 1px 6px; border-radius: 4px;">${capKw} kW</span>` : ""}
            </div>
            <strong style="color: #0f172a; font-size: 13.5px; display: inline-block;">${p.customerName || "Draft Customer"}</strong>
            <span style="font-size: 12px; color: #64748b; margin-left: 6px;">${p.mobileNumber || ""} ${p.emailAddress ? "| " + p.emailAddress : ""}</span><br>
            <span style="font-size: 11px; color: #94a3b8;">${dateStr}${costVal ? " • ₹" + Math.round(costVal).toLocaleString("en-IN") : ""}</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button class="primary-button load-local-btn" data-idx="${idx}" style="padding: 6px 14px; font-size: 12px; min-height: 32px;" type="button">Load</button>
            <button class="ghost-button delete-local-btn" data-idx="${idx}" style="padding: 6px 8px; font-size: 13px; min-height: 32px; color: #ef4444;" type="button" title="Delete proposal">🗑️</button>
          </div>
        </div>
      `;
    }).join("");
  }

  // 2. Fetch server proposals safely
  let serverHtml = "";
  try {
    const res = await fetch("/api/load-proposals?search=" + encodeURIComponent(query));
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
        window._currentServerProposals = json.data;
        serverHtml = json.data.map((p, idx) => {
          const serialNo = p.proposal_serial_no || p.state_data?.reportDisplay?.proposalSerialNo || p.state_data?.input?.proposalSerialNo || "";
          const capKw = p.system_capacity_kw || p.state_data?.state?.estimates?.recommended?.dcCapacityKw || p.state_data?.formValues?.capacityOverride || "";
          const costVal = p.total_cost || p.state_data?.state?.estimates?.recommended?.netCost || "";
          return `
          <div style="padding: 10px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 2px; flex-wrap: wrap;">
                <span style="font-size: 10px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">☁️ Server</span>
                <strong style="color: #0f172a; font-size: 13.5px;">${p.customer_name || "Unknown"}</strong>
                ${serialNo ? `<span style="font-size: 11px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 1px 6px; border-radius: 4px;">${serialNo}</span>` : ""}
                ${capKw ? `<span style="font-size: 11px; font-weight: 600; color: #166534; background: #dcfce7; padding: 1px 6px; border-radius: 4px;">${capKw} kW</span>` : ""}
              </div>
              <span style="font-size: 12px; color: var(--text-muted);">${p.mobile_number || ""} ${p.email_address ? "| " + p.email_address : ""}</span><br>
              <span style="font-size: 11px; color: var(--text-muted);">${new Date(p.created_at).toLocaleString()}${costVal ? " • ₹" + Math.round(costVal).toLocaleString("en-IN") : ""}</span>
            </div>
            <button class="primary-button load-server-btn" data-idx="${idx}" style="padding: 6px 14px; font-size: 12px; min-height: 32px;" type="button">Load</button>
          </div>
        `;
        }).join("");
      }
    }
  } catch (err) {
    console.warn("Server search offline or unavailable:", err);
  }

  if (!localHtml && !serverHtml) {
    listEl.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 24px;">
        <span style="font-size: 24px; display: block; margin-bottom: 8px;">📂</span>
        No saved proposals found.<br>
        <span style="font-size: 12px;">Click "Save Data 💾" in the sidebar to save, or "Import JSON File" to load a file.</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = localHtml + (serverHtml ? `<div style="margin: 10px 0 4px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Cloud / Server Proposals</div>` + serverHtml : "");

  // Wire local Load buttons
  listEl.querySelectorAll(".load-local-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const p = window._currentLocalProposals?.[idx];
      if (p) {
        window.loadProposalState(p.stateData || p);
      }
    });
  });

  // Wire local Delete buttons
  listEl.querySelectorAll(".delete-local-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const p = window._currentLocalProposals?.[idx];
      if (p && confirm(`Delete saved proposal for "${p.customerName || 'Customer'}"?`)) {
        try {
          const raw = localStorage.getItem("solar_saved_proposals");
          let list = raw ? JSON.parse(raw) : [];
          if (Array.isArray(list)) {
            list = list.filter(item => (p.id ? item.id !== p.id : item.proposalSerialNo !== p.proposalSerialNo));
            localStorage.setItem("solar_saved_proposals", JSON.stringify(list));
          }
          const lastRaw = localStorage.getItem("solar_proposal_last_saved");
          if (lastRaw) {
            const lastSaved = JSON.parse(lastRaw);
            if ((p.id && lastSaved.id === p.id) || (p.proposalSerialNo && lastSaved.proposalSerialNo === p.proposalSerialNo)) {
              localStorage.removeItem("solar_proposal_last_saved");
            }
          }
        } catch (e) {
          console.error("Failed to delete proposal", e);
        }
        searchProposals(query);
      }
    });
  });

  // Wire server Load buttons
  listEl.querySelectorAll(".load-server-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const p = window._currentServerProposals?.[idx];
      if (p) {
        window.loadProposalState(p.state_data || p);
      }
    });
  });
}

window.loadProposalState = function(data) {
  if (!data) return;

  state.isRestoringProposal = true;
  const sData = (data.stateData || data.state_data || data);

  // 1. If formValues exists (v2 schema), restore all DOM inputs, selects, textareas, and checkboxes directly
  if (sData.formValues && typeof sData.formValues === "object") {
    Object.keys(sData.formValues).forEach((id) => {
      const el = $(id);
      if (!el) return;
      if (el.type === "checkbox") {
        el.checked = !!sData.formValues[id];
      } else if (el.type === "radio") {
        if (el.value === sData.formValues[id]) el.checked = true;
      } else {
        el.value = sData.formValues[id] !== undefined && sData.formValues[id] !== null ? sData.formValues[id] : "";
      }
    });
  }

  // 2. Restore state properties (multi-meter, extracted bill, overrides, configs)
  if (sData.state) {
    if (sData.state.meters && Array.isArray(sData.state.meters)) {
      state.meters = JSON.parse(JSON.stringify(sData.state.meters));
    }
    if (sData.state.meteringMode) {
      state.meteringMode = sData.state.meteringMode;
    }
    if (sData.state.allocationStrategy) {
      state.allocationStrategy = sData.state.allocationStrategy;
    }
    if (sData.state.extractedBill !== undefined) {
      state.extractedBill = sData.state.extractedBill ? JSON.parse(JSON.stringify(sData.state.extractedBill)) : null;
    }
    if (sData.state.costOverrides) {
      state.costOverrides = JSON.parse(JSON.stringify(sData.state.costOverrides));
    }
    if (sData.state.systemIncludesText) {
      state.systemIncludesText = JSON.parse(JSON.stringify(sData.state.systemIncludesText));
    }
    if (sData.state.breakupConfig) {
      state.breakupConfig = JSON.parse(JSON.stringify(sData.state.breakupConfig));
    }
    if (sData.state.breakupConfigGst) {
      state.breakupConfigGst = JSON.parse(JSON.stringify(sData.state.breakupConfigGst));
    }
    if (sData.state.breakupConfigContingency) {
      state.breakupConfigContingency = JSON.parse(JSON.stringify(sData.state.breakupConfigContingency));
    }
    if (sData.state.breakupConfigMarginPct) {
      state.breakupConfigMarginPct = JSON.parse(JSON.stringify(sData.state.breakupConfigMarginPct));
    }
    if (sData.state.savingsConfig) {
      state.savingsConfig = JSON.parse(JSON.stringify(sData.state.savingsConfig));
    }
    if (sData.state.billConfig) {
      state.billConfig = JSON.parse(JSON.stringify(sData.state.billConfig));
    }
    if (sData.state.selectedSystemIndex !== undefined) {
      state.selectedSystemIndex = sData.state.selectedSystemIndex;
    }
    if (sData.state.ongridBackup !== undefined) {
      state.ongridBackup = sData.state.ongridBackup;
    }
  }

  // 3. Fallback / Explicit sections unpacking (Rates, Loans, Sizing, ReportDisplay)
  if (sData.rates && typeof sData.rates === "object") {
    Object.keys(sData.rates).forEach((id) => {
      const el = $(id);
      if (el && sData.rates[id] !== undefined) el.value = sData.rates[id];
    });
  } else if (sData.config && sData.config.pricing) {
    const p = sData.config.pricing;
    if ($("panelDcrRate") && p.panelDcrRatePerWp !== undefined) $("panelDcrRate").value = p.panelDcrRatePerWp;
    if ($("panelNonDcrRate") && p.panelNonDcrRatePerWp !== undefined) $("panelNonDcrRate").value = p.panelNonDcrRatePerWp;
    if ($("batteryRate") && p.batteryRatePerWh !== undefined) $("batteryRate").value = p.batteryRatePerWh;
    if (p.structureRates) {
      if ($("hotDipStructureRate") && p.structureRates.hotDip !== undefined) $("hotDipStructureRate").value = p.structureRates.hotDip;
      if ($("galvalumeStructureRate") && p.structureRates.galvalume !== undefined) $("galvalumeStructureRate").value = p.structureRates.galvalume;
      if ($("gpPurlinStructureRate") && p.structureRates.gpPurlin !== undefined) $("gpPurlinStructureRate").value = p.structureRates.gpPurlin;
    }
    if ($("wiringRate") && p.wiringRatePerW !== undefined) $("wiringRate").value = p.wiringRatePerW;
    if ($("installationRate") && p.installationRatePerW !== undefined) $("installationRate").value = p.installationRatePerW;
    if ($("consultancyRate") && p.consultancyRatePerW !== undefined) $("consultancyRate").value = p.consultancyRatePerW;
    if ($("contingencyRate") && p.contingencyRate !== undefined) $("contingencyRate").value = p.contingencyRate;
    if ($("marginRate") && p.marginRate !== undefined) $("marginRate").value = p.marginRate;

    if (sData.config.performance) {
      const perf = sData.config.performance;
      if ($("panelWp") && perf.panelWp !== undefined) $("panelWp").value = perf.panelWp;
      if ($("dailyGeneration") && perf.dailyGenerationPerKw !== undefined) $("dailyGeneration").value = perf.dailyGenerationPerKw;
      if ($("shadingLoss") && perf.shadingLoss !== undefined) $("shadingLoss").value = perf.shadingLoss;
      if ($("orientationLoss") && perf.orientationLoss !== undefined) $("orientationLoss").value = perf.orientationLoss;
      if ($("systemLoss") && perf.systemLoss !== undefined) $("systemLoss").value = perf.systemLoss;
      if ($("degradationRate") && perf.degradationRate !== undefined) $("degradationRate").value = perf.degradationRate;
      if ($("panelEfficiency") && perf.panelEfficiency !== undefined) $("panelEfficiency").value = perf.panelEfficiency;
      if ($("batteryDod") && perf.batteryDod !== undefined) $("batteryDod").value = perf.batteryDod;
      if ($("inverterEfficiency") && perf.inverterEfficiency !== undefined) $("inverterEfficiency").value = perf.inverterEfficiency;
      if ($("selfConsumptionPct") && perf.selfConsumptionPct !== undefined) $("selfConsumptionPct").value = perf.selfConsumptionPct;
    }

    if (sData.config.tariff) {
      const tar = sData.config.tariff;
      if ($("fixedCharge") && tar.fixedCharge !== undefined) $("fixedCharge").value = tar.fixedCharge;
      if ($("electricityDuty") && tar.electricityDuty !== undefined) $("electricityDuty").value = tar.electricityDuty;
      if ($("tariffEscalation") && tar.tariffEscalation !== undefined) $("tariffEscalation").value = tar.tariffEscalation;
      if (Array.isArray(tar.slabs)) {
        tar.slabs.forEach((s, idx) => {
          const el = $(`slabRate${idx + 1}`);
          if (el && s.rate !== undefined) el.value = s.rate;
        });
      }
    }
  }

  // Legacy input object unpacking
  if (sData.input && typeof sData.input === "object") {
    Object.keys(sData.input).forEach((key) => {
      const el = $(key);
      if (el && el.type !== "radio" && el.type !== "checkbox") {
        el.value = sData.input[key] || "";
      } else if (el && el.type === "checkbox") {
        el.checked = !!sData.input[key];
      }
    });
    if (sData.input.backupLoadPercent !== undefined && $("backupLoad")) {
      $("backupLoad").value = sData.input.backupLoadPercent;
    }
    if (sData.input.loanTenureMonths !== undefined && $("internalLoanTenureMonths")) {
      $("internalLoanTenureMonths").value = sData.input.loanTenureMonths;
    }
  }

  // Loans unpacking
  if (sData.loans && typeof sData.loans === "object") {
    Object.keys(sData.loans).forEach((id) => {
      const el = $(id);
      if (el && sData.loans[id] !== undefined) el.value = sData.loans[id];
    });
  }

  // Sizing & overrides unpacking
  if (sData.sizing && typeof sData.sizing === "object") {
    Object.keys(sData.sizing).forEach((key) => {
      const el = $(key);
      if (el && el.type !== "checkbox" && el.type !== "radio") {
        el.value = sData.sizing[key] !== undefined ? sData.sizing[key] : "";
      }
    });
    if (sData.sizing.selectedSystemIndex !== undefined) state.selectedSystemIndex = sData.sizing.selectedSystemIndex;
    if (sData.sizing.ongridBackup !== undefined) state.ongridBackup = sData.sizing.ongridBackup;
    if (sData.sizing.costOverrides) state.costOverrides = sData.sizing.costOverrides;
    if (sData.sizing.systemIncludesText) state.systemIncludesText = sData.sizing.systemIncludesText;
    if (sData.sizing.breakupConfig) state.breakupConfig = sData.sizing.breakupConfig;
    if (sData.sizing.breakupConfigGst) state.breakupConfigGst = sData.sizing.breakupConfigGst;
    if (sData.sizing.breakupConfigContingency) state.breakupConfigContingency = sData.sizing.breakupConfigContingency;
    if (sData.sizing.breakupConfigMarginPct) state.breakupConfigMarginPct = sData.sizing.breakupConfigMarginPct;
    if (sData.sizing.savingsConfig) state.savingsConfig = sData.sizing.savingsConfig;
    if (sData.sizing.billConfig) state.billConfig = sData.sizing.billConfig;
  }

  // Report Display checkboxes & options unpacking
  if (sData.reportDisplay && typeof sData.reportDisplay === "object") {
    Object.keys(sData.reportDisplay).forEach((key) => {
      const el = $(key);
      if (el && el.type === "checkbox") {
        el.checked = !!sData.reportDisplay[key];
      } else if (el) {
        el.value = sData.reportDisplay[key] || "";
      }
    });
  }

  // Synchronize twin fields (customer vs internal)
  const custName = $("customerName")?.value || $("internalCustomerName")?.value || sData.customerName || "";
  if ($("customerName")) $("customerName").value = custName;
  if ($("internalCustomerName")) $("internalCustomerName").value = custName;

  const mob = $("mobileNumber")?.value || $("internalMobileNumber")?.value || sData.mobileNumber || "";
  if ($("mobileNumber")) $("mobileNumber").value = mob;
  if ($("internalMobileNumber")) $("internalMobileNumber").value = mob;

  const email = $("emailAddress")?.value || $("internalEmailAddress")?.value || sData.emailAddress || "";
  if ($("emailAddress")) $("emailAddress").value = email;
  if ($("internalEmailAddress")) $("internalEmailAddress").value = email;

  const pMode = $("paymentMode")?.value || $("internalPaymentMode")?.value || "upfront";
  if ($("paymentMode")) $("paymentMode").value = pMode;
  if ($("internalPaymentMode")) $("internalPaymentMode").value = pMode;
  $("customerLoanFields")?.classList.toggle("hidden", pMode !== "loan");

  // Synchronize loan values between customer and internal views
  const lRate = $("loanInterestRate")?.value || $("internalLoanInterestRate")?.value || 9.5;
  if ($("loanInterestRate")) $("loanInterestRate").value = lRate;
  if ($("internalLoanInterestRate")) $("internalLoanInterestRate").value = lRate;

  const lAmt = $("loanAmount")?.value || $("internalLoanAmount")?.value || "";
  if ($("loanAmount")) $("loanAmount").value = lAmt;
  if ($("internalLoanAmount")) $("internalLoanAmount").value = lAmt;

  const lEmi = $("loanMonthlyEmi")?.value || $("internalLoanMonthlyEmi")?.value || "";
  if ($("loanMonthlyEmi")) $("loanMonthlyEmi").value = lEmi;
  if ($("internalLoanMonthlyEmi")) $("internalLoanMonthlyEmi").value = lEmi;

  // 4. Restore Rooftop CAD state
  if (sData.cad) {
    state.pendingCadState = sData.cad;
    const cad = getActiveRooftopCAD();
    if (cad && typeof cad.loadState === "function") {
      cad.loadState(sData.cad);
      state.pendingCadState = null;

      if ($("cadRoofLength") && sData.cad.roofLengthFt !== undefined) $("cadRoofLength").value = sData.cad.roofLengthFt;
      if ($("cadRoofBreadth") && sData.cad.roofBreadthFt !== undefined) $("cadRoofBreadth").value = sData.cad.roofBreadthFt;
      if ($("cadPathwayWidth") && sData.cad.defaultPathwayWidthFt !== undefined) $("cadPathwayWidth").value = sData.cad.defaultPathwayWidthFt;
      if ($("cadBuildingHeightInput") && sData.cad.buildingHeightFt !== undefined) $("cadBuildingHeightInput").value = sData.cad.buildingHeightFt;
      if ($("cadElevationBldgHeightInput") && sData.cad.buildingHeightFt !== undefined) $("cadElevationBldgHeightInput").value = sData.cad.buildingHeightFt;
      if ($("cadNorthAngleInput") && sData.cad.northAngleDeg !== undefined) $("cadNorthAngleInput").value = sData.cad.northAngleDeg;
      if ($("cadSunTimeSlider") && sData.cad.sunSim?.timeHour !== undefined) $("cadSunTimeSlider").value = sData.cad.sunSim.timeHour;

      if (sData.cad.image && sData.cad.image.isLoaded) {
        const imgControls = $("cadImageControls");
        if (imgControls) imgControls.style.display = "flex";
        const lockBtn = $("cadLockImageBtn");
        if (lockBtn) {
          lockBtn.textContent = cad.image.locked ? "🔒 Locked" : "🔓 Unlocked";
          lockBtn.style.color = cad.image.locked ? "#38bdf8" : "#fbbf24";
        }
        if ($("cadZoomSlider")) $("cadZoomSlider").value = cad.image.scale || 1.0;
        if ($("cadOpacitySlider") && sData.cad.image.opacity !== undefined) $("cadOpacitySlider").value = sData.cad.image.opacity;
      }
      cad.render();
      cad.notifyChanges();
      cad.notifyLayersChange();
    }
  }

  // 5. Restore Multi-Meter / Single Meter mode and re-render table
  if (state.meteringMode === "multi") {
    setMeteringMode("multi");
  } else {
    setMeteringMode("single");
  }
  renderMultiMeterTable();

  // 6. Re-render Extracted Bill OCR card if present
  if (state.extractedBill) {
    renderExtractedBill(state.extractedBill);
  }

  // Remove blur overlay when a proposal is loaded
  const resultsPanel = document.querySelector(".results-panel");
  if (resultsPanel) resultsPanel.classList.remove("blurred-overlay");

  if ($("loadProposalModal")) $("loadProposalModal").style.display = "none";

  render();
  state.isRestoringProposal = false;
};

window.saveProposalData = saveProposalData;
window.captureFormValues = captureFormValues;
window.exportCurrentProposalJSON = exportCurrentProposalJSON;
window.importProposalJSONFile = importProposalJSONFile;
window.searchProposals = searchProposals;
window.buildProposalSnapshot = buildProposalSnapshot;
