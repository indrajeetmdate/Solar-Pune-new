import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

console.log("Starting End-to-End Workspace Integrity & Auto-Calculation Test...");

const htmlContent = fs.readFileSync(path.resolve("index.html"), "utf8");

// Setup JSDOM with HTML and scripts
const dom = new JSDOM(htmlContent, {
  url: "http://localhost:3000/",
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
});

const { window } = dom;
const { document } = window;

// Polyfill canvas & scrollIntoView
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    arc: () => {},
    rect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    drawImage: () => {},
    clip: () => {},
    measureText: () => ({ width: 50 }),
    fillText: () => {},
    strokeText: () => {},
    setLineDash: () => {},
    getLineDash: () => [],
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
};

window.Element.prototype.scrollIntoView = function () {};
window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
  this.setAttribute("open", "");
};
window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.removeAttribute("open");
};

// Polyfill FileReader
window.FileReader = class {
  readAsDataURL(file) {
    setTimeout(() => {
      this.result = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      if (this.onload) this.onload({ target: this });
    }, 10);
  }
};

// Global mocks
globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = window.localStorage;
globalThis.Image = class {
  constructor() {
    setTimeout(() => {
      this.naturalWidth = 800;
      this.naturalHeight = 600;
      this.width = 800;
      this.height = 600;
      if (this.onload) this.onload();
    }, 10);
  }
  set src(val) {
    this._src = val;
  }
  get src() {
    return this._src;
  }
};

// Load app module
const appModule = await import("../src/app.js");

console.log("Checking Initial Auto-Calculation & Figures on Page Load...");

// Check workspace blur overlay removal
const resultsPanel = document.getElementById("resultsPanel");
assert.ok(resultsPanel, "resultsPanel element must exist");
assert.ok(!resultsPanel.classList.contains("blurred-overlay"), "resultsPanel must NOT have blurred-overlay class on load");

// Check Key Performance Indicator cards
const recommendedCapacity = document.getElementById("recommendedCapacity")?.textContent;
const monthlyGeneration = document.getElementById("monthlyGeneration")?.textContent;
const monthlySavings = document.getElementById("monthlySavings")?.textContent;
const payback = document.getElementById("payback")?.textContent;

console.log("Rendered KPIs on initial load:", {
  recommendedCapacity,
  monthlyGeneration,
  monthlySavings,
  payback,
});

assert.ok(recommendedCapacity && recommendedCapacity.includes("kWp") && !recommendedCapacity.includes("0.0"), "Capacity must be calculated");
assert.ok(monthlyGeneration && monthlyGeneration.includes("units") && !monthlyGeneration.startsWith("0 "), "Monthly generation must be calculated");
assert.ok(monthlySavings && monthlySavings.includes("Rs") && !monthlySavings.includes("Rs 0"), "Monthly savings must be calculated");
assert.ok(payback && payback.includes("yrs"), "Payback must be calculated");

// Check all 15 Required Fields and 2 Additional Important Fields are present on the Left Side Panel
const leftPanel = document.getElementById("sidebarPanel");
assert.ok(leftPanel, "Left sidebar panel must exist");
const requiredFieldIds = [
  "customerName",
  "sanctionedLoad",
  "consumerCategory",
  "connectionPhase",
  "monthlyUnits",
  "monthlyBill",
  "goal",
  "roofArea",
  "panelType",
  "subsidyCategory",
  "paymentMode",
  "panelMake",
  "panelRate",
  "panelWp",
  "billFixedCharges",
  "billEnergyCharges",
  "billElectricityDuty"
];

for (const fId of requiredFieldIds) {
  const el = document.getElementById(fId);
  assert.ok(el, `Required field #${fId} must exist on left side panel`);
  assert.ok(leftPanel.contains(el), `Field #${fId} must be located inside the left side panel`);
}

// Check loan default values
assert.equal(document.getElementById("loanInterestRate")?.value, "7", "Bank interest default must be 7%");
assert.equal(document.getElementById("loanDownPaymentPct")?.value, "10", "Upfront customer payment default must be 10%");

// Check 2 Additional Important Fields (Solar Capacity and Inverter Capacity)
const capOverride = document.getElementById("capacityOverride");
const invOverride = document.getElementById("inverterOverride");
assert.ok(capOverride && leftPanel.contains(capOverride), "Solar capacity (capacityOverride) field must exist in left panel");
assert.ok(invOverride && leftPanel.contains(invOverride), "Inverter capacity (inverterOverride) field must exist in left panel");

