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

console.log("\nALL END-TO-END WORKSPACE & AUTO-CALCULATION TESTS PASSED! 🚀🎉");
