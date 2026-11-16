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
  readAsText(file) {
    this.result = file.textData || "";
    if (this.onload) this.onload({ target: this });
  }
};

// Global mocks
globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = window.localStorage;
globalThis.FileReader = window.FileReader;
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

// Check Left Panel grouping: 1. Required Fields and 2. Not Required Fields
const reqGroup = document.getElementById("requiredFieldsGroup");
const notReqGroup = document.getElementById("notRequiredFieldsGroup");
assert.ok(reqGroup, "#requiredFieldsGroup must exist on left side panel");
assert.ok(notReqGroup, "#notRequiredFieldsGroup must exist on left side panel");
assert.ok(reqGroup.textContent.includes("1. Required Fields"), "Required fields group must be clearly titled '1. Required Fields'");
assert.ok(notReqGroup.textContent.includes("2. Not Required Fields"), "Not required fields group must be clearly titled '2. Not Required Fields'");
assert.ok(reqGroup.contains(document.getElementById("customerName")), "Customer name must be in Required Fields group");
assert.ok(reqGroup.contains(document.getElementById("paymentMode")), "Payment Mode must be in Required Fields group");
assert.ok(notReqGroup.contains(document.getElementById("capacityOverride")), "Solar capacity override must be in Not Required Fields group");
assert.ok(notReqGroup.contains(document.getElementById("inverterOverride")), "Inverter capacity override must be in Not Required Fields group");

// Check loan default values
assert.equal(document.getElementById("loanInterestRate")?.value, "7", "Bank interest default must be 7%");
assert.equal(document.getElementById("loanDownPaymentPct")?.value, "10", "Upfront customer payment default must be 10%");

// Test Loan Upfront Payment Percentage changes reflect dynamically in Option B
const paymentModeSelect = document.getElementById("paymentMode");
const loanDownPaymentPctInput = document.getElementById("loanDownPaymentPct");
const loanBreakdownContainer = document.getElementById("financingBreakdownContent");

// Switch to Loan Mode
paymentModeSelect.value = "loan";
paymentModeSelect.dispatchEvent(new window.Event("change", { bubbles: true }));

// Test 20% down payment
loanDownPaymentPctInput.value = "20";
loanDownPaymentPctInput.dispatchEvent(new window.Event("input", { bubbles: true }));
const loanHtml20 = loanBreakdownContainer.innerHTML;
assert.ok(loanHtml20.includes("(20%)"), "Option B table must show (20%) for Upfront Customer Payment");
assert.ok(loanHtml20.includes("39,065"), "Option B table must reflect calculated 20% down payment amount (Rs 39,065)");

// Test 0% down payment (Zero Down Payment)
loanDownPaymentPctInput.value = "0";
loanDownPaymentPctInput.dispatchEvent(new window.Event("input", { bubbles: true }));
const loanHtml0 = loanBreakdownContainer.innerHTML;
assert.ok(loanHtml0.includes("(0%)"), "Option B table must show (0%) for Upfront Customer Payment");
assert.ok(loanHtml0.includes("Rs 0") || loanHtml0.includes("₹0"), "Option B table must show 0 down payment when 0% is selected");

// Reset back to 10%
loanDownPaymentPctInput.value = "10";
loanDownPaymentPctInput.dispatchEvent(new window.Event("input", { bubbles: true }));
paymentModeSelect.value = "upfront";
paymentModeSelect.dispatchEvent(new window.Event("change", { bubbles: true }));

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

const undoBtn = document.getElementById("cadUndoBtn");
assert.ok(undoBtn, "Undo button must exist");
assert.ok(undoBtn.textContent.includes("Undo"), "Undo button must contain text 'Undo'");
assert.ok(undoBtn.title.includes("Ctrl+X"), "Undo button tooltip should mention Ctrl+X");

const redoBtn = document.getElementById("cadRedoBtn");
assert.ok(redoBtn, "Redo button must exist");
assert.ok(redoBtn.textContent.includes("Redo"), "Redo button must contain text 'Redo'");
assert.ok(redoBtn.title.includes("Ctrl+Y"), "Redo button tooltip should mention Ctrl+Y");

// Test undo / redo button interactions
assert.equal(undoBtn.disabled, true, "Undo button should initially be disabled");
assert.equal(redoBtn.disabled, true, "Redo button should initially be disabled");
cad.placePanel();
assert.equal(undoBtn.disabled, false, "Undo button should become enabled after placing panel");
assert.equal(redoBtn.disabled, true, "Redo button should remain disabled after new action");
undoBtn.click();
assert.equal(undoBtn.disabled, true, "Undo button should be disabled after undoing the single action");
assert.equal(redoBtn.disabled, false, "Redo button should become enabled after undo");
redoBtn.click();
assert.equal(undoBtn.disabled, false, "Undo button should be enabled after redo");
assert.equal(redoBtn.disabled, true, "Redo button should be disabled at head of history");

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

