import { DEFAULT_CONFIG, PANEL_LABELS, STRUCTURE_LABELS, SYSTEM_LABELS } from "./config.js";
import { calculateEstimate } from "./calculator.js";

const INTERNAL_PASSPHRASE_KEY = "puneSolarInternalPassphrase";

const $ = (id) => document.getElementById(id);

const state = {
  internalUnlocked: false,
  activeTab: "system",
};

const ids = [
  "customerName",
  "monthlyUnits",
  "monthlyBill",
  "roofArea",
  "sanctionedLoad",
  "goal",
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
];

function numberValue(id) {
  const value = parseFloat($(id).value);
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

function readInput() {
  return {
    customerName: $("customerName").value.trim(),
    monthlyUnits: numberValue("monthlyUnits"),
    monthlyBill: numberValue("monthlyBill"),
    roofArea: numberValue("roofArea"),
    sanctionedLoad: numberValue("sanctionedLoad"),
    goal: $("goal").value,
    backupNeeded: $("backupNeeded").checked,
    customerView: $("customerView").checked,
    panelType: $("panelType").value,
    structureType: $("structureType").value,
    capacityOverride: numberValue("capacityOverride"),
    inverterOverride: numberValue("inverterOverride"),
    backupLoadKw: numberValue("backupLoad"),
    backupHours: numberValue("backupHours"),
    savingsMethod: $("savingsMethod").value,
  };
}

function readConfig() {
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
      ...DEFAULT_CONFIG.tariff,
      fixedCharge: numberValue("fixedCharge"),
      electricityDuty: numberValue("electricityDuty"),
      tariffEscalation: numberValue("tariffEscalation"),
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
    .map((option) => {
      const selected = option.systemType === recommended.systemType ? "selected-row" : "";
      return `
        <tr class="${selected}">
          <td>${SYSTEM_LABELS[option.systemType]}</td>
          <td>${PANEL_LABELS[option.panelType]}</td>
          <td>${money(option.netCost)}</td>
          <td>${money(option.subsidy)}</td>
          <td>${money(option.monthlySavings)}</td>
          <td>${years(option.paybackYears)}</td>
        </tr>
      `;
    })
    .join("");
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

function render() {
  const input = readInput();
  const config = readConfig();
  const estimate = calculateEstimate(input, config);
  const option = estimate.recommended;

  $("recommendationTitle").textContent = `${SYSTEM_LABELS[option.systemType]} ${PANEL_LABELS[option.panelType]} solar`;
  $("recommendationReason").textContent = getGoalReason(input.goal, option);
  $("recommendedCapacity").textContent = `${option.dcCapacityKw.toFixed(1)} kWp`;
  $("monthlyGeneration").textContent = units(option.monthlyGeneration);
  $("monthlySavings").textContent = money(option.monthlySavings);
  $("payback").textContent = years(option.paybackYears);
  $("sanctionStatus").textContent = estimate.sanctionedStatus.label;
  $("sanctionStatus").className = `status-pill ${estimate.sanctionedStatus.level}`;

  renderComparison(estimate.options, option);
  renderBreakup(option, input, input.customerView);
  renderNotes(option, input);
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
  $("internalPanel").classList.remove("hidden");
  $("easyModeButton").classList.remove("active");
  $("internalModeButton").classList.add("active");
  $("customerView").checked = false;
  $("internalPassword").value = "";
  $("passwordError").classList.add("hidden");
  render();
}

function lockInternal() {
  state.internalUnlocked = false;
  $("internalPanel").classList.add("hidden");
  $("internalModeButton").classList.remove("active");
  $("easyModeButton").classList.add("active");
  $("customerView").checked = true;
  render();
}

function openInternal() {
  if (state.internalUnlocked) {
    $("internalPanel").classList.remove("hidden");
    $("easyModeButton").classList.remove("active");
    $("internalModeButton").classList.add("active");
    $("customerView").checked = false;
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

function attachEvents() {
  ids.forEach((id) => {
    const element = $(id);
    if (!element) return;
    element.addEventListener("input", render);
    element.addEventListener("change", render);
  });

  $("easyModeButton").addEventListener("click", lockInternal);
  $("internalModeButton").addEventListener("click", openInternal);
  $("unlockButton").addEventListener("click", unlockInternal);
  $("lockInternalButton").addEventListener("click", lockInternal);
  $("resetButton").addEventListener("click", resetForm);

  $("internalPassword").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      unlockInternal();
    }
  });

  $("billUpload").addEventListener("change", (event) => {
    const [file] = event.target.files;
    $("billUploadStatus").textContent = file
      ? `${file.name} attached. Manual unit entry is used in V1.`
      : "Optional for V1. Enter units manually after upload.";
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });
}

attachEvents();
render();