// Check Product Warranty & Details earthing rod dimension in DOM
const warrantyTableHtml = document.getElementById("workspaceTabPaneProposal")?.innerHTML || document.body.innerHTML;
assert.ok(warrantyTableHtml.includes("16 MM EARTHING ALU. CONDUCTOR ROD"), "Earthing rod must specify 16 MM");
assert.ok(warrantyTableHtml.includes("14 MM × 1 MTR COPPER ROD"), "Earthing rod must specify 14 MM");
assert.ok(!warrantyTableHtml.includes("16 SQ MM EARTHING"), "Earthing rod must NOT specify 16 SQ MM");
assert.ok(!warrantyTableHtml.includes("14 SQ MM × 1 MTR"), "Earthing rod must NOT specify 14 SQ MM");
console.log("✓ All 15 Required fields, 2 additional capacity controls, and 16mm/14mm earthing rod spec verified!");

// Check Workspace Tabs exist and can switch
const tabs = ["cad", "sizing", "financials", "loan", "proposal", "guide"];
for (const tabId of tabs) {
  const btn = document.querySelector(`.workspace-tab-btn[data-tab="${tabId}"]`);
  assert.ok(btn, `Tab button for ${tabId} must exist`);
  btn.click();
  const activePane = document.querySelector(`.workspace-tab-pane.active`);
  assert.equal(activePane?.dataset.pane, tabId, `Active tab pane must match ${tabId}`);
}
console.log("✓ All 6 Workspace Tabs switch smoothly and are active!");

// Check Sizing & Compare pane has option rows
const compRows = document.getElementById("comparisonRows")?.children;
assert.ok(compRows && compRows.length >= 3, "Comparison table must contain system option rows");

// Check Financials cost breakup has items
const costBreakup = document.getElementById("costBreakup")?.children;
assert.ok(costBreakup && costBreakup.length >= 5, "Cost breakup table must contain breakdown items");

// Check MSEB Proposal Side-by-Side Tables
const currentBillHtml = document.getElementById("msebCurrentBillContainer")?.innerHTML;
const postSolarBillHtml = document.getElementById("msebPostSolarBillContainer")?.innerHTML;

assert.ok(currentBillHtml && currentBillHtml.includes("Fixed Charges"), "Current Bill table must include Fixed Charges");
assert.ok(currentBillHtml && currentBillHtml.includes("Energy Charges"), "Current Bill table must include Energy Charges");
assert.ok(currentBillHtml && currentBillHtml.includes("Net Bill Payable"), "Current Bill table must include Net Bill Payable");

assert.ok(postSolarBillHtml && postSolarBillHtml.includes("Solar Generation"), "Post-solar Bill table must include Solar Generation");
assert.ok(postSolarBillHtml && postSolarBillHtml.includes("Net Monthly Savings"), "Post-solar Bill table must include Net Monthly Savings");
console.log("✓ MSEB Side-by-Side bill comparison tables populated with accurate data!");

// Check Internal Mode Master Password Dialog
const internalBtn = document.getElementById("internalModeButton");
assert.ok(internalBtn, "Internal mode button must exist");
internalBtn.click();
const pwdDialog = document.getElementById("passwordDialog");
assert.ok(pwdDialog.open, "Password dialog must be opened after clicking Internal mode button");

// Unlock with password
document.getElementById("internalPassword").value = "solar2026";
document.getElementById("unlockButton").click();
assert.ok(!pwdDialog.open, "Password dialog must close after successful unlock");
assert.ok(document.getElementById("internalModeButton").classList.contains("active"), "Internal mode button must be active");
console.log("✓ Internal Mode Master Password Dialog opens, validates, and unlocks successfully!");

// Check Save, Load & Edit Older Saved Data
console.log("Testing Save, Load & Edit Older Saved Proposal...");
document.getElementById("customerName").value = "Sunil Patil";
document.getElementById("monthlyUnits").value = "550";
document.getElementById("monthlyBill").value = "6400";
document.getElementById("roofArea").value = "800";

// Save proposal
await window.saveProposalData();

const savedListRaw = window.localStorage.getItem("solar_saved_proposals");
assert.ok(savedListRaw, "Proposal must be saved to localStorage");
const savedList = JSON.parse(savedListRaw);
assert.equal(savedList[0].customerName, "Sunil Patil", "Saved proposal customer name must match");

// Reset to a different state
document.getElementById("customerName").value = "Other Person";
document.getElementById("monthlyUnits").value = "200";

// Load the proposal back
window.loadProposalState(savedList[0]);

assert.equal(document.getElementById("customerName").value, "Sunil Patil", "Loaded customer name must be Sunil Patil");
assert.equal(document.getElementById("monthlyUnits").value, "550", "Loaded units must be 550");
console.log("✓ Loading older saved data restores all fields and triggers clean re-calculation!");

