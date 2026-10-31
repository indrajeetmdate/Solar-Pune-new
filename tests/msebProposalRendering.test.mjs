import assert from "node:assert/strict";
import { DEFAULT_CONFIG, getPanelSpecificationText } from "../src/config.js";
import { calculateEstimate } from "../src/calculator.js";

// Test 1: getPanelSpecificationText coverage
assert.equal(getPanelSpecificationText("dcr", null, 550), "Tier-1 DCR Mono PERC / TOPCon (550 Wp)");
assert.equal(getPanelSpecificationText("nonDcr", null, 550), "Tier-1 Non-DCR Mono PERC (550 Wp)");
assert.equal(getPanelSpecificationText("dcr_bifacial", null, 550), "Tier-1 DCR Mono Bifacial Glass-to-Glass (550 Wp)");
assert.equal(getPanelSpecificationText("mono_bifacial", null, 550), "Tier-1 Mono Bifacial (Non-DCR, 550 Wp)");
assert.equal(getPanelSpecificationText("topcon_bifacial", null, 550), "Tier-1 N-Type TOPCon Bifacial (Non-DCR, 550 Wp)");
assert.equal(getPanelSpecificationText("dcr_topcon", null, 550), "Tier-1 DCR N-Type TOPCon Bifacial (550 Wp)");
assert.equal(getPanelSpecificationText("poly", null, 335), "Tier-1 Multi-Crystalline / Polycrystalline (335 Wp)");
assert.equal(getPanelSpecificationText("custom", "Adani 550Wp Bifacial DCR", 550), "Adani 550Wp Bifacial DCR");

// Test 2: calculateEstimate with various panel types
const baseInput = {
  monthlyUnits: 450,
  monthlyBill: 5200,
  roofArea: 650,
  sanctionedLoad: 5,
  goal: "ongrid",
  structureType: "hotDip",
  backupNeeded: false,
  capacityOverride: 0,
  inverterOverride: 0,
  savingsMethod: "auto",
};

const estDcr = calculateEstimate({ ...baseInput, panelType: "dcr" }, DEFAULT_CONFIG);
assert.equal(estDcr.recommended.subsidy, 78000, "DCR panel must receive full subsidy");
assert.equal(estDcr.recommended.panelSpec, "Tier-1 DCR Mono PERC / TOPCon (550 Wp)");

const estNonDcr = calculateEstimate({ ...baseInput, panelType: "nonDcr" }, DEFAULT_CONFIG);
assert.equal(estNonDcr.recommended.subsidy, 0, "Non-DCR panel must receive 0 subsidy");
assert.equal(estNonDcr.recommended.panelSpec, "Tier-1 Non-DCR Mono PERC (550 Wp)");

const estBifacial = calculateEstimate({ ...baseInput, panelType: "dcr_bifacial" }, DEFAULT_CONFIG);
assert.equal(estBifacial.recommended.subsidy, 78000, "DCR Bifacial must receive subsidy");
assert.equal(estBifacial.recommended.panelSpec, "Tier-1 DCR Mono Bifacial Glass-to-Glass (550 Wp)");

const estCustom = calculateEstimate({ ...baseInput, panelType: "dcr", panelSpecCustom: "Tata Power 550Wp DCR Mono" }, DEFAULT_CONFIG);
assert.equal(estCustom.recommended.panelSpec, "Tata Power 550Wp DCR Mono");