// Verify PDF Sample View & Editable Text with Password "editprop"
console.log("Testing PDF Sample View & Editable Text with Password 'editprop'...");
const openSampleBtn = document.getElementById("openSampleViewBtn");
assert.ok(openSampleBtn, "View Sample PDF & Edit Text button must exist");

const sampleModal = document.getElementById("pdfSampleViewModal");
const samplePagesContainer = document.getElementById("pdfSampleViewPages");
assert.ok(sampleModal, "PDF Sample View modal must exist");
assert.ok(samplePagesContainer, "PDF Sample View pages container must exist");

// Open Sample View
openSampleBtn.click();
assert.equal(sampleModal.style.display, "flex", "PDF Sample View modal must be opened");

// Verify that all core pages and sections are rendered
const sampleContent = samplePagesContainer.textContent;
assert.ok(sampleContent.includes("Turnkey Solar PV Installation Proposal"), "Must include main proposal title");
assert.ok(sampleContent.includes("1. System Design Considerations & Capacity Summary"), "Must include Section 1");
assert.ok(sampleContent.includes("Current MSEDCL Bill (Before Solar)"), "Must include Current Bill Before Solar table");
assert.ok(sampleContent.includes("With Rooftop Solar (After Solar)"), "Must include After Solar table");
assert.ok(sampleContent.includes("16 MM EARTHING ALU. CONDUCTOR ROD; 14 MM × 1 MTR COPPER ROD"), "Must include 16 MM & 14 MM earthing spec");
assert.ok(sampleContent.includes("Terms and Conditions for Warranty"), "Must include Warranty Terms");
assert.ok(sampleContent.includes("Scope of Work"), "Must include Scope of Work");

// Verify that initially elements are read-only (not contenteditable)
const firstHeading = samplePagesContainer.querySelector(".pdf-section-title");
assert.ok(firstHeading, "Section title must exist");
assert.notEqual(firstHeading.getAttribute("contenteditable"), "true", "Text should initially be locked and not editable");

// Test Unlock with WRONG password
const unlockBtn = document.getElementById("sampleViewUnlockEditBtn");
const pwdInput = document.getElementById("sampleViewPasswordInput");
const confirmPwdBtn = document.getElementById("sampleViewConfirmUnlockBtn");
const pwdError = document.getElementById("sampleViewPasswordError");

unlockBtn.click();
pwdInput.value = "wrongpassword";
confirmPwdBtn.click();
assert.equal(pwdError.style.display, "block", "Password error must be displayed for invalid password");
assert.notEqual(firstHeading.getAttribute("contenteditable"), "true", "Elements must not be editable after wrong password");

// Test Unlock with CORRECT password "editprop"
pwdInput.value = "editprop";
confirmPwdBtn.click();
assert.equal(pwdError.style.display, "none", "Password error should be hidden on correct password");
assert.equal(firstHeading.getAttribute("contenteditable"), "true", "All section headings must now be contenteditable='true'");

// Verify that table cells, paragraphs, and values are also editable
const sampleCell = samplePagesContainer.querySelector(".pdf-table td");
assert.ok(sampleCell, "Table cell must exist");
assert.equal(sampleCell.getAttribute("contenteditable"), "true", "Table cell must be contenteditable='true'");

const sampleParagraph = samplePagesContainer.querySelector(".pdf-paragraph");
assert.ok(sampleParagraph, "Paragraph must exist");
assert.equal(sampleParagraph.getAttribute("contenteditable"), "true", "Paragraph must be contenteditable='true'");

// Make manual edit to a text element and verify persistence
const originalTitle = firstHeading.textContent;
firstHeading.textContent = "1. Customized Special Solar System Design Plan";
assert.equal(firstHeading.textContent, "1. Customized Special Solar System Design Plan", "Manual edit must be applied to DOM");

// Lock edits
unlockBtn.click(); // Clicking again locks text
assert.notEqual(firstHeading.getAttribute("contenteditable"), "true", "Heading must no longer be editable after locking");
assert.equal(firstHeading.textContent, "1. Customized Special Solar System Design Plan", "Edited text must be preserved after locking!");