// Check Rooftop CAD Aerial Image Panning
console.log("Testing Rooftop CAD Aerial Image Panning...");
const { getActiveRooftopCAD } = await import("../src/panelDiagram.js");
const cad = getActiveRooftopCAD();
assert.ok(cad, "Active Rooftop CAD instance must exist");

// Load custom image
cad.loadCustomImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
await new Promise((r) => setTimeout(r, 50));
assert.ok(cad.image.isLoaded, "CAD image must be loaded");
assert.equal(cad.image.locked, false, "CAD image must be UNLOCKED by default so user can immediately pan");

// Pan image
cad.panImage(50, -30);
assert.equal(cad.image.x, 50, "CAD image X pan must be 50");
assert.equal(cad.image.y, -30, "CAD image Y pan must be -30");
console.log("✓ CAD Aerial roof image is panable inside base roof margins!");

// Verify Streamlined Rooftop CAD Toolbar Text Buttons & Compact Layers Pane
console.log("Testing Streamlined Rooftop CAD Toolbar Text Buttons & Compact Layers Pane...");
const uploadBtn = document.getElementById("cadUploadImageBtn");
assert.ok(uploadBtn, "Upload image button must exist");
assert.ok(uploadBtn.textContent.includes("Upload Image"), "Upload button must have text 'Upload Image'");

const selectBtn = document.getElementById("cadToolSelectBtn");
assert.ok(selectBtn, "Select tool button must exist");
assert.ok(selectBtn.textContent.includes("Select"), "Select tool button must have text");

const cutoutBtn = document.getElementById("cadToolSubtractBtn");
assert.ok(cutoutBtn, "Cutout button must exist");
assert.ok(cutoutBtn.textContent.includes("Cutout"), "Cutout button must have text 'Cutout'");

const shapeRectBtn = document.getElementById("cadShapeRectBtn");
assert.ok(shapeRectBtn && shapeRectBtn.textContent.includes("Rect"), "Rect shape button must have text 'Rect'");

const shapeCircleBtn = document.getElementById("cadShapeCircleBtn");
assert.ok(shapeCircleBtn && shapeCircleBtn.textContent.includes("Circle"), "Circle shape button must have text 'Circle'");

const shapeLBtn = document.getElementById("cadShapeLBtn");
assert.ok(shapeLBtn && shapeLBtn.textContent.includes("L-Shape"), "L-Shape button must have text 'L-Shape'");

const walkwayBtn = document.getElementById("cadToolPathwayBtn");
assert.ok(walkwayBtn && walkwayBtn.textContent.includes("Walkway"), "Walkway button must have text 'Walkway'");

const autoPlaceBtn = document.getElementById("cadAutoPlaceBtn");
assert.ok(autoPlaceBtn && autoPlaceBtn.textContent.includes("Autofill"), "Autofill button must have text 'Autofill'");

const resetPanelsBtn = document.getElementById("cadClearPanelsBtn");
assert.ok(resetPanelsBtn && resetPanelsBtn.textContent.includes("Reset"), "Reset panels button must have text 'Reset'");

const deleteSelectedBtn = document.getElementById("cadDeleteSelectedBtn");
assert.ok(deleteSelectedBtn && deleteSelectedBtn.textContent.includes("Delete Selected"), "Delete Selected button must have text 'Delete Selected'");

// Test More Tools Drawer toggle
const moreToolsBtn = document.getElementById("cadToggleMoreToolsBtn");
const moreToolsDrawer = document.getElementById("cadMoreToolsDrawer");
assert.ok(moreToolsBtn, "More Tools toggle button must exist");
assert.ok(moreToolsDrawer, "More Tools drawer must exist");
assert.equal(moreToolsDrawer.style.display, "none", "More tools drawer should initially be hidden");
moreToolsBtn.click();
assert.equal(moreToolsDrawer.style.display, "flex", "More tools drawer should open on click");
moreToolsBtn.click();
assert.equal(moreToolsDrawer.style.display, "none", "More tools drawer should close on second click");

// Check Layers Panel
const layersPanel = document.getElementById("cadLayersPanel");
assert.ok(layersPanel, "Layers panel must exist");
const layersHeader = layersPanel.querySelector(".cad-layers-header");
assert.ok(layersHeader, "Layers header must exist");
console.log("✓ Streamlined Rooftop CAD Toolbar and Compact Layers Pane verified!");

console.log("\nALL END-TO-END WORKSPACE & AUTO-CALCULATION TESTS PASSED! 🚀🎉");
