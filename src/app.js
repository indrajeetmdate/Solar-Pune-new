import { DEFAULT_CONFIG, TARIFF_PROFILES, PANEL_LABELS, STRUCTURE_LABELS, SYSTEM_LABELS } from "./config.js";
import { calculateEstimate, getPanelConfigurations } from "./calculator.js";
import { parseMsebBillFile } from "./billParser.js";
import { isSupportedBillFile } from "./ocrExtractor.js";
import { drawPanelArray } from "./panelDiagram.js";

const INTERNAL_PASSPHRASE_KEY = "puneSolarInternalPassphrase";

const $ = (id) => document.getElementById(id);

const state = {
  internalUnlocked: false,
  activeTab: "system",
  extractedBill: null,
  ongridBackup: "basic",
  selectedSystemIndex: null,
};

const ASSUMPTION_IDS = [
  "panelType", "structureType", "capacityOverride", "inverterOverride", "backupLoad", "backupHours",
  "panelDcrRate", "panelNonDcrRate", "batteryRate", "hybridInverterRate", "offgridInverterRate", "ongridInverterRate",
  "hotDipStructureRate", "galvalumeStructureRate", "gpPurlinStructureRate", "wiringRate", "installationRate", "protectionCost",
  "netMeterCost", "consultancyFee", "liaisoningFee", "gstRate", "contingencyRate",
  "dailyGeneration", "sqftPerKw", "shadingLoss", "orientationLoss", "systemLoss", "degradationRate", "batteryDod", "inverterEfficiency",
  "savingsMethod", "fixedCharge", "electricityDuty", "tariffEscalation",
  "slabRate1", "slabRate2", "slabRate3", "slabRate4"
];

const PRESETS_STORAGE_KEY = "solar_calculator_presets";

const ids = [
  "customerName",
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
  "panelType",
  "structureType",
  "capacityOverride",
  "inverterOverride",
  "backupLoad",
  "backupHours",
  "panelDcrRate",
  "panelNonDcrRate",
  "batteryRate",
  "hybridInverterRate",
  "offgridInverterRate",
  "ongridInverterRate",
  "hotDipStructureRate",
  "galvalumeStructureRate",
  "gpPurlinStructureRate",
  "wiringRate",
  "installationRate",
  "protectionCost",
  "netMeterCost",
  "consultancyFee",
  "liaisoningFee",
  "gstRate",
  "contingencyRate",
  "dailyGeneration",
  "sqftPerKw",
  "shadingLoss",
  "orientationLoss",
  "systemLoss",
  "degradationRate",
  "batteryDod",
  "inverterEfficiency",
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
  return {
    customerName: safeStr("customerName"),
    mobileNumber: safeStr("mobileNumber"),
    emailAddress: safeStr("emailAddress"),
    monthlyUnits: numberValue("monthlyUnits"),
    monthlyBill: numberValue("monthlyBill"),
    roofArea: numberValue("roofArea"),
    sanctionedLoad: numberValue("sanctionedLoad"),
    consumerCategory: safeStr("consumerCategory") || "LT-I",
    connectionPhase: safeStr("connectionPhase") || "1-phase",
    numFlats: numberValue("numFlats"),
    currentPf: numberValue("currentPf") || null,
    improvedPf: 0.97,  // Smart inverters typically bring PF to 0.97+
    peakHourUsagePct: numberValue("peakHourUsagePct") || 30,
    goal: safeStr("goal"),
    coordinates: safeStr("coordinates"),
    tiltAngle: safeStr("tiltAngle") !== "" ? numberValue("tiltAngle") : null,
    orientationDir: safeStr("orientationDir"),
    optimizationStrategy: safeStr("optimizationStrategy") || "optimum",
    extractedPeakUnits: state.extractedBill?.fields?.peakUnitsKwh || null,
    backupNeeded: safeChecked("backupNeeded"),
    customerView: safeChecked("customerView"),
    panelType: safeStr("panelType"),
    structureType: safeStr("structureType"),
    capacityOverride: numberValue("capacityOverride"),
    inverterOverride: numberValue("inverterOverride"),
    backupLoadKw: numberValue("backupLoad"),
    backupHours: numberValue("backupHours"),
    savingsMethod: safeStr("savingsMethod"),
    ongridBackup: state.ongridBackup,
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
      panelDcrRatePerWp: numberValue("panelDcrRate"),
      panelNonDcrRatePerWp: numberValue("panelNonDcrRate"),
      batteryRatePerWh: numberValue("batteryRate"),
      hybridInverterRatePerW: numberValue("hybridInverterRate"),
      offgridInverterRatePerW: numberValue("offgridInverterRate"),
      ongridInverterRatePerW: numberValue("ongridInverterRate"),
      structureRates: {
        hotDip: numberValue("hotDipStructureRate"),
        galvalume: numberValue("galvalumeStructureRate"),
        gpPurlin: numberValue("gpPurlinStructureRate"),
      },
      wiringRatePerW: numberValue("wiringRate"),
      installationRatePerW: numberValue("installationRate"),
      protectionCost: numberValue("protectionCost"),
      netMeterCost: numberValue("netMeterCost"),
      consultancyFee: numberValue("consultancyFee"),
      liaisoningFee: numberValue("liaisoningFee"),
      gstRate: numberValue("gstRate"),
      contingencyRate: numberValue("contingencyRate"),
    },
    performance: {
      dailyGenerationPerKw: numberValue("dailyGeneration"),
      sqftPerKw: numberValue("sqftPerKw"),
      shadingLoss: numberValue("shadingLoss"),
      orientationLoss: numberValue("orientationLoss"),
      systemLoss: numberValue("systemLoss"),
      degradationRate: numberValue("degradationRate"),
      batteryDod: numberValue("batteryDod"),
      inverterEfficiency: numberValue("inverterEfficiency"),
    },
    tariff: {
      consumerCategory: category,
      fixedCharge: numberValue("fixedCharge") || (profile.fixedChargePerKw * (numberValue("sanctionedLoad") || 5)),
      electricityDuty: numberValue("electricityDuty") || profile.dutyRate || 7,
      tariffEscalation: numberValue("tariffEscalation"),
      slabs,
    },
    policy: DEFAULT_CONFIG.policy,
  };
}