// Test Print invocation
let printCalled = false;
window.print = () => { printCalled = true; };
const printBtn = document.getElementById("sampleViewPrintBtn");
assert.ok(printBtn, "Print to PDF button must exist");
printBtn.click();
assert.ok(printCalled, "Print to PDF must invoke window.print()");

// Close Sample View modal
const closeBtn = document.getElementById("closeSampleViewModalBtn");
assert.ok(closeBtn, "Close Sample View button must exist");
closeBtn.click();
assert.equal(sampleModal.style.display, "none", "Sample View modal must close");

console.log("✓ PDF Sample View and Edit Mode with password 'editprop' verified successfully!");

// =========================================================================
// TEST SUITE: MULTI-CUSTOMER BUILDING SOLAR PROPOSAL STUDIO
// =========================================================================
console.log("\nTesting Multi-Customer Building Solar Proposal Studio...");

// 1. Verify Mode Switcher buttons exist
const modeSingleBtn = document.getElementById("modeSingleBtn");
const modeMultiBuildingBtn = document.getElementById("modeMultiBuildingBtn");
assert.ok(modeSingleBtn, "Single customer mode button must exist");
assert.ok(modeMultiBuildingBtn, "Multi-customer building mode button must exist");

// 2. Switch to Multi-Customer Building mode
modeMultiBuildingBtn.click();
assert.equal(window.appState.proposalMode, "multi_building", "Proposal mode must be 'multi_building'");
assert.ok(modeMultiBuildingBtn.classList.contains("active"), "Multi-building mode button must be active");
assert.ok(!modeSingleBtn.classList.contains("active"), "Single customer mode button must NOT be active");

const bldgTabBtn = document.getElementById("workspaceTabBuildingBtn");
assert.ok(bldgTabBtn, "Building Studio tab button must exist");
assert.notEqual(bldgTabBtn.style.display, "none", "Building Studio tab button must be visible");

const activePane = document.querySelector(".workspace-tab-pane.active");
assert.equal(activePane?.dataset.pane, "building", "Active pane must switch to 'building'");

// 3. Verify Building Studio UI & Initial Seeded Flats
const bldgFlatsTbody = document.getElementById("buildingFlatsTableBody");
assert.ok(bldgFlatsTbody, "Building flats table body must exist");
assert.equal(bldgFlatsTbody.children.length, 4, "Initial seeded flats table must contain 4 flats");

const kpiFlats = document.getElementById("bldgKpiFlats")?.textContent;
assert.ok(kpiFlats && kpiFlats.includes("4 Flats"), `KPI flats must indicate 4 flats, got: ${kpiFlats}`);

// 4. Test Adding a Flat and Auto-Increment Flat Number
const addFlatBtn = document.getElementById("addFlatBtn");
assert.ok(addFlatBtn, "Add flat button must exist");
addFlatBtn.click();

assert.equal(window.appState.buildingFlats.length, 5, "Building flats count must increase to 5");
assert.equal(bldgFlatsTbody.children.length, 5, "Table rows must update to 5");
const newRowFlatNo = bldgFlatsTbody.querySelector('tr[data-flat-idx="4"] input[data-field="flatNo"]')?.value;
assert.equal(newRowFlatNo, "203", `New flat number must auto-increment to 203, got: ${newRowFlatNo}`);

// 5. Test 'Same as above' Row Clone
const firstCloneBtn = bldgFlatsTbody.querySelector('tr[data-flat-idx="0"] .btn-flat-clone');
assert.ok(firstCloneBtn, "Clone button must exist on row 0");
firstCloneBtn.click();
assert.equal(window.appState.buildingFlats.length, 6, "Flats count must increase to 6 after cloning");

// 5b. Test CSV/TSV File Upload via importCsvInput with User's Exact Data
const userActualCsv = `FlatNo\tCustomerName\tSanctionLoadKw\tCategory\tPhase\tMonthlyUnits\tMonthlyBill\tPaymentMode\tLoanDownPaymentPct\tLoanInterestRate
101\tAjay kulkarni\t5\tLT-I\t3-phase\t93\t1023\twithout_loan\t10\t7
102\tRuchi Bhindwale\t5\tLT-I\t3-phase\t153\t1836\twithout_loan\t10\t7
103\tAjay Uke\t4\tLT-I\t1-phase\t91\t910\twithout_loan\t10\t7
201\tAshok Mahajan\t5\tLT-I\t3-phase\t92\t1104\twithout_loan\t10\t7
202\tShriniwas Badrayani\t5\tLT-I\t3-phase\t376\t4512\twithout_loan\t10\t7
203\tSudhir Aptekar\t4\tLT-I\t1-phase\t194\t2134\twithout_loan\t10\t7
301\tShrirang Jamadagani\t5\tLT-I\t3-phase\t240\t2640\twithout_loan\t10\t7
302\tSanjeevani Toley\t5\tLT-I\t3-phase\t195\t2340\twithout_loan\t10\t7`;

