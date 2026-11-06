import { getPanelSpecificationText } from "./config.js";
import { getScopeOfWorkItems } from "./reportGenerator.js";

/**
 * PDF Sample View & Inline Document Text Editor
 * Unlocks manual text editing across all sections, tables, paragraphs, and values with password "editprop".
 */

let currentEstimates = null;
let currentSelectedOption = null;
let currentHideFlags = {};
let isEditingUnlocked = false;

// Format currency
const formatCurrency = (val) =>
  "Rs " + Math.round(Number(val) || 0).toLocaleString("en-IN");

// System type label
const formatSysType = (t) => {
  if (t === "ongrid") return "On-Grid";
  if (t === "ongrid_basic_backup") return "Semi-Hybrid (1100VA)";
  if (t === "ongrid_standard_backup") return "Semi-Hybrid (2100VA)";
  if (t === "offgrid") return "Off-Grid";
  if (t === "hybrid") return "Hybrid";
  return "On-Grid";
};

/**
 * Build Multi-Customer Building Sample PDF Pages
 * Generates interactive HTML pages for sample view and inline editing with password 'editprop'.
 */
export function buildBuildingSamplePdfPages(estimates, selectedOption, hideFlags = {}) {
  const buildingData = hideFlags.buildingData || estimates?.buildingData || {};
  const summary = buildingData.summary || {};
  const flatLedger = buildingData.flatLedger || [];
  const includeIndividualSheets = hideFlags.includeIndividualSheets || false;

  const proposalSerialNo =
    hideFlags.proposalSerialNo ||
    (typeof document !== "undefined" && document.getElementById("proposalSerialNo")?.value) ||
    "DC/2026-27/PROP-1140";

  const bldgName =
    buildingData.buildingName ||
    (typeof document !== "undefined" && document.getElementById("buildingNameInput")?.value) ||
    "Shivaji Heights Co-op Housing Society";

  const bldgAddress =
    buildingData.buildingAddress ||
    (typeof document !== "undefined" && document.getElementById("buildingAddressInput")?.value) ||
    "Baner, Pune, Maharashtra - 411045";

  const proposalDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  let cadCanvasDataUrl = null;
  if (typeof document !== "undefined") {
    try {
      const canvas = document.getElementById("panelDiagramCanvas");
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        cadCanvasDataUrl = canvas.toDataURL("image/png");
      }
    } catch (e) {
      console.warn("Could not capture CAD canvas:", e);
    }
  }

  const formatCurrency = (val) =>
    "Rs " + Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const createPageHeader = (pageTitle = "Building Solar Proposal") => `
    <div class="pdf-page-header">
      <div class="pdf-header-left">
        <div class="pdf-company-title">DATLION CNERGY PRIVATE LIMITED</div>
        <div class="pdf-company-sub">SOLAR EPC & CLEAN ENERGY SOLUTIONS</div>
      </div>
      <div class="pdf-header-right">
        <div class="pdf-doc-title">${pageTitle}</div>
        <div class="pdf-doc-meta"><strong>Ref:</strong> <span class="editable-field">${proposalSerialNo}</span> | <strong>Date:</strong> <span class="editable-field">${proposalDate}</span></div>
      </div>
    </div>
  `;

  const createPageFooter = (pageNum, totalPages) => `
    <div class="pdf-page-footer">
      <div class="pdf-footer-left">www.cnergy.co.in</div>
      <div class="pdf-footer-center">Page ${pageNum} of ${totalPages} &nbsp;|&nbsp; Ref: ${proposalSerialNo}</div>
      <div class="pdf-footer-right">
        <div>DATLION CNERGY PRIVATE LIMITED</div>
        <div style="font-size: 7pt; color: #64748b;">GSTIN: 27AALCD8550A1ZP | Pune, Maharashtra</div>
      </div>
    </div>
  `;

  const pages = [];
  const basePagesCount = 3;
  const totalPagesCount = includeIndividualSheets ? (basePagesCount + flatLedger.length) : basePagesCount;

  // PAGE 1: Building Executive Summary
  const page1 = `
    <div class="pdf-sample-page" data-page-index="1">
      ${createPageHeader("Multi-Customer Building Solar Proposal")}
      <div class="pdf-page-body">
        <div class="pdf-grid-2" style="margin-bottom: 14px;">
          <div class="pdf-card pdf-card-from">
            <div class="pdf-card-badge blue">Issued By (Solar EPC)</div>
            <div class="pdf-card-name">DATLION CNERGY PRIVATE LIMITED</div>
            <p class="pdf-card-address">
              Ground, Shed No. 1, Shashitara Pratishthan BJP Office,<br>
              Late Narayanrao Kondiba Jagtap Path, Hingne Khurd,<br>
              Pune, Maharashtra - 411051
            </p>
            <div class="pdf-card-contact">
              <div><strong>GSTIN:</strong> 27AALCD8550A1ZP</div>
              <div><strong>Email:</strong> datlioncnergy@gmail.com</div>
              <div><strong>Phone:</strong> +91 8956340980 | www.cnergy.co.in</div>
            </div>
          </div>
          <div class="pdf-card pdf-card-to">
            <div class="pdf-card-badge green">Prepared For (Building / Society)</div>
            <div class="pdf-card-name editable-field">${bldgName}</div>
            <p class="pdf-card-address editable-field">${bldgAddress}</p>
            <div class="pdf-card-contact">
              <div><strong>Total Flats / Meters:</strong> <span class="editable-field">${summary.totalFlats || flatLedger.length} Units</span></div>
              <div><strong>Total Sanction Load:</strong> <span class="editable-field">${summary.totalSanctionedLoad || 0} kW</span></div>
              <div><strong>Total Monthly Consumption:</strong> <span class="editable-field">${(summary.totalMonthlyUnits || 0).toLocaleString("en-IN")} units/month</span></div>
            </div>
          </div>
        </div>

        <div class="pdf-section-title">1. Building Executive Summary & Key Indicators</div>
        <div class="pdf-section-desc">Aggregate solar capacity, turnkey project economics, and PM Surya Ghar subsidy benefits for the society.</div>

        <div class="pdf-grid-4" style="margin-bottom: 12px;">
          <div class="pdf-kpi-box">
            <div class="kpi-box-label">Total Solar Capacity</div>
            <div class="kpi-box-val editable-field">${(summary.totalBuildingCapacityKw || 0).toFixed(1)} kWp</div>
            <div class="kpi-box-sub editable-field">${summary.totalBuildingPanels || 0} Solar Modules</div>
          </div>
          <div class="pdf-kpi-box">
            <div class="kpi-box-label">Monthly Generation</div>
            <div class="kpi-box-val editable-field">${(summary.monthlyGenerationTotal || 0).toLocaleString("en-IN")} units</div>
            <div class="kpi-box-sub editable-field">${(summary.annualGenerationTotal || 0).toLocaleString("en-IN")} units / yr</div>
          </div>
          <div class="pdf-kpi-box highlight-green">
            <div class="kpi-box-label">Total PM Surya Ghar Subsidy</div>
            <div class="kpi-box-val editable-field" style="color: #15803d;">${formatCurrency(summary.totalSubsidy)}</div>
            <div class="kpi-box-sub">Fixed Quantum Slabs</div>
          </div>
          <div class="pdf-kpi-box highlight-green">
            <div class="kpi-box-label">Annual Bill Savings</div>
            <div class="kpi-box-val editable-field" style="color: #15803d;">${formatCurrency(summary.totalAnnualSavings)}</div>
            <div class="kpi-box-sub editable-field">${summary.buildingPaybackYears || 0} yrs payback</div>
          </div>
        </div>

        <div class="pdf-card" style="margin-bottom: 12px; background: #f8fafc;">
          <div style="font-size: 8.5pt; font-weight: 700; color: #0f172a; margin-bottom: 6px;">PROJECT INVESTMENT SUMMARY</div>
          <table class="pdf-table" style="font-size: 8pt;">
            <tbody>
              <tr><td>Gross Turnkey Project Cost:</td><td style="text-align: right;"><strong class="editable-field">${formatCurrency(summary.totalBuildingGrossCost)}</strong></td></tr>
              <tr><td>Total PM Surya Ghar Central Subsidies:</td><td style="text-align: right; color: #15803d;"><strong class="editable-field">(-) ${formatCurrency(summary.totalSubsidy)}</strong></td></tr>
              <tr style="background: #f0fdf4;"><td><strong>Net Society & Resident Investment:</strong></td><td style="text-align: right; color: #0284c7;"><strong class="editable-field">${formatCurrency(summary.totalNetCost)}</strong></td></tr>
            </tbody>
          </table>
        </div>

        <div class="pdf-card" style="background: #ffffff; border: 1px solid #e2e8f0;">
          <div style="font-size: 8.5pt; font-weight: 700; color: #63923e; margin-bottom: 6px;">SHARED TECHNICAL ARCHITECTURE</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 7.5pt; color: #334155;">
            <div><strong>Modules:</strong> <span class="editable-field">${buildingData.panelMake || "Tier-1 Mono PERC DCR"} (${buildingData.panelWp || 550} Wp)</span></div>
            <div><strong>Structure:</strong> <span class="editable-field">Hot-dip Galvanized Elevated (25+ yrs life)</span></div>
            <div><strong>Inverters:</strong> <span class="editable-field">Multi-MPPT On-Grid Inverters (IP65)</span></div>
            <div><strong>Safety:</strong> <span class="editable-field">16 mm & 14 mm chemical copper bonded earthing rods</span></div>
            <div style="grid-column: 1 / -1;"><strong>Net Metering:</strong> <span class="editable-field">Group Net Metering / Individual Bi-directional meters compliant with MSEDCL</span></div>
          </div>
        </div>
      </div>
      ${createPageFooter(1, totalPagesCount)}
    </div>
  `;
  pages.push(page1);

  // PAGE 2: Shared Rooftop CAD Layout & Demarcation
  const page2 = `
    <div class="pdf-sample-page" data-page-index="2">
      ${createPageHeader("Rooftop Layout & CAD Blueprint")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">2. Shared Rooftop Layout & Demarcated Flat Panel Allocation</div>
        <div class="pdf-section-desc">Architectural CAD layout displaying physical panel allocations, color boundaries per flat, and maintenance pathways.</div>

        <div style="text-align: center; margin: 10px 0; background: #0f172a; border-radius: 6px; padding: 6px;">
          ${cadCanvasDataUrl ? `<img src="${cadCanvasDataUrl}" alt="Shared Rooftop CAD Blueprint" style="max-width: 100%; max-height: 280px; object-fit: contain; border-radius: 4px;">` : `<div style="color: #94a3b8; padding: 40px; font-size: 10pt;">CAD Aerial Blueprint Diagram</div>`}
        </div>

        <div class="pdf-card" style="margin-bottom: 10px;">
          <div style="font-size: 8.5pt; font-weight: 700; color: #0f172a; margin-bottom: 4px;">ROOFTOP ENGINEERING METRICS</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 7.5pt;">
            <div>Available Roof: <strong class="editable-field">${buildingData.roofAreaSqft || 2000} sq.ft.</strong></div>
            <div>Array Footprint: <strong class="editable-field">${Math.round((summary.totalBuildingPanels || 0) * 27.5)} sq.ft.</strong></div>
            <div>Clear Pathways: <strong class="editable-field">${Math.max(0, (buildingData.roofAreaSqft || 2000) - Math.round((summary.totalBuildingPanels || 0) * 27.5))} sq.ft.</strong></div>
            <div>Allocation: <strong class="editable-field">Proportional to Units</strong></div>
          </div>
        </div>

        <div class="pdf-card" style="background: #ffffff;">
          <div style="font-size: 8.5pt; font-weight: 700; color: #63923e; margin-bottom: 6px;">DEMARCATED RESIDENT PANEL ALLOCATION LEGEND</div>
          <table class="pdf-table" style="font-size: 7pt;">
            <thead>
              <tr style="background: #1e293b; color: white;">
                <th>Flat No</th>
                <th>Resident Name</th>
                <th>Monthly Units</th>
                <th>Panels</th>
                <th>Solar kWp</th>
                <th>Array Share (%)</th>
              </tr>
            </thead>
            <tbody>
              ${flatLedger.map(f => `
                <tr>
                  <td style="text-align: center;"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${f.color || '#2563eb'}; margin-right: 4px;"></span><strong>${f.flatNo}</strong></td>
                  <td>${f.customerName}</td>
                  <td style="text-align: center;">${f.monthlyUnits} kWh</td>
                  <td style="text-align: center;"><strong>${f.panels}</strong></td>
                  <td style="text-align: center;">${(f.allocatedKw || 0).toFixed(2)} kWp</td>
                  <td style="text-align: center;">${Math.round(((f.panels || 0) / (summary.totalBuildingPanels || 1)) * 100)}%</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
      ${createPageFooter(2, totalPagesCount)}
    </div>
  `;
  pages.push(page2);

  // PAGE 3+: Building Master Financial Ledger
  const page3 = `
    <div class="pdf-sample-page" data-page-index="3">
      ${createPageHeader("Building Master Financial Ledger")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">3. Resident-Wise Financial Allocation & Solar Ledger</div>
        <div class="pdf-section-desc">Comprehensive allocation of solar capacity, fixed-quantum subsidy, gross investment share, monthly generation, and net bills.</div>

        <div style="width: 100%; overflow-x: auto; margin-top: 8px;">
          <table class="pdf-table" style="font-size: 6.8pt; line-height: 1.2;">
            <thead>
              <tr style="background: #1e293b; color: white; text-align: center;">
                <th style="padding: 4px 2px;">#</th>
                <th style="padding: 4px 4px;">Flat No</th>
                <th style="padding: 4px 6px; text-align: left;">Resident Name</th>
                <th style="padding: 4px 2px;">Load<br>(kW)</th>
                <th style="padding: 4px 2px;">Units<br>/mo</th>
                <th style="padding: 4px 2px;">Panels</th>
                <th style="padding: 4px 2px;">kWp</th>
                <th style="padding: 4px 4px;">Gross (Rs)</th>
                <th style="padding: 4px 4px; background: #064e3b; color: #a7f3d0;">Subsidy (Rs)</th>
                <th style="padding: 4px 4px; background: #064e3b; color: #a7f3d0;">Net Cost (Rs)</th>
                <th style="padding: 4px 2px;">Gen/mo<br>(kWh)</th>
                <th style="padding: 4px 4px;">Savings<br>/mo</th>
                <th style="padding: 4px 4px;">Post Bill</th>
                <th style="padding: 4px 2px;">Payback</th>
                <th style="padding: 4px 2px;">Loan</th>
              </tr>
            </thead>
            <tbody>
              ${flatLedger.map((f, i) => `
                <tr style="text-align: center;">
                  <td style="padding: 3px 2px;">${i + 1}</td>
                  <td style="padding: 3px 4px;"><strong><span class="editable-field">${f.flatNo}</span></strong></td>
                  <td style="padding: 3px 6px; text-align: left;"><span class="editable-field">${f.customerName}</span></td>
                  <td style="padding: 3px 2px;"><span class="editable-field">${f.sanctionedLoad}</span></td>
                  <td style="padding: 3px 2px;"><span class="editable-field">${f.monthlyUnits}</span></td>
                  <td style="padding: 3px 2px;"><strong><span class="editable-field">${f.panels}</span></strong></td>
                  <td style="padding: 3px 2px;"><span class="editable-field">${(f.allocatedKw || 0).toFixed(2)}</span></td>
                  <td style="padding: 3px 4px; text-align: right;"><span class="editable-field">${Number(f.grossCost || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 3px 4px; text-align: right; background: #f0fdf4; color: #15803d; font-weight: bold;"><span class="editable-field">${Number(f.subsidy || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 3px 4px; text-align: right; background: #f0f9ff; color: #0284c7; font-weight: bold;"><span class="editable-field">${Number(f.netCost || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 3px 2px;"><span class="editable-field">${f.monthlyGeneration}</span></td>
                  <td style="padding: 3px 4px; text-align: right; color: #15803d;"><span class="editable-field">${Number(f.monthlySavings || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 3px 4px; text-align: right;"><span class="editable-field">${Number(f.postSolarBill || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 3px 2px;"><span class="editable-field">${f.paybackYears}</span> yrs</td>
                  <td style="padding: 3px 2px;"><span class="editable-field">${f.loanMode ? "Yes" : "No"}</span></td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9; font-weight: bold; text-align: center;">
                <td colspan="3" style="text-align: left; padding: 4px 6px;">BUILDING TOTALS (${summary.totalFlats || flatLedger.length} FLATS)</td>
                <td>${summary.totalSanctionedLoad || 0}</td>
                <td>${(summary.totalMonthlyUnits || 0).toLocaleString("en-IN")}</td>
                <td>${summary.totalBuildingPanels || 0}</td>
                <td>${(summary.totalBuildingCapacityKw || 0).toFixed(2)}</td>
                <td style="text-align: right;">${Number(summary.totalBuildingGrossCost || 0).toLocaleString("en-IN")}</td>
                <td style="text-align: right; color: #15803d;">${Number(summary.totalSubsidy || 0).toLocaleString("en-IN")}</td>
                <td style="text-align: right; color: #0284c7;">${Number(summary.totalNetCost || 0).toLocaleString("en-IN")}</td>
                <td>${(summary.monthlyGenerationTotal || 0).toLocaleString("en-IN")}</td>
                <td style="text-align: right; color: #15803d;">${Number(summary.totalMonthlySavings || 0).toLocaleString("en-IN")}</td>
                <td>—</td>
                <td>${summary.buildingPaybackYears || 0} yrs</td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      ${createPageFooter(3, totalPagesCount)}
    </div>
  `;
  pages.push(page3);

  // OPTIONAL: Individual Resident Sheets
  if (includeIndividualSheets && flatLedger.length > 0) {
    flatLedger.forEach((flat, idx) => {
      const pageIndex = 4 + idx;
      let subsidyExplanation = "Not eligible for subsidy (< 1 kW or commercial)";
      if (flat.subsidy === 30000) subsidyExplanation = "PM Surya Ghar 1 kW Slab = Rs 30,000 (Fixed Quantum)";
      else if (flat.subsidy === 60000) subsidyExplanation = "PM Surya Ghar 2 kW Slab = Rs 60,000 (Fixed Quantum)";
      else if (flat.subsidy === 78000) subsidyExplanation = "PM Surya Ghar 3 kW+ Slab Cap = Rs 78,000 (Fixed Quantum)";

      const flatPage = `
        <div class="pdf-sample-page" data-page-index="${pageIndex}">
          ${createPageHeader(`Individual Proposal — Flat ${flat.flatNo}`)}
          <div class="pdf-page-body">
            <div class="pdf-section-title">Official Solar Proposal — Flat ${flat.flatNo} (<span class="editable-field">${flat.customerName}</span>)</div>
            <div class="pdf-section-desc">Dedicated turnkey solar PV system share for Flat ${flat.flatNo} at ${bldgName}.</div>

            <div class="pdf-card" style="margin-bottom: 10px;">
              <div style="font-size: 8.5pt; font-weight: 700; color: #0f172a; margin-bottom: 4px;">RESIDENT SITE & ELECTRICAL PARAMETERS</div>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; font-size: 7.5pt;">
                <div>Sanction Load: <strong class="editable-field">${flat.sanctionedLoad} kW</strong></div>
                <div>Phase: <strong class="editable-field">${flat.phase || "1-phase"}</strong></div>
                <div>Monthly Units: <strong class="editable-field">${flat.monthlyUnits} kWh</strong></div>
                <div>Baseline Bill: <strong class="editable-field">${formatCurrency(flat.monthlyBill)}</strong></div>
                <div>Allocated Solar: <strong class="editable-field" style="color: #0284c7;">${(flat.allocatedKw || 0).toFixed(2)} kWp (${flat.panels} Modules)</strong></div>
                <div>Monthly Gen: <strong class="editable-field">${flat.monthlyGeneration} kWh</strong></div>
                <div>PM Surya Subsidy: <strong class="editable-field" style="color: #15803d;">${formatCurrency(flat.subsidy)}</strong></div>
                <div>Net Investment: <strong class="editable-field" style="color: #0284c7;">${formatCurrency(flat.netCost)}</strong></div>
              </div>
            </div>

            <div class="pdf-card" style="margin-bottom: 10px;">
              <div style="font-size: 8.5pt; font-weight: 700; color: #63923e; margin-bottom: 4px;">ELECTRICITY BILL COMPARISON: BEFORE VS AFTER SOLAR</div>
              <table class="pdf-table" style="font-size: 7.5pt;">
                <thead>
                  <tr style="background: #1e293b; color: white;">
                    <th>Bill Parameter</th>
                    <th>Without Solar (Baseline)</th>
                    <th>With Rooftop Solar</th>
                    <th>Monthly Benefit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Units Billed</td>
                    <td><span class="editable-field">${flat.monthlyUnits}</span> units</td>
                    <td><span class="editable-field">${Math.max(0, flat.monthlyUnits - flat.monthlyGeneration)}</span> units</td>
                    <td style="color: #15803d; font-weight: bold;">Offset <span class="editable-field">${Math.min(flat.monthlyUnits, flat.monthlyGeneration)}</span> units</td>
                  </tr>
                  <tr>
                    <td>Fixed Charges</td>
                    <td>Rs 130</td>
                    <td>Rs 130</td>
                    <td>Rs 0 (Mandatory MSEDCL Grid Charge)</td>
                  </tr>
                  <tr>
                    <td>Energy Charges</td>
                    <td><span class="editable-field">${formatCurrency(flat.energyCharge || (flat.monthlyBill - 130 - 300))}</span></td>
                    <td><span class="editable-field">${formatCurrency(Math.max(0, flat.monthlyBill - flat.monthlySavings - 130))}</span></td>
                    <td style="color: #15803d; font-weight: bold;"><span class="editable-field">${formatCurrency(flat.monthlySavings)}</span></td>
                  </tr>
                  <tr style="background: #f0fdf4;">
                    <td><strong>Net Monthly Payable</strong></td>
                    <td><strong class="editable-field">${formatCurrency(flat.monthlyBill)}</strong></td>
                    <td><strong class="editable-field">${formatCurrency(flat.postSolarBill)}</strong></td>
                    <td style="color: #15803d; font-weight: bold;"><strong class="editable-field">${formatCurrency(flat.monthlySavings)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="pdf-card" style="margin-bottom: 10px;">
              <div style="font-size: 8.5pt; font-weight: 700; color: #63923e; margin-bottom: 4px;">INVESTMENT & FIXED-QUANTUM SUBSIDY BREAKDOWN</div>
              <div style="font-size: 7.5pt; line-height: 1.6; color: #334155;">
                <div>Gross Turnkey Cost Share: <strong class="editable-field">${formatCurrency(flat.grossCost)}</strong></div>
                <div style="color: #15803d;">PM Surya Ghar Subsidy: <strong class="editable-field">${formatCurrency(flat.subsidy)}</strong> (${subsidyExplanation})</div>
                <div style="color: #0284c7;">Net Payable by Resident: <strong class="editable-field">${formatCurrency(flat.netCost)}</strong></div>
                <div>Estimated Payback: <strong class="editable-field">${flat.paybackYears} Years</strong></div>
              </div>
            </div>

            ${flat.loanMode && flat.financing ? `
              <div class="pdf-card" style="margin-bottom: 10px; background: #f0f9ff; border-color: #bae6fd;">
                <div style="font-size: 8.5pt; font-weight: 700; color: #0284c7; margin-bottom: 4px;">SOLAR BANK LOAN FINANCING DETAILS</div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; font-size: 7.5pt;">
                  <div>Down Payment (10%): <strong class="editable-field">${formatCurrency(flat.financing.downPayment || flat.netCost * 0.1)}</strong></div>
                  <div>Loan Principal (90%): <strong class="editable-field">${formatCurrency(flat.financing.principal || flat.netCost * 0.9)}</strong></div>
                  <div>Interest Rate: <strong class="editable-field">${flat.financing.interestRatePct || 7.0}% p.a.</strong></div>
                  <div>Tenure: <strong class="editable-field">5 Years (60 Mos)</strong></div>
                  <div>Monthly EMI: <strong class="editable-field" style="color: #0284c7;">${formatCurrency(flat.financing.monthlyEmi || Math.round(flat.monthlySavings * 0.85))}</strong></div>
                  <div>Net Cashflow Gain: <strong class="editable-field" style="color: #15803d;">+${formatCurrency(Math.max(0, flat.monthlySavings - (flat.financing.monthlyEmi || 0)))} / mo</strong></div>
                </div>
              </div>
            ` : ""}

            <div class="pdf-card" style="background: #ffffff; border: 1px solid #e2e8f0;">
              <div style="font-size: 8pt; font-weight: 700; color: #0f172a; margin-bottom: 4px;">WARRANTIES & TURNKEY SCOPE OF DELIVERY</div>
              <div style="font-size: 7.2pt; color: #475569; line-height: 1.4;">
                <div>✓ <strong>Solar Modules:</strong> 25-Year Linear Performance Warranty (Tier-1 DCR Mono PERC/TOPCon).</div>
                <div>✓ <strong>Grid-Tied Inverter:</strong> 8-Year Comprehensive Manufacturer Replacement Warranty.</div>
                <div>✓ <strong>Mounting Structure:</strong> 25-Year Hot-dip Galvanization Warranty.</div>
                <div>✓ <strong>Earthing & Electrical Safety:</strong> Dedicated 16 mm and 14 mm copper bonded earthing electrode rods.</div>
                <div>✓ <strong>Scope of Work:</strong> Turnkey Supply, Fabrication, Wiring, MSEDCL Net Metering statutory liaising & Commissioning.</div>
              </div>
            </div>
          </div>
          ${createPageFooter(pageIndex, totalPagesCount)}
        </div>
      `;
      pages.push(flatPage);
    });
  }

  return pages.join("\n");
}

/**
 * Generate high-fidelity HTML pages representing the PDF document.
 */
export function buildSamplePdfPages(estimates, selectedOption, hideFlags = {}) {
  // If Multi-Customer Building Proposal, use dedicated building generator
  const isBuilding = hideFlags.isBuildingProposal || 
                     estimates?.isBuildingProposal || 
                     (typeof window !== "undefined" && window.appState?.proposalMode === "multi_building");

  if (isBuilding) {
    if (!hideFlags.buildingData && typeof window !== "undefined" && window.appState?.buildingData) {
      hideFlags.buildingData = window.appState.buildingData;
    }
    if (hideFlags.includeIndividualSheets === undefined && typeof document !== "undefined") {
      hideFlags.includeIndividualSheets = document.getElementById("includeIndividualSheets")?.checked || false;
    }
    return buildBuildingSamplePdfPages(estimates, selectedOption, hideFlags);
  }

  const { input = {}, sanctionedStatus = {} } = estimates || {};
  const option = selectedOption || estimates?.recommended || {};
  const isLoan = option.financing && option.financing.paymentMode === "loan";

  const proposalSerialNo =
    hideFlags.proposalSerialNo ||
    option.proposalSerialNo ||
    (typeof document !== "undefined" && document.getElementById("proposalSerialNo")?.value) ||
    "DC/2026-27/PROP-1140";

  const customerName =
    input.customerName ||
    (typeof document !== "undefined" && document.getElementById("customerName")?.value) ||
    "Valued Customer";

  const customerAddress =
    input.customerAddress ||
    (typeof document !== "undefined" && document.getElementById("proposalToCustomerAddress")?.textContent) ||
    "Pune, Maharashtra";

  const customerPhone =
    input.customerPhone ||
    (typeof document !== "undefined" && document.getElementById("proposalToCustomerPhone")?.textContent) ||
    "+91 98XXXXXXXX";

  const proposalDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // CAD Blueprint canvas snapshot
  let cadCanvasDataUrl = null;
  if (typeof document !== "undefined") {
    try {
      const canvas = document.getElementById("panelDiagramCanvas");
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        cadCanvasDataUrl = canvas.toDataURL("image/png");
      }
    } catch (e) {
      console.warn("Could not capture CAD canvas:", e);
    }
  }

  // Active panel specification text
  const panelSpecText =
    getPanelSpecificationText(
      input.panelType || option.panelType || "dcr",
      input.panelWattPeak || 550
    ) || "Tier-1 Mono PERC / TOPCon (550 Wp)";

  // Sizing and layout
  const panelLayout = estimates?.panelLayout || {};
  const numPanels = panelLayout.numPanels || Math.round(((option.dcCapacityKw || 4.4) * 1000) / (input.panelWattPeak || 550));
  const panelAreaSqft = panelLayout.panelOnlyAreaSqft || Math.round(numPanels * 27.5);
  const totalAreaSqft = panelLayout.totalAreaSqft || Math.round(panelAreaSqft * 1.5);
  const roofArea = input.roofArea || 650;
  const grossArea = typeof document !== "undefined" && document.getElementById("cadGrossArea")?.textContent || roofArea;
  const cutoutArea = typeof document !== "undefined" && document.getElementById("cadCutoutArea")?.textContent || "0";
  const netUsableArea = typeof document !== "undefined" && document.getElementById("cadNetArea")?.textContent || roofArea;

  // Bill comparison figures
  const curBill = option.currentBillBreakdown || {};
  const postBill = option.postSolarBillBreakdown || {};

  const curFixed = curBill.fixedCharge ?? 130;
  const curEnergy = curBill.energyCharge ?? 4738;
  const curWheeling = curBill.wheelingCharge ?? 0;
  const curDuty = curBill.duty ?? 332;
  const curTotal = curBill.total ?? input.monthlyBill ?? 5200;

  const postSolarGen = postBill.solarGeneration ?? Math.round(option.monthlyGeneration ?? 465);
  const postBanked = postBill.bankedUnits ?? 15;
  const postFixed = postBill.fixedCharge ?? curFixed;
  const postEnergy = postBill.energyCharge ?? 0;
  const postNetPayable = postBill.netPayable ?? postFixed;
  const postMonthlySavings = postBill.monthlySavings ?? option.monthlySavings ?? 5070;
  const postAnnualSavings = postBill.annualSavings ?? option.annualSavings ?? (postMonthlySavings * 12);

  // Cost breakup figures
  const cost = option.costBreakup || {};
  const baseCost = cost.baseCostInclGst || cost.totalPreSubsidy || option.totalPreSubsidy || 273326;
  const subsidyAmount = option.subsidy ?? 78000;
  const netCustomerCost = option.netCost ?? (baseCost - subsidyAmount);

  // Financing
  const fin = option.financing || {};
  const downPayment = fin.downPayment ?? Math.round(netCustomerCost * 0.1);
  const loanPrincipal = fin.principal ?? (netCustomerCost - downPayment);
  const loanRate = fin.interestRatePct ?? 7.0;
  const loanEmi = fin.monthlyEmi ?? curTotal;
  const loanTenure = fin.tenureFormatted || `${fin.tenureMonths || 43} mos`;
  const totalInterest = fin.totalInterest ?? 28274;
  const totalRepayment = fin.totalRepayment ?? (loanPrincipal + totalInterest);
  const freeYears = fin.freeElectricityYears ?? 21.4;
  const lifetimeGainWithLoan = fin.lifetimeNetGainWithLoan ?? (option.lifetimeSavings ? option.lifetimeSavings - totalRepayment : 1850526);

  // Determine pages array
  const pages = [];

  // Common Header HTML generator
  const createPageHeader = (pageTitle = "Solar PV Installation Proposal") => `
    <div class="pdf-page-header">
      <div class="pdf-header-left">
        <div class="pdf-company-title">DATLION CNERGY PRIVATE LIMITED</div>
        <div class="pdf-company-sub">SOLAR EPC & CLEAN ENERGY SOLUTIONS</div>
      </div>
      <div class="pdf-header-right">
        <div class="pdf-doc-title">${pageTitle}</div>
        <div class="pdf-doc-meta"><strong>Ref:</strong> <span class="editable-field">${proposalSerialNo}</span> | <strong>Date:</strong> <span class="editable-field">${proposalDate}</span></div>
      </div>
    </div>
  `;

  // Common Footer HTML generator
  const createPageFooter = (pageNum, totalPages) => `
    <div class="pdf-page-footer">
      <div class="pdf-footer-left">www.cnergy.co.in</div>
      <div class="pdf-footer-center">Page ${pageNum} of ${totalPages} &nbsp;|&nbsp; Ref: ${proposalSerialNo}</div>
      <div class="pdf-footer-right">
        <div>DATLION CNERGY PRIVATE LIMITED</div>
        <div style="font-size: 7pt; color: #64748b;">GSTIN: 27AALCD8550A1ZP | Pune, Maharashtra</div>
      </div>
    </div>
  `;

  // ==========================================
  // PAGE 1: EXECUTIVE SUMMARY & SYSTEM DESIGN
  // ==========================================
  const page1Content = `
    <div class="pdf-sample-page" data-page-index="1">
      ${createPageHeader("Turnkey Solar PV Installation Proposal")}
      
      <div class="pdf-page-body">
        <!-- From & To Corporate Header Cards -->
        <div class="pdf-grid-2" style="margin-bottom: 14px;">
          <!-- From Card -->
          <div class="pdf-card pdf-card-from">
            <div class="pdf-card-badge blue">Issued By (Solar EPC)</div>
            <div class="pdf-card-name">DATLION CNERGY PRIVATE LIMITED</div>
            <p class="pdf-card-address">
              Ground, Shed No. 1, Shashitara Pratishthan BJP Office,<br>
              Late Narayanrao Kondiba Jagtap Path, Hingne Khurd,<br>
              Pune, Maharashtra - 411051
            </p>
            <div class="pdf-card-contact">
              <div><strong>GSTIN:</strong> 27AALCD8550A1ZP</div>
              <div><strong>Email:</strong> datlioncnergy@gmail.com</div>
              <div><strong>Phone:</strong> +91 8956340980 | www.cnergy.co.in</div>
            </div>
          </div>

          <!-- To Card -->
          <div class="pdf-card pdf-card-to">
            <div class="pdf-card-badge green">Prepared For (Valued Client)</div>
            <div class="pdf-card-name">${customerName}</div>
            <p class="pdf-card-address">${customerAddress}</p>
            <div class="pdf-card-contact">
              <div><strong>Contact:</strong> ${customerPhone}</div>
              <div><strong>Sanctioned Load:</strong> ${input.sanctionedLoad || 5} kW (${input.phase || "Single Phase"}) | <strong>Category:</strong> ${input.consumerCategory || "LT-I Residential"}</div>
              <div><strong>Monthly Usage:</strong> ${input.monthlyUnits || 450} units | <strong>Current Bill:</strong> ${formatCurrency(curTotal)}</div>
              <div><strong>Usable Roof Area:</strong> ${roofArea} sq ft</div>
            </div>
          </div>
        </div>

        <!-- Section 1: System Sizing & Engineering Design -->
        <div class="pdf-section-title">1. System Design Considerations & Capacity Summary</div>
        <p class="pdf-paragraph">
          Based on Pune's local solar insolation index (5.2 peak sun hours/day), your sanctioned connected load of ${input.sanctionedLoad || 5} kW, and an average monthly electricity consumption of ${input.monthlyUnits || 450} kWh, Datlion Cnergy proposes the following turnkey photovoltaic system design:
        </p>

        <!-- Selected System Highlight Pill -->
        <div class="pdf-highlight-box green" style="margin-bottom: 10px;">
          <div><strong>Selected Technology:</strong> ${formatSysType(option.systemType)} Solar PV</div>
          <div><strong>DC System Capacity:</strong> ${option.dcCapacityKw || 4.4} kWp &nbsp;|&nbsp; <strong>AC Inverter:</strong> ${option.inverterCapacityKw || 4.4} kW</div>
          <div><strong>Estimated Monthly Generation:</strong> ${postSolarGen} units (${Math.round((option.dailyGeneration || 15.5) * 10) / 10} units/day)</div>
        </div>

        <!-- Sizing & Spec Tables -->
        <div class="pdf-grid-2" style="margin-bottom: 10px;">
          <div>
            <div class="pdf-subheading">Capacity Sizing Metrics</div>
            <table class="pdf-table">
              <tr><td>Target Monthly Generation</td><td><strong>${postSolarGen} units</strong></td></tr>
              <tr><td>Baseline Monthly Usage</td><td><strong>${input.monthlyUnits || 450} units</strong></td></tr>
              <tr><td>Net Solar Offset Ratio</td><td><strong>${Math.min(100, Math.round((postSolarGen / (input.monthlyUnits || 450)) * 100))}%</strong></td></tr>
              <tr><td>Sanctioned Load Limit</td><td><strong>${input.sanctionedLoad || 5} kW (${sanctionedStatus.label || "Within Load"})</strong></td></tr>
              <tr><td>Performance Ratio (PR)</td><td><strong>${Math.round((option.sizing?.performanceFactor || 0.839) * 100)}% (MNRE Standard)</strong></td></tr>
            </table>
          </div>
          <div>
            <div class="pdf-subheading">Solar PV Module Specification</div>
            <table class="pdf-table">
              <tr><td>Module Make & Tech</td><td><strong>${panelSpecText}</strong></td></tr>
              <tr><td>Rated Watt Peak</td><td><strong>${input.panelWattPeak || 550} Wp Tier-1 ALMM</strong></td></tr>
              <tr><td>Module Count</td><td><strong>${numPanels} Modules</strong></td></tr>
              <tr><td>Module Footprint Area</td><td><strong>${panelAreaSqft} sq ft (${Math.round(panelAreaSqft * 0.0929)} m²)</strong></td></tr>
              <tr><td>Total Required Area</td><td><strong>${totalAreaSqft} sq ft (${Math.round(totalAreaSqft * 0.0929)} m²)</strong></td></tr>
            </table>
          </div>
        </div>

        <!-- Inverter Specifications Table -->
        <div class="pdf-subheading">Grid-Tied Inverter & Power Conditioning</div>
        <table class="pdf-table" style="margin-bottom: 8px;">
          <thead>
            <tr>
              <th>Equipment</th>
              <th>Make & Model</th>
              <th>Rated Capacity</th>
              <th>MPPT Trackers</th>
              <th>Enclosure Rating</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Solar PV Inverter</td>
              <td>Tier-1 MNRE Approved Grid-Tied Inverter</td>
              <td>${option.inverterCapacityKw || 4.4} kW</td>
              <td>Dual MPPT (98.6% Max Efficiency)</td>
              <td>IP65 Weatherproof (Outdoor rated)</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${createPageFooter(1, isLoan ? 7 : 6)}
    </div>
  `;
  pages.push(page1Content);

  // ==========================================
  // PAGE 2: ROOFTOP CAD BLUEPRINT & AREA FIT
  // ==========================================
  if (!hideFlags.hideCad) {
    const page2Content = `
      <div class="pdf-sample-page" data-page-index="2">
        ${createPageHeader("Rooftop Layout & CAD Architectural Plan")}
        
        <div class="pdf-page-body">
          <div class="pdf-section-title">2. Rooftop Layout & Solar Array CAD Plan</div>
          <p class="pdf-paragraph">
            Dimensioned rooftop layout plan illustrating solar array placement, shadow-free positioning, perimeter safety offsets, and central maintenance access corridors:
          </p>

          <!-- CAD Diagram Canvas Container -->
          <div class="pdf-cad-preview-box">
            ${
              cadCanvasDataUrl
                ? `<img src="${cadCanvasDataUrl}" alt="CAD Rooftop Solar Array Layout" class="pdf-cad-image">`
                : `<div class="pdf-cad-placeholder">📐 Rooftop CAD Diagram Blueprint (Active in Canvas)</div>`
            }
          </div>

          <!-- Area Fit & Array Metrics Table -->
          <div class="pdf-subheading" style="margin-top: 12px;">Rooftop Space Allocation & Obstacle Analysis</div>
          <table class="pdf-table" style="margin-bottom: 12px;">
            <thead>
              <tr>
                <th>Total Measured Roof</th>
                <th>Cutout / Obstacle Zones</th>
                <th>Net Usable Solar Area</th>
                <th>Array Footprint</th>
                <th>Roof Utilization</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${grossArea} sq ft</strong></td>
                <td><strong style="color: #ef4444;">${cutoutArea} sq ft</strong></td>
                <td><strong style="color: #16a34a;">${netUsableArea} sq ft</strong></td>
                <td><strong>${panelAreaSqft} sq ft (${numPanels} Panels)</strong></td>
                <td><strong>${Math.round((panelAreaSqft / Math.max(1, Number(netUsableArea) || roofArea)) * 100)}% Usable</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="pdf-highlight-box yellow">
            <strong>Structural & Ballast Engineering Note:</strong> Mounting structure is engineered with Hot-Dip Galvanized / GI sections rated to withstand wind velocities up to 150 km/h in accordance with IS 875 (Part 3). Non-penetrating chemical anchoring or concrete ballast blocks ensure 100% roof waterproofing integrity.
          </div>
        </div>

        ${createPageFooter(2, isLoan ? 7 : 6)}
      </div>
    `;
    pages.push(page2Content);
  }

  // ==========================================
  // PAGE 3: SCOPE OF WORK & FINANCIAL QUOTE
  // ==========================================
  const page3Content = `
    <div class="pdf-sample-page" data-page-index="3">
      ${createPageHeader("Scope of Work & Turnkey EPC Cost Quote")}
      
      <div class="pdf-page-body">
        <div class="pdf-section-title">3. Financial Quote & Turnkey Scope of Work</div>
        <p class="pdf-paragraph">
          Comprehensive turnkey delivery covering design, engineering, procurement, mechanical installation, electrical safety, liaisoning, and commissioning:
        </p>

        <!-- Canonical 8 Line Items Included in System -->
        <div class="pdf-subheading">Included Bill of Materials & Works</div>
        <div class="pdf-pill-container" style="margin-bottom: 12px;">
          <span class="pdf-pill">✓ Solar Panels</span>
          <span class="pdf-pill">✓ Mounting Structure (Hot-dip galvanized)</span>
          <span class="pdf-pill">✓ On-grid Inverter</span>
          <span class="pdf-pill">✓ Safety and earthing</span>
          <span class="pdf-pill">✓ Wiring excluding cable cost</span>
          <span class="pdf-pill">✓ Installation & Commissioning</span>
          <span class="pdf-pill">✓ Consultancy</span>
          <span class="pdf-pill green">✓ GST (Goods & Services Tax)</span>
        </div>

        <!-- 7 Execution Phases -->
        <div class="pdf-subheading">Turnkey EPC Execution Phases</div>
        <div class="pdf-phases-grid" style="margin-bottom: 12px;">
          <div class="pdf-phase-box"><strong>1. Design & Engineering:</strong> Complete 3D shadow analysis, array layout engineering, wind-load verification, and SLD.</div>
          <div class="pdf-phase-box"><strong>2. Supply & Procurement:</strong> MNRE/ALMM approved Tier-1 Solar PV modules, high-efficiency grid inverter, and certified BOS.</div>
          <div class="pdf-phase-box"><strong>3. Mounting & Civil Works:</strong> Structure installation, module clamping, anchoring civil works, and chambers for earth pits.</div>
          <div class="pdf-phase-box"><strong>4. Electrical Safety & Protection:</strong> ACDB & DCDB switchgear with Class-II SPDs & MCBs, chemical earthing, and lightning arrestor.</div>
          <div class="pdf-phase-box"><strong>5. Testing & Commissioning:</strong> Array insulation testing, earth resistance verification, inverter sync, and safety audits.</div>
          <div class="pdf-phase-box"><strong>6. Net Metering Liaisoning:</strong> End-to-end MSEDCL documentation, sanction approval, net meter install, and subsidy processing.</div>
          <div class="pdf-phase-box"><strong>7. Handover & User Training:</strong> As-built drawings, plant manual, safety guidelines, and cloud monitoring app configuration.</div>
        </div>

        <!-- 3 Highlighted Notes -->
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          <div class="pdf-highlight-box green" style="padding: 5px 10px; font-size: 8.5pt;">• Note: All of the above are in line with MNRE guidelines.</div>
          <div class="pdf-highlight-box yellow" style="padding: 5px 10px; font-size: 8.5pt;">• Note: Cabling/wiring charges will be at actual length of DC and AC cabling required.</div>
          <div class="pdf-highlight-box blue" style="padding: 5px 10px; font-size: 8.5pt;">• Note: MSEDCL Net Metering Liaisoning & Discom Documentation Support charges at actuals.</div>
        </div>

        <!-- Cost Breakup Table -->
        <div class="pdf-subheading">Commercial Project Investment Breakup</div>
        <table class="pdf-table">
          <thead>
            <tr>
              <th>Scope Item Description</th>
              <th style="text-align: right; width: 140px;">Amount (Rs)</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Solar PV Modules & Inverter Package (${option.dcCapacityKw || 4.4} kWp)</td><td style="text-align: right;">${formatCurrency((cost.panels || 110000) + (cost.inverter || 26268))}</td></tr>
            <tr><td>Hot-Dip Galvanized Mounting Structure & Hardware</td><td style="text-align: right;">${formatCurrency(cost.structure || 26400)}</td></tr>
            <tr><td>Electrical Safety, Chemical Earthing, DCDB/ACDB & BOS</td><td style="text-align: right;">${formatCurrency(cost.safetyAndEarthing || 15000)}</td></tr>
            <tr><td>Civil Work, Installation, Testing & Engineering Consultancy</td><td style="text-align: right;">${formatCurrency((cost.installation || 11000) + (cost.consultancy || 4400))}</td></tr>
            <tr><td>Contractor EPC Margin & Overheads</td><td style="text-align: right;">${formatCurrency(cost.margin || 63075)}</td></tr>
            <tr style="background: #f8fafc; font-weight: 700;"><td>Subtotal (Base Project Cost)</td><td style="text-align: right;">${formatCurrency(baseCost - (cost.gst || 17183))}</td></tr>
            <tr><td>GST (Goods & Services Tax @ 8.9% composite rate)</td><td style="text-align: right;">${formatCurrency(cost.gst || 17183)}</td></tr>
            <tr style="background: #f1f5f9; font-weight: 700; font-size: 10pt;"><td>Total Turnkey Cost (Pre-Subsidy)</td><td style="text-align: right; color: #0284c7;">${formatCurrency(baseCost)}</td></tr>
            <tr style="background: #f0fdf4; font-weight: 700; color: #166534;"><td>Less: Central PM Surya Ghar Subsidy (Direct to Customer)</td><td style="text-align: right;">- ${formatCurrency(subsidyAmount)}</td></tr>
            <tr style="background: #eef3ec; font-weight: 800; font-size: 11pt; border-top: 2px solid #16a34a;"><td>Net Customer Investment (Post-Subsidy)</td><td style="text-align: right; color: #15803d;">${formatCurrency(netCustomerCost)}</td></tr>
          </tbody>
        </table>
      </div>

      ${createPageFooter(3, isLoan ? 7 : 6)}
    </div>
  `;
  pages.push(page3Content);

  // ==========================================
  // PAGE 4: ENERGY GENERATION & MSEB BILL COMPARISON
  // ==========================================
  const page4Content = `
    <div class="pdf-sample-page" data-page-index="4">
      ${createPageHeader("Electricity Bill Analysis & Lifetime Savings")}
      
      <div class="pdf-page-body">
        <div class="pdf-section-title">4. Energy Generation & MSEB Bill Comparison</div>
        <p class="pdf-paragraph">
          Side-by-side comparative financial model contrasting your current MSEDCL utility outflow with the projected post-solar net-metered electricity bill:
        </p>

        <!-- Side-by-Side Bill Comparison Tables -->
        <div class="pdf-grid-2" style="margin-bottom: 14px;">
          <!-- Left Table: Before Solar -->
          <div>
            <div class="pdf-subheading" style="color: #ef4444;">Current MSEDCL Bill (Before Solar)</div>
            <table class="pdf-table">
              <tr><td>Units Consumed / Month</td><td style="text-align: right;"><strong>${input.monthlyUnits || 450} units</strong></td></tr>
              <tr><td>Fixed Charges</td><td style="text-align: right;">${formatCurrency(curFixed)}</td></tr>
              <tr><td>Energy Charges</td><td style="text-align: right;">${formatCurrency(curEnergy)}</td></tr>
              <tr><td>Wheeling Charges</td><td style="text-align: right;">${formatCurrency(curWheeling)}</td></tr>
              <tr><td>Electricity Duty</td><td style="text-align: right;">${formatCurrency(curDuty)}</td></tr>
              <tr style="background: #fef2f2; font-weight: 700;"><td>Total Current Bill</td><td style="text-align: right;">${formatCurrency(curTotal)}</td></tr>
              <tr style="background: #fee2e2; font-weight: 800; color: #b91c1c;"><td>Net Bill Payable</td><td style="text-align: right;">${formatCurrency(curTotal)}</td></tr>
            </table>
          </div>

          <!-- Right Table: After Solar -->
          <div>
            <div class="pdf-subheading" style="color: #16a34a;">With Rooftop Solar (After Solar)</div>
            <table class="pdf-table">
              <tr><td>Solar Generation / Month</td><td style="text-align: right;"><strong>${postSolarGen} units</strong></td></tr>
              <tr><td>Banked Solar Units</td><td style="text-align: right;"><strong>${postBanked} units</strong></td></tr>
              <tr><td>Fixed Charges</td><td style="text-align: right;">${formatCurrency(postFixed)}</td></tr>
              <tr><td>Energy Charges</td><td style="text-align: right;">${formatCurrency(postEnergy)}</td></tr>
              <tr style="background: #f0fdf4; font-weight: 700;"><td>Net Bill Payable</td><td style="text-align: right; color: #166534;">${formatCurrency(postNetPayable)}</td></tr>
              <tr style="background: #dcfce7; font-weight: 800; color: #15803d;"><td>Net Monthly Savings</td><td style="text-align: right;">${formatCurrency(postMonthlySavings)}</td></tr>
              <tr style="background: #bbf7d0; font-weight: 800; color: #14532d;"><td>Projected Annual Savings</td><td style="text-align: right;">${formatCurrency(postAnnualSavings)}</td></tr>
            </table>
          </div>
        </div>

        <!-- 25-Year Lifetime Returns Summary -->
        <div class="pdf-subheading">25-Year Long-Term Financial Return Summary</div>
        <table class="pdf-table" style="margin-bottom: 12px;">
          <thead>
            <tr>
              <th>Net Investment</th>
              <th>Annual Savings</th>
              <th>Simple Payback</th>
              <th>25-Year Cumulative Savings</th>
              <th>Lifetime ROI (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="font-size: 10.5pt; font-weight: 700; text-align: center;">
              <td>${formatCurrency(netCustomerCost)}</td>
              <td style="color: #16a34a;">${formatCurrency(postAnnualSavings)} / yr</td>
              <td style="color: #0284c7;">${option.paybackYears || 3.2} Years</td>
              <td style="color: #15803d;">${formatCurrency(option.lifetimeSavings || 2074126)}</td>
              <td style="color: #0284c7;">${option.roiPercent || 31.1}%</td>
            </tr>
          </tbody>
        </table>

        <div class="pdf-highlight-box blue">
          <strong>Solar ROI Highlights:</strong> Solar panels generate clean electricity with minimal degradation (< 0.55%/year) over their 30-year performance life. After achieving capital payback in approximately ${option.paybackYears || 3.2} years, you will enjoy over 21 years of virtually free green electricity.
        </div>
      </div>

      ${createPageFooter(4, isLoan ? 7 : 6)}
    </div>
  `;
  pages.push(page4Content);

  // ==========================================
  // PAGE 5: FINANCING & LOAN (IF LOAN ACTIVE)
  // ==========================================
  if (isLoan) {
    const page5Content = `
      <div class="pdf-sample-page" data-page-index="5">
        ${createPageHeader("Zero Out-of-Pocket Solar Loan Structure")}
        
        <div class="pdf-page-body">
          <div class="pdf-section-title">5. Zero Out-of-Pocket Financing & Loan Details</div>
          <p class="pdf-paragraph">
            Structured solar loan allowing you to swap your monthly electricity utility bill with an equivalent bank loan EMI, requiring virtually zero out-of-pocket outflow:
          </p>

          <table class="pdf-table" style="margin-bottom: 14px;">
            <thead>
              <tr>
                <th>Financing Parameter</th>
                <th style="text-align: right;">Terms & Value</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Total Net Project Investment (Post-Subsidy)</td><td style="text-align: right;"><strong>${formatCurrency(netCustomerCost)}</strong></td></tr>
              <tr><td>Customer Upfront Down Payment (${Math.round((downPayment / netCustomerCost) * 100)}%)</td><td style="text-align: right;">${formatCurrency(downPayment)}</td></tr>
              <tr><td>Financed Loan Principal Amount</td><td style="text-align: right;"><strong>${formatCurrency(loanPrincipal)}</strong></td></tr>
              <tr><td>Annual Bank Interest Rate</td><td style="text-align: right;">${loanRate}% p.a. (Nationalized Bank Green Loan)</td></tr>
              <tr style="background: #f0fdf4; font-weight: 700; font-size: 10.5pt; color: #166534;">
                <td>Monthly Loan EMI</td>
                <td style="text-align: right;">${formatCurrency(loanEmi)} / month</td>
              </tr>
              <tr><td>Repayment Tenure</td><td style="text-align: right;">${loanTenure}</td></tr>
              <tr><td>Total Repayment Amount (Principal + Interest)</td><td style="text-align: right;">${formatCurrency(totalRepayment)}</td></tr>
              <tr><td>Free Electricity Duration After Loan Payoff</td><td style="text-align: right;"><strong>${freeYears} Years</strong></td></tr>
              <tr style="background: #eef3ec; font-weight: 800; font-size: 11pt; color: #15803d;">
                <td>25-Year Lifetime Net Gain (After Full Loan Repayment)</td>
                <td style="text-align: right;">${formatCurrency(lifetimeGainWithLoan)}</td>
              </tr>
            </tbody>
          </table>

          <div class="pdf-highlight-box green">
            <strong>Zero Out-of-Pocket Mechanism:</strong> Your current monthly electricity bill is ${formatCurrency(curTotal)}. With our zero out-of-pocket financing, your new total monthly outflow (EMI of ${formatCurrency(loanEmi)} + remaining utility bill of ${formatCurrency(postNetPayable)}) closely matches what you already pay today. Once the loan is paid off in ${loanTenure}, your electricity is free for the remaining 21+ years!
          </div>
        </div>

        ${createPageFooter(5, 7)}
      </div>
    `;
    pages.push(page5Content);
  }

  // ==========================================
  // PAGE 6: PRODUCT WARRANTY & TERMS AND CONDITIONS
  // ==========================================
  const warrantyPageNum = isLoan ? 6 : 5;
  const totalPages = isLoan ? 7 : 6;

  const page6Content = `
    <div class="pdf-sample-page" data-page-index="${warrantyPageNum}">
      ${createPageHeader("Equipment Warranty & Terms and Conditions")}
      
      <div class="pdf-page-body">
        <div class="pdf-section-title">${warrantyPageNum}. Equipment Specifications & Product Warranty</div>
        <p class="pdf-paragraph">
          Comprehensive manufacturer-backed original warranties and specifications for all major system components:
        </p>

        <!-- 4-Column Warranty Table -->
        <table class="pdf-table" style="margin-bottom: 12px;">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">Sr. No.</th>
              <th style="width: 130px;">Product</th>
              <th>Make & Specification</th>
              <th style="width: 170px; text-align: center;">Warranty</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center; font-weight: 700;">1</td>
              <td><strong>SOLAR PANEL</strong></td>
              <td>${panelSpecText}</td>
              <td style="text-align: center; color: #16a34a; font-weight: 700;">12 Year Product Warranty /<br>30 Year Performance Warranty</td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: 700;">2</td>
              <td><strong>DCDB</strong></td>
              <td>HAVELLS 1 IN 1 OUT 600 V</td>
              <td style="text-align: center; color: #16a34a; font-weight: 700;">5 Year</td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: 700;">3</td>
              <td><strong>EARTHING</strong></td>
              <td>16 MM EARTHING ALU. CONDUCTOR ROD; 14 MM × 1 MTR COPPER ROD</td>
              <td style="text-align: center; color: #64748b;">—</td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: 700;">4</td>
              <td><strong>DC CABLE</strong></td>
              <td>4 SQ MM COPPER TIN</td>
              <td style="text-align: center; color: #16a34a; font-weight: 700;">20 Year</td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: 700;">5</td>
              <td><strong>CIVIL CHAMBER</strong></td>
              <td>ISI STANDARD</td>
              <td style="text-align: center; color: #16a34a; font-weight: 700;">10 Year</td>
            </tr>
            <tr>
              <td style="text-align: center; font-weight: 700;">6</td>
              <td><strong>ONGRID INVERTER</strong></td>
              <td>Grid-Tied Solar Inverter (IP65 Weatherproof)</td>
              <td style="text-align: center; color: #16a34a; font-weight: 700;">10 Year Warranty</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 8pt; font-style: italic; color: #64748b; margin-top: -6px; margin-bottom: 10px;">
          * Note: Other product warranties not mentioned above will be added as per project BOM.
        </p>

        <!-- Terms and Conditions (4 Clauses) -->
        <div class="pdf-subheading">Terms and Conditions for Warranty</div>
        <div class="pdf-terms-container" style="margin-bottom: 14px;">
          <div class="pdf-term-item">
            <strong>1. Natural Calamity & Extreme Weather:</strong> Equipment warranties cover manufacturing, material, and workmanship defects under standard rated operating conditions. Damages directly or indirectly caused by natural calamities, severe weather anomalies (cyclones, gale winds exceeding structure design rating, hailstorms, flooding, earthquakes, landslides), or direct lightning strikes exceeding surge suppression (SPD) capacities are excluded from manufacturer warranty and must be insured under comprehensive plant insurance.
          </div>
          <div class="pdf-term-item">
            <strong>2. Force Majeure:</strong> Neither the contractor nor original manufacturers shall be held liable for any delay, performance shortfall, or warranty voidance arising from Force Majeure events beyond reasonable human control, including but not limited to war, civil disturbances, riots, sabotage, fire, epidemics, labor disputes, or statutory grid shutdowns.
          </div>
          <div class="pdf-term-item">
            <strong>3. Change in Government Policies & Regulatory Framework:</strong> Generation estimates, solar savings, and financial payback calculations are based strictly on prevailing MERC tariff orders, MSEDCL net metering rules, and MNRE PM Surya Ghar subsidy regulations. Any future amendments, changes in net metering provisions, imposition of grid-support/banking charges, or revision of fixed tariffs shall not be construed as a defect or warranty violation by the installer.
          </div>
          <div class="pdf-term-item">
            <strong>4. Operation, Maintenance & Pass-Through Warranty:</strong> All product warranties are original equipment manufacturer (OEM) pass-through warranties. The warranty remains in full force provided that: (a) panels are periodically washed with non-abrasive soft water, (b) the plant is operated within rated electrical parameters, and (c) no unauthorized modifications, repairs, or component tampering are carried out by uncertified third parties.
          </div>
        </div>

        <!-- Acceptance Signatures -->
        <div class="pdf-signature-block">
          <div>
            <div class="pdf-sig-line"></div>
            <strong>For DATLION CNERGY PRIVATE LIMITED</strong>
            <div style="font-size: 8pt; color: #64748b;">Authorized Signatory / Technical Director</div>
          </div>
          <div>
            <div class="pdf-sig-line"></div>
            <strong>Accepted & Confirmed by Client</strong>
            <div style="font-size: 8pt; color: #64748b;">${customerName} (${proposalDate})</div>
          </div>
        </div>
      </div>

      ${createPageFooter(warrantyPageNum, totalPages)}
    </div>
  `;
  pages.push(page6Content);

  // ==========================================
  // PAGE 7: SOLAR SYSTEM DIFFERENCES GUIDE
  // ==========================================
  const guidePageNum = isLoan ? 7 : 6;
  const page7Content = `
    <div class="pdf-sample-page" data-page-index="${guidePageNum}">
      ${createPageHeader("Solar System Technology Differences & Guide")}
      
      <div class="pdf-page-body">
        <div class="pdf-section-title">${guidePageNum}. Solar System Differences & Technology Guide</div>
        <p class="pdf-paragraph">
          Overview of photovoltaic topologies to understand system differences and long-term operating dynamics:
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px;">
          <div class="pdf-card" style="border-left: 4px solid #16a34a;">
            <div style="font-weight: 700; color: #166534; font-size: 11pt; margin-bottom: 4px;">On-Grid Solar System (Recommended for Residential)</div>
            <p style="font-size: 9.5pt; color: #334155; margin: 0; line-height: 1.45;">
              Grid-connected solar system without batteries. Directly synchronizes with the utility grid and exports 100% of daytime excess energy via bi-directional net metering. Delivers the lowest upfront capital cost, fastest payback (typically 3–4 years), and highest ROI. Anti-islanding safety shut-off activates automatically during utility power outages.
            </p>
          </div>

          <div class="pdf-card" style="border-left: 4px solid #0284c7;">
            <div style="font-weight: 700; color: #075985; font-size: 11pt; margin-bottom: 4px;">Hybrid Solar System (Solar + Battery + Grid)</div>
            <p style="font-size: 9.5pt; color: #334155; margin: 0; line-height: 1.45;">
              Combines net-metered grid export with lithium-ion / tubular battery storage. Solar generation powers your connected load first, charges the battery bank second, and exports surplus electricity to MSEDCL third. When utility power cuts occur, the intelligent hybrid inverter automatically transitions to islanding mode within 10 milliseconds to supply backup power.
            </p>
          </div>

          <div class="pdf-card" style="border-left: 4px solid #f59e0b;">
            <div style="font-weight: 700; color: #b45309; font-size: 11pt; margin-bottom: 4px;">Off-Grid Solar System (100% Standalone Battery)</div>
            <p style="font-size: 9.5pt; color: #334155; margin: 0; line-height: 1.45;">
              Operates completely independent of the MSEDCL electrical grid. Requires extensive battery bank capacity to sustain daytime and nighttime household consumption plus 2–3 days of monsoon autonomy. Ideal for remote farmhouses, agricultural pumps, or areas with absent utility infrastructure. Not eligible for net metering grid export.
            </p>
          </div>
        </div>

        <div class="pdf-highlight-box green">
          <strong>Need Help or Custom Engineering?</strong> Datlion Cnergy provides turnkey engineering, DISCOM paperwork, and dedicated post-commissioning customer support across Maharashtra. Contact our engineering desk at +91 8956340980 or visit www.cnergy.co.in.
        </div>
      </div>

      ${createPageFooter(guidePageNum, totalPages)}
    </div>
  `;
  pages.push(page7Content);

  return pages.join("\n");
}

/**
 * Open the PDF Sample View modal and render the sample pages.
 */
export function openPdfSampleView(estimates, selectedOption, hideFlags = {}) {
  currentEstimates = estimates;
  currentSelectedOption = selectedOption;
  currentHideFlags = hideFlags;

  const modal = document.getElementById("pdfSampleViewModal");
  const pagesContainer = document.getElementById("pdfSampleViewPages");
  if (!modal || !pagesContainer) return;

  // Render fresh sample pages
  pagesContainer.innerHTML = buildSamplePdfPages(estimates, selectedOption, hideFlags);

  // Show modal
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  // Check if editing was already unlocked in this session
  applyEditState();
}

/**
 * Close the PDF Sample View modal.
 */
export function closePdfSampleView() {
  const modal = document.getElementById("pdfSampleViewModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}

/**
 * Apply edit state (contenteditable="true" or "false") to all text nodes.
 */
function applyEditState() {
  const modal = document.getElementById("pdfSampleViewModal");
  const container = document.getElementById("pdfSampleViewPages");
  const statusBadge = document.getElementById("sampleViewStatusBadge");
  const banner = document.getElementById("sampleViewStatusBanner");
  const toggleBtn = document.getElementById("sampleViewUnlockEditBtn");

  if (!container) return;

  // Find all text-bearing elements
  const textElements = container.querySelectorAll(
    "h1, h2, h3, h4, h5, p, span, td, th, li, strong, em, b, i, .pdf-section-title, .pdf-subheading, .pdf-company-title, .pdf-company-sub, .pdf-doc-title, .pdf-card-name, .pdf-card-address, .pdf-phase-box, .pdf-term-item, .pdf-pill, .pdf-doc-meta, .pdf-highlight-box, .pdf-card-badge, .pdf-cad-placeholder, div[data-editable='true']"
  );

  if (isEditingUnlocked) {
    modal?.classList.add("editing-unlocked");
    textElements.forEach((el) => {
      // Don't make images or non-editable control wrappers contenteditable
      if (el.tagName !== "IMG" && !el.classList.contains("no-edit")) {
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "false");
      }
    });

    if (statusBadge) {
      statusBadge.textContent = "✏️ Edit Mode Active";
      statusBadge.className = "sample-status-pill active";
    }
    if (banner) {
      banner.style.display = "block";
    }
    if (toggleBtn) {
      toggleBtn.innerHTML = "<span>🔒</span> <span>Lock Text</span>";
      toggleBtn.title = "Lock text to prevent accidental changes";
      toggleBtn.classList.add("active");
    }
  } else {
    modal?.classList.remove("editing-unlocked");
    textElements.forEach((el) => {
      el.setAttribute("contenteditable", "false");
    });

    if (statusBadge) {
      statusBadge.textContent = "🔒 Locked (Read-Only)";
      statusBadge.className = "sample-status-pill locked";
    }
    if (banner) {
      banner.style.display = "none";
    }
    if (toggleBtn) {
      toggleBtn.innerHTML = "<span>✏️</span> <span>Edit Text</span>";
      toggleBtn.title = "Unlock manual text editing (password required)";
      toggleBtn.classList.remove("active");
    }
  }
}

/**
 * Open the password confirmation dialog to unlock text editing.
 */
export function promptForPasswordAndUnlock() {
  if (isEditingUnlocked) {
    // If already unlocked, clicking the toggle locks it
    isEditingUnlocked = false;
    applyEditState();
    return;
  }

  const dialog = document.getElementById("sampleViewPasswordDialog");
  const input = document.getElementById("sampleViewPasswordInput");
  const err = document.getElementById("sampleViewPasswordError");

  if (!dialog) return;

  if (input) input.value = "";
  if (err) err.style.display = "none";

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.style.display = "flex";
  }
  input?.focus();
}

/**
 * Confirm password and unlock editing across all sample view elements.
 */
export function confirmPasswordUnlock() {
  const input = document.getElementById("sampleViewPasswordInput");
  const err = document.getElementById("sampleViewPasswordError");
  const dialog = document.getElementById("sampleViewPasswordDialog");

  const pwd = (input?.value || "").trim().toLowerCase();
  if (pwd === "editprop") {
    isEditingUnlocked = true;
    if (err) err.style.display = "none";
    if (typeof dialog?.close === "function") dialog.close();
    else if (dialog) dialog.style.display = "none";
    applyEditState();
  } else {
    if (err) {
      err.style.display = "block";
      err.textContent = "Incorrect password. Enter 'editprop' to confirm manual editing.";
    }
  }
}

/**
 * Cancel the password dialog.
 */
export function cancelPasswordUnlock() {
  const dialog = document.getElementById("sampleViewPasswordDialog");
  const err = document.getElementById("sampleViewPasswordError");
  if (err) err.style.display = "none";
  if (typeof dialog?.close === "function") dialog.close();
  else if (dialog) dialog.style.display = "none";
}

/**
 * Reset all edited text in the Sample View back to auto-calculated defaults.
 */
export function resetSampleViewToDefaults() {
  if (confirm("Revert all manual text edits back to original auto-calculated values?")) {
    const pagesContainer = document.getElementById("pdfSampleViewPages");
    if (pagesContainer && currentEstimates) {
      pagesContainer.innerHTML = buildSamplePdfPages(
        currentEstimates,
        currentSelectedOption,
        currentHideFlags
      );
      applyEditState();
    }
  }
}

/**
 * Print the exact Sample View to PDF using native browser print.
 */
export function printPdfSampleView() {
  window.print();
}

/**
 * Initialize DOM listeners for the PDF Sample View modal & dialogs.
 */
export function initPdfSampleView() {
  // Close Sample View button
  document.getElementById("closeSampleViewModalBtn")?.addEventListener("click", closePdfSampleView);
  document.getElementById("sampleViewCloseBtnTop")?.addEventListener("click", closePdfSampleView);

  // Edit Text button (prompts for password)
  document.getElementById("sampleViewUnlockEditBtn")?.addEventListener("click", promptForPasswordAndUnlock);

  // Password confirmation buttons
  document.getElementById("sampleViewConfirmUnlockBtn")?.addEventListener("click", confirmPasswordUnlock);
  document.getElementById("sampleViewCancelUnlockBtn")?.addEventListener("click", cancelPasswordUnlock);

  // Enter key inside password input
  document.getElementById("sampleViewPasswordInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmPasswordUnlock();
    } else if (e.key === "Escape") {
      cancelPasswordUnlock();
    }
  });

  // Reset to default button
  document.getElementById("sampleViewResetBtn")?.addEventListener("click", resetSampleViewToDefaults);

  // Print button
  document.getElementById("sampleViewPrintBtn")?.addEventListener("click", printPdfSampleView);

  // Open Sample View button from Proposal tab
  document.getElementById("openSampleViewBtn")?.addEventListener("click", () => {
    if (window.appState) {
      const isBuilding = window.appState.proposalMode === "multi_building";
      const est = window.appState.estimates || { input: {}, options: [], recommended: {} };
      const opt =
        (window.appState.selectedSystemIndex !== null &&
          window.appState.selectedSystemIndex >= 0 &&
          est.options &&
          est.options[window.appState.selectedSystemIndex]) ||
        (est.recommended || {});
      const hideFlags = {
        isBuildingProposal: isBuilding,
        buildingData: isBuilding ? window.appState.buildingData : null,
        includeIndividualSheets: isBuilding ? (document.getElementById("includeIndividualSheets")?.checked || false) : false,
        proposalSerialNo: document.getElementById("proposalSerialNo")?.value || "DC/2026-27/PROP-1140",
      };
      openPdfSampleView(est, opt, hideFlags);
    }
  });
}