function getGoalReason(goal, option) {
  if (goal === "backupSupport") {
    return "Prioritizes backup support while keeping solar savings visible.";
  }
  if (goal === "lowestUpfront") {
    return "Lowest estimated customer cost from the compared options.";
  }
  if (goal === "bestRoi") {
    return "Highest annual savings relative to net customer cost.";
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
    notes.push(`Estimated battery backup: ${option.batteryCapacityKwh} kWh for about ${input.backupHours} hours at ${input.backupLoadKw} kW load.`);
  }

  notes.push("Fixed charges and minimum charges may remain even after solar installation.");
  notes.push("All values are estimates for consultation and should be reviewed before quotation.");

  return notes;
}

function renderComparison(options, recommended) {
  $("comparisonRows").innerHTML = options
    .map((option, index) => {
      const isSelected = state.selectedSystemIndex !== null 
        ? state.selectedSystemIndex === index 
        : option.systemType === recommended.systemType;
        
      const selectedClass = isSelected ? "selected-row" : "";
      
      let systemCell = SYSTEM_LABELS[option.systemType] || SYSTEM_LABELS[option.systemType.split('_')[0]];
      
      if (option.systemType === "ongrid" || option.systemType === "ongrid_basic_backup" || option.systemType === "ongrid_standard_backup") {
        systemCell = `
          <select class="table-select system-select" onclick="event.stopPropagation()">
            <option value="none" ${state.ongridBackup === 'none' ? 'selected' : ''}>On-grid</option>
            <option value="basic" ${state.ongridBackup === 'basic' ? 'selected' : ''}>On-grid + Basic Backup (1100VA)</option>
            <option value="standard" ${state.ongridBackup === 'standard' ? 'selected' : ''}>On-grid + Std Backup (2100VA)</option>
          </select>
        `;
      }

      return `
        <tr class="${selectedClass}" style="cursor: pointer;" data-index="${index}">
          <td style="text-align: center;"><input type="radio" name="systemSelection" ${isSelected ? 'checked' : ''} style="cursor: pointer;" onclick="event.stopPropagation(); this.closest('tr').click();"></td>
          <td>${systemCell}</td>
          <td>${PANEL_LABELS[option.panelType]}</td>
          <td>${option.inverterCapacityKw} kW</td>
          <td>${option.batteryCapacityKwh > 0 ? option.batteryCapacityKwh + ' kWh' : '—'}</td>
          <td>${money(option.netCost)}</td>
          <td>${money(option.subsidy)}</td>
          <td>${money(option.monthlySavings)}</td>
          <td>${years(option.paybackYears)}</td>
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

function renderBreakup(option, input, customerView) {
  const items = [
    ["Panels", option.costBreakup.panels],
    [`Structure (${STRUCTURE_LABELS[input.structureType]})`, option.costBreakup.structure],
    ["Inverter", option.costBreakup.inverter],
    ["Battery", option.costBreakup.battery],
    ["Wiring", option.costBreakup.wiring],
    ["Installation", option.costBreakup.installation],
    ["Protection", option.costBreakup.protection],
    ["Net meter/testing", option.costBreakup.netMeter],
    ["Consultancy", option.costBreakup.consultancy],
    ["Liaisoning", option.costBreakup.liaisoning],
    ["GST", option.costBreakup.gst],
    ["Contingency", option.costBreakup.contingency],
    ["Subsidy", -option.subsidy],
    ["Net customer cost", option.netCost],
  ];

  const visibleItems = customerView
    ? items.filter(([label]) => ["Panels", "Structure", "Inverter", "Battery", "Subsidy", "Net customer cost"].some((key) => label.includes(key)))
    : items;

  $("costBreakup").innerHTML = visibleItems
    .map(([label, value]) => `
      <div>
        <dt>${label}</dt>
        <dd>${money(value)}</dd>
      </div>
    `)
    .join("");
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

function render() {
  const input = readInput();
  const config = readConfig();
  const estimate = calculateEstimate(input, config);
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
  $("monthlySavings").textContent = money(option.monthlySavings);
  $("payback").textContent = years(option.paybackYears);
  $("sanctionStatus").textContent = estimate.sanctionedStatus.label;
  $("sanctionStatus").className = `status-pill ${estimate.sanctionedStatus.level}`;

  // Savings breakdown (category-aware bonuses)
  const sbEl = $("savingsBreakdownPanel");
  if (sbEl && option.savingsBreakdown) {
    const sb = option.savingsBreakdown;
    const tipMap = {
      "Slab/tariff offset": "Savings from reducing units in expensive MSEDCL slab tiers. More solar = lower per-unit rate.",
      "ToD daytime rebate": "Solar generates during 9AM–5PM when MSEDCL offers a rebate on Time-of-Day tariff. You earn credits at a lower cost.",
      "Peak penalty avoided": "Battery discharges during expensive peak hours (5PM–10PM), avoiding the highest tariff rates.",
      "PF improvement": "Smart inverters improve your Power Factor, earning a discount from MSEDCL on your bill.",
      "Prompt pay discount": "1% discount for paying your reduced bill on time. Solar makes this easier with lower bills.",
      "Banking loss": "MSEDCL charges a grid-support fee on excess solar units exported to the grid.",
    };
    const items = [
      ["Slab/tariff offset", sb.baseSavings],
      ["ToD daytime rebate", sb.todDaytimeRebate],
      ["Peak penalty avoided", sb.todPeakAvoided],
      ["PF improvement", sb.pfIncentive],
      ["Prompt pay discount", sb.promptPayDiscount],
      ["Banking loss", -sb.bankingLoss],
    ].filter(([, v]) => v !== 0);

    if (items.length > 1) {
      sbEl.classList.remove("hidden");
      sbEl.innerHTML = items
        .map(([label, value]) => {
          const tip = tipMap[label] || "";
          const icon = tip ? ` <i class="info-tip" data-tip="${tip}">i</i>` : "";
          return `<div><dt>${label}${icon}</dt><dd>${value > 0 ? "+" : ""}${money(Math.abs(value))}${value < 0 ? " loss" : ""}/mo</dd></div>`;
        })
        .join("");
    } else {
      sbEl.classList.add("hidden");
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
  renderBreakup(option, input, input.customerView);
  renderNotes(option, input);
  renderExtractedBill(state.extractedBill);
  renderDiagram(pl, input);
}

function renderDiagram(pl, input) {
  const section = $("panelDiagramSection");
  const select = $("panelConfigSelect");
  const canvas = $("panelDiagramCanvas");
  const dimLabel = $("panelDiagramDimensions");

  if (!section || !select || !canvas || !dimLabel) return;
  if (!pl || pl.numPanels <= 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  const configs = getPanelConfigurations(pl.numPanels);

  // Re-populate select if panel count changed
  const currentVal = select.value;
  select.innerHTML = configs.map(c => 
    `<option value="${c.label}">${c.label}</option>`
  ).join("");
  
  if (configs.some(c => c.label === currentVal)) {
    select.value = currentVal;
  } else {
    // Default to a square-ish configuration
    const best = configs.sort((a, b) => Math.abs(a.rows - a.cols) - Math.abs(b.rows - b.cols))[0];
    select.value = best.label;
  }

  const activeConfig = configs.find(c => c.label === select.value) || configs[0];
  
  dimLabel.textContent = `Outer dimensions: ${activeConfig.totalWidthM}m width × ${activeConfig.totalHeightM}m length`;

  const tilt = input.tiltAngle !== null && input.tiltAngle !== undefined && input.tiltAngle !== "" 
    ? Number(input.tiltAngle) 
    : 18; // Default tilt heuristic
  const orient = input.orientationDir || "South";

  // Adjust wrapper styling if needed
  const wrapper = $("panelDiagramWrapper");
  if (wrapper) {
    canvas.style.transform = "none";
    canvas.style.boxShadow = "none";
    canvas.style.background = "transparent";
  }

  drawPanelArray(canvas, {
    rows: activeConfig.rows,
    cols: activeConfig.cols,
    panelWidthMm: pl.panelWidthMm,
    panelHeightMm: pl.panelHeightMm,
    tiltAngle: tilt,
    orientationDir: orient
  });
}

function unlockInternal() {
  const passphrase = $("internalPassword").value;
  const storedPassphrase = window.localStorage.getItem(INTERNAL_PASSPHRASE_KEY);

  if (!storedPassphrase) {
    if (passphrase.trim().length < 6) {
      $("passwordError").textContent = "Use at least 6 characters.";
      $("passwordError").classList.remove("hidden");
      return;
    }
    window.localStorage.setItem(INTERNAL_PASSPHRASE_KEY, passphrase);
  } else if (passphrase !== storedPassphrase) {
    $("passwordError").textContent = "Incorrect passphrase.";
    $("passwordError").classList.remove("hidden");
    return;
  }

  state.internalUnlocked = true;
  $("passwordDialog").close();
  $("internalPassword").value = "";
  $("passwordError").classList.add("hidden");
  openInternal();
}

function lockInternal() {
  state.internalUnlocked = false;
  $("internalPanel").classList.add("hidden");
  $("easyModeButton").classList.add("active");
  $("internalModeButton").classList.remove("active");
  $("customerView").checked = true;

  // Restore wizard actions
  document.querySelectorAll('.wizard-actions').forEach(el => el.classList.remove('hidden'));
  
  // If we lock, restart the wizard visually, or just go to step 1
  if (typeof window.goToStep === 'function') {
    window.goToStep(1);
  }

  render();
}

function openInternal() {
  if (state.internalUnlocked) {
    $("internalPanel").classList.remove("hidden");
    const resultsPanel = document.querySelector('.results-panel');
    if (resultsPanel) resultsPanel.classList.remove('blurred-overlay');
    $("easyModeButton").classList.remove("active");
    $("internalModeButton").classList.add("active");
    $("customerView").checked = false;

    // Show step 2, hide step 1 (Customer Basics)
    const step1 = document.getElementById("step1");
    const step2 = document.getElementById("step2");
    if (step1) step1.classList.add("hidden");
    if (step2) step2.classList.remove("hidden");

    // Hide wizard buttons
    document.querySelectorAll('.wizard-actions').forEach(el => el.classList.add('hidden'));

    render();
    return;
  }

  const hasPassphrase = Boolean(window.localStorage.getItem(INTERNAL_PASSPHRASE_KEY));
  $("passwordDialogTitle").textContent = hasPassphrase ? "Enter passphrase" : "Set internal passphrase";
  $("passwordHelp").textContent = hasPassphrase
    ? "Use the browser-local passphrase for this device."
    : "Create a passphrase for this browser. Static hosting does not provide production authentication.";
  $("passwordError").classList.add("hidden");
  $("passwordDialog").showModal();
  $("internalPassword").focus();
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

  $("easyModeButton")?.addEventListener("click", lockInternal);
  $("internalModeButton")?.addEventListener("click", openInternal);
  $("unlockButton")?.addEventListener("click", unlockInternal);
  $("lockInternalButton")?.addEventListener("click", lockInternal);
  $("resetButton")?.addEventListener("click", resetForm);
  $("applyExtractedBill")?.addEventListener("click", applyExtractedBill);

  $("goal")?.addEventListener("change", () => {
    state.selectedSystemIndex = null;
    render();
  });

  $("savePresetButton")?.addEventListener("click", savePreset);
  $("presetSelect")?.addEventListener("change", (e) => loadPreset(e.target.value));

  // Consumer category change: toggle conditional fields and update slab defaults
  $("consumerCategory")?.addEventListener("change", () => {
    const cat = $("consumerCategory").value;
    const profile = TARIFF_PROFILES[cat];
    if (!profile) return;

    // Toggle conditional fields
    $("numFlatsField")?.classList.toggle("hidden", cat !== "LT-I-GHS");
    $("powerFactorField")?.classList.toggle("hidden", !profile.pfIncentiveApplicable);
    $("peakUsageField")?.classList.toggle("hidden", profile.todPeakPenaltyPct <= 0);

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

  $("internalPassword")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockInternal();
    }
  });

  $("billUpload").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) {
      state.extractedBill = null;
      $("billUploadStatus").textContent = "";
      $("billUploadStatus").className = "";
      render();
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isAI = isSupportedBillFile(file) && ext !== "txt" && ext !== "csv";
    const statusEl = $("billUploadStatus");
    statusEl.className = "upload-status-loading";

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
      const btn = $("downloadProposalButton");
      const origText = btn?.textContent;
      btn.textContent = "Generating PDF...";
      btn.disabled = true;

      setTimeout(() => {
        if (window.generateProposalPDF) {
          window.generateProposalPDF(state.estimates);
        } else {
          import("./reportGenerator.js").then(() => {
            window.generateProposalPDF(state.estimates);
          }).catch(err => {
            console.error("Failed to load PDF generator", err);
            alert("Failed to generate PDF: " + err.message);
          });
        }
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }, 100);
    } else {
      alert("Please ensure all inputs are filled to calculate the estimate before downloading.");
    }
  });

  $("downloadProposalButtonInternal")?.addEventListener("click", () => {
    if (state.estimates) {
      const btn = $("downloadProposalButtonInternal");
      const origText = btn?.textContent;
      if (btn) { btn.textContent = "Generating PDF..."; btn.disabled = true; }

      setTimeout(() => {
        if (window.generateProposalPDF) {
          window.generateProposalPDF(state.estimates);
        } else {
          import("./reportGenerator.js").then(() => {
            window.generateProposalPDF(state.estimates);
          }).catch(err => {
            console.error("Failed to load PDF generator", err);
            alert("Failed to generate PDF: " + err.message);
          });
        }
        if (btn) { btn.textContent = origText; btn.disabled = false; }
      }, 100);
    } else {
      alert("Please calculate an estimate first before downloading the proposal.");
    }
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  $("panelConfigSelect")?.addEventListener("change", () => {
    const pl = state.estimates?.panelLayout;
    const input = readInput();
    if (pl) renderDiagram(pl, input);
  });
}

let slackSent = false;

window.goToStep = function(step) {
  if (step > 1) {
    const mobile = document.getElementById('mobileNumber').value.trim();
    if (!mobile) {
      alert("Please enter your Mobile Number before proceeding.");
      return;
    }

    if (!slackSent) {
      const name = document.getElementById('customerName').value.trim();
      const email = document.getElementById('emailAddress').value.trim();
      
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