const importInput = document.getElementById("importCsvInput");
assert.ok(importInput, "importCsvInput must exist");
let alertMessage = "";
window.alert = (msg) => { alertMessage = msg; };
globalThis.alert = window.alert;

Object.defineProperty(importInput, "files", {
  value: [{ textData: userActualCsv, name: "actual_customers.csv" }],
  configurable: true,
});
importInput.dispatchEvent(new window.Event("change"));

assert.equal(window.appState.buildingFlats.length, 8, "Must import all 8 flats from user TSV");
assert.equal(window.appState.buildingFlats[0].customerName, "Ajay kulkarni");
assert.equal(window.appState.buildingFlats[0].paymentMode, "upfront");
assert.equal(window.appState.buildingFlats[0].loanMode, false);
assert.equal(window.appState.buildingFlats[4].monthlyUnits, 376);
assert.ok(alertMessage.includes("Successfully imported 8 flats"), `Must show success alert, got: ${alertMessage}`);

// Verify compulsory roof area modal upon CSV import
{
  const csvModal = document.getElementById("csvRoofAreaModal");
  assert.ok(csvModal, "CSV Roof Area Modal must exist in DOM");
  assert.equal(csvModal.style.display, "flex", "CSV Roof Area Modal must be displayed after CSV import");
  const csvAreaInput = document.getElementById("csvRoofAreaInput");
  assert.ok(Number(csvAreaInput.value) >= 800, "Recommended minimum roof area must be calculated and prefilled");

  // Confirm roof area (2500 sq ft)
  csvAreaInput.value = "2500";
  const confirmBtn = document.getElementById("csvRoofAreaConfirmBtn");
  assert.ok(confirmBtn, "Confirm Roof Area button must exist");
  confirmBtn.click();
  assert.equal(csvModal.style.display, "none", "CSV Roof Area Modal must close on confirmation");
  assert.equal(window.appState.buildingConfig.roofArea, 2500, "Building config roof area must be updated to 2500 sq ft");

  // Verify CAD loaded panels and all panels have strictly uniform, fixed physical dimensions
  const cadInst = getActiveRooftopCAD();
  assert.ok(cadInst.panels.length > 0, "Rooftop CAD must have panels allocated for the building");
  const basePanelW = cadInst.panels[0].w;
  const basePanelH = cadInst.panels[0].h;
  for (let pi = 0; pi < cadInst.panels.length; pi++) {
    const p = cadInst.panels[pi];
    assert.equal(p.w, basePanelW, `Panel #${pi + 1} width must match uniform base panel width`);
    assert.equal(p.h, basePanelH, `Panel #${pi + 1} height must match uniform base panel height`);
  }

  // Verify Aerial Image Scaling with respect to Base Roof
  assert.ok(cadInst.image.isLoaded, "Aerial image must be loaded");
  cadInst.fitImageToRoof("width");
  const expectedWidthScale = cadInst.roofW / cadInst.image.origWidth;
  assert.ok(Math.abs(cadInst.image.scale - expectedWidthScale) < 0.01, "fitImageToRoof('width') must scale image width to roof width");

  cadInst.fitImageToRoof("height");
  const expectedHeightScale = cadInst.roofH / cadInst.image.origHeight;
  assert.ok(Math.abs(cadInst.image.scale - expectedHeightScale) < 0.01, "fitImageToRoof('height') must scale image height to roof height");

  cadInst.scaleImageToPercentOfRoof(120);
  assert.equal(cadInst.getImageScaleToRoofPercent(), 120, "scaleImageToPercentOfRoof(120) must set scale to 120%");

  cadInst.setImagePhysicalWidthFt(65);
  const pDims = cadInst.getImagePhysicalDimensionsFt();
  assert.equal(pDims.widthFt, 65, "Physical width of image must be set to 65 ft");

  // Test inspector buttons for aerial image
  cadInst.selectItem("image", { id: "roof_image", type: "image" });
  const fitWidthBtn = document.getElementById("inspectorFitWidthBtn");
  assert.ok(fitWidthBtn, "Inspector fit width button must exist");
  fitWidthBtn.click();
  assert.ok(Math.abs(cadInst.image.scale - expectedWidthScale) < 0.01, "Inspector fit width button must execute fitImageToRoof('width')");
}