// Test 3: PDF Generation includes MSEDCL Left and Right comparison tables
const mockCalls = [];
globalThis.alert = () => {};
globalThis.window = {
  jspdf: {
    jsPDF: class MockPDF {
      constructor() {
        this.pages = [1];
        this.lastAutoTable = { finalY: 50 };
        this.textCalls = [];
        this.internal = {
          pageSize: { getWidth: () => 210, getHeight: () => 297 },
          getNumberOfPages: () => this.pages.length,
        };
      }
      setFont() {}
      setFontSize() {}
      setTextColor() {}
      text(content, x, y, opts) {
        this.textCalls.push(content);
      }
      line() {}
      setDrawColor() {}
      setLineWidth() {}
      setFillColor() {}
      rect() {}
      roundedRect() {}
      addPage() { this.pages.push(this.pages.length + 1); }
      getNumberOfPages() { return this.pages.length; }
      setPage() {}
      addImage() {}
      output() { return 'pdf-blob'; }
      save(filename) { this.savedFilename = filename; }
      splitTextToSize(text) { return Array.isArray(text) ? text : [text]; }
      autoTable(opts) {
        this.lastAutoTable = { finalY: (opts.startY || 50) + (opts.body ? opts.body.length * 6 : 20) };
        mockCalls.push(opts);
      }
    }
  }
};
globalThis.document = {
  createElement: () => ({ getContext: () => ({ fillStyle: '', fillRect: () => {}, clearRect: () => {}, drawImage: () => {} }), toDataURL: () => 'data:image/jpeg;base64,123' }),
  getElementById: () => null
};
globalThis.Image = class {
  set src(url) {
    this.width = 100;
    this.height = 100;
    setTimeout(() => this.onload && this.onload(), 5);
  }
};

const { generateProposalPDF } = await import("../src/reportGenerator.js");
await generateProposalPDF(estBifacial, estBifacial.recommended, { hidePayback: false });

const leftTable = mockCalls.find(c => c.head && c.head[0] && c.head[0][0].includes("Current MSEDCL Bill (Before Solar)"));
assert.ok(leftTable, "Current MSEDCL Bill (Before Solar) table must be generated in PDF");
assert.ok(leftTable.body.some(r => r[0] === "Units Consumed"), "Must include Units Consumed");
assert.ok(leftTable.body.some(r => r[0] === "Fixed Charges"), "Must include Fixed Charges");
assert.ok(leftTable.body.some(r => r[0] === "Energy Charges"), "Must include Energy Charges");
assert.ok(leftTable.body.some(r => r[0].includes("Wheeling Charges")), "Must include Wheeling Charges");
assert.ok(leftTable.body.some(r => r[0].includes("Electricity Duty")), "Must include Electricity Duty");
assert.ok(leftTable.body.some(r => r[0] === "Total Current Bill"), "Must include Total Current Bill");
assert.ok(leftTable.body.some(r => r[0] === "Net Bill Payable"), "Must include Net Bill Payable");

const rightTable = mockCalls.find(c => c.head && c.head[0] && c.head[0][0].includes("With Rooftop Solar (After Solar)"));
assert.ok(rightTable, "With Rooftop Solar (After Solar) table must be generated in PDF");
assert.ok(rightTable.body.some(r => r[0] === "Solar Generation"), "Must include Solar Generation");
assert.ok(rightTable.body.some(r => r[0] === "Banked Solar Units"), "Must include Banked Solar Units");
assert.ok(rightTable.body.some(r => r[0] === "Fixed Charges"), "Must include Fixed Charges");
assert.ok(rightTable.body.some(r => r[0].includes("Energy Charges")), "Must include Energy Charges");
assert.ok(rightTable.body.some(r => r[0] === "Net Bill Payable"), "Must include Net Bill Payable");
assert.ok(rightTable.body.some(r => r[0] === "Net Monthly Savings"), "Must include Net Monthly Savings");
assert.ok(rightTable.body.some(r => r[0] === "Projected Annual Savings"), "Must include Projected Annual Savings");

const warrantyTable = mockCalls.find(c => c.body && c.body.some(row => row[1] === "SOLAR PANEL"));
assert.ok(warrantyTable, "Warranty table must be generated in PDF");
assert.equal(warrantyTable.body[0][2], "Tier-1 DCR Mono Bifacial Glass-to-Glass (550 Wp)", "Solar panel specification in warranty table must reflect selected bifacial panel");

console.log("All MSEB Proposal Rendering and Panel Selection tests passed successfully! 🎉");
