import assert from "node:assert/strict";
import { DEFAULT_CONFIG, getPanelSpecificationText } from "../src/config.js";
import { calculateEstimate } from "../src/calculator.js";
import { generateBuildingProposalPDF } from "../src/reportGenerator.js";

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

// Test 4: Earthing Rod specification verification in Product Warranty & Details
const earthingRow = warrantyTable.body.find(row => row[1] === "EARTHING");
assert.ok(earthingRow, "Earthing row must be present in warranty table");
assert.ok(earthingRow[2].includes("16 MM EARTHING ALU. CONDUCTOR ROD"), "Earthing rod must be 16 MM, not 16 SQ MM");
assert.ok(earthingRow[2].includes("14 MM × 1 MTR COPPER ROD"), "Earthing rod must be 14 MM, not 14 SQ MM");
assert.ok(!earthingRow[2].includes("16 SQ MM"), "Earthing rod must NOT specify 16 SQ MM");
assert.ok(!earthingRow[2].includes("14 SQ MM"), "Earthing rod must NOT specify 14 SQ MM");

// Test 5: Proposal loan calculations omitted when Without Loan (hideFinancing) is selected
const pdfWithoutLoanCalls = [];
globalThis.window.jspdf.jsPDF = class MockPDFWithoutLoan {
  constructor() {
    this.pages = [1];
    this.lastAutoTable = { finalY: 50 };
    this.textCalls = [];
    this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 }, getNumberOfPages: () => this.pages.length };
  }
  setFont() {}
  setFontSize() {}
  setTextColor() {}
  text(content, x, y, opts) { this.textCalls.push(content); }
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
  save(filename) {}
  splitTextToSize(text) { return Array.isArray(text) ? text : [text]; }
  autoTable(opts) { pdfWithoutLoanCalls.push(opts); }
};

await generateProposalPDF(estBifacial, estBifacial.recommended, { hideFinancing: true });
const hasLoanProposalWithoutLoan = pdfWithoutLoanCalls.some(c => c.head && c.head[0] && String(c.head[0][0]).includes("Bank Partner Loan"));
assert.equal(hasLoanProposalWithoutLoan, false, "When Without Loan is selected, proposal must not show loan calculations");

// Test 6: Commercial Summary in Sample View strictly subtracts subsidy when shown
const { buildSingleSamplePdfPages } = await import("../src/pdfSampleView.js");
const sampleOpt = {
  ...estBifacial.recommended,
  totalPreSubsidy: 192776,
  subsidy: 60000,
  netCost: 192776, // intentionally set stale/gross to ensure renderer derives correct net
};
const htmlWithSubsidy = buildSingleSamplePdfPages(estBifacial, sampleOpt, { hideSubsidy: false });
assert.ok(htmlWithSubsidy.includes("Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account)"), "Expected subsidy must be visible");
assert.ok(htmlWithSubsidy.includes("1,92,776"), "Total gross cost must be 1,92,776");
assert.ok(htmlWithSubsidy.includes("60,000"), "Subsidy must be 60,000");
assert.ok(htmlWithSubsidy.includes("1,32,776"), "Net Payable Cost must be strictly 1,32,776 (192,776 - 60,000)");

// Test 7: Commercial Summary in Sample View hides subsidy row when hideSubsidy: true
const htmlHideSubsidy = buildSingleSamplePdfPages(estBifacial, sampleOpt, { hideSubsidy: true });
assert.ok(!htmlHideSubsidy.includes("Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account)"), "Expected subsidy row must be hidden when hideSubsidy is true");
assert.ok(htmlHideSubsidy.includes("Net Payable Cost to customer"), "Net Payable Cost row must be present");