// 6. Test Bulk Data Entry: Load at least 30 Flats (Verifying 30+ entries per page requirement)
const bulk30Flats = [];
for (let i = 1; i <= 32; i++) {
  const flatNum = 100 + i;
  bulk30Flats.push({
    id: `flat-bulk-${i}`,
    flatNo: String(flatNum),
    customerName: `Flat Resident ${flatNum}`,
    sanctionedLoad: 4.0,
    category: "LT-I",
    phase: "1-phase",
    monthlyUnits: 300 + (i * 10),
    monthlyBill: 3500 + (i * 120),
    loanMode: (i % 2 === 0)
  });
}
window.appState.buildingFlats = bulk30Flats;
window.updateBuildingStudio();

assert.equal(bldgFlatsTbody.children.length, 32, "Building flats table must render all 32 entries");
const footFlats = document.getElementById("footFlatsCount")?.textContent;
assert.equal(footFlats, "32", "Table footer must show 32 flats");

// 7. Test Sizing & Subsidy Calculations on Building Ledger
const ledger = window.appState.buildingData;
assert.ok(ledger, "Building ledger calculation result must exist");
assert.equal(ledger.flatLedger.length, 32, "Flat ledger must contain 32 entries");
assert.ok(ledger.summary.totalBuildingCapacityKw > 0, "Total capacity must be greater than 0");
assert.ok(ledger.summary.totalSubsidy > 0, "Total subsidy must be calculated");

// Verify individual flat subsidies adhere to pro-rata slabs (0-2 kWp @ 30k/kW, >2-3 kWp @ 18k/kW, cap 78k)
ledger.flatLedger.forEach(f => {
  const sub = f.subsidy;
  const kw = f.allocatedKw;
  if (kw >= 3.0) {
    assert.equal(sub, 78000);
  } else if (kw > 2.0) {
    assert.equal(sub, Math.round(60000 + (kw - 2.0) * 18000));
  } else if (kw > 0) {
    assert.equal(sub, Math.round(kw * 30000));
  } else {
    assert.equal(sub, 0);
  }
});

// 8. Test CAD Demarcation & Cross-Workspace Tab Synchronization with Building Data
const bldgCad = window.cad;
if (bldgCad && typeof bldgCad.assignPanelsToFlats === "function") {
  bldgCad.assignPanelsToFlats(ledger.flatLedger);
  const firstPanel = bldgCad.panels[0];
  if (firstPanel) {
    assert.ok(firstPanel.flatColor, "CAD panel must have assigned flatColor border");
    assert.ok(firstPanel.flatLabel, "CAD panel must have assigned flatLabel text");
  }
}

// Verify Cross-Workspace Tab Synchronization:
// 1. Sidebar Inputs sync to building
const custNameInput = document.getElementById("customerName")?.value;
assert.ok(custNameInput && custNameInput.includes("Shivaji Heights"), `Sidebar customerName must sync with building name, got: ${custNameInput}`);
const mUnitsInput = Number(document.getElementById("monthlyUnits")?.value);
assert.equal(mUnitsInput, ledger.summary.totalMonthlyUnits, `Sidebar monthlyUnits must sync with building total units (${ledger.summary.totalMonthlyUnits}), got: ${mUnitsInput}`);

// 2. Sizing & Compare Pane metrics sync
const recCap = document.getElementById("recommendedCapacity")?.textContent;
assert.ok(recCap && recCap.includes(ledger.summary.totalBuildingCapacityKw.toFixed(1)), `Recommended capacity must show building capacity, got: ${recCap}`);
const recTitle = document.getElementById("recommendationTitle")?.textContent;
assert.ok(recTitle && recTitle.includes("Flats Combined"), `Recommendation title must indicate combined flats, got: ${recTitle}`);

// 3. Financials & Savings Pane metrics sync
const finGross = document.getElementById("financialTotalCost")?.textContent;
assert.ok(finGross && (finGross.includes("Rs") || finGross.includes("₹")), `Financials gross cost must be formatted in currency, got: ${finGross}`);
const multiSubCard = document.getElementById("financialMultiSubsidyCard");
assert.equal(multiSubCard?.style.display, "block", "Multi-Meter Financial Subsidy Card must be visible in building mode");

// 4. Loan & EMI Pane sync
const finContent = document.getElementById("financingBreakdownContent")?.innerHTML;
assert.ok(finContent && finContent.includes("Resident Financing Mode Breakdown"), "Loan pane must include Resident Financing Mode Breakdown");

