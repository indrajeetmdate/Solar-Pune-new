import { getPanelSpecificationText } from "./config.js";
import { getScopeOfWorkItems } from "./reportGenerator.js";

let currentEstimates = null;
let currentSelectedOption = null;
let currentHideFlags = {};
let isEditingUnlocked = false;

const formatCurrency = (val) =>
  "Rs " + Number(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const formatSysType = (t) => {
  if (t === "ongrid") return "On-Grid";
  if (t === "ongrid_basic_backup") return "Semi-Hybrid (1100VA)";
  if (t === "ongrid_standard_backup") return "Semi-Hybrid (2100VA)";
  if (t === "offgrid") return "Off-Grid";
  if (t === "hybrid") return "Hybrid";
  return "On-Grid";
};

function captureCadSnapshotForSample() {
  let cad = null;
  let dataUrl = null;
  if (typeof window !== "undefined") {
    cad = window.cad || (typeof window.getActiveRooftopCAD === "function" ? window.getActiveRooftopCAD() : null);
  }
  if (cad && typeof cad.getReportSnapshot === "function") {
    try {
      dataUrl = cad.getReportSnapshot();
    } catch (e) {
      console.warn("Could not capture CAD snapshot:", e);
    }
  }
  if (!dataUrl && typeof document !== "undefined") {
    try {
      const canvas = document.getElementById("panelDiagramCanvas");
      if (canvas && canvas.width > 0 && canvas.height > 0 && typeof canvas.toDataURL === "function") {
        dataUrl = canvas.toDataURL("image/png");
      }
    } catch (e) {
      console.warn("Could not capture CAD canvas:", e);
    }
  }
  return { cad, dataUrl };
}

/**
 * Build Multi-Customer Building Sample PDF Pages
 * Generates interactive HTML pages matching official building proposal with password 'editprop' editing.
 */
export function buildBuildingSamplePdfPages(estimates, selectedOption, hideFlags = {}) {
  const buildingData = hideFlags.buildingData || estimates?.buildingData || {};
  const summary = buildingData.summary || buildingData.totals || {};
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

  const { dataUrl: cadCanvasDataUrl } = captureCadSnapshotForSample();

  const createPageHeader = (pageTitle = "Building Solar Proposal") => `
    <div class="pdf-page-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energy.png" onerror="this.src='logo.png'" alt="DC Energy" style="height: 32px; width: auto; object-fit: contain;">
        <div>
          <div class="pdf-company-title">DATLION CNERGY</div>
          <div class="pdf-company-sub">SOLAR EPC &amp; CLEAN ENERGY SOLUTIONS</div>
        </div>
      </div>
      <div class="pdf-header-right">
        <div class="pdf-doc-title">${pageTitle}</div>
        <div class="pdf-doc-meta">Ref: <span class="editable-field">${proposalSerialNo}</span></div>
      </div>
    </div>
  `;

  const createPageFooter = (pageNum, totalPages) => `
    <div class="pdf-page-footer">
      <div class="pdf-footer-left">www.cnergy.co.in</div>
      <div class="pdf-footer-center">Page ${pageNum} of ${totalPages} &nbsp;|&nbsp; Ref: ${proposalSerialNo}</div>
      <div class="pdf-footer-right">
        <div style="font-weight: 700; color: #1e293b;">DATLION CNERGY PRIVATE LIMITED</div>
        <div style="font-size: 7pt; color: #64748b;">GSTIN: 27AALCD8550A1ZP | Pune</div>
      </div>
    </div>
  `;

  // Calculate total pages dynamically
  const showCadDiagram = hideFlags.showCadDiagram !== undefined 
    ? Boolean(hideFlags.showCadDiagram) 
    : (typeof document !== "undefined" ? document.getElementById("showCadDiagram")?.checked !== false : true);

  const FLATS_PER_LEDGER_PAGE = 32;
  const ledgerPagesCount = Math.max(1, Math.ceil(flatLedger.length / FLATS_PER_LEDGER_PAGE));
  const cadPagesCount = showCadDiagram ? 1 : 0;
  const termsPagesCount = 2; // Warranty and Details (Page 1) + Terms & Conditions Contd. (Page 2)
  const basePagesCount = 1 + cadPagesCount + ledgerPagesCount + termsPagesCount; // Page 1 (Exec Summary), [Page 2 (CAD Map)], Page 3.. (Master Ledger), Page 4.. (Warranty & Terms)
  const totalPagesCount = includeIndividualSheets ? (basePagesCount + flatLedger.length) : basePagesCount;

  const pages = [];

  // ==========================================
  // PAGE 1: Building Executive Summary
  // ==========================================
  const page1 = `
    <div class="pdf-sample-page" data-page-index="1">
      ${createPageHeader("Building Solar Proposal")}
      <div class="pdf-page-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm; font-size: 8pt;">
          <div style="color: #63923e; font-weight: 700;">PROPOSAL REF: <span class="editable-field">${proposalSerialNo}</span></div>
          <div style="color: #64748b;">DATE: <span class="editable-field">${proposalDate}</span></div>
        </div>

        <div class="pdf-grid-2" style="margin-bottom: 3mm;">
          <div class="pdf-card pdf-card-from" style="padding: 2.5mm 3.5mm;">
            <div class="pdf-card-badge blue">Issued By (Solar EPC)</div>
            <div class="pdf-card-name">DATLION CNERGY PRIVATE LIMITED</div>
            <p class="pdf-card-address">
              Ground, Shed No. 1, Shashitara Pratishthan BJP Office,<br>
              Late Narayanrao Kondiba Jagtap Path, Hingne Khurd, Pune - 411051
            </p>
            <div class="pdf-card-contact">
              <div><strong>GSTIN:</strong> 27AALCD8550A1ZP</div>
              <div><strong>Email:</strong> datlioncnergy@gmail.com</div>
              <div><strong>Phone:</strong> +91 8956340980 | www.cnergy.co.in</div>
            </div>
          </div>
          <div class="pdf-card pdf-card-to" style="padding: 2.5mm 3.5mm;">
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

        <div class="pdf-section-title">1. Building Executive Summary &amp; Financial Indicators</div>
        <div class="pdf-section-desc" style="font-size: 7.8pt; color: #475569; margin-bottom: 2mm;">Turnkey solar PV system economics, aggregate capacity, and PM Surya Ghar subsidy benefits for the society.</div>

        <table class="pdf-table" style="margin-bottom: 3mm; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 32%;">
            <col style="width: 18%;">
            <col style="width: 32%;">
            <col style="width: 18%;">
          </colgroup>
          <tbody>
            <tr>
              <td style="width: 32%; background: #f8fafc; font-weight: 700;">Total Solar PV Capacity</td>
              <td style="width: 18%; font-weight: 700;"><span class="editable-field">${(summary.totalBuildingCapacityKw || 0).toFixed(1)} kWp</span> (${summary.totalBuildingPanels || 0} Modules)</td>
              <td style="width: 32%; background: #f8fafc; font-weight: 700;">Estimated Monthly Generation</td>
              <td style="width: 18%;"><span class="editable-field">${(summary.monthlyGenerationTotal || 0).toLocaleString("en-IN")}</span> kWh / mo</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 700;">Turnkey Project Value (Gross)</td>
              <td><span class="editable-field">${formatCurrency(summary.totalBuildingGrossCost)}</span></td>
              <td style="background: #f8fafc; font-weight: 700;">Estimated Annual Generation</td>
              <td><span class="editable-field">${(summary.annualGenerationTotal || 0).toLocaleString("en-IN")}</span> kWh / yr</td>
            </tr>
            <tr style="background: #f0fdf4;">
              <td style="font-weight: 700; color: #166534;">Total PM Surya Ghar Subsidies</td>
              <td style="font-weight: 700; color: #166534;"><span class="editable-field">${formatCurrency(summary.totalSubsidy)}</span></td>
              <td style="font-weight: 700; color: #166534;">Annual Electricity Savings</td>
              <td style="font-weight: 700; color: #166534;"><span class="editable-field">${formatCurrency(summary.totalAnnualSavings)} / yr</span></td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 700; color: #0284c7;">Net Investment (Society)</td>
              <td style="font-weight: 700; color: #0284c7;"><span class="editable-field">${formatCurrency(summary.totalNetCost)}</span></td>
              <td style="background: #f8fafc; font-weight: 700;">Blended Payback Period</td>
              <td><span class="editable-field">${Number(summary.buildingPaybackYears || 0).toFixed(1)} Years</span></td>
            </tr>
          </tbody>
        </table>

        <div class="pdf-card" style="background: #ffffff; border: 1px solid #e2e8f0; padding: 2.5mm 3.5mm;">
          <div style="font-size: 8.5pt; font-weight: 700; color: #63923e; margin-bottom: 2mm;">Shared Technical System Architecture</div>
          <table class="pdf-plain-table" style="width: 100%; font-size: 7.2pt; line-height: 1.4; border-collapse: collapse;">
            <tbody>
              <tr><td style="width: 32%; font-weight: 700; padding: 1mm 0; color: #0f172a;">Solar PV Modules</td><td style="padding: 1mm 0; color: #334155;"><span class="editable-field">${buildingData.panelMake || "Tier-1 Mono PERC DCR"} (${buildingData.panelWp || 550} Wp High-efficiency modules)</span></td></tr>
              <tr><td style="font-weight: 700; padding: 1mm 0; color: #0f172a;">Mounting Structure</td><td style="padding: 1mm 0; color: #334155;"><span class="editable-field">Elevated Hot-dip Galvanized (HDG 80-120 micron, 25+ yr structural durability)</span></td></tr>
              <tr><td style="font-weight: 700; padding: 1mm 0; color: #0f172a;">Inverter Architecture</td><td style="padding: 1mm 0; color: #334155;"><span class="editable-field">${summary.inverterModelSummary ? `${summary.inverterModelSummary} (Dedicated Inverter for Each Flat)` : "High-efficiency Multi-MPPT Grid-Tied Inverters with IP65 weatherproofing (Separate inverter per flat)"}</span></td></tr>
              <tr><td style="font-weight: 700; padding: 1mm 0; color: #0f172a;">Safety &amp; Earthing</td><td style="padding: 1mm 0; color: #334155;"><span class="editable-field">Dedicated dual copper bonded earthing electrode rods (16mm &amp; 14mm) + Type-2 SPDs</span></td></tr>
              <tr><td style="font-weight: 700; padding: 1mm 0; color: #0f172a;">Grid Interconnection</td><td style="padding: 1mm 0; color: #334155;"><span class="editable-field">Individual bi-directional net meters / Group Net Metering under MSEDCL Solar Regulations</span></td></tr>
              <tr><td style="font-weight: 700; padding: 1mm 0; color: #0f172a;">Turnkey Inclusions</td><td style="padding: 1mm 0; color: #334155;"><span class="editable-field">Supply, structural fabrication, DC/AC cabling, statutory MSEDCL approvals &amp; commissioning</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      ${createPageFooter(1, totalPagesCount)}
    </div>
  `;
  pages.push(page1);

  // ==========================================
  // PAGE 2 (OPTIONAL): Shared Rooftop CAD Layout & Demarcation
  // ==========================================
  if (showCadDiagram) {
    const totalPanelsCount = summary.totalBuildingPanels || 1;
    const page2 = `
    <div class="pdf-sample-page" data-page-index="2">
      ${createPageHeader("Rooftop Layout & CAD Blueprint")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">2. Shared Rooftop Layout &amp; Demarcated Flat Panel Allocation</div>
        <div class="pdf-section-desc" style="font-size: 7.8pt; color: #475569; margin-bottom: 2mm;">Architectural CAD layout displaying physical panel allocations, color boundaries per flat, and maintenance pathways.</div>

        <div style="text-align: center; margin-bottom: 2.5mm; background: #0f172a; border-radius: 4px; padding: 3mm; height: 75mm; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
          ${cadCanvasDataUrl ? `<img src="${cadCanvasDataUrl}" alt="Shared Rooftop CAD Blueprint" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 2px;">` : `<div style="color: #94a3b8; font-size: 9pt;">CAD Aerial Blueprint Diagram</div>`}
        </div>

        <table class="pdf-table" style="margin-bottom: 2.5mm; font-size: 7.2pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 25%;">
            <col style="width: 25%;">
            <col style="width: 25%;">
            <col style="width: 25%;">
          </colgroup>
          <tbody>
            <tr>
              <td style="width: 25%; background: #f8fafc; font-weight: 700;">Total Roof Area</td>
              <td style="width: 25%;"><span class="editable-field">${buildingData.roofAreaSqft || 2000} sq.ft.</span></td>
              <td style="width: 25%; background: #f8fafc; font-weight: 700;">Solar Array Area</td>
              <td style="width: 25%;"><span class="editable-field">${Math.round((summary.totalBuildingPanels || 0) * 27.5)} sq.ft.</span></td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 700;">Walkways &amp; Pathways</td>
              <td><span class="editable-field">${Math.max(0, (buildingData.roofAreaSqft || 2000) - Math.round((summary.totalBuildingPanels || 0) * 27.5))} sq.ft.</span></td>
              <td style="background: #f8fafc; font-weight: 700;">Orientation &amp; Tilt</td>
              <td>South Facing, Optimal 18° Tilt</td>
            </tr>
            <tr>
              <td style="background: #f8fafc; font-weight: 700;">Allocated Modules</td>
              <td><span class="editable-field">${summary.totalBuildingPanels || 0} Modules</span></td>
              <td style="background: #f8fafc; font-weight: 700;">Allocation Strategy</td>
              <td>Proportional to Monthly Consumption</td>
            </tr>
          </tbody>
        </table>

        <div style="font-size: 8pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">Demarcated Resident Panel Allocation Legend</div>
        <table class="pdf-table" style="font-size: 6.8pt; line-height: 1.2; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 12%;">
            <col style="width: 32%;">
            <col style="width: 16%;">
            <col style="width: 12%;">
            <col style="width: 14%;">
            <col style="width: 14%;">
          </colgroup>
          <thead>
            <tr style="background-color: #63923e; color: white; text-align: center;">
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Flat No</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; text-align: left; border-color: #4d7c2a;">Resident Name</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Monthly Units</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Panels</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Solar kWp</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Array Share (%)</th>
            </tr>
          </thead>
          <tbody>
            ${flatLedger.slice(0, 15).map(f => `
              <tr style="text-align: center;">
                <td><span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${f.color || '#2563eb'}; margin-right: 4px;"></span><strong><span class="editable-field">${f.flatNo}</span></strong></td>
                <td style="text-align: left;"><span class="editable-field">${f.customerName}</span></td>
                <td><span class="editable-field">${f.monthlyUnits}</span> kWh</td>
                <td><strong><span class="editable-field">${f.panels}</span></strong></td>
                <td><span class="editable-field">${(f.allocatedKw || 0).toFixed(2)}</span> kWp</td>
                <td>${Math.round(((f.panels || 0) / totalPanelsCount) * 100)}%</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ${createPageFooter(2, totalPagesCount)}
    </div>
  `;
    pages.push(page2);
  }

  // ==========================================
  // Building Master Financial Ledger
  // (Paginates cleanly with 30-32 flats per page)
  // ==========================================
  const ledgerSectionNum = showCadDiagram ? "3" : "2";
  for (let pIdx = 0; pIdx < ledgerPagesCount; pIdx++) {
    const pageNum = 1 + cadPagesCount + 1 + pIdx;
    const startRow = pIdx * FLATS_PER_LEDGER_PAGE;
    const endRow = Math.min(flatLedger.length, startRow + FLATS_PER_LEDGER_PAGE);
    const chunkFlats = flatLedger.slice(startRow, endRow);
    const isLastLedgerPage = (pIdx === ledgerPagesCount - 1);

    const pageLedger = `
      <div class="pdf-sample-page" data-page-index="${pageNum}">
        ${createPageHeader("Building Master Financial Ledger")}
        <div class="pdf-page-body">
          <div class="pdf-section-title">${ledgerSectionNum}. Resident-Wise Financial Allocation &amp; Solar Ledger${ledgerPagesCount > 1 ? ` (Part ${pIdx + 1} of ${ledgerPagesCount})` : ""}</div>
          <div class="pdf-section-desc" style="font-size: 7.5pt; color: #475569; margin-bottom: 2mm;">
            Comprehensive allocation of solar capacity, PM Surya Ghar subsidy, gross investment share, monthly generation, and net bills.
          </div>

          <table class="pdf-table pdf-ledger-table" style="width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 5.4pt; line-height: 1.15; box-sizing: border-box;">
            <colgroup>
              <col style="width: 2.8%;">
              <col style="width: 5.2%;">
              <col style="width: 12.5%;">
              <col style="width: 4.5%;">
              <col style="width: 5.0%;">
              <col style="width: 4.2%;">
              <col style="width: 4.8%;">
              <col style="width: 9.0%;">
              <col style="width: 8.5%;">
              <col style="width: 8.0%;">
              <col style="width: 8.0%;">
              <col style="width: 5.5%;">
              <col style="width: 7.5%;">
              <col style="width: 5.5%;">
              <col style="width: 4.8%;">
              <col style="width: 4.2%;">
            </colgroup>
            <thead>
              <tr style="background-color: #1e293b; color: white; text-align: center;">
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">#</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Flat</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 2px; text-align: left; border-color: #0f172a;">Resident Name</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Load<br>(kW)</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Units<br>/mo</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Panels</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">kWp</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 2px; text-align: left; border-color: #0f172a;">Inverter</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 2px; border-color: #0f172a;">Gross (Rs)</th>
                <th style="background-color: #064e3b !important; color: #a7f3d0 !important; padding: 2px 2px; border-color: #0f172a;">Subsidy (Rs)</th>
                <th style="background-color: #0c4a6e !important; color: #bae6fd !important; padding: 2px 2px; border-color: #0f172a;">Net Cost (Rs)</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Gen/mo<br>(kWh)</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 2px; border-color: #0f172a;">Savings<br>/mo (Rs)</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 2px; border-color: #0f172a;">Post Bill<br>(Rs)</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Payback</th>
                <th style="background-color: #1e293b !important; color: #ffffff !important; padding: 2px 1px; border-color: #0f172a;">Loan</th>
              </tr>
            </thead>
            <tbody>
              ${chunkFlats.map((f, i) => `
                <tr style="text-align: center;">
                  <td style="padding: 2px 1px;">${startRow + i + 1}</td>
                  <td style="padding: 2px 1px;"><strong><span class="editable-field">${f.flatNo}</span></strong></td>
                  <td style="padding: 2px 2px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span class="editable-field">${f.customerName}</span></td>
                  <td style="padding: 2px 1px;"><span class="editable-field">${f.sanctionedLoad}</span></td>
                  <td style="padding: 2px 1px;"><span class="editable-field">${f.monthlyUnits}</span></td>
                  <td style="padding: 2px 1px;"><strong><span class="editable-field">${f.panels}</span></strong></td>
                  <td style="padding: 2px 1px;"><span class="editable-field">${(f.allocatedKw || 0).toFixed(2)}</span></td>
                  <td style="padding: 2px 2px; text-align: left; font-size: 5.2pt; color: #0284c7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span class="editable-field">${f.inverterModel || "—"}</span></td>
                  <td style="padding: 2px 2px; text-align: right;"><span class="editable-field">${Number(f.grossCost || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 2px 2px; text-align: right; background: #f0fdf4; color: #15803d; font-weight: bold;"><span class="editable-field">${Number(f.subsidy || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 2px 2px; text-align: right; background: #f0f9ff; color: #0284c7; font-weight: bold;"><span class="editable-field">${Number(f.netCost || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 2px 1px;"><span class="editable-field">${f.monthlyGeneration}</span></td>
                  <td style="padding: 2px 2px; text-align: right; color: #15803d;"><span class="editable-field">${Number(f.monthlySavings || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 2px 2px; text-align: right;"><span class="editable-field">${Number(f.postSolarBill || 0).toLocaleString("en-IN")}</span></td>
                  <td style="padding: 2px 1px;"><span class="editable-field">${Number(f.paybackYears || 0).toFixed(1)}</span> y</td>
                  <td style="padding: 2px 1px;"><span class="editable-field">${f.loanMode ? "Yes" : "No"}</span></td>
                </tr>
              `).join("")}
            </tbody>
            ${isLastLedgerPage ? `
              <tfoot>
                <tr style="background: #f1f5f9; font-weight: bold; text-align: center; border-top: 1px solid #94a3b8;">
                  <td colspan="3" style="text-align: left; padding: 2px 2px;">BUILDING TOTALS (${summary.totalFlats || flatLedger.length} FLATS)</td>
                  <td style="padding: 2px 1px;">${summary.totalSanctionedLoad || 0}</td>
                  <td style="padding: 2px 1px;">${(summary.totalMonthlyUnits || 0).toLocaleString("en-IN")}</td>
                  <td style="padding: 2px 1px;">${summary.totalBuildingPanels || 0}</td>
                  <td style="padding: 2px 1px;">${(summary.totalBuildingCapacityKw || 0).toFixed(2)}</td>
                  <td style="font-size: 5.2pt; color: #0369a1; text-align: left; padding: 2px 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${summary.totalInverters || flatLedger.length} Inverters</td>
                  <td style="text-align: right; padding: 2px 1px;">${Number(summary.totalBuildingGrossCost || 0).toLocaleString("en-IN")}</td>
                  <td style="text-align: right; color: #15803d; padding: 2px 1px;">${Number(summary.totalSubsidy || 0).toLocaleString("en-IN")}</td>
                  <td style="text-align: right; color: #0284c7; padding: 2px 1px;">${Number(summary.totalNetCost || 0).toLocaleString("en-IN")}</td>
                  <td style="padding: 2px 1px;">${(summary.monthlyGenerationTotal || 0).toLocaleString("en-IN")}</td>
                  <td style="text-align: right; color: #15803d; padding: 2px 1px;">${Number(summary.totalMonthlySavings || 0).toLocaleString("en-IN")}</td>
                  <td style="padding: 2px 1px;">—</td>
                  <td style="padding: 2px 1px;">${Number(summary.buildingPaybackYears || 0).toFixed(1)} y</td>
                  <td style="padding: 2px 1px;">—</td>
                </tr>
              </tfoot>
            ` : ""}
          </table>
        </div>
        ${createPageFooter(pageNum, totalPagesCount)}
      </div>
    `;
    pages.push(pageLedger);
  }

  // ==========================================
  // PAGE: Building Terms & Conditions, Warranty and Details
  // ==========================================
  const termsSectionNum = showCadDiagram ? "4" : "3";
  const warrantyPageNum = 1 + cadPagesCount + ledgerPagesCount + 1;
  const warrantyPanelSpec = `${buildingData.panelMake || "Tier-1 Mono PERC DCR"} (${buildingData.panelWp || 550} Wp High-efficiency modules)`;
  const warrantyInverterSpec = summary.inverterModelSummary 
    ? `${summary.inverterModelSummary} (Dedicated Inverter for Each Flat)`
    : "High-efficiency Multi-MPPT Grid-Tied Inverters with IP65 weatherproofing (Separate inverter per flat)";

  const pageWarranty = `
    <div class="pdf-sample-page" data-page-index="${warrantyPageNum}">
      ${createPageHeader("Warranty and Details")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">${termsSectionNum}. Terms &amp; Conditions, Warranty and Details</div>
        <p class="pdf-paragraph" style="font-size: 8pt; color: #475569; margin-bottom: 2mm;">
          Comprehensive component warranties, manufacturer guarantees, and contractual terms governing this society solar EPC proposal.
        </p>

        <!-- Product Warranty Table -->
        <table class="pdf-table" style="margin-bottom: 2mm; font-size: 7.5pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 8%;">
            <col style="width: 22%;">
            <col style="width: 45%;">
            <col style="width: 25%;">
          </colgroup>
          <thead>
            <tr style="background-color: #63923e; color: white;">
              <th style="background-color: #63923e !important; color: #ffffff !important; text-align: center; padding: 1.5mm; border-color: #4d7c2a;">Sr. No.</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Product</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Make &amp; Specification</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; text-align: center; padding: 1.5mm; border-color: #4d7c2a;">Warranty</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="text-align: center; font-weight: 700;">1</td><td><strong>SOLAR PANELS</strong></td><td>${warrantyPanelSpec}</td><td style="text-align: center; color: #16a34a; font-weight: 700;">12 Year Warranty /<br>30 Year Performance Warranty</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">2</td><td><strong>MOUNTING STRUCTURE</strong></td><td>Elevated Hot-dip Galvanized Structure (HDG 80-120 micron, 25+ yr durability)</td><td style="text-align: center; color: #16a34a; font-weight: 700;">25-Year Galvanization &amp; Structural Integrity</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">3</td><td><strong>INVERTER ARCHITECTURE</strong></td><td>${warrantyInverterSpec}</td><td style="text-align: center; color: #16a34a; font-weight: 700;">8-Year Comprehensive Replacement Warranty</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">4</td><td><strong>DCDB &amp; AC SWITCHGEAR</strong></td><td>HAVELLS / REPUTED MULTI-IN 600V-1000V DCDB with Type-2 SPDs</td><td style="text-align: center; color: #16a34a; font-weight: 700;">5 Year</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">5</td><td><strong>EARTHING &amp; SAFETY</strong></td><td>16 MM ALU. CONDUCTOR ROD; 14 MM × 1 MTR CHEMICAL COPPER BONDED RODS</td><td style="text-align: center; color: #16a34a; font-weight: 700;">10 Year System Life Warranty</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">6</td><td><strong>SOLAR DC/AC CABLING</strong></td><td>4 / 6 SQ MM COPPER TIN SOLAR CABLE (UV Resistant, Flame Retardant)</td><td style="text-align: center; color: #16a34a; font-weight: 700;">20 Year</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">7</td><td><strong>CIVIL CHAMBER</strong></td><td>HEAVY DUTY ISI STANDARD PRECAST CONCRETE CHAMBER</td><td style="text-align: center; color: #16a34a; font-weight: 700;">10 Year</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">8</td><td><strong>METERING &amp; INTERCONNECTION</strong></td><td>Bi-directional Net Meters under MSEDCL Solar Regulations</td><td style="text-align: center; color: #16a34a; font-weight: 700;">Statutory DISCOM Standard</td></tr>
          </tbody>
        </table>
        <div style="font-size: 6.8pt; font-style: italic; color: #64748b; margin-bottom: 3mm;">
          * Note: Other product warranties not mentioned above will be added later / as per project BOM.
        </div>

        <div style="font-size: 8.5pt; font-weight: 700; color: #000000; margin-bottom: 1mm;">
          Terms and Conditions for Warranty, System Design, Installation &amp; Commercials
        </div>
        <div style="font-size: 7.2pt; color: #64748b; margin-bottom: 2mm;">
          The following terms and conditions govern this society solar EPC proposal and form the collaborative agreement between Datlion Cnergy Pvt. Ltd. and the Client / Housing Society.
        </div>

        <!-- Section A -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          A. System Design &amp; Generation Feasibility Terms
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Simulated Solar Generation &amp; Yield Engineering:</strong> Projections and carbon offsets are computer-simulated engineering estimations based on standard test conditions (STC) and historical Pune irradiance data (NASA/Meteonorm). Actual yield reflects real-time sunlight, seasonal weather, grid availability, and routine module washing.</div>
          <div style="margin-top: 1mm;"><strong>2. Grid Synchronization &amp; Statutory Anti-Islanding:</strong> As mandated by Central Electricity Authority (CEA) and MSEDCL safety regulations, on-grid inverters automatically disconnect during utility power cuts or voltage/frequency trips (anti-islanding protection). Standby during utility outages is a regulatory safety feature.</div>
          <div style="margin-top: 1mm;"><strong>3. Future Shading Obstructions &amp; Property Alterations:</strong> Array design is optimized for site conditions at the time of survey. Subsequent construction, foliage growth, or architectural changes on adjoining properties that cast shade are beyond the installer's scope.</div>
        </div>

        <!-- Section B -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          B. Rooftop Layout, Civil &amp; Structural Responsibilities
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35;">
          <div><strong>1. Roof Structural Soundness &amp; Load Capacity:</strong> Mounting structures are engineered for wind speeds up to 150 km/h. The client confirms the roof slab or support structure possesses adequate structural load-bearing capacity for the solar installation.</div>
          <div style="margin-top: 1mm;"><strong>2. Fastener Sealing &amp; Roof Water Ingress:</strong> Datlion Cnergy employs standard chemical anchoring and weatherproofing sealant at base fixings. General roof slab waterproofing and structural maintenance remain the client's responsibility.</div>
          <div style="margin-top: 1mm;"><strong>3. Rooftop Access &amp; Routine Module Washing:</strong> The client provides safe roof access and a soft-water tap connection. Fortnightly module washing with clean, non-abrasive water preserves peak power output and maintains OEM warranties.</div>
          <div style="margin-top: 1mm;"><strong>4. Indicative Blueprint &amp; Site Adaptations:</strong> The CAD layout is an indicative engineering blueprint. Minor string routing or walkway adjustments may be made during physical installation to best accommodate site conduits without reducing contracted DC capacity.</div>
        </div>
      </div>
      ${createPageFooter(warrantyPageNum, totalPagesCount)}
    </div>
  `;
  pages.push(pageWarranty);

  // ==========================================
  // PAGE: Terms and Conditions (Contd.)
  // ==========================================
  const tcContdPageNum = warrantyPageNum + 1;
  const pageTcContd = `
    <div class="pdf-sample-page" data-page-index="${tcContdPageNum}">
      ${createPageHeader("Terms and Conditions (Contd.)")}
      <div class="pdf-page-body">
        <!-- Section C -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          C. Commercial, Pricing &amp; Milestone Payment Terms
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Quotation Validity &amp; Milestone Progress:</strong> Pricing is valid for 15 days from issue date. Payments follow agreed project milestones (advance booking, material dispatch, installation, and commissioning), ensuring smooth procurement and prompt execution.</div>
          <div style="margin-top: 1mm;"><strong>2. Cabling, Wiring &amp; Civil Works at Actuals:</strong> Standard bill of materials (BOM) allowances are included. Cabling and wiring charges will be at actual measured length of DC and AC cabling required on site, ensuring client pays transparently for exact site requirements.</div>
          <div style="margin-top: 1mm;"><strong>3. Statutory Taxes &amp; On-Site Material Custody:</strong> Pricing reflects prevailing GST rates (effective composite 8.9%). Delivered materials stored safely at site transition to client custody, with ownership title transferring upon final milestone settlement.</div>
        </div>

        <!-- Section D -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          D. MSEDCL Net Metering, Grid Interconnection &amp; PM Surya Ghar Subsidy Terms (MNRE 07.06.2024)
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Central Financial Assistance (CFA) Eligibility &amp; DBT:</strong> Central subsidy under PM Surya Ghar: Muft Bijli Yojana applies strictly to Capex mode (consumer self-funded or bank loan financed) and is credited directly to the client's bank account via DBT. RESCO/utility aggregation models and off-grid setups are strictly excluded (₹0 CFA). Sizing strictly follows pro-rata slabs (0 to 2 kWp: ₹30,000/kWp / >2 to 3 kWp: ₹18,000/kWp / >3 kWp: ₹0 additional; max CFA cap of ₹78,000 per consumer). Maharashtra falls under General/Standard Category States (eligible DISCOMs: MSEDCL, BEST, Adani Electricity, Tata Power). Datlion Cnergy assists with National Portal documentation; EPC payments remain independent of DBT disbursement.</div>
          <div style="margin-top: 1mm;"><strong>2. Mandatory Equipment &amp; Mounting Compliance:</strong> CFA requires 100% Domestic Content Requirement (DCR) ALMM-listed solar cells/modules and BIS-compliant inverters. Systems must be mounted on rooftops, terraces, balconies, BIPV, or elevated structures with ≥ 8 ft ground clearance. Ground-mounted systems are strictly ineligible for CFA.</div>
          <div style="margin-top: 1mm;"><strong>3. Grid Feasibility &amp; Housing Society Sizing:</strong> Systems ≤ 10 kW enjoy deemed grid feasibility approval per MNRE guidelines. For Group Housing Societies / multi-meter buildings (Category B/C), total CFA capacity is capped at min(3 kWp × Total Houses, 500 kWp), and common utility power is prohibited from supplying individual residential flats.</div>
        </div>

        <!-- Section E -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          E. Bank Partner Financing Facilitation Terms
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Illustrative EMI Projections &amp; Underwriting:</strong> All bank EMI figures, interest rates (e.g. 9.5% p.a.), and payback timelines are illustrative estimates. Final loan sanction, interest rates, and loan tenure are determined by the partner lending bank (SBI, Canara Bank, Union Bank, etc.) under PM Surya Ghar nationalized schemes.</div>
          <div style="margin-top: 1mm;"><strong>2. EPC Facilitation Role &amp; Independent Milestones:</strong> Datlion Cnergy acts as a technology and documentation facilitator to help clients secure competitive green solar loans. Project milestone payments proceed in coordination with bank disbursement schedules.</div>
        </div>

        <!-- Section F -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          F. Terms and Conditions for Warranty &amp; OEM Pass-Through
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Original Equipment Manufacturer (OEM) Pass-Through:</strong> Solar panels (12-yr product / 30-yr performance), inverters (10-yr), and switchgear carry direct manufacturer warranties. Datlion Cnergy acts as your local single-point facilitator for manufacturer warranty claims and RMA processing.</div>
          <div style="margin-top: 1mm;"><strong>2. Operation, Maintenance &amp; Pass-Through Warranty:</strong> All product warranties are original equipment manufacturer (OEM) pass-through warranties. Standard warranty remains valid when the system is operated within rated electrical parameters, cleaned regularly with soft water, and serviced by authorized personnel.</div>
          <div style="margin-top: 1mm;"><strong>3. Natural Calamity &amp; Force Majeure Protections:</strong> Warranties cover equipment manufacturing and performance defects. Damages caused by Natural Calamity events (cyclones exceeding design rating, hailstorms, flooding, earthquakes) or Force Majeure disruptions (civil unrest, grid-level anomalies) are covered under comprehensive plant insurance rather than equipment warranties.</div>
          <div style="margin-top: 1mm;"><strong>4. Change in Government Policies &amp; Regulatory Framework:</strong> Savings and payback models are based on current MERC net metering regulations and MSEDCL tariffs. Any future Change in Government Policies, tariff revisions, or DISCOM grid-banking rules are external regulatory updates.</div>
        </div>

        <!-- Section G -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          G. Proposal-Wide General EPC Terms &amp; Conditions
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35;">
          <div><strong>1. Limitation of EPC Liability (Capped at 5%):</strong> To the extent permitted by law, the total cumulative aggregate liability of Datlion Cnergy Pvt. Ltd. for any claim or dispute arising under this proposal shall be subject to a Limitation of EPC Liability (Capped at 5%) of the total contract value actually received, excluding indirect or consequential downtime losses.</div>
          <div style="margin-top: 1mm;"><strong>2. Mutual Good Faith &amp; Exclusive Jurisdiction:</strong> Both parties agree to resolve any operational questions through mutual consultation and good-faith cooperation. Unresolved legal disputes shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra, India.</div>
        </div>
      </div>
      ${createPageFooter(tcContdPageNum, totalPagesCount)}
    </div>
  `;
  pages.push(pageTcContd);

  // ==========================================
  // OPTIONAL: Individual Resident Sheets
  // (1 page per resident)
  // ==========================================
  if (includeIndividualSheets && flatLedger.length > 0) {
    flatLedger.forEach((flat, idx) => {
      const pageIndex = basePagesCount + 1 + idx;
      let subsidyExplanation = "Not eligible for subsidy (ground mount, off-grid, non-DCR, or commercial)";
      if (flat.subsidy > 0) {
        if (flat.allocatedKw <= 2.0) {
          subsidyExplanation = `PM Surya Ghar Pro-Rata Slab (Rs 30,000/kWp) = Rs ${flat.subsidy.toLocaleString("en-IN")}`;
        } else if (flat.allocatedKw <= 3.0) {
          subsidyExplanation = `PM Surya Ghar Pro-Rata Slab (Rs 60,000 + Rs 18,000/kWp above 2 kWp) = Rs ${flat.subsidy.toLocaleString("en-IN")}`;
        } else {
          subsidyExplanation = `PM Surya Ghar Maximum CFA Cap = Rs ${flat.subsidy.toLocaleString("en-IN")}`;
        }
      }

      const dpPct = flat.financing?.downPaymentPct ?? (Number(flat.loanDownPaymentPct) || 10);

      const flatPage = `
        <div class="pdf-sample-page" data-page-index="${pageIndex}">
          ${createPageHeader(`Individual Proposal — Flat ${flat.flatNo}`)}
          <div class="pdf-page-body">
            <div class="pdf-section-title">Official Solar Proposal — Flat ${flat.flatNo} (<span class="editable-field">${flat.customerName}</span>)</div>
            <div class="pdf-section-desc" style="font-size: 7.5pt; color: #475569; margin-bottom: 2mm;">Dedicated turnkey solar PV system share for Flat ${flat.flatNo} at ${bldgName}.</div>

            <!-- Parameters -->
            <table class="pdf-table" style="margin-bottom: 2.5mm; font-size: 7.2pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
              <colgroup>
                <col style="width: 25%;">
                <col style="width: 25%;">
                <col style="width: 25%;">
                <col style="width: 25%;">
              </colgroup>
              <tbody>
                <tr>
                  <td style="width: 25%; background: #f8fafc; font-weight: 700;">Resident Name</td>
                  <td style="width: 25%;"><span class="editable-field">${flat.customerName}</span></td>
                  <td style="width: 25%; background: #f8fafc; font-weight: 700;">Flat Number</td>
                  <td style="width: 25%; font-weight: 700;"><span class="editable-field">${flat.flatNo}</span></td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; font-weight: 700;">Sanctioned Load</td>
                  <td><span class="editable-field">${flat.sanctionedLoad} kW</span> (${flat.phase || "1-phase"})</td>
                  <td style="background: #f8fafc; font-weight: 700;">Consumer Category</td>
                  <td><span class="editable-field">${flat.category || "LT-I Residential"}</span></td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; font-weight: 700;">Monthly Units</td>
                  <td><span class="editable-field">${flat.monthlyUnits}</span> kWh / mo</td>
                  <td style="background: #f8fafc; font-weight: 700;">Baseline Bill</td>
                  <td><span class="editable-field">${formatCurrency(flat.monthlyBill)}</span></td>
                </tr>
                <tr style="background: #f0f9ff;">
                  <td style="font-weight: 700; color: #0284c7;">Allocated Solar PV</td>
                  <td style="font-weight: 700; color: #0284c7;"><span class="editable-field">${(flat.allocatedKw || 0).toFixed(2)} kWp</span> (${flat.panels} Modules)</td>
                  <td style="font-weight: 700;">Monthly Solar Gen</td>
                  <td><span class="editable-field">${flat.monthlyGeneration}</span> kWh / mo</td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; font-weight: 700;">Dedicated Inverter</td>
                  <td colspan="3"><span class="editable-field" style="color: #0284c7; font-weight: 700;">${flat.inverterModel || "Dedicated Solar Inverter"}</span> (${flat.inverterPhase || flat.phase || "1-phase"}) — 8-Year Replacement Warranty</td>
                </tr>
              </tbody>
            </table>

            <!-- Bill Comparison -->
            <div style="font-size: 8pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">ELECTRICITY BILL COMPARISON: BEFORE VS AFTER SOLAR</div>
            <table class="pdf-table" style="font-size: 7.2pt; margin-bottom: 2.5mm; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
              <colgroup>
                <col style="width: 31%;">
                <col style="width: 23%;">
                <col style="width: 23%;">
                <col style="width: 23%;">
              </colgroup>
              <thead>
                <tr style="background-color: #63923e; color: white;">
                  <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm 2mm; border-color: #4d7c2a;">Bill Parameter</th>
                  <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm 2mm; text-align: center; border-color: #4d7c2a;">Without Solar</th>
                  <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm 2mm; text-align: center; border-color: #4d7c2a;">With Rooftop Solar</th>
                  <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm 2mm; text-align: right; border-color: #4d7c2a;">Monthly Benefit</th>
                </tr>
              </thead>
              <tbody>
                <tr style="text-align: center;">
                  <td style="text-align: left;">Units Billed</td>
                  <td><span class="editable-field">${flat.monthlyUnits}</span> units</td>
                  <td><span class="editable-field">${Math.max(0, flat.monthlyUnits - flat.monthlyGeneration)}</span> units</td>
                  <td style="color: #15803d; font-weight: bold; text-align: right;">Offset <span class="editable-field">${Math.min(flat.monthlyUnits, flat.monthlyGeneration)}</span> units</td>
                </tr>
                <tr style="text-align: center;">
                  <td style="text-align: left;">Fixed Charges</td>
                  <td>Rs 130</td>
                  <td>Rs 130</td>
                  <td style="text-align: right;">Rs 0 (Mandatory Grid Charge)</td>
                </tr>
                <tr style="text-align: center;">
                  <td style="text-align: left;">Energy Charges</td>
                  <td><span class="editable-field">${formatCurrency(flat.energyCharge || (flat.monthlyBill - 130 - 300))}</span></td>
                  <td><span class="editable-field">${formatCurrency(Math.max(0, flat.monthlyBill - flat.monthlySavings - 130))}</span></td>
                  <td style="color: #15803d; font-weight: bold; text-align: right;"><span class="editable-field">${formatCurrency(flat.monthlySavings)}</span></td>
                </tr>
                <tr style="background: #f0fdf4; font-weight: bold; text-align: center;">
                  <td style="text-align: left;">Net Monthly Payable</td>
                  <td><span class="editable-field">${formatCurrency(flat.monthlyBill)}</span></td>
                  <td><span class="editable-field">${formatCurrency(flat.postSolarBill)}</span></td>
                  <td style="color: #15803d; text-align: right;"><span class="editable-field">${formatCurrency(flat.monthlySavings)}</span></td>
                </tr>
              </tbody>
            </table>

            <!-- Investment Breakdown -->
            <div style="font-size: 8pt; font-weight: 700; color: #63923e; margin-bottom: 1mm;">INVESTMENT &amp; PM SURYA GHAR SUBSIDY BREAKDOWN</div>
            <table class="pdf-table" style="font-size: 7.2pt; margin-bottom: 2.5mm; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
              <colgroup>
                <col style="width: 35%;">
                <col style="width: 25%;">
                <col style="width: 40%;">
              </colgroup>
              <tbody>
                <tr>
                  <td style="width: 35%; background: #f8fafc; font-weight: 700;">Turnkey Gross Cost Share</td>
                  <td style="width: 25%; font-weight: 700;"><span class="editable-field">${formatCurrency(flat.grossCost)}</span></td>
                  <td style="color: #64748b; font-size: 6.8pt;">Proportional share of building solar EPC delivery</td>
                </tr>
                <tr style="background: #f0fdf4;">
                  <td style="font-weight: 700; color: #15803d;">PM Surya Ghar Subsidy</td>
                  <td style="font-weight: 700; color: #15803d;"><span class="editable-field">${formatCurrency(flat.subsidy)}</span></td>
                  <td style="color: #15803d; font-size: 6.8pt;">${subsidyExplanation}</td>
                </tr>
                <tr style="background: #f0f9ff;">
                  <td style="font-weight: 700; color: #0284c7;">Net Payable by Resident</td>
                  <td style="font-weight: 700; color: #0284c7;"><span class="editable-field">${formatCurrency(flat.netCost)}</span></td>
                  <td style="color: #0284c7; font-size: 6.8pt;">Gross cost minus direct central subsidy credit</td>
                </tr>
                <tr>
                  <td style="background: #f8fafc; font-weight: 700;">Estimated Payback Period</td>
                  <td><strong><span class="editable-field">${Number(flat.paybackYears || 0).toFixed(1)}</span> Years</strong></td>
                  <td style="color: #64748b; font-size: 6.8pt;">Based on annual bill offset savings</td>
                </tr>
              </tbody>
            </table>

            ${flat.loanMode && flat.financing ? `
              <div style="font-size: 8pt; font-weight: 700; color: #0284c7; margin-bottom: 1mm;">Solar Loan Financing Option (Nationalized Bank Tie-up)</div>
              <table class="pdf-table" style="font-size: 7.2pt; margin-bottom: 2.5mm; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
                <colgroup>
                  <col style="width: 35%;">
                  <col style="width: 25%;">
                  <col style="width: 40%;">
                </colgroup>
                <tbody>
                  <tr>
                    <td style="width: 35%; background: #f0f9ff; font-weight: 700;">Customer Down Payment (${dpPct}%)</td>
                    <td style="width: 25%;"><span class="editable-field">${formatCurrency(flat.financing.downPayment || (flat.netCost * (dpPct / 100)))}</span></td>
                    <td style="color: #64748b; font-size: 6.8pt;">Initial upfront customer investment</td>
                  </tr>
                  <tr>
                    <td style="background: #f0f9ff; font-weight: 700;">Bank Loan Principal (${100 - dpPct}%)</td>
                    <td><strong><span class="editable-field">${formatCurrency(flat.financing.principal || (flat.netCost * ((100 - dpPct) / 100)))}</span></strong></td>
                    <td style="color: #64748b; font-size: 6.8pt;">Financed by SBI / Canara Bank / Bank of Maharashtra</td>
                  </tr>
                  <tr>
                    <td style="background: #f0f9ff; font-weight: 700;">Estimated Monthly EMI</td>
                    <td style="color: #0284c7; font-weight: 700;"><span class="editable-field">${formatCurrency(flat.financing.monthlyEmi || Math.round(flat.monthlySavings * 0.85))} / mo</span></td>
                    <td style="color: #0284c7; font-size: 6.8pt;">Flexible 5-year repayment tenure</td>
                  </tr>
                </tbody>
              </table>
            ` : ""}

            <!-- Warranties -->
            <div class="pdf-card" style="background: #ffffff; border: 1px solid #e2e8f0; padding: 2mm 3mm;">
              <div style="font-size: 7.5pt; font-weight: 700; color: #0f172a; margin-bottom: 1mm;">WARRANTIES &amp; TURNKEY SCOPE OF DELIVERY</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 3mm; font-size: 6.8pt; color: #475569;">
                <div>✓ <strong>Solar Modules:</strong> 25-Year Linear Performance Warranty</div>
                <div>✓ <strong>Inverter:</strong> 8-Year Comprehensive Replacement Warranty</div>
                <div>✓ <strong>Structure:</strong> 25-Year Hot-dip Galvanization Warranty</div>
                <div>✓ <strong>Safety:</strong> 16 mm and 14 mm copper bonded earthing electrode rods</div>
                <div style="grid-column: 1 / -1;">✓ <strong>Turnkey Scope:</strong> Supply, Structural Mounting, Wiring, MSEDCL Net Metering &amp; Commissioning</div>
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
 * Build Single Customer Sample PDF Pages matching PDF 2 (the official proposal)
 */
export function buildSingleSamplePdfPages(estimates, selectedOption, hideFlags = {}) {
  const { input = {}, sanctionedStatus = {} } = estimates || {};
  const option = selectedOption || estimates?.recommended || {};
  const fin = option.financing || {};
  const isLoan = !hideFlags.hideFinancing && (option.financing && option.financing.paymentMode === "loan");

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
    hideFlags.customerAddress ||
    input.customerAddress ||
    (typeof document !== "undefined" && document.getElementById("proposalToCustomerAddress")?.textContent) ||
    "Pune, Maharashtra";

  const customerPhone =
    input.customerPhone ||
    input.mobileNumber ||
    (typeof document !== "undefined" && document.getElementById("proposalToCustomerPhone")?.textContent) ||
    "—";

  const proposalDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const showCadDiagram = hideFlags.showCadDiagram !== undefined
    ? Boolean(hideFlags.showCadDiagram)
    : (hideFlags.hideCadDiagram !== undefined
        ? !hideFlags.hideCadDiagram
        : (typeof document !== "undefined" ? document.getElementById("showCadDiagram")?.checked !== false : true));
  const hidePayback = Boolean(hideFlags.hidePayback || hideFlags.hideCost);
  const hideAreaFit = Boolean(hideFlags.hideAreaFit);
  const hideSubsidy = Boolean(hideFlags.hideSubsidy);
  const hideCost = Boolean(hideFlags.hideCost);
  const solarInstalled = Boolean(hideFlags.solarInstalled);
  const effectiveIsLoan = isLoan && !hideCost;

  // CAD Blueprint canvas snapshot & live CAD metrics (capture only when CAD section is included)
  const cadSnapshot = showCadDiagram ? captureCadSnapshotForSample() : { cad: null, dataUrl: null };
  const cad = cadSnapshot.cad;
  const cadCanvasDataUrl = cadSnapshot.dataUrl;

  // Active panel specification text
  const panelLayout = estimates?.panelLayout || {};
  const panelSpecText =
    option.panelSpec ||
    input.panelSpec ||
    getPanelSpecificationText(
      input.panelType || option.panelType || "dcr",
      input.panelSpecCustom,
      panelLayout.panelWp || 550
    ) || "Tier-1 DCR Mono PERC / TOPCon (550 Wp)";

  const numPanels = panelLayout.numPanels || Math.round(((option.dcCapacityKw || 4.4) * 1000) / (panelLayout.panelWp || 550));
  const panelAreaSqft = panelLayout.totalAreaSqft || Math.round(numPanels * 27.5);
  const roofArea = input.roofArea || 2856;
  const roofL = input.roofLength || (typeof document !== "undefined" && document.getElementById("roofLength")?.value) || (typeof document !== "undefined" && document.getElementById("cadRoofLength")?.value) || 68;
  const roofB = input.roofBreadth || (typeof document !== "undefined" && document.getElementById("roofBreadth")?.value) || (typeof document !== "undefined" && document.getElementById("cadRoofBreadth")?.value) || 42;
  const bldgHeight = input.buildingHeight || (typeof document !== "undefined" && document.getElementById("buildingHeight")?.value) || (typeof document !== "undefined" && document.getElementById("cadBuildingHeightInput")?.value) || 18;
  const northAngle = input.northAngle || (typeof document !== "undefined" && document.getElementById("northAngle")?.value) || (typeof document !== "undefined" && document.getElementById("cadNorthAngleInput")?.value) || 0;

  const cadStats = cad && typeof cad.getAreaStats === "function" ? cad.getAreaStats() : null;
  const cadRoofL = (cad && cad.roofLengthFt) || roofL;
  const cadRoofB = (cad && cad.roofBreadthFt) || roofB;
  const cadGrossSqft = cadStats ? cadStats.grossSqft : Math.round(Number(cadRoofL) * Number(cadRoofB));
  const cadNetSqft = cadStats ? cadStats.netUsableSqft : roofArea;
  const placedPanelsCount = cad && Array.isArray(cad.panels) ? cad.panels.length : numPanels;
  const reqPanelsCount = (cad && cad.requiredPanels) ? cad.requiredPanels : numPanels;
  const cadNorthAngle = (cad && cad.northAngleDeg !== undefined) ? cad.northAngleDeg : northAngle;
  const cadBldgHeight = (cad && cad.buildingHeightFt !== undefined) ? cad.buildingHeightFt : bldgHeight;
  const cadShadingStr = (cad && cad.sunSim?.enabled && typeof cad.getShadingLossStats === "function")
    ? `${(cad.getShadingLossStats()?.lossPercent || 0).toFixed(1)}% Solar Shading Loss`
    : "0.0% Solar Shading Loss";

  // Bill comparison figures
  const curBill = option.currentBillBreakdown || {};
  const postBill = option.postSolarBillBreakdown || {};
  const curFixed = curBill.fixedCharge ?? 130;
  const curEnergy = curBill.energyCharge ?? 4738;
  const curWheeling = curBill.wheelingCharge ?? (curBill.wheelingFac ?? 0);
  const curDuty = curBill.duty ?? 332;
  const curTotal = curBill.total ?? input.monthlyBill ?? 5200;

  const postSolarGen = option.monthlyGeneration ?? postBill.solarGeneration ?? 465;
  const postBanked = postBill.bankedUnits ?? Math.max(0, postSolarGen - (input.monthlyUnits || 450));
  const postFixed = postBill.fixedCharge ?? curFixed;
  const postEnergy = postBill.energyCharge ?? 0;
  const postNetPayable = postBill.netPayable ?? postFixed;
  const postMonthlySavings = option.monthlySavings ?? postBill.monthlySavings ?? 5070;
  const postAnnualSavings = option.annualSavings ?? postBill.annualSavings ?? (postMonthlySavings * 12);

  const dailyGenKwh = option.dailyGeneration !== undefined
    ? option.dailyGeneration
    : Math.round(((postSolarGen || 0) / 30) * 10) / 10;
  const monthlyGenKwh = postSolarGen;
  const dailyPerKw = option.dcCapacityKw > 0 ? (dailyGenKwh / option.dcCapacityKw).toFixed(2) : "4.49";
  const monthlyPerKw = option.dcCapacityKw > 0 ? (monthlyGenKwh / option.dcCapacityKw).toFixed(1) : "135.2";

  let mainInverterPrefix = "On-grid";
  if (option.systemType === "hybrid") mainInverterPrefix = "Hybrid";
  if (option.systemType === "offgrid") mainInverterPrefix = "Off-grid";

  const inverterCapacityDisplay = option.inverterModel
    ? `${option.inverterCapacityKw || option.dcCapacityKw || 2.36} kW (${option.inverterModel})`
    : `${option.inverterCapacityKw || option.dcCapacityKw || 2.36} kW`;
  const inverterWarrantySpec = option.inverterModel
    ? `${option.inverterModel} (Grid-Tied IP65)`
    : "Grid-Tied Solar Inverter (IP65)";

  // Dynamic section numbers & page counts (CAD Layout optional, Financing optional)
  let nextSectionNum = 2;
  const cadSectionNum = showCadDiagram ? nextSectionNum++ : null;
  const quoteSectionNum = nextSectionNum++;
  const loanSectionNum = effectiveIsLoan ? nextSectionNum++ : null;
  const warrantySectionNum = nextSectionNum++;
  const sysTypesSectionNum = nextSectionNum++;

  const totalPages = 5 + (showCadDiagram ? 1 : 0) + (effectiveIsLoan ? 2 : 0);
  let currentPageNum = 1;
  const pages = [];

  const createPageHeader = (pageTitle = "Solar System Proposal", subTitle = "") => `
    <div class="pdf-page-header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energy.png" onerror="this.src='logo.png'" alt="DC Energy" style="height: 32px; width: auto; object-fit: contain;">
        <div>
          <div class="pdf-company-title">DATLION CNERGY</div>
          <div class="pdf-company-sub">SOLAR EPC &amp; CLEAN ENERGY SOLUTIONS</div>
        </div>
      </div>
      <div class="pdf-header-right">
        <div class="pdf-doc-title editable-field">${pageTitle}</div>
        ${subTitle ? `<div class="pdf-doc-meta editable-field" style="font-size: 7.2pt; color: #64748b;">${subTitle}</div>` : ""}
        <div class="pdf-doc-meta">Ref: <span class="editable-field">${proposalSerialNo}</span></div>
      </div>
    </div>
  `;

  const createPageFooter = (pageNum, total) => `
    <div class="pdf-page-footer">
      <div class="pdf-footer-left">www.cnergy.co.in</div>
      <div class="pdf-footer-center">Page ${pageNum} of ${total} &nbsp;|&nbsp; Ref: ${proposalSerialNo}</div>
      <div class="pdf-footer-right">
        <div style="font-weight: 700; color: #1e293b;">DATLION CNERGY PRIVATE LIMITED</div>
        <div style="font-size: 7pt; color: #64748b;">GSTIN: 27AALCD8550A1ZP | Pune</div>
      </div>
    </div>
  `;

  // ==========================================
  // PAGE 1: 1. System Design Considerations
  // ==========================================
  const areaFitLabel = panelLayout.fitsInArea === false
    ? `No - needs ${Math.max(0, (panelAreaSqft || 0) - (roofArea || 0))} sq ft more`
    : `Yes - fits in ${roofArea} sq ft`;
  const page1Num = currentPageNum++;
  const page1Content = `
    <div class="pdf-sample-page" data-page-index="${page1Num}">
      ${createPageHeader("Solar System Proposal", "Turnkey Solar PV Installation Proposal")}
      <div class="pdf-page-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2mm; font-size: 8pt;">
          <div style="color: #63923e; font-weight: 700;">PROPOSAL REF: <span class="editable-field">${proposalSerialNo}</span></div>
          <div style="color: #64748b;">DATE: <span class="editable-field">${proposalDate}</span></div>
        </div>

        <div class="pdf-grid-2" style="margin-bottom: 3.5mm;">
          <div class="pdf-card pdf-card-from" style="padding: 3mm 4mm;">
            <div class="pdf-card-badge green" style="color: #63923e; font-size: 7.5pt; font-weight: 700;">PROPOSAL FROM (SOLAR EPC):</div>
            <div class="pdf-card-name" style="font-size: 9pt; font-weight: 700; color: #000000; margin-bottom: 1.2mm;">DATLION CNERGY PRIVATE LIMITED</div>
            <p class="pdf-card-address" style="font-size: 7.2pt; color: #475569; line-height: 1.35; margin-bottom: 1.5mm;">
              Ground, Shed No. 1, Shashitara Pratishthan BJP Office, Late Narayanrao Kondiba Jagtap Path, Hingne Khurd, Pune, 411051
            </p>
            <div class="pdf-card-contact" style="font-size: 7.2pt; line-height: 1.35;">
              <div style="font-weight: 700; color: #000000;">GSTIN: 27AALCD8550A1ZP</div>
              <div style="color: #64748b;">Email: datlioncnergy@gmail.com</div>
              <div style="color: #64748b;">Phone: +91 8956340980 | www.cnergy.co.in</div>
            </div>
          </div>
          <div class="pdf-card pdf-card-to" style="padding: 3mm 4mm; background: #f0fdf4; border-color: #bbf7d0;">
            <div class="pdf-card-badge green" style="color: #63923e; font-size: 7.5pt; font-weight: 700;">PREPARED FOR (VALUED CLIENT):</div>
            <div class="pdf-card-name editable-field" style="font-size: 9pt; font-weight: 700; color: #000000; margin-bottom: 1.2mm;">${customerName}</div>
            <p class="pdf-card-address editable-field" style="font-size: 7.2pt; color: #475569; line-height: 1.35; margin-bottom: 1.5mm;">
              Site Address: ${customerAddress}
            </p>
            <div class="pdf-card-contact" style="font-size: 7.2pt; line-height: 1.35;">
              <div style="color: #64748b;">Phone: <span class="editable-field">${customerPhone}</span></div>
              <div style="color: #334155;">Sanctioned Load: <span class="editable-field">${input.sanctionedLoad || 5} kW</span> | Category: <span class="editable-field">${input.consumerCategory || "LT-I"}</span></div>
              <div style="color: #334155;">Monthly Usage: <span class="editable-field">${input.monthlyUnits || 450} units</span> | Avg Bill: <span class="editable-field">${formatCurrency(curTotal)}</span></div>
              <div style="color: #334155;">Usable Roof Area: <span class="editable-field">${roofArea} sq ft</span></div>
            </div>
          </div>
        </div>

        <div class="pdf-section-title" style="font-size: 13pt; margin-top: 2.5mm; margin-bottom: 2mm;">1. System Design Considerations &amp; Capacity Summary</div>
        <div style="font-size: 8pt; color: #64748b; margin-bottom: 1.5mm;">Orientation: <span class="editable-field">${input.orientationDir || "South"}</span></div>
        <div style="font-size: 10pt; font-weight: 700; color: #63923e; margin-bottom: 2.5mm;">Selected System: <span class="editable-field">${formatSysType(option.systemType)} (${option.dcCapacityKw || 2.36} kWp)</span></div>

        <!-- Table 1: Capacity Requirements -->
        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-bottom: 1.2mm;">Capacity Requirements</div>
        <table class="pdf-table" style="margin-bottom: 3.5mm; font-size: 8pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 45%;">
            <col style="width: 55%;">
          </colgroup>
          <tbody>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Required by Consumption</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${option.sizing?.byConsumptionKw || 2.2} kW</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Supported by Roof Area</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${option.sizing?.byAreaKw || 40.7} kW</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Sanctioned Load Limit</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${option.sizing?.byLoadKw ? `${option.sizing.byLoadKw} kW` : (input.sanctionedLoad ? `${input.sanctionedLoad} kW` : "N/A")}</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">${solarInstalled ? "Installed Solar Capacity" : "Recommended Solar Capacity"}</td><td style="padding: 1.8mm 2.5mm;"><strong><span class="editable-field">${option.dcCapacityKw || 2.36} kWp</span></strong></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Daily Solar Generation</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${dailyGenKwh} kWh (${dailyPerKw} kWh/kW)</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Monthly Solar Generation</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${monthlyGenKwh} kWh (${monthlyPerKw} kWh/kW)</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Sanction Status</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${sanctionedStatus.label || "Within sanctioned load"}</span></td></tr>
          </tbody>
        </table>

        <!-- Table 2: Panel Configuration -->
        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-bottom: 1.2mm;">Panel Configuration</div>
        <table class="pdf-table" style="margin-bottom: 3.5mm; font-size: 8pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 45%;">
            <col style="width: 55%;">
          </colgroup>
          <tbody>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Panel Specification</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${panelLayout.panelDimensions || "1123 × 2279 mm"} (${panelLayout.panelWp || 550} Wp each) · ${panelSpecText}</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Number of Panels</td><td style="padding: 1.8mm 2.5mm;"><strong><span class="editable-field">${numPanels} panels</span></strong></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Total Area Required</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${panelAreaSqft} sq ft (${Math.round(panelAreaSqft * 0.0929)} sq m)</span></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Available Installation Area</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${roofArea} sq ft</span></td></tr>
            ${!hideAreaFit ? `<tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Fits in Available Area</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${areaFitLabel}</span></td></tr>` : ""}
          </tbody>
        </table>

        <!-- Table 3: Battery and Inverter Specifications -->
        <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-bottom: 1.2mm;">Battery and Inverter Specifications</div>
        <table class="pdf-table" style="margin-bottom: 3.5mm; font-size: 8pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 45%;">
            <col style="width: 55%;">
          </colgroup>
          <tbody>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">${mainInverterPrefix} Inverter Capacity</td><td style="padding: 1.8mm 2.5mm;"><strong><span class="editable-field">${inverterCapacityDisplay}</span></strong></td></tr>
            <tr><td style="background: #eef3ec; font-weight: 700; padding: 1.8mm 2.5mm;">Battery Capacity</td><td style="padding: 1.8mm 2.5mm;"><span class="editable-field">${option.batteryCapacityKwh > 0 ? `${option.batteryCapacityKwh} kWh` : "No battery (Grid-tied system)"}</span></td></tr>
          </tbody>
        </table>

        <!-- Pill Note -->
        <div class="pdf-highlight-box green" style="padding: 2.8mm 3.5mm; font-size: 7.5pt; line-height: 1.35; margin-bottom: 0;">
          • <strong>Design &amp; Generation Note:</strong> Simulated yield based on NASA/Meteonorm irradiance data. Actual output varies with weather, grid uptime, and routine soft-water module washing.
        </div>
      </div>
      ${createPageFooter(page1Num, totalPages)}
    </div>
  `;
  pages.push(page1Content);

  // ==========================================
  // OPTIONAL PAGE: Rooftop Layout & Solar Array CAD Plan
  // ==========================================
  if (showCadDiagram) {
    const cadPageNum = currentPageNum++;
    const page2Content = `
      <div class="pdf-sample-page" data-page-index="${cadPageNum}">
        ${createPageHeader("Rooftop Layout & CAD Blueprint")}
        <div class="pdf-page-body">
          <div class="pdf-section-title">${cadSectionNum}. Rooftop Layout &amp; Solar Array CAD Plan</div>
          <p class="pdf-paragraph" style="font-size: 8pt; color: #475569; margin-bottom: 2mm;">
            Dimensioned rooftop architectural layout, module placement, maintenance pathways, and shadow obstruction analysis.
          </p>

          <!-- CAD Graphic Container -->
          <div style="text-align: center; margin-bottom: 4mm; background: #0f172a; border-radius: 4px; padding: 3mm; height: 125mm; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
            ${cadCanvasDataUrl ? `<img src="${cadCanvasDataUrl}" alt="CAD Rooftop Layout Blueprint" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 2px;">` : `<div style="color: #94a3b8; font-size: 9pt;">CAD Aerial Blueprint Diagram (Active in Canvas)</div>`}
          </div>

          <!-- CAD Specifications Table -->
          <table class="pdf-table" style="margin-bottom: 4mm; font-size: 7.8pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
            <colgroup>
              <col style="width: 40%;">
              <col style="width: 60%;">
            </colgroup>
            <tbody>
              <tr><td style="background: #eef3ec; font-weight: 700; padding: 2mm 3mm;">Roof Dimensions</td><td style="padding: 2mm 3mm;"><span class="editable-field">${cadRoofL} ft × ${cadRoofB} ft (${cadGrossSqft} sq ft)</span></td></tr>
              <tr><td style="background: #eef3ec; font-weight: 700; padding: 2mm 3mm;">Net Usable Roof Space</td><td style="padding: 2mm 3mm;"><span class="editable-field">${cadNetSqft} sq ft (${(cadNetSqft * 0.0929).toFixed(1)} sq m)</span></td></tr>
              <tr><td style="background: #eef3ec; font-weight: 700; padding: 2mm 3mm;">Solar Module Placement</td><td style="padding: 2mm 3mm;"><strong><span class="editable-field">${placedPanelsCount} / ${reqPanelsCount} Modules Placed (${placedPanelsCount >= reqPanelsCount ? "Complete Array" : `${reqPanelsCount - placedPanelsCount} Latent`})</span></strong></td></tr>
              <tr><td style="background: #eef3ec; font-weight: 700; padding: 2mm 3mm;">Orientation &amp; True North</td><td style="padding: 2mm 3mm;"><span class="editable-field">${cadNorthAngle}° Azimuth (${cadNorthAngle === 0 ? "True North Aligned" : `${cadNorthAngle}° from North`}) | Height: ${cadBldgHeight} ft</span></td></tr>
              <tr><td style="background: #eef3ec; font-weight: 700; padding: 2mm 3mm;">Simulated Shading Impact</td><td style="padding: 2mm 3mm;"><span class="editable-field">${cadShadingStr} (Astronomical solar trajectory &amp; obstacle model)</span></td></tr>
            </tbody>
          </table>

          <!-- Pill Note -->
          <div class="pdf-highlight-box green" style="padding: 3mm 4mm; font-size: 7.5pt; line-height: 1.45; margin-bottom: 0;">
            • <strong>Structural &amp; Layout Note:</strong> Rooftop CAD array layout is preliminary and subject to minor adjustments during physical installation. The client warrants that the roof slab possesses adequate structural load-bearing capacity; roof waterproofing and sealing integrity remain the client's sole responsibility.
          </div>
        </div>
        ${createPageFooter(cadPageNum, totalPages)}
      </div>
    `;
    pages.push(page2Content);
  }

  // ==========================================
  // PAGE: Financial Quote & Scope of Work (or Scope Only if hideCost)
  // ==========================================
  const sowItems = getScopeOfWorkItems(option, input);
  const midPoint = Math.ceil(sowItems.length / 2);
  const sowCol1 = sowItems.slice(0, midPoint);
  const sowCol2 = sowItems.slice(midPoint);
  const quotePageNum = currentPageNum++;

  const page3Content = `
    <div class="pdf-sample-page" data-page-index="${quotePageNum}">
      ${createPageHeader(hideCost ? "Scope of Work & System Inclusions" : "Financial Quote & Scope of Work")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">${quoteSectionNum}. ${hideCost ? "Scope of Work &amp; System Inclusions" : "Financial Quote &amp; Scope of Work"}</div>
        <div style="font-size: 9.5pt; font-weight: 700; color: #63923e; margin-bottom: 2mm;">
          Selected Option: <span class="editable-field">${formatSysType(option.systemType)} (${option.dcCapacityKw || 2.36} kWp)</span>
        </div>

        <!-- Scope of Work Box -->
        <div class="pdf-card" style="margin-bottom: 2.5mm; padding: 2.5mm 3.5mm; background: #f8fafc;">
          <div style="font-weight: 700; font-size: 8pt; color: #0f172a; margin-bottom: 1.5mm;">Scope of Work (Turnkey EPC Delivery):</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 4mm; font-size: 7.2pt; color: #334155;">
            <div>${sowCol1.map(item => `<div>• <span class="editable-field">${item}</span></div>`).join("")}</div>
            <div>${sowCol2.map(item => `<div>• <span class="editable-field">${item}</span></div>`).join("")}</div>
          </div>
        </div>

        <!-- 3 Highlighted Notes -->
        <div style="display: flex; flex-direction: column; gap: 1.5mm; margin-bottom: 2.5mm;">
          <div class="pdf-highlight-box green" style="padding: 1.5mm 3mm; margin: 0; font-size: 7.2pt; font-weight: 700;">• Note: All of the above are in line with MNRE guidelines (100% DCR ALMM modules; elevated structures with ≥ 8 ft clearance).</div>
          <div class="pdf-highlight-box yellow" style="padding: 1.5mm 3mm; margin: 0; font-size: 7.2pt; font-weight: 700;">• Note: Cabling/wiring charges will be at actual length of DC and AC cabling required.</div>
          <div class="pdf-highlight-box blue" style="padding: 1.5mm 3mm; margin: 0; font-size: 7.2pt; font-weight: 700;">• Note: MSEDCL Net Metering Liaisoning &amp; Discom Documentation Support charges at actuals (Systems ≤ 10 kW enjoy deemed feasibility).</div>
        </div>

        ${!hideCost ? `
        <!-- Commercial Summary Plain Lines -->
        <table class="pdf-plain-table" style="width: 100%; margin-bottom: 1.5mm; font-size: 7.8pt; border-collapse: collapse;">
          <tbody>
            <tr>
              <td style="padding: 1mm 0;"><strong>Total System Cost (Inc. GST) (as payable to Datlion Cnergy Pvt. Ltd.)</strong></td>
              <td style="text-align: right; font-weight: 700;"><span class="editable-field">${formatCurrency(option.totalPreSubsidy)}</span></td>
            </tr>
            ${!hideSubsidy && (option.subsidy || 0) > 0 ? `
            <tr>
              <td style="padding: 1mm 0; color: #15803d; font-weight: 700;">${(input.meters && Array.isArray(input.meters) && input.meters.length > 1) ? `Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account across ${input.meters.length} flats)` : "Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account)"}</td>
              <td style="text-align: right; color: #15803d; font-weight: 700;"><span class="editable-field">- ${formatCurrency(option.subsidy)}</span></td>
            </tr>` : ""}
            <tr style="border-top: 1px solid #cbd5e1;">
              <td style="padding: 1.5mm 0; font-weight: 800; font-size: 8.5pt;">Net Payable Cost to customer</td>
              <td style="text-align: right; font-weight: 800; font-size: 8.5pt;"><span class="editable-field">${formatCurrency((hideSubsidy || !(option.subsidy > 0)) ? option.totalPreSubsidy : Math.max(0, (option.totalPreSubsidy || 0) - (option.subsidy || 0)))}</span></td>
            </tr>
          </tbody>
        </table>
        <div style="font-size: 6.8pt; font-style: italic; color: #64748b; line-height: 1.35; margin-bottom: 2.5mm;">
          <div>* GST: 70% goods @ 5% + 30% services @ 18% = 8.9% effective rate.</div>
          <div>* Quotation validity: 15 days. Full contract value is payable to Datlion Cnergy Pvt. Ltd. regardless of central subsidy disbursement.</div>
        </div>` : ""}

        <!-- Side-by-Side MSEDCL Electricity Bill Comparison -->
        <div style="font-weight: 700; font-size: 8.2pt; color: #0f172a; margin-bottom: 1.5mm;">MSEDCL Electricity Bill Comparison &amp; Projected Savings:</div>
        <div class="pdf-grid-2" style="margin-bottom: 2.5mm; display: flex; gap: 3.5mm; width: 100%; box-sizing: border-box;">
          <!-- Left: Current Bill Before Solar -->
          <div style="flex: 1 1 0; min-width: 0; box-sizing: border-box;">
            <table class="pdf-table" style="margin-bottom: 0; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
              <colgroup>
                <col style="width: 60%;">
                <col style="width: 40%;">
              </colgroup>
              <thead>
                <tr style="background-color: #334155; color: white;">
                  <th style="background-color: #334155 !important; color: #ffffff !important; padding: 1.5mm 2mm; font-size: 7.2pt; width: 60%; border-color: #1e293b;">Current MSEDCL Bill (Before Solar)</th>
                  <th style="background-color: #334155 !important; color: #ffffff !important; text-align: right; padding: 1.5mm 2mm; width: 40%; font-size: 7.2pt; border-color: #1e293b;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style="padding: 1.3mm 2mm; width: 60%;">Units Consumed</td><td style="padding: 1.3mm 2mm; text-align: right; width: 40%;"><strong>${input.monthlyUnits || 450} kWh</strong></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Fixed Charges</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curFixed)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Energy Charges</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curEnergy)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Wheeling Charges</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curWheeling)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Fuel Adjustment (FAC)</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curBill.facCharge || 0)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Electricity Duty</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curDuty)}</span></td></tr>
                <tr style="background: #f8fafc; font-weight: 700;"><td style="padding: 1.3mm 2mm;">Total Current Bill</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curTotal)}</span></td></tr>
                <tr style="background: #fee2e2; font-weight: 800; color: #b91c1c;"><td style="padding: 1.3mm 2mm;">Net Bill Payable</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(curTotal)}</span></td></tr>
              </tbody>
            </table>
          </div>

          <!-- Right: With Rooftop Solar -->
          <div style="flex: 1 1 0; min-width: 0; box-sizing: border-box;">
            <table class="pdf-table" style="margin-bottom: 0; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
              <colgroup>
                <col style="width: 60%;">
                <col style="width: 40%;">
              </colgroup>
              <thead>
                <tr style="background-color: #63923e; color: white;">
                  <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm 2mm; font-size: 7.2pt; width: 60%; border-color: #4d7c2a;">With Rooftop Solar (After Solar)</th>
                  <th style="background-color: #63923e !important; color: #ffffff !important; text-align: right; padding: 1.5mm 2mm; width: 40%; font-size: 7.2pt; border-color: #4d7c2a;">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style="padding: 1.3mm 2mm; width: 60%;">Solar Generation</td><td style="padding: 1.3mm 2mm; text-align: right; width: 40%;"><strong>${postSolarGen} kWh</strong></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Banked Solar Units</td><td style="padding: 1.3mm 2mm; text-align: right; width: 40%;"><strong>${postBanked} kWh</strong></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Fixed Charges</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(postFixed)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Energy Charges</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(postEnergy)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Wheeling Charges</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(postBill.wheelingCharge || 0)}</span></td></tr>
                <tr><td style="padding: 1.3mm 2mm;">Electricity Duty</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(postBill.duty || 0)}</span></td></tr>
                <tr style="background: #f0fdf4; font-weight: 700; color: #166534;"><td style="padding: 1.3mm 2mm;">Net Bill Payable</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(postNetPayable)}</span></td></tr>
                <tr style="background: #dcfce7; font-weight: 800; color: #15803d;"><td style="padding: 1.3mm 2mm;">Net Monthly Savings</td><td style="padding: 1.3mm 2mm; text-align: right;"><span class="editable-field">${formatCurrency(postMonthlySavings)}/mo</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; gap: 8mm; margin-bottom: 1.5mm; font-size: 8.5pt;">
          ${!hidePayback ? `<div><strong>Estimated Payback Period:</strong> <span class="editable-field">${Number.isFinite(Number(option.paybackYears)) ? Number(option.paybackYears).toFixed(1) : "2.0"} Years</span></div>` : ""}
          <div><strong>25-Year Lifetime Savings:</strong> <strong class="editable-field" style="color: #63923e;">${formatCurrency(option.lifetimeSavings)}</strong></div>
        </div>
        <div style="font-size: 6.8pt; font-style: italic; color: #64748b;">
          * Note: Financial payback and bill savings projections are modeled on prevailing MSEDCL tariffs and MERC net metering regulations; subject to customer consumption patterns and grid availability.
        </div>
      </div>
      ${createPageFooter(quotePageNum, totalPages)}
    </div>
  `;
  pages.push(page3Content);

  // ==========================================
  // OPTIONAL PAGES: Bank Partner Loan Proposal (Only if loan active & cost visible)
  // ==========================================
  if (effectiveIsLoan) {
    const loanPage1Num = currentPageNum++;
    const downPaymentLabel = `Upfront Customer Payment (${fin.downPaymentPct !== undefined ? fin.downPaymentPct : 10}% Down Payment)`;
    const page4Content = `
      <div class="pdf-sample-page" data-page-index="${loanPage1Num}">
        ${createPageHeader("Bank Partner Loan Proposal")}
        <div class="pdf-page-body">
          <div class="pdf-section-title">${loanSectionNum}. Bank Partner Loan Proposal (For illustrative purposes only actual cost depends on actual loan rates)</div>
          <p class="pdf-paragraph" style="font-size: 8pt; color: #475569; margin-bottom: 2mm;">
            Convert your monthly electricity bill into an appreciating rooftop solar asset with zero incremental budget.
          </p>

          <!-- Hero Box -->
          <div class="pdf-card" style="background: #f2f8ee; border: 1px solid #63923e; padding: 2.5mm 3.5mm; margin-bottom: 3mm;">
            <div style="font-size: 8.5pt; font-weight: 700; color: #63923e; margin-bottom: 1mm;">Zero Out-of-Pocket Principle &amp; Strategic Capital Advantage</div>
            <div style="font-size: 7.5pt; color: #334155; line-height: 1.4;">
              ${fin.isZeroOutOfPocket
                ? `Instead of paying your current MSEDCL electricity bill of Rs ${formatCurrency(fin.targetBillAmount)}/mo, you redirect that exact amount as a bank EMI (${formatCurrency(fin.monthlyEmi)}/mo). You incur Rs 0 extra monthly burden, and in just ${fin.tenureFormatted}, the entire system is 100% free and fully owned, giving you free electricity for the next ${fin.freeElectricityYears} years!`
                : `Finance your solar plant with an affordable bank EMI of ${formatCurrency(fin.monthlyEmi)}/mo for ${fin.tenureFormatted}, after which you enjoy 100% free solar power for the remaining ${fin.freeElectricityYears} years of system life.`}
            </div>
          </div>

          <!-- 3 Mini KPI Cards -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 3mm;">
            <div class="pdf-card" style="padding: 2.5mm; text-align: center; background: #eef3ec;">
              <div style="font-size: 7pt; color: #64748b;">Monthly Installment (EMI)</div>
              <div style="font-size: 11pt; font-weight: 700; color: #63923e; margin: 1mm 0;"><span class="editable-field">${formatCurrency(fin.monthlyEmi)} / mo</span></div>
              <div style="font-size: 6.8pt; font-style: italic; color: #64748b;">(Matches electricity bill)</div>
            </div>
            <div class="pdf-card" style="padding: 2.5mm; text-align: center; background: #eef3ec;">
              <div style="font-size: 7pt; color: #64748b;">Loan Payoff Period</div>
              <div style="font-size: 11pt; font-weight: 700; color: #000000; margin: 1mm 0;"><span class="editable-field">${fin.tenureFormatted}</span></div>
              <div style="font-size: 6.8pt; font-style: italic; color: #64748b;">(Time to 100% free solar)</div>
            </div>
            <div class="pdf-card" style="padding: 2.5mm; text-align: center; background: #eef3ec;">
              <div style="font-size: 7pt; color: #64748b;">100% Free Electricity</div>
              <div style="font-size: 11pt; font-weight: 700; color: #63923e; margin: 1mm 0;"><span class="editable-field">${fin.freeElectricityYears} Years</span></div>
              <div style="font-size: 6.8pt; font-style: italic; color: #64748b;">(Post-loan generation)</div>
            </div>
          </div>

          <!-- Commercial Comparison Table -->
          <table class="pdf-table" style="margin-bottom: 3mm; font-size: 7.2pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
            <colgroup>
              <col style="width: 44%;">
              <col style="width: 28%;">
              <col style="width: 28%;">
            </colgroup>
            <thead>
              <tr style="background-color: #63923e; color: white;">
                <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm 2.5mm; border-color: #4d7c2a;">Commercial Feature</th>
                <th style="background-color: #63923e !important; color: #ffffff !important; text-align: right; padding: 1.5mm 2.5mm; border-color: #4d7c2a;">Option A: Upfront Cash</th>
                <th style="background-color: #63923e !important; color: #ffffff !important; text-align: right; padding: 1.5mm 2.5mm; font-weight: bold; border-color: #4d7c2a;">Option B: Bank Loan (Zero Out-of-Pocket)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>${downPaymentLabel}</td><td style="text-align: right;"><span class="editable-field">${formatCurrency(fin.totalPreSubsidy)}</span></td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${formatCurrency(fin.downPayment)}</span></td></tr>
              <tr><td>Loan Principal Amount (Bank Funded)</td><td style="text-align: right;">-</td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${formatCurrency(fin.principal)}</span></td></tr>
              <tr><td>Bank Partner Interest Rate</td><td style="text-align: right;">-</td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${fin.interestRatePct}% p.a.</span></td></tr>
              <tr><td>Monthly Installment (EMI)</td><td style="text-align: right;">Rs 0 / mo</td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${formatCurrency(fin.monthlyEmi)} / mo</span></td></tr>
              <tr><td>Loan Repayment Period (Payoff Duration)</td><td style="text-align: right;">Immediate</td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${fin.tenureFormatted}</span></td></tr>
              <tr><td>Total Interest Paid to Bank</td><td style="text-align: right;">Rs 0</td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${formatCurrency(fin.totalInterest)}</span></td></tr>
              <tr><td>Total Outflow over Life</td><td style="text-align: right;"><span class="editable-field">${formatCurrency(fin.upfrontNetCost)}</span></td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${formatCurrency(fin.totalLoanCost)}</span></td></tr>
              <tr><td>100% Free Solar Electricity Period</td><td style="text-align: right;">25.0 Years</td><td style="text-align: right; color: #63923e; font-weight: bold;"><span class="editable-field">${fin.freeElectricityYears} Years</span></td></tr>
              <tr style="background: #eef3ec; font-weight: bold;"><td>25-Year Net Financial Gain</td><td style="text-align: right;"><span class="editable-field">${formatCurrency(fin.lifetimeNetGainUpfront)}</span></td><td style="text-align: right; color: #63923e;"><span class="editable-field">${formatCurrency(fin.lifetimeNetGainWithLoan)}</span></td></tr>
            </tbody>
          </table>

          <!-- Strategic Note Box -->
          <div class="pdf-card" style="background: #f0fdf4; border-left: 3px solid #10b981; padding: 2.5mm 3.5mm;">
            <div style="font-size: 8pt; font-weight: 700; color: #065f46; margin-bottom: 1.5mm;">Strategic Opportunity Cost &amp; Loan EMI Note (Option B vs Upfront Cash):</div>
            <div style="font-size: 7.2pt; color: #166534; font-weight: 700; margin-bottom: 0.5mm;">1. Loan EMI vs Current Bill Substitution:</div>
            <div style="font-size: 7pt; color: #334155; line-height: 1.35; margin-bottom: 2mm;">
              Paying EMI (${formatCurrency(fin.monthlyEmi)}/mo) to the bank instead of electricity bill payments (current bill) will make the solar system 100% free in just ${fin.tenureFormatted} (Option B vs Upfront Cash comparison). You incur zero extra monthly burden, and after payoff, you enjoy ${fin.freeElectricityYears} years of 100% free electricity!
            </div>
            <div style="font-size: 7.2pt; color: #166534; font-weight: 700; margin-bottom: 0.5mm;">2. Save Upfront Cash &amp; Invest in Business (Opportunity Cost):</div>
            <div style="font-size: 7pt; color: #334155; line-height: 1.35;">
              Save upfront cash (${formatCurrency(fin.totalPreSubsidy)}) and invest it in your business or high-yield assets (opportunity cost advantage). Keeping capital liquid for business expansion or working capital while letting your existing utility bill budget pay off the solar plant is the smartest financial leverage.
            </div>
            ${fin.isFallback ? `<div style="font-size: 6.8pt; color: #92400e; margin-top: 1.5mm; font-weight: 600;">* Note: Requested monthly bill budget (${formatCurrency(fin.requestedEmi || fin.targetBillAmount)}/mo) does not cover monthly interest (${formatCurrency(fin.monthlyInterest || 0)}/mo); structured on a standard 60-month EMI schedule.</div>` : ""}
          </div>
        </div>
        ${createPageFooter(loanPage1Num, totalPages)}
      </div>
    `;
    pages.push(page4Content);

    // Bank Partner Loan Proposal (Contd.)
    const loanPage2Num = currentPageNum++;
    const page5Content = `
      <div class="pdf-sample-page" data-page-index="${loanPage2Num}">
        ${createPageHeader("Bank Partner Loan Proposal (Contd.)")}
        <div class="pdf-page-body">
          <div class="pdf-section-title" style="margin-top: 2mm; margin-bottom: 3mm;">Key Advantages of Bank Partner Solar Financing:</div>
          <div style="display: flex; flex-direction: column; gap: 3mm; font-size: 8.5pt; color: #334155; line-height: 1.45; margin-bottom: 5mm;">
            <div>- <strong>Zero Incremental Monthly Budget:</strong> Paying EMI to the bank instead of bill payments makes the system free in just <span class="editable-field">${fin.tenureFormatted}</span>.</div>
            <div>- <strong>Save Upfront Cash for Business:</strong> Preserve <span class="editable-field">${formatCurrency(fin.totalPreSubsidy)}</span> liquidity for business working capital, inventory, or investment opportunity cost.</div>
            <div>- <strong>Nationalized Bank Schemes:</strong> Easy processing under PM Surya Ghar with subsidized interest rates.</div>
            <div>- <strong>Asset Creation &amp; Long-Term Wealth:</strong> Switch from a perpetual utility expense to owning a high-ROI power plant.</div>
            <div>- <strong>No Prepayment Penalty:</strong> Option to prepay or foreclose at any time to eliminate interest and accelerate free power.</div>
          </div>
          <div style="font-size: 7.5pt; font-style: italic; color: #64748b; line-height: 1.4;">
            * Note: Loan approval, interest rates, and final terms are governed exclusively by the lending bank. Financing delays or rejections do not alter payment milestone obligations to Datlion Cnergy Pvt. Ltd.
          </div>
        </div>
        ${createPageFooter(loanPage2Num, totalPages)}
      </div>
    `;
    pages.push(page5Content);
  }

  // ==========================================
  // PAGE: Terms & Conditions, Warranty and Details
  // ==========================================
  const warrantyPageNum = currentPageNum++;
  const page6Content = `
    <div class="pdf-sample-page" data-page-index="${warrantyPageNum}">
      ${createPageHeader("Warranty and Details")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">${warrantySectionNum}. Terms &amp; Conditions, Warranty and Details</div>
        <p class="pdf-paragraph" style="font-size: 8pt; color: #475569; margin-bottom: 2mm;">
          Comprehensive component warranties, manufacturer guarantees, and contractual terms governing this EPC proposal.
        </p>

        <!-- Product Warranty Table -->
        <table class="pdf-table" style="margin-bottom: 2mm; font-size: 7.5pt; width: 100% !important; min-width: 0 !important; table-layout: fixed;">
          <colgroup>
            <col style="width: 8%;">
            <col style="width: 22%;">
            <col style="width: 45%;">
            <col style="width: 25%;">
          </colgroup>
          <thead>
            <tr style="background-color: #63923e; color: white;">
              <th style="background-color: #63923e !important; color: #ffffff !important; text-align: center; padding: 1.5mm; border-color: #4d7c2a;">Sr. No.</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Product</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; padding: 1.5mm; border-color: #4d7c2a;">Make &amp; Specification</th>
              <th style="background-color: #63923e !important; color: #ffffff !important; text-align: center; padding: 1.5mm; border-color: #4d7c2a;">Warranty</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="text-align: center; font-weight: 700;">1</td><td><strong>SOLAR PANEL</strong></td><td>${panelSpecText}</td><td style="text-align: center; color: #16a34a; font-weight: 700;">12 Year Warranty /<br>30 Year Performance Warranty</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">2</td><td><strong>DCDB</strong></td><td>HAVELLS 1 IN 1 OUT 600 V</td><td style="text-align: center; color: #16a34a; font-weight: 700;">5 Year</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">3</td><td><strong>EARTHING</strong></td><td>16 MM EARTHING ALU. CONDUCTOR ROD; 14 MM × 1 MTR COPPER ROD</td><td style="text-align: center; color: #64748b;">—</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">4</td><td><strong>DC CABLE</strong></td><td>4 SQ MM COPPER TIN</td><td style="text-align: center; color: #16a34a; font-weight: 700;">20 Year</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">5</td><td><strong>CIVIL CHAMBER</strong></td><td>ISI STANDARD</td><td style="text-align: center; color: #16a34a; font-weight: 700;">10 Year</td></tr>
            <tr><td style="text-align: center; font-weight: 700;">6</td><td><strong>${mainInverterPrefix.toUpperCase()} INVERTER</strong></td><td>${inverterWarrantySpec}</td><td style="text-align: center; color: #16a34a; font-weight: 700;">10 Year Warranty</td></tr>
          </tbody>
        </table>
        <div style="font-size: 6.8pt; font-style: italic; color: #64748b; margin-bottom: 3mm;">
          * Note: Other product warranties not mentioned above will be added later / as per project BOM.
        </div>

        <div style="font-size: 8.5pt; font-weight: 700; color: #000000; margin-bottom: 1mm;">
          Terms and Conditions for Warranty, System Design, Installation &amp; Commercials
        </div>
        <div style="font-size: 7.2pt; color: #64748b; margin-bottom: 2mm;">
          The following terms and conditions govern this EPC proposal and form the collaborative agreement between Datlion Cnergy Pvt. Ltd. and the Client.
        </div>

        <!-- Section A -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          A. System Design &amp; Generation Feasibility Terms
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Simulated Solar Generation &amp; Yield Engineering:</strong> Projections and carbon offsets are computer-simulated engineering estimations based on standard test conditions (STC) and historical Pune irradiance data (NASA/Meteonorm). Actual yield reflects real-time sunlight, seasonal weather, grid availability, and routine module washing.</div>
          <div style="margin-top: 1mm;"><strong>2. Grid Synchronization &amp; Statutory Anti-Islanding:</strong> As mandated by Central Electricity Authority (CEA) and MSEDCL safety regulations, on-grid inverters automatically disconnect during utility power cuts or voltage/frequency trips (anti-islanding protection). Standby during utility outages is a regulatory safety feature.</div>
          <div style="margin-top: 1mm;"><strong>3. Future Shading Obstructions &amp; Property Alterations:</strong> Array design is optimized for site conditions at the time of survey. Subsequent construction, foliage growth, or architectural changes on adjoining properties that cast shade are beyond the installer's scope.</div>
        </div>

        <!-- Section B -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          B. Rooftop Layout, Civil &amp; Structural Responsibilities
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35;">
          <div><strong>1. Roof Structural Soundness &amp; Load Capacity:</strong> Mounting structures are engineered for wind speeds up to 150 km/h. The client confirms the roof slab or support structure possesses adequate structural load-bearing capacity for the solar installation.</div>
          <div style="margin-top: 1mm;"><strong>2. Fastener Sealing &amp; Roof Water Ingress:</strong> Datlion Cnergy employs standard chemical anchoring and weatherproofing sealant at base fixings. General roof slab waterproofing and structural maintenance remain the client's responsibility.</div>
          <div style="margin-top: 1mm;"><strong>3. Rooftop Access &amp; Routine Module Washing:</strong> The client provides safe roof access and a soft-water tap connection. Fortnightly module washing with clean, non-abrasive water preserves peak power output and maintains OEM warranties.</div>
          <div style="margin-top: 1mm;"><strong>4. Indicative Blueprint &amp; Site Adaptations:</strong> The CAD layout is an indicative engineering blueprint. Minor string routing or walkway adjustments may be made during physical installation to best accommodate site conduits without reducing contracted DC capacity.</div>
        </div>
      </div>
      ${createPageFooter(warrantyPageNum, totalPages)}
    </div>
  `;
  pages.push(page6Content);

  // ==========================================
  // PAGE: Terms and Conditions (Contd.)
  // ==========================================
  const tcContdPageNum = currentPageNum++;
  const page7Content = `
    <div class="pdf-sample-page" data-page-index="${tcContdPageNum}">
      ${createPageHeader("Terms and Conditions (Contd.)")}
      <div class="pdf-page-body">
        <!-- Section C -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          C. Commercial, Pricing &amp; Milestone Payment Terms
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Quotation Validity &amp; Milestone Progress:</strong> Pricing is valid for 15 days from issue date. Payments follow agreed project milestones (advance booking, material dispatch, installation, and commissioning), ensuring smooth procurement and prompt execution.</div>
          <div style="margin-top: 1mm;"><strong>2. Cabling, Wiring &amp; Civil Works at Actuals:</strong> Standard bill of materials (BOM) allowances are included. Cabling and wiring charges will be at actual measured length of DC and AC cabling required on site, ensuring client pays transparently for exact site requirements.</div>
          <div style="margin-top: 1mm;"><strong>3. Statutory Taxes &amp; On-Site Material Custody:</strong> Pricing reflects prevailing GST rates (effective composite 8.9%). Delivered materials stored safely at site transition to client custody, with ownership title transferring upon final milestone settlement.</div>
        </div>

        <!-- Section D -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          D. MSEDCL Net Metering, Grid Interconnection &amp; PM Surya Ghar Subsidy Terms (MNRE 07.06.2024)
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Central Financial Assistance (CFA) Eligibility &amp; DBT:</strong> Central subsidy under PM Surya Ghar: Muft Bijli Yojana applies strictly to Capex mode (consumer self-funded or bank loan financed) and is credited directly to the client's bank account via DBT. RESCO/utility aggregation models and off-grid setups are strictly excluded (₹0 CFA). Sizing strictly follows pro-rata slabs (0 to 2 kWp: ₹30,000/kWp / >2 to 3 kWp: ₹18,000/kWp / >3 kWp: ₹0 additional; max CFA cap of ₹78,000 per consumer). Maharashtra falls under General/Standard Category States (eligible DISCOMs: MSEDCL, BEST, Adani Electricity, Tata Power). Datlion Cnergy assists with National Portal documentation; EPC payments remain independent of DBT disbursement.</div>
          <div style="margin-top: 1mm;"><strong>2. Mandatory Equipment &amp; Mounting Compliance:</strong> CFA requires 100% Domestic Content Requirement (DCR) ALMM-listed solar cells/modules and BIS-compliant inverters. Systems must be mounted on rooftops, terraces, balconies, BIPV, or elevated structures with ≥ 8 ft ground clearance. Ground-mounted systems are strictly ineligible for CFA.</div>
          <div style="margin-top: 1mm;"><strong>3. Grid Feasibility &amp; Housing Society Sizing:</strong> Systems ≤ 10 kW enjoy deemed grid feasibility approval per MNRE guidelines. For Group Housing Societies / multi-meter buildings (Category B/C), total CFA capacity is capped at min(3 kWp × Total Houses, 500 kWp), and common utility power is prohibited from supplying individual residential flats.</div>
        </div>

        <!-- Section E -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          E. Bank Partner Financing Facilitation Terms
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Illustrative EMI Projections &amp; Underwriting:</strong> All bank EMI figures, interest rates (e.g. 9.5% p.a.), and payback timelines are illustrative estimates. Final loan sanction, interest rates, and loan tenure are determined by the partner lending bank (SBI, Canara Bank, Union Bank, etc.) under PM Surya Ghar nationalized schemes.</div>
          <div style="margin-top: 1mm;"><strong>2. EPC Facilitation Role &amp; Independent Milestones:</strong> Datlion Cnergy acts as a technology and documentation facilitator to help clients secure competitive green solar loans. Project milestone payments proceed in coordination with bank disbursement schedules.</div>
        </div>

        <!-- Section F -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          F. Terms and Conditions for Warranty &amp; OEM Pass-Through
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35; margin-bottom: 2.5mm;">
          <div><strong>1. Original Equipment Manufacturer (OEM) Pass-Through:</strong> Solar panels (12-yr product / 30-yr performance), inverters (10-yr), and switchgear carry direct manufacturer warranties. Datlion Cnergy acts as your local single-point facilitator for manufacturer warranty claims and RMA processing.</div>
          <div style="margin-top: 1mm;"><strong>2. Operation, Maintenance &amp; Pass-Through Warranty:</strong> All product warranties are original equipment manufacturer (OEM) pass-through warranties. Standard warranty remains valid when the system is operated within rated electrical parameters, cleaned regularly with soft water, and serviced by authorized personnel.</div>
          <div style="margin-top: 1mm;"><strong>3. Natural Calamity &amp; Force Majeure Protections:</strong> Warranties cover equipment manufacturing and performance defects. Damages caused by Natural Calamity events (cyclones exceeding design rating, hailstorms, flooding, earthquakes) or Force Majeure disruptions (civil unrest, grid-level anomalies) are covered under comprehensive plant insurance rather than equipment warranties.</div>
          <div style="margin-top: 1mm;"><strong>4. Change in Government Policies &amp; Regulatory Framework:</strong> Savings and payback models are based on current MERC net metering regulations and MSEDCL tariffs. Any future Change in Government Policies, tariff revisions, or DISCOM grid-banking rules are external regulatory updates.</div>
        </div>

        <!-- Section G -->
        <div class="pdf-card" style="background: #f1f5f9; border-color: #cbd5e1; padding: 1.5mm 3mm; font-size: 7.5pt; font-weight: 700; color: #63923e; margin-bottom: 1.5mm;">
          G. Proposal-Wide General EPC Terms &amp; Conditions
        </div>
        <div style="font-size: 6.8pt; color: #334155; line-height: 1.35;">
          <div><strong>1. Limitation of EPC Liability (Capped at 5%):</strong> To the extent permitted by law, the total cumulative aggregate liability of Datlion Cnergy Pvt. Ltd. for any claim or dispute arising under this proposal shall be subject to a Limitation of EPC Liability (Capped at 5%) of the total contract value actually received, excluding indirect or consequential downtime losses.</div>
          <div style="margin-top: 1mm;"><strong>2. Mutual Good Faith &amp; Exclusive Jurisdiction:</strong> Both parties agree to resolve any operational questions through mutual consultation and good-faith cooperation. Unresolved legal disputes shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra, India.</div>
        </div>
      </div>
      ${createPageFooter(tcContdPageNum, totalPages)}
    </div>
  `;
  pages.push(page7Content);

  // ==========================================
  // PAGE: Solar System Types
  // ==========================================
  const sysTypesPageNum = currentPageNum++;
  const page8Content = `
    <div class="pdf-sample-page" data-page-index="${sysTypesPageNum}">
      ${createPageHeader("Solar System Types")}
      <div class="pdf-page-body">
        <div class="pdf-section-title">${sysTypesSectionNum}. Solar System Types</div>
        <p class="pdf-paragraph" style="font-size: 8.5pt; color: #475569; margin-bottom: 3mm;">
          Understanding the different solar system configurations to choose the right solution for your needs.
        </p>

        <div style="text-align: center; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          <img src="https://solarcalculator.cnergy.co.in/src/system_differences.png" onerror="this.src='system_differences.png'; this.onerror=null;" alt="Solar System Types" style="max-width: 100%; max-height: 220mm; object-fit: contain;">
        </div>
      </div>
      ${createPageFooter(sysTypesPageNum, totalPages)}
    </div>
  `;
  pages.push(page8Content);

  return pages.join("\n");
}

/**
 * Generate high-fidelity HTML pages representing the PDF document.
 */
export function buildSamplePdfPages(estimates, selectedOption, hideFlags = {}) {
  const resolvedFlags = { ...hideFlags };
  if (typeof document !== "undefined") {
    if (resolvedFlags.showCadDiagram === undefined) {
      const cadEl = document.getElementById("showCadDiagram");
      resolvedFlags.showCadDiagram = cadEl ? cadEl.checked : true;
    }
    if (resolvedFlags.hidePayback === undefined) resolvedFlags.hidePayback = Boolean(document.getElementById("hidePayback")?.checked);
    if (resolvedFlags.hideAreaFit === undefined) resolvedFlags.hideAreaFit = Boolean(document.getElementById("hideAreaFit")?.checked);
    if (resolvedFlags.hideSubsidy === undefined) resolvedFlags.hideSubsidy = Boolean(document.getElementById("hideSubsidy")?.checked);
    if (resolvedFlags.hideCost === undefined) resolvedFlags.hideCost = Boolean(document.getElementById("hideCost")?.checked);
    if (resolvedFlags.hideFinancing === undefined) resolvedFlags.hideFinancing = Boolean(document.getElementById("hideFinancing")?.checked);
    if (resolvedFlags.solarInstalled === undefined) resolvedFlags.solarInstalled = Boolean(document.getElementById("solarInstalled")?.checked);
  }

  // If Multi-Customer Building Proposal, use dedicated building generator
  const isBuilding = resolvedFlags.isBuildingProposal ||
                     estimates?.isBuildingProposal ||
                     (typeof window !== "undefined" && window.appState?.proposalMode === "multi_building");

  if (isBuilding) {
    if (!resolvedFlags.buildingData && typeof window !== "undefined" && window.appState?.buildingData) {
      resolvedFlags.buildingData = window.appState.buildingData;
    }
    if (resolvedFlags.includeIndividualSheets === undefined && typeof document !== "undefined") {
      resolvedFlags.includeIndividualSheets = document.getElementById("includeIndividualSheets")?.checked || false;
    }
    return buildBuildingSamplePdfPages(estimates, selectedOption, resolvedFlags);
  }

  return buildSingleSamplePdfPages(estimates, selectedOption, resolvedFlags);
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
 * Prompt user for confirmation password "editprop" before unlocking manual edits.
 */
export function promptForPasswordAndUnlock() {
  if (isEditingUnlocked) {
    // If already unlocked, toggle to lock
    isEditingUnlocked = false;
    applyEditState();
    return;
  }

  const dialog = document.getElementById("sampleViewPasswordDialog");
  const input = document.getElementById("sampleViewPasswordInput");
  const errorMsg = document.getElementById("sampleViewPasswordError");

  if (errorMsg) errorMsg.style.display = "none";
  if (input) input.value = "";

  if (typeof dialog?.showModal === "function") {
    dialog.showModal();
    input?.focus();
  } else if (dialog) {
    dialog.style.display = "block";
    input?.focus();
  }
}

/**
 * Confirm password entered in dialog.
 */
export function confirmPasswordUnlock() {
  const input = document.getElementById("sampleViewPasswordInput");
  const errorMsg = document.getElementById("sampleViewPasswordError");
  const dialog = document.getElementById("sampleViewPasswordDialog");

  const pwd = input?.value?.trim();

  if (pwd === "editprop") {
    isEditingUnlocked = true;
    if (errorMsg) errorMsg.style.display = "none";
    if (typeof dialog?.close === "function") dialog.close();
    else if (dialog) dialog.style.display = "none";
    applyEditState();
  } else {
    if (errorMsg) {
      errorMsg.style.display = "block";
    }
  }
}

/**
 * Cancel password dialog without unlocking.
 */
export function cancelPasswordUnlock() {
  const dialog = document.getElementById("sampleViewPasswordDialog");
  const errorMsg = document.getElementById("sampleViewPasswordError");
  if (errorMsg) errorMsg.style.display = "none";
  if (typeof dialog?.close === "function") dialog.close();
  else if (dialog) dialog.style.display = "none";
}

/**
 * Apply edit state to all editable elements in Sample View.
 */
function applyEditState() {
  const modal = document.getElementById("pdfSampleViewModal");
  const statusBadge = document.getElementById("sampleViewStatusBadge");
  const statusBanner = document.getElementById("sampleViewStatusBanner");
  const unlockBtn = document.getElementById("sampleViewUnlockEditBtn");

  if (!modal) return;

  const editableElements = modal.querySelectorAll(".pdf-section-title, .pdf-paragraph, .pdf-table td, .pdf-table th, .editable-field");

  if (isEditingUnlocked) {
    modal.classList.add("editing-unlocked");
    editableElements.forEach((el) => {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "false");
    });

    if (statusBadge) {
      statusBadge.textContent = "🔓 Editing Unlocked";
      statusBadge.className = "sample-status-pill unlocked";
    }
    if (statusBanner) {
      statusBanner.style.display = "block";
      statusBanner.innerHTML = "✏️ <strong>Live Edit Mode Active:</strong> Click any text, heading, or table cell to edit inline before printing/saving to PDF.";
    }
    if (unlockBtn) {
      unlockBtn.innerHTML = "<span>🔒</span> <span>Lock Edits</span>";
      unlockBtn.classList.add("active");
    }
  } else {
    modal.classList.remove("editing-unlocked");
    editableElements.forEach((el) => {
      el.removeAttribute("contenteditable");
    });

    if (statusBadge) {
      statusBadge.textContent = "🔒 Locked (Read-Only)";
      statusBadge.className = "sample-status-pill locked";
    }
    if (statusBanner) {
      statusBanner.style.display = "none";
    }
    if (unlockBtn) {
      unlockBtn.innerHTML = "<span>✏️</span> <span>Edit Proposal Text</span>";
      unlockBtn.classList.remove("active");
    }
  }
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
  const origZoom = document.body.style.zoom;
  document.body.style.zoom = "1";
  try {
    window.print();
  } finally {
    setTimeout(() => {
      document.body.style.zoom = origZoom;
    }, 1000);
  }
}

// Global print hooks to ensure zoom is always 1 during printing
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  let savedZoom = "";
  window.addEventListener("beforeprint", () => {
    if (typeof document !== "undefined" && document.body) {
      savedZoom = document.body.style.zoom || "";
      document.body.style.zoom = "1";
    }
  });
  window.addEventListener("afterprint", () => {
    if (typeof document !== "undefined" && document.body) {
      document.body.style.zoom = savedZoom;
    }
  });
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

  // Open Sample View button from Proposal tab (skip if app.js already owns the click binding)
  const openBtn = document.getElementById("openSampleViewBtn");
  if (openBtn && openBtn.dataset.boundByApp !== "1") {
    openBtn.addEventListener("click", () => {
      if (window.appState) {
        const isBuilding = window.appState.proposalMode === "multi_building";
        const est = window.appState.estimates || { input: {}, options: [], recommended: {} };
        const opt =
          (window.appState.selectedSystemIndex !== null &&
            window.appState.selectedSystemIndex >= 0 &&
            est.options &&
            est.options[window.appState.selectedSystemIndex]) ||
          (est.recommended || {});
        const paymentMode = document.getElementById("paymentMode")?.value || "upfront";
        const hideCost = Boolean(document.getElementById("hideCost")?.checked);
        const hideFlags = {
          isBuildingProposal: isBuilding,
          buildingData: isBuilding ? window.appState.buildingData : null,
          includeIndividualSheets: isBuilding ? (document.getElementById("includeIndividualSheets")?.checked || false) : false,
          showCadDiagram: document.getElementById("showCadDiagram") ? document.getElementById("showCadDiagram").checked : true,
          hidePayback: Boolean(document.getElementById("hidePayback")?.checked),
          hideAreaFit: Boolean(document.getElementById("hideAreaFit")?.checked),
          hideSubsidy: Boolean(document.getElementById("hideSubsidy")?.checked),
          hideCost,
          hideFinancing: paymentMode !== "loan" || hideCost || Boolean(document.getElementById("hideFinancing")?.checked),
          solarInstalled: Boolean(document.getElementById("solarAlreadyInstalled")?.checked),
          customerAddress: (document.getElementById("customerAddress")?.value || "").trim(),
          proposalSerialNo: document.getElementById("proposalSerialNo")?.value || "DC/2026-27/PROP-1140",
        };
        openPdfSampleView(est, opt, hideFlags);
      }
    });
  }
}