// Test 8: Single-Customer Sample View honors showCadDiagram: false (hides Page 2 & renumbers sections + Page N of M)
const htmlNoCad = buildSingleSamplePdfPages(estBifacial, sampleOpt, { showCadDiagram: false });
assert.ok(!htmlNoCad.includes("Rooftop Layout &amp; Solar Array CAD Plan"), "CAD section must be omitted when showCadDiagram is false");
assert.ok(htmlNoCad.includes("2. Financial Quote &amp; Scope of Work"), "Financial Quote must be renumbered to Section 2 when CAD is hidden");
assert.ok(htmlNoCad.includes("3. Terms &amp; Conditions, Warranty and Details"), "Warranty & T&C must be renumbered to Section 3 when CAD is hidden");
assert.ok(htmlNoCad.includes("4. Solar System Types"), "Solar System Types must be renumbered to Section 4 when CAD is hidden");
assert.ok(htmlNoCad.includes("Page 5 of 5"), "Total page count must reflect 5 pages when CAD and Loan are omitted");
assert.ok(!htmlNoCad.includes("Page 6 of 6"), "Should not contain Page 6 of 6 when CAD is omitted");

// Test 9: Single-Customer Sample View with showCadDiagram: true & Loan active numbers sections 1..6 and 8 pages
const sampleLoanOpt = {
  ...sampleOpt,
  inverterModel: "5kw Single Phase",
  financing: {
    paymentMode: "loan",
    downPaymentPct: 10,
    downPayment: 19278,
    principal: 173498,
    interestRatePct: 7,
    monthlyEmi: 5200,
    targetBillAmount: 5200,
    tenureFormatted: "3.2 yrs (38 mos)",
    totalInterest: 24102,
    upfrontNetCost: 132776,
    totalLoanCost: 216878,
    totalPreSubsidy: 192776,
    freeElectricityYears: 21.8,
    lifetimeNetGainUpfront: 1800000,
    lifetimeNetGainWithLoan: 1750000,
    isZeroOutOfPocket: true,
  },
};
const htmlCadLoan = buildSingleSamplePdfPages(estBifacial, sampleLoanOpt, { showCadDiagram: true });
assert.ok(htmlCadLoan.includes("2. Rooftop Layout &amp; Solar Array CAD Plan"), "CAD section must appear as Section 2 when showCadDiagram is true");
assert.ok(htmlCadLoan.includes("3. Financial Quote &amp; Scope of Work"), "Financial Quote must be Section 3 when CAD is shown");
assert.ok(htmlCadLoan.includes("4. Bank Partner Loan Proposal"), "Bank Loan Proposal must be Section 4");
assert.ok(htmlCadLoan.includes("5. Terms &amp; Conditions, Warranty and Details"), "Warranty must be Section 5");
assert.ok(htmlCadLoan.includes("6. Solar System Types"), "Solar System Types must be Section 6");
assert.ok(htmlCadLoan.includes("Page 8 of 8"), "Total pages must be 8 with both CAD and Loan enabled");

// Test 10: Single-Customer Sample View honors hidePayback, hideAreaFit, hideCost, solarInstalled, and inverterModel
const htmlHiddenFlags = buildSingleSamplePdfPages(estBifacial, sampleLoanOpt, {
  showCadDiagram: false,
  hidePayback: true,
  hideAreaFit: true,
  hideCost: true,
  solarInstalled: true,
});
assert.ok(!htmlHiddenFlags.includes("Estimated Payback Period:"), "Payback line must be omitted when hidePayback is true");
assert.ok(!htmlHiddenFlags.includes("Fits in Available Area"), "Fits in Available Area row must be omitted when hideAreaFit is true");
assert.ok(!htmlHiddenFlags.includes("Total System Cost (Inc. GST)"), "Cost summary table must be hidden when hideCost is true");
assert.ok(htmlHiddenFlags.includes("Scope of Work (Turnkey EPC Delivery):"), "Scope of Work must remain visible when hideCost is true");
assert.ok(!htmlHiddenFlags.includes("Bank Partner Loan Proposal"), "Loan pages must be hidden when hideCost is true");
assert.ok(htmlHiddenFlags.includes("Installed Solar Capacity"), "Capacity label must switch to Installed Solar Capacity when solarInstalled is true");
assert.ok(htmlHiddenFlags.includes("5kw Single Phase"), "Actual inverter model from tier matrix must appear in single Sample PDF");