// 5. Proposal & Export Preview Card sync
const propToName = document.getElementById("proposalToCustomerName")?.textContent;
assert.ok(propToName && propToName.includes("Shivaji Heights"), `Proposal Prepared For name must sync with building name, got: ${propToName}`);

// 6. Tech Guide Pane sync
const guideSection = document.getElementById("multiBuildingGuideSection");
assert.ok(guideSection, "Tech Guide must contain Category B Multi-Customer Building Solar guide section");

// 9. Test Building Proposal Generation & Sample View
const openPdfBtn = document.getElementById("openSampleViewBtn");
assert.ok(openPdfBtn, "Open sample view button must exist");

// Check default proposal output: checkbox 'Include Full Individual Resident Sheets' is unchecked by default
const includeIndivCheckbox = document.getElementById("includeIndividualSheets");
assert.ok(includeIndivCheckbox, "Include individual sheets checkbox must exist");
assert.equal(includeIndivCheckbox.checked, false, "Include individual sheets must be unchecked by default (combined ledger default)");

// Open Building Proposal in Sample View
openPdfBtn.click();
assert.equal(sampleModal.style.display, "flex", "Sample View modal must open for building proposal");

// Verify Combined Ledger proposal pages (Page 1 = Executive Summary, Page 2 = CAD Blueprint, Page 3 = Master Ledger)
const samplePages = samplePagesContainer.querySelectorAll(".pdf-sample-page");
assert.equal(samplePages.length, 3, "Default building proposal output must be 3 pages (Combined Ledger)");

const page1Text = samplePages[0].textContent;
assert.ok(page1Text.includes("Building Executive Summary"), "Page 1 must contain Building Executive Summary");
assert.ok(page1Text.includes("Shivaji Heights"), "Page 1 must contain Building Name");

const page2Text = samplePages[1].textContent;
assert.ok(page2Text.includes("Shared Rooftop Layout & Demarcated Flat Panel Allocation"), "Page 2 must contain CAD Demarcation title");

const page3Text = samplePages[2].textContent;
assert.ok(page3Text.includes("Resident-Wise Financial Allocation & Solar Ledger"), "Page 3 must contain Master Ledger title");
assert.ok(page3Text.includes("BUILDING TOTALS (32 FLATS)"), "Page 3 must contain Master Ledger 32 flats totals");

// 10. Test In-place text editing on Building Proposal preview with password 'editprop'
const bldgUnlockBtn = document.getElementById("sampleViewUnlockEditBtn");
const bldgPwdInput = document.getElementById("sampleViewPasswordInput");
const bldgConfirmBtn = document.getElementById("sampleViewConfirmUnlockBtn");

bldgUnlockBtn.click();
bldgPwdInput.value = "editprop";
bldgConfirmBtn.click();

const editableBldgCell = samplePages[2].querySelector(".pdf-table td span.editable-field");
assert.ok(editableBldgCell, "Editable field must exist on building ledger table");
assert.equal(editableBldgCell.getAttribute("contenteditable"), "true", "Building ledger table text must be editable with password 'editprop'");

// Lock edits
bldgUnlockBtn.click();
assert.notEqual(editableBldgCell.getAttribute("contenteditable"), "true", "Building ledger text must no longer be editable after locking");

// Close Sample View modal
document.getElementById("closeSampleViewModalBtn")?.click();

// 11. Test Option: 'Include Full Individual Resident Sheets'
includeIndivCheckbox.checked = true;
openPdfBtn.click();

const fullPages = samplePagesContainer.querySelectorAll(".pdf-sample-page");
assert.equal(fullPages.length, 3 + 32, "When 'Include Full Individual Resident Sheets' is checked, proposal must include all 32 individual flat sheets!");

const individualFlatPage = fullPages[3].textContent;
assert.ok(individualFlatPage.includes("Official Solar Proposal — Flat 101"), "Individual sheet must have customized flat header");
assert.ok(individualFlatPage.includes("ELECTRICITY BILL COMPARISON: BEFORE VS AFTER SOLAR"), "Individual sheet must NOT skip electricity bill comparison");
assert.ok(
  individualFlatPage.includes("INVESTMENT & PM SURYA GHAR SUBSIDY BREAKDOWN") ||
  individualFlatPage.includes("INVESTMENT & FIXED-QUANTUM SUBSIDY BREAKDOWN"),
  "Individual sheet must NOT skip investment & subsidy breakdown"
);
assert.ok(individualFlatPage.includes("WARRANTIES & TURNKEY SCOPE OF DELIVERY"), "Individual sheet must NOT skip scope of work");
assert.ok(individualFlatPage.includes("16 mm and 14 mm copper bonded earthing electrode rods"), "Individual sheet must specify 16mm and 14mm earthing rods");

document.getElementById("closeSampleViewModalBtn")?.click();

// 11b. Test Changing Customer/Building Name via Modal without Fallback Bug
const quickChangeCustomerBtn = document.getElementById("quickChangeCustomerBtn");
assert.ok(quickChangeCustomerBtn, "Quick Change Customer button must exist");
quickChangeCustomerBtn.click();

const changeCustModal = document.getElementById("changeCustomerModal");
assert.ok(changeCustModal && changeCustModal.style.display !== "none", "Change customer modal must be open");

const modalCustNameInput = document.getElementById("modalCustomerName");
const modalCustAddrInput = document.getElementById("modalCustomerAddress");
const modalUpdateBtn = document.getElementById("modalUpdateCustomerOnlyBtn");

modalCustNameInput.value = "Gokuldham Heights CHS";
modalCustAddrInput.value = "Kothrud, Pune, Maharashtra - 411038";
modalUpdateBtn.click();

assert.equal(changeCustModal.style.display, "none", "Modal must close after update");
assert.equal(document.getElementById("proposalToCustomerName")?.textContent, "Gokuldham Heights CHS", "Proposal Prepared For name must be updated immediately");
assert.equal(window.appState.buildingConfig?.buildingName, "Gokuldham Heights CHS", "buildingConfig.buildingName must be updated");
assert.equal(window.appState.buildingData?.buildingName, "Gokuldham Heights CHS", "buildingData.buildingName must be updated");
assert.equal(document.getElementById("buildingNameInput")?.value, "Gokuldham Heights CHS", "buildingNameInput value must be updated");

// Trigger re-render to verify it does NOT fall back to original name
window.render();
assert.equal(document.getElementById("proposalToCustomerName")?.textContent, "Gokuldham Heights CHS", "Proposal Prepared For name must NOT fall back after render()");

// 11c. Test Hiding CAD Layout Blueprint (#showCadDiagram)
const showCadCheckbox = document.getElementById("showCadDiagram");
assert.ok(showCadCheckbox, "showCadDiagram checkbox must exist");

// Uncheck CAD diagram and uncheck individual sheets
includeIndivCheckbox.checked = false;
showCadCheckbox.checked = false;
showCadCheckbox.dispatchEvent(new window.Event("change"));

openPdfBtn.click();
const noCadPages = samplePagesContainer.querySelectorAll(".pdf-sample-page");
assert.equal(noCadPages.length, 2, "Building proposal must only have 2 pages when CAD diagram is unchecked");

const noCadContent = samplePagesContainer.textContent;
assert.ok(!noCadContent.includes("Shared Rooftop Layout & Demarcated Flat Panel Allocation"), "Shared Rooftop Layout & Demarcated Flat Panel Allocation MUST be hidden when CAD is unchecked");
assert.ok(noCadPages[0].textContent.includes("Gokuldham Heights CHS"), "Page 1 must show updated building name");
assert.ok(noCadPages[1].textContent.includes("2. Resident-Wise Financial Allocation & Solar Ledger"), "Master ledger must be numbered as section 2 when CAD is hidden");

document.getElementById("closeSampleViewModalBtn")?.click();

// Re-check CAD diagram to verify it restores
showCadCheckbox.checked = true;
showCadCheckbox.dispatchEvent(new window.Event("change"));

openPdfBtn.click();
const restoredCadPages = samplePagesContainer.querySelectorAll(".pdf-sample-page");
assert.equal(restoredCadPages.length, 3, "Building proposal must have 3 pages when CAD diagram is re-checked");
assert.ok(samplePagesContainer.textContent.includes("Shared Rooftop Layout & Demarcated Flat Panel Allocation"), "CAD section must be restored when showCadDiagram is checked");
assert.ok(restoredCadPages[2].textContent.includes("3. Resident-Wise Financial Allocation & Solar Ledger"), "Master ledger must be numbered as section 3 when CAD is shown");

document.getElementById("closeSampleViewModalBtn")?.click();