// Test 11: Building Master Financial Ledger table width fits comfortably within A4 boundaries
const buildingDoc = new globalThis.window.jspdf.jsPDF();
let buildingAutoTableOpts = null;
buildingDoc.autoTable = (opts) => {
  if (opts.head && opts.head[0] && opts.head[0].some(h => String(h).includes("Post Bill"))) {
    buildingAutoTableOpts = opts;
  }
};
await generateBuildingProposalPDF({
  doc: buildingDoc,
  pageWidth: 210,
  pageHeight: 297,
  margin: 15,
  COLORS: { primary: "#63923E", secondary: "#92B56B", text: "#4C4C4C", textLight: "#777777", black: "#000000", white: "#FFFFFF" },
  estimates: {},
  selectedOption: {},
  hideFlags: {
    isBuildingProposal: true,
    buildingData: {
      buildingName: "Test Heights",
      summary: { totalFlats: 2, totalSanctionedLoad: 10, totalBuildingPanels: 20, totalBuildingCapacityKw: 11, totalBuildingGrossCost: 500000, totalSubsidy: 156000, totalNetCost: 344000, monthlyGenerationTotal: 1500, totalMonthlySavings: 15000, buildingPaybackYears: 2.5 },
      flatLedger: [
        { flatNo: "101", customerName: "Flat 101", sanctionedLoad: 5, monthlyUnits: 400, panels: 10, allocatedKw: 5.5, inverterModel: "5kW Single Phase", grossCost: 250000, subsidy: 78000, netCost: 172000, monthlyGeneration: 750, monthlySavings: 7500, postSolarBill: 100, paybackYears: 2.5, loanMode: false },
        { flatNo: "102", customerName: "Flat 102", sanctionedLoad: 5, monthlyUnits: 400, panels: 10, allocatedKw: 5.5, inverterModel: "5kW Single Phase", grossCost: 250000, subsidy: 78000, netCost: 172000, monthlyGeneration: 750, monthlySavings: 7500, postSolarBill: 100, paybackYears: 2.5, loanMode: true }
      ]
    }
  },
  logoResult: null,
  sysDiffResult: null,
  proposalSerialNo: "TEST-PROP-001",
  proposalDate: "01 Jan 2026",
  customerAddress: "Pune"
});

assert.ok(buildingAutoTableOpts, "Building autoTable options must be captured");
const colStyles = buildingAutoTableOpts.columnStyles;
const totalTableWidth = Object.values(colStyles).reduce((sum, col) => sum + (col.cellWidth || 0), 0);
assert.ok(totalTableWidth <= 180, `Total column widths (${totalTableWidth} mm) must be <= 180 mm to prevent overflow on A4`);
assert.equal(buildingAutoTableOpts.head[0].length, 16, "Building proposal ledger must have 16 columns");
const lastColIndex = buildingAutoTableOpts.head[0].length - 1;
assert.ok(buildingAutoTableOpts.head[0][lastColIndex].includes("Loan"), "Last column must be Loan Opt");
assert.ok(buildingAutoTableOpts.head[0][lastColIndex - 1].includes("Payback"), "Second last column must be Payback");
assert.ok(buildingAutoTableOpts.head[0][lastColIndex - 2].includes("Post Bill"), "Third last column must be Post Bill");

assert.ok(buildingDoc.getNumberOfPages() >= 5, `Building proposal PDF must have at least 5 pages including Warranty and Terms, got ${buildingDoc.getNumberOfPages()}`);
assert.ok(buildingDoc.textCalls.some(t => String(t).includes("Terms & Conditions, Warranty and Details")), "Building proposal PDF must contain 'Terms & Conditions, Warranty and Details'");
assert.ok(buildingDoc.textCalls.some(t => String(t).includes("Terms and Conditions for Warranty")), "Building proposal PDF must contain 'Terms and Conditions for Warranty'");
assert.ok(buildingDoc.textCalls.some(t => String(t).includes("MSEDCL Net Metering")), "Building proposal PDF must contain MSEDCL Net Metering terms");

console.log("All MSEB Proposal Rendering, Panel Selection, and Loan Omission tests passed successfully! 🎉");