// 12. Test Manual Reset & Redo Demarcation Button in Rooftop CAD (Multi-Meter Mode)
{
  const redoDemarcationBtn = document.getElementById("cadRedoDemarcationBtn");
  assert.ok(redoDemarcationBtn, "cadRedoDemarcationBtn must exist in CAD toolbar");
  assert.equal(redoDemarcationBtn.style.display, "inline-flex", "cadRedoDemarcationBtn must be visible in multi-building mode");

  const imgRedoBtn = document.getElementById("cadImageRedoDemarcationBtn");
  assert.ok(imgRedoBtn, "cadImageRedoDemarcationBtn must exist in Image Drawer");

  const cadInst2 = window.cad;
  assert.ok(cadInst2, "CAD instance must exist");

  // Simulate uploaded rooftop aerial image
  cadInst2.image = {
    element: { width: 800, height: 600 },
    isLoaded: true,
    x: cadInst2.roofX || 50,
    y: cadInst2.roofY || 50,
    scale: 1.0,
    rotation: 0,
    locked: false
  };

  // Add obstacle cutout over newly identified obstacle on rooftop image
  cadInst2.cutouts = [{
    id: "cutout_lift_room",
    type: "cutout",
    shape: "rectangle",
    x: (cadInst2.roofX || 50) + 15,
    y: (cadInst2.roofY || 50) + 15,
    w: 80,
    h: 60
  }];

  // Click manual Reset & Redo Demarcation button
  redoDemarcationBtn.click();

  assert.ok(cadInst2.panels.length > 0, "Panels must be placed on roof after Reset & Redo Demarcation");
  const liftCutout = cadInst2.cutouts[0];
  for (const p of cadInst2.panels) {
    // Verify no panel collides with the obstacle cutout
    const overlaps = !(
      p.x + p.w <= liftCutout.x ||
      p.x >= liftCutout.x + liftCutout.w ||
      p.y + p.h <= liftCutout.y ||
      p.y >= liftCutout.y + liftCutout.h
    );
    assert.ok(!overlaps, "Panels must avoid collision with newly placed rooftop obstacle cutout");

    // Verify all placed panels carry flat demarcation
    assert.ok(p.flatColor, "Panel must have demarcated flatColor");
    assert.ok(p.flatLabel, "Panel must have demarcated flatLabel");
    assert.ok(p.customerName, "Panel must have demarcated customerName");
  }

  // Test clicking Reset All Panels clears both panels and demarcation
  const clearPanelsBtn = document.getElementById("cadClearPanelsBtn");
  clearPanelsBtn?.click();
  assert.equal(cadInst2.panels.length, 0, "Reset All Panels must clear panels array");
  assert.equal(cadInst2.multiCustomerFlats, null, "Reset All Panels must clear multiCustomerFlats");

  // Test clicking Autofill Panels re-places and re-demarcates
  const autoPlaceBtnElem = document.getElementById("cadAutoPlaceBtn");
  autoPlaceBtnElem?.click();
  assert.ok(cadInst2.panels.length > 0, "Autofill Panels must re-populate panels");
  assert.ok(cadInst2.panels[0].flatColor, "Autofill in building mode must re-demarcate flats");

  // Test clicking Image Drawer Redo Demarcation button
  imgRedoBtn.click();
  assert.ok(cadInst2.panels.length > 0, "Image drawer redo demarcation button must function cleanly");
  assert.ok(cadInst2.panels[0].flatLabel, "Image drawer redo demarcation must assign flat labels");

  // Test Building Studio Proportional CAD Sync button
  const syncCadBtn = document.getElementById("syncCadPanelsBtn");
  syncCadBtn?.click();
  assert.ok(cadInst2.panels.length > 0, "Sync CAD Panels button must trigger reset & redo demarcation");
  assert.ok(cadInst2.panels[0].flatColor, "Sync CAD Panels must produce demarcated panels");

  modeSingleBtn.click();
  assert.equal(window.appState.proposalMode, "single", "Proposal mode must restore to 'single'");
  assert.equal(redoDemarcationBtn.style.display, "none", "cadRedoDemarcationBtn must be hidden in single customer mode");
  assert.equal(imgRedoBtn.style.display, "none", "cadImageRedoDemarcationBtn must be hidden in single customer mode");
  assert.equal(bldgTabBtn.style.display, "none", "Building Studio tab must be hidden in single customer mode");
}
const restoredName = document.getElementById("customerName")?.value;
assert.notEqual(restoredName, "Shivaji Heights Co-op Housing Society", "Single customer name must be restored when switching back");

console.log("✓ Multi-Customer Building Solar Proposal Studio & Cross-Workspace Synchronization verified successfully!");

console.log("\nALL END-TO-END WORKSPACE & AUTO-CALCULATION TESTS PASSED! 🚀🎉");
