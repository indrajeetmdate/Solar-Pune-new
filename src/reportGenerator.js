// Helper to load image and get base64 data
const loadImage = (url, maxDim = 400) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      let scale = 1;
      if (!img.width || !img.height) {
        console.warn(`Image loaded but has no dimensions: ${url}`);
        resolve(null);
        return;
      }
      if (img.width > maxDim || img.height > maxDim) {
        scale = Math.min(maxDim / img.width, maxDim / img.height);
      }
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (typeof ctx?.clearRect === 'function') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        data: canvas.toDataURL('image/png'),
        format: 'PNG',
        width: canvas.width,
        height: canvas.height
      });
    };
    img.onerror = () => {
      console.warn(`Failed to load image: ${url}`);
      resolve(null);
    }
  });
};

// Helper to get canvas as image data
const canvasToImageData = (canvasId) => {
  try {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn("Canvas not found:", canvasId);
      return null;
    }
    // Check if canvas has content by checking width
    if (canvas.width === 0 || canvas.height === 0) {
      console.warn("Canvas not drawn yet - empty dimensions");
      return null;
    }
    const dataUrl = canvas.toDataURL('image/png');
    // Check if canvas is empty (might not be drawn yet)
    if (!dataUrl || dataUrl.length < 100 || dataUrl === 'data:,') {
      console.warn("Canvas appears empty");
      return null;
    }
    return dataUrl;
  } catch (e) {
    console.warn("Canvas conversion failed:", e);
    return null;
  }
};

export function sanitizeSystemIncludes(text) {
  let s = (text || "")
    .replace(/,?\s+and\s+contingency/gi, "")
    .replace(/,?\s+contingency/gi, "")
    .replace(/,\s*\./g, ".")
    .replace(/\s*,\s*,/g, ",")
    .replace(/,\s*GST\b/gi, ", and GST")
    .replace(/and\s+and\b/gi, "and")
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
  if (s && !s.endsWith(".")) s += ".";
  return s;
}

export function buildSystemIncludesText(option) {
  const cBreakup = option.costBreakup || {};
  let mainInverterPrefix = "On-grid";
  if (option.systemType === "hybrid") mainInverterPrefix = "Hybrid";
  if (option.systemType === "offgrid") mainInverterPrefix = "Off-grid";

  let rawText;
  if (option.systemIncludesText) {
    rawText = option.systemIncludesText.replace(/^System Includes:\s*/i, "");
  } else {
    const includedItems = [];
    if (option.costBreakupList) {
      option.costBreakupList.forEach(it => {
        if (!it.isHidden && !it.isHeader) {
          includedItems.push(it.label);
        }
      });
    } else {
      // Fallback if list not found
      includedItems.push(
        "Solar Panels",
        `${mainInverterPrefix} Inverter`,
        "Mounting Structure",
        "Safety and earthing",
        "Wiring excluding cable cost",
        "Installation & Commissioning",
        "Consultancy"
      );
      if (cBreakup.backupInverter > 0) includedItems.push("Backup Off-grid Inverter");
      if (cBreakup.battery > 0) includedItems.push("Battery Storage");
    }
    rawText = includedItems.join(", ") + ", and GST.";
  }
  return "System Includes: " + sanitizeSystemIncludes(rawText);
}

export async function generateProposalPDF(estimates, selectedOption, hideFlags = {}) {
  console.log("Starting PDF generation...", estimates);

  // Wait for jsPDF to be available (it loads from CDN)
  let jsPDF = null;
  let attempts = 0;
  while (!jsPDF && attempts < 50) {
    jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
    if (!jsPDF) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
  }

  if (!jsPDF) {
    console.error("jsPDF not loaded after waiting");
    alert("PDF generator library not loaded. Please refresh the page and try again.");
    return;
  }

  try {
    // Load logo and system differences image in parallel
    const [logoResultInitial, sysDiffResult] = await Promise.all([
      loadImage("https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energy.png"),
      loadImage("https://solarcalculator.cnergy.co.in/src/system_differences.png", 2400),
    ]);
    const logoResult = logoResultInitial || await loadImage("logo.png");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const COLORS = {
    primary: "#63923E",
    secondary: "#92B56B",
    text: "#4C4C4C",
    textLight: "#777777",
    black: "#000000",
    white: "#FFFFFF",
    bgLight: "#eef3ec",
  };

  const { input, sanctionedStatus } = estimates;

  // Use the explicitly selected option (passed from UI), falling back to recommended
  const option = selectedOption || estimates.recommended;

  const { hidePayback, hideAreaFit, hideSubsidy, hideCost, hideFinancing, solarInstalled } = hideFlags;
  const proposalSerialNo = hideFlags.proposalSerialNo || option.proposalSerialNo || "DC/2026-27/PROP-1001";
  const customerAddress = hideFlags.customerAddress || input.customerAddress || "Pune, Maharashtra";
  const proposalDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  // --- Helpers ---
  const formatCurrency = (val) =>
    "Rs " + Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const formatSysType = (t) => {
    if (t === "ongrid") return "On-Grid";
    if (t === "ongrid_basic_backup") return "Semi-Hybrid (1100VA)";
    if (t === "ongrid_standard_backup") return "Semi-Hybrid (2100VA)";
    if (t === "offgrid") return "Off-Grid";
    if (t === "hybrid") return "Hybrid";
    return t;
  };

  const addHeader = (title) => {
    // Elegant, corporate header banner
    // Full width top accent stripe in primary solar green
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, pageWidth, 2.5, "F");

    // Clean white header background
    doc.setFillColor(COLORS.white);
    doc.rect(0, 2.5, pageWidth, 18, "F");

    // Sleek divider line separating header from page content
    doc.setDrawColor(226, 232, 240); // #e2e8f0 border
    doc.setLineWidth(0.4);
    doc.line(margin, 20.5, pageWidth - margin, 20.5);

    let textStartX = margin;

    // Top Left: DC Energy Logo
    if (logoResult && logoResult.data) {
      const logoH = 14;
      const logoW = logoResult.height ? (logoResult.width / logoResult.height) * logoH : 14;
      const fmt = (logoResult.data && logoResult.data.includes('image/png')) ? 'PNG' : (logoResult.format || 'JPEG');
      try {
        doc.addImage(logoResult.data, fmt, margin, 4.2, logoW, logoH, 'companyLogo');
        textStartX = margin + logoW + 3.5;
      } catch (e) {
        console.warn("Failed to render logo in header:", e);
      }
    }

    // Top Left Branding text next to logo
    doc.setTextColor(30, 41, 59); // Slate-800 (#1e293b)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("DATLION CNERGY", textStartX, 11.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(COLORS.primary);
    doc.text("SOLAR EPC & CLEAN ENERGY SOLUTIONS", textStartX, 15.5);

    // Top Right: Section Title & Proposal Reference
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(COLORS.primary);
    doc.text(title, pageWidth - margin, 11.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.textLight);
    doc.text(`Ref: ${proposalSerialNo}`, pageWidth - margin, 15.5, { align: "right" });
  };

  // ================= PAGE 1: System Design Considerations =================
  addHeader("Solar System Proposal");
  let yPos = 25;

  // Metadata ribbon: Proposal Reference & Date
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.primary);
  doc.text(`PROPOSAL REF: ${proposalSerialNo}`, margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textLight);
  doc.text(`DATE: ${proposalDate}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 4;

  const isMultiMeter = input.meters && Array.isArray(input.meters) && input.meters.length > 1;

  // --- Side-by-Side Corporate Cards: FROM (DC Energy) and TO (Customer) ---
  const cardWidth = (pageWidth - margin * 2 - 6) / 2;
  const cardHeight = 44;
  const leftCardX = margin;
  const rightCardX = margin + cardWidth + 6;

  // Left Card: FROM (DC Energy)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftCardX, yPos, cardWidth, cardHeight, 1.5, 1.5, "FD");

  let fromY = yPos + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.primary);
  doc.text("PROPOSAL FROM (SOLAR EPC):", leftCardX + 4, fromY);
  fromY += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.black);
  doc.text("DATLION CNERGY PRIVATE LIMITED", leftCardX + 4, fromY);
  fromY += 3.8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.text);
  const companyAddr = "Ground, Shed No. 1, Shashitara Pratishthan BJP Office, Late Narayanrao Kondiba Jagtap Path, Hingne Khurd, Pune, 411051";
  const splitCompAddr = doc.splitTextToSize(companyAddr, cardWidth - 8);
  doc.text(splitCompAddr, leftCardX + 4, fromY);
  fromY += splitCompAddr.length * 3 + 1.5;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(COLORS.black);
  doc.text("GSTIN: 27AALCD8550A1ZP", leftCardX + 4, fromY);
  fromY += 3.2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.textLight);
  doc.text("Email: datlioncnergy@gmail.com", leftCardX + 4, fromY);
  fromY += 3;
  doc.text("Phone: +91 8956340980 | www.cnergy.co.in", leftCardX + 4, fromY);

  // Right Card: TO (Customer)
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightCardX, yPos, cardWidth, cardHeight, 1.5, 1.5, "FD");

  let toY = yPos + 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.primary);
  doc.text("PREPARED FOR (VALUED CLIENT):", rightCardX + 4, toY);
  toY += 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(COLORS.black);
  const custName = input.customerName || (isMultiMeter ? "Apartment Society" : "Valued Customer");
  doc.text(custName, rightCardX + 4, toY);
  toY += 3.8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(COLORS.text);
  const splitCustAddr = doc.splitTextToSize(`Site Address: ${customerAddress}`, cardWidth - 8);
  doc.text(splitCustAddr, rightCardX + 4, toY);
  toY += splitCustAddr.length * 3 + 1.5;

  doc.setTextColor(COLORS.textLight);
  const contactText = `Phone: ${input.mobileNumber || "—"}${input.emailAddress ? " | " + input.emailAddress : ""}`;
  doc.text(doc.splitTextToSize(contactText, cardWidth - 8), rightCardX + 4, toY);
  toY += 3.2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  doc.text(`Sanctioned Load: ${input.sanctionedLoad} kW  |  Category: ${input.consumerCategory || "LT-I Residential"}`, rightCardX + 4, toY);
  toY += 3;
  doc.text(`Monthly Usage: ${input.monthlyUnits} units  |  Avg Bill: ${formatCurrency(input.monthlyBill || 0)}`, rightCardX + 4, toY);
  toY += 3;
  doc.text(`Usable Roof Area: ${input.roofArea} sq ft`, rightCardX + 4, toY);

  yPos += cardHeight + 7;

  // Section 1 Heading
  doc.setTextColor(COLORS.black);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("1. System Design Considerations", margin, yPos);
  yPos += 8;

  if (input.coordinates || input.tiltAngle !== null || input.orientationDir) {
    const geoInfo = [];
    if (input.coordinates) geoInfo.push(`Coordinates: ${input.coordinates}`);
    if (input.tiltAngle !== null) geoInfo.push(`Tilt: ${input.tiltAngle} deg`);
    if (input.orientationDir) geoInfo.push(`Orientation: ${input.orientationDir}`);
    if (geoInfo.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.textLight);
      doc.text(geoInfo.join(" | "), margin, yPos);
      yPos += 5;
    }
  }

  // If multi-meter, add the meter-wise breakdown table
  if (isMultiMeter) {
    doc.setTextColor(COLORS.black);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Multi-Meter Breakdown & Subsidy Allocation", margin, yPos);
    yPos += 6;

    const mmHeaders = [["Flat / Name", "Consumer No.", "Load", "Units/Mo", "Solar (kWp)", "PM Surya Ghar Subsidy"]];
    const mmRows = input.meters.map((m) => {
      const sub = option.meterBreakdown?.find(b => b.id === m.id || b.consumerNumber === m.consumerNumber)?.subsidy ?? 0;
      return [
        m.label || m.consumerName || "Flat",
        m.consumerNumber || "N/A",
        `${m.sanctionedLoad || 0} kW`,
        `${m.monthlyUnits || 0}`,
        `${m.allocatedKw || 0} kWp`,
        formatCurrency(sub),
      ];
    });

    const totalAlloc = round(input.meters.reduce((s, m) => s + (Number(m.allocatedKw) || 0), 0), 1);
    const totalSub = round(option.subsidy || 0, 0);
    mmRows.push([
      "Total / Building",
      "-",
      `${input.sanctionedLoad || 0} kW`,
      `${input.monthlyUnits || 0}`,
      `${totalAlloc} kWp`,
      formatCurrency(totalSub),
    ]);

    doc.autoTable({
      startY: yPos,
      head: mmHeaders,
      body: mmRows,
      theme: "grid",
      headStyles: { fillColor: COLORS.primary, fontSize: 9 },
      bodyStyles: { fontSize: 8.5 },
      didParseCell: function (data) {
        if (data.row.index === mmRows.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.bgLight;
        }
      },
      margin: { left: margin },
    });

    yPos = doc.lastAutoTable.finalY + 8;
  }

  // Selected system type label
  doc.setTextColor(COLORS.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Selected System: ${formatSysType(option.systemType)} (${option.dcCapacityKw} kWp)`, margin, yPos);
  yPos += 10;

  // Sizing Requirements
  doc.setTextColor(COLORS.black);
  doc.setFontSize(12.5);
  doc.setFont("helvetica", "bold");
  doc.text("Capacity Requirements", margin, yPos);
  yPos += 5.5;

  const dailyGenKwh = option.dailyGeneration !== undefined
    ? option.dailyGeneration
    : Math.round(((option.monthlyGeneration || 0) / 30) * 10) / 10;
  const monthlyGenKwh = option.monthlyGeneration || 0;
  const dailyPerKw = option.dcCapacityKw > 0 ? (dailyGenKwh / option.dcCapacityKw).toFixed(2) : "0.00";
  const monthlyPerKw = option.dcCapacityKw > 0 ? (monthlyGenKwh / option.dcCapacityKw).toFixed(1) : "0.0";

  const reqData = [
    ["Required by Consumption", `${option.sizing.byConsumptionKw} kW`],
    ["Supported by Roof Area", `${option.sizing.byAreaKw} kW`],
    ["Sanctioned Load Limit", option.sizing.byLoadKw ? `${option.sizing.byLoadKw} kW` : "N/A"],
    [solarInstalled ? "Installed Solar Capacity" : "Recommended Solar Capacity", `${option.dcCapacityKw} kWp`],
    ["Daily Solar Generation", `${dailyGenKwh.toLocaleString("en-IN")} kWh (${dailyPerKw} kWh/kW)`],
    ["Monthly Solar Generation", `${monthlyGenKwh.toLocaleString("en-IN")} kWh (${monthlyPerKw} kWh/kW)`],
    ["Sanction Status", sanctionedStatus.label]
  ];

  doc.autoTable({
    startY: yPos,
    body: reqData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
    },
    margin: { left: margin },
  });
  yPos = doc.lastAutoTable.finalY + 5;

  // Panel Layout Configuration
  const panelLayout = estimates.panelLayout;
  if (panelLayout) {
    doc.setTextColor(COLORS.black);
    doc.setFontSize(12.5);
    doc.setFont("helvetica", "bold");
    doc.text("Panel Configuration", margin, yPos);
    yPos += 5.5;

    const panelData = [
      ["Panel Specification", `${panelLayout.panelDimensions} (${panelLayout.panelWp} Wp each)`],
      ["Number of Panels", `${panelLayout.numPanels} panels`],
      ["Total Area Required", `${panelLayout.totalAreaSqft} sq ft (${panelLayout.totalAreaSqm} sq m)`],
      ["Available Installation Area", `${panelLayout.availableAreaSqft} sq ft`],
    ];

    // Conditionally include "Fits in Available Area"
    if (!hideAreaFit) {
      const fitStatus = panelLayout.fitsInArea === null
        ? "Area not specified"
        : panelLayout.fitsInArea
          ? `Yes - fits in ${panelLayout.availableAreaSqft} sq ft`
          : `No - needs ${panelLayout.totalAreaSqft - panelLayout.availableAreaSqft} sq ft more`;
      panelData.push(["Fits in Available Area", fitStatus]);
    }

    doc.autoTable({
      startY: yPos,
      body: panelData,
      theme: "grid",
      headStyles: { fillColor: COLORS.primary },
      bodyStyles: { fontSize: 8, cellPadding: 1.8 },
      columnStyles: {
        0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
      },
      margin: { left: margin },
    });
    yPos = doc.lastAutoTable.finalY + 5;
  }

  // Battery and Inverter Specifications
  doc.setTextColor(COLORS.black);
  doc.setFontSize(12.5);
  doc.setFont("helvetica", "bold");
  doc.text("Battery and Inverter Specifications", margin, yPos);
  yPos += 5.5;

  let mainInverterPrefix = "On-grid";
  if (option.systemType === "hybrid") mainInverterPrefix = "Hybrid";
  if (option.systemType === "offgrid") mainInverterPrefix = "Off-grid";

  const inverterSpecs = [
    [`${mainInverterPrefix} Inverter Capacity`, `${option.inverterCapacityKw} kW`],
  ];
  
  if (option.systemType === "ongrid_basic_backup") {
    inverterSpecs.push(["Backup Off-grid Inverter", "1.1 kVA"]);
    inverterSpecs.push(["Backup Battery Capacity", `${option.batteryCapacityKwh} kWh`]);
  } else if (option.systemType === "ongrid_standard_backup") {
    inverterSpecs.push(["Backup Off-grid Inverter", "2.1 kVA"]);
    inverterSpecs.push(["Backup Battery Capacity", `${option.batteryCapacityKwh} kWh`]);
  } else if (option.batteryCapacityKwh > 0) {
    inverterSpecs.push(["Battery Capacity", `${option.batteryCapacityKwh} kWh`]);
  } else {
    inverterSpecs.push(["Battery Capacity", "No battery (Grid-tied system)"]);
  }

  doc.autoTable({
    startY: yPos,
    body: inverterSpecs,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    columnStyles: {
      0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
    },
    margin: { left: margin },
  });
  yPos = doc.lastAutoTable.finalY + 4;

  // System Design Disclaimer Note (Minimized in words, safely above page footer)
  const sysNoteW = pageWidth - margin * 2;
  const sysNoteText = "• Design & Generation Note: Simulated yield based on NASA/Meteonorm irradiance data. Actual output varies with weather, grid uptime, and routine soft-water module washing.";
  const splitSysNote = doc.splitTextToSize(sysNoteText, sysNoteW - 8);
  const sysPillH = 3.5 + splitSysNote.length * 3.2;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, yPos, sysNoteW, sysPillH, 1.2, 1.2, "FD");
  doc.setFillColor(99, 146, 62);
  doc.roundedRect(margin, yPos, 2.2, sysPillH, 0.8, 0.8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(splitSysNote, margin + 5, yPos + 3.4);
  yPos += sysPillH + 4;

  let sectionNumber = 2;

  // ================= SECTION 2: Rooftop Layout & Solar Array CAD Plan =================
  const showCadDiagram = hideFlags.showCadDiagram !== undefined ? hideFlags.showCadDiagram : !hideFlags.hideCadDiagram;
  if (showCadDiagram) {
    doc.addPage();
    yPos = 30;
    addHeader("Rooftop Layout & CAD Blueprint");

    doc.setTextColor(COLORS.black);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`${sectionNumber}. Rooftop Layout & Solar Array CAD Plan`, margin, yPos);
    yPos += 8;
    sectionNumber++;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.text);
    doc.text("Dimensioned rooftop architectural layout, module placement, maintenance pathways, and shadow obstruction analysis.", margin, yPos);
    yPos += 7;

    // Get snapshot image from RooftopCAD or canvas
    let cadImage = null;
    let cad = null;
    try {
      if (typeof window !== "undefined") {
        cad = window.cad || (typeof window.getActiveRooftopCAD === "function" ? window.getActiveRooftopCAD() : null);
      }
      if (cad && typeof cad.getReportSnapshot === "function") {
        cadImage = cad.getReportSnapshot();
      }
      if (!cadImage) {
        cadImage = canvasToImageData("panelDiagramCanvas");
      }
    } catch (e) {
      console.warn("Could not capture CAD snapshot:", e);
    }

    if (cadImage) {
      const maxImgW = pageWidth - margin * 2;
      const maxImgH = 105;
      let imgProps = null;
      try {
        imgProps = doc.getImageProperties(cadImage);
      } catch (e) {
        imgProps = { width: 800, height: 460 };
      }
      const aspect = (imgProps && imgProps.width && imgProps.height)
        ? (imgProps.width / imgProps.height)
        : (800 / 460);

      let drawW = maxImgW;
      let drawH = drawW / aspect;
      if (drawH > maxImgH) {
        drawH = maxImgH;
        drawW = drawH * aspect;
      }
      const imgX = margin + (maxImgW - drawW) / 2;

      // Dark CAD canvas border/fill
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(imgX - 0.5, yPos - 0.5, drawW + 1, drawH + 1, 1.5, 1.5, "F");
      try {
        doc.addImage(cadImage, "PNG", imgX, yPos, drawW, drawH);
      } catch (err) {
        console.warn("Failed to add CAD image to PDF:", err);
      }
      yPos += drawH + 8;
    }

    // Architectural layout & array metrics table
    let cadStats = null;
    let placedPanelsCount = 0;
    let reqPanelsCount = option.sizing ? Math.ceil(option.dcCapacityKw / 0.55) : 0;
    let northAngle = 0;
    let bldgHeight = 18;
    let shadingEst = "0.0%";
    let roofL = 30;
    let roofB = 20;

    if (cad) {
      cadStats = cad.getAreaStats ? cad.getAreaStats() : null;
      placedPanelsCount = cad.panels ? cad.panels.length : 0;
      reqPanelsCount = cad.requiredPanels || reqPanelsCount;
      northAngle = cad.northAngleDeg ?? 0;
      bldgHeight = cad.buildingHeightFt ?? 18;
      roofL = cad.roofLengthFt || 30;
      roofB = cad.roofBreadthFt || 20;
      if (cad.sunSim && cad.sunSim.enabled && typeof cad.getShadingLossStats === "function") {
        const lossStats = cad.getShadingLossStats();
        if (lossStats) shadingEst = `${lossStats.lossPercent.toFixed(1)}%`;
      }
    }

    const cadTableData = [
      ["Roof Dimensions", `${roofL} ft × ${roofB} ft (${cadStats ? cadStats.grossSqft : roofL * roofB} sq ft)`],
      ["Net Usable Roof Space", `${cadStats ? cadStats.netUsableSqft : roofL * roofB} sq ft (${cadStats ? cadStats.netUsableSqm : ((roofL * roofB) * 0.0929).toFixed(1)} sq m)`],
      ["Solar Module Placement", `${placedPanelsCount} / ${reqPanelsCount} Modules Placed (${placedPanelsCount === reqPanelsCount ? "Complete Array" : `${Math.max(0, reqPanelsCount - placedPanelsCount)} Latent`})`],
      ["Orientation & True North", `${northAngle}° Azimuth (${northAngle === 0 ? "True North Aligned" : `${northAngle}° from North`}) | Height: ${bldgHeight} ft`],
      ["Simulated Shading Impact", `${shadingEst} Solar Shading Loss (Astronomical solar trajectory & obstacle model)`]
    ];

    doc.autoTable({
      startY: yPos,
      body: cadTableData,
      theme: "grid",
      headStyles: { fillColor: COLORS.primary },
      columnStyles: {
        0: { fontStyle: "bold", width: 75, fillColor: COLORS.bgLight },
        1: { fontStyle: "normal" }
      },
      margin: { left: margin },
    });
    yPos = doc.lastAutoTable.finalY + 4;

    const cadNoteW = pageWidth - margin * 2;
    const cadNoteText = "• Structural & Layout Note: Rooftop CAD array layout is preliminary and subject to minor adjustments during physical installation. The client warrants that the roof slab possesses adequate structural load-bearing capacity; roof waterproofing and sealing integrity remain the client's sole responsibility.";
    const splitCadNote = doc.splitTextToSize(cadNoteText, cadNoteW - 8);
    const cadPillH = 4 + splitCadNote.length * 3.3;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, cadNoteW, cadPillH, 1.2, 1.2, "FD");
    doc.setFillColor(99, 146, 62);
    doc.roundedRect(margin, yPos, 2.2, cadPillH, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(51, 65, 85);
    doc.text(splitCadNote, margin + 5, yPos + 3.8);
    yPos += cadPillH + 8;
  }

  // ================= FINANCIAL QUOTE & SCOPE OF WORK SECTION =================
  if (!hideCost) {
    doc.addPage();
    yPos = 30;
    addHeader("Financial Quote & Scope of Work");
  
    doc.setTextColor(COLORS.black);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(`${sectionNumber}. Financial Quote & Scope of Work`, margin, yPos);
    yPos += 8;
    sectionNumber++;
  
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.primary);
    doc.text(`Selected Option: ${formatSysType(option.systemType)} (${option.dcCapacityKw} kWp)`, margin, yPos);
    yPos += 7;

    // Scope of Work Card (Turnkey EPC Delivery)
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    const sowHeight = 35;
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, sowHeight, 1.5, 1.5, "FD");

    let sowY = yPos + 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.black);
    doc.text("Scope of Work (Turnkey EPC Delivery):", margin + 4, sowY);
    sowY += 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.text);
    const sowLines = [
      "• Comprehensive Site Survey, 3D Shadow Modeling & System Engineering Design",
      "• Procurement & Supply of Tier-1 High-Efficiency Solar PV Modules & Grid-Tied Inverter",
      "• Module Mounting Structure (Hot-Dip Galvanized / Anodized Aluminum) & Civil Anchoring",
      "• ACDB & DCDB Protection Switchgear with Type-II Surge Protection (SPD) & MCB/MCCBs",
      "• Chemical Earthing System (Dual Rods/Electrodes) & Lightning Arrestor Protection",
      "• System Integration, Pre-Commissioning & Grid Synchronisation",
      "• MSEDCL Net Metering Liaisoning & Discom Documentation Support"
    ];
    sowLines.forEach(line => {
      doc.text(line, margin + 4, sowY);
      sowY += 3.3;
    });

    yPos += sowHeight + 4;

    // --- 3 Prominently Highlighted Project Notes ---
    const notesW = pageWidth - margin * 2;
    const pillH = 6.8;
    const pillGap = 2;

    // 1. MNRE Guidelines Note (Emerald Green Highlight Pill)
    doc.setFillColor(236, 253, 245); // #ecfdf5
    doc.setDrawColor(167, 243, 208); // #a7f3d0
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, notesW, pillH, 1.2, 1.2, "FD");
    doc.setFillColor(16, 185, 129);  // #10b981 left accent
    doc.roundedRect(margin, yPos, 2.2, pillH, 0.8, 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(6, 95, 70);     // #065f46 dark emerald
    doc.text("• Note: All of the above are in line with MNRE guidelines.", margin + 5, yPos + 4.7);
    yPos += pillH + pillGap;

    // 2. Cabling/Wiring Charges Note (Amber Highlight Pill)
    doc.setFillColor(255, 251, 235); // #fffbeb
    doc.setDrawColor(253, 230, 138); // #fde68a
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, notesW, pillH, 1.2, 1.2, "FD");
    doc.setFillColor(245, 158, 11);  // #f59e0b left accent
    doc.roundedRect(margin, yPos, 2.2, pillH, 0.8, 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);   // #92400e dark amber
    doc.text("• Note: Cabling/wiring charges will be at actual length of DC and AC cabling required.", margin + 5, yPos + 4.7);
    yPos += pillH + pillGap;

    // 3. Liaisoning & Discom Support Note (Blue Highlight Pill)
    doc.setFillColor(239, 246, 255); // #eff6ff
    doc.setDrawColor(191, 219, 254); // #bfdbfe
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, yPos, notesW, pillH, 1.2, 1.2, "FD");
    doc.setFillColor(59, 130, 246);  // #3b82f6 left accent
    doc.roundedRect(margin, yPos, 2.2, pillH, 0.8, 0.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175);   // #1e40af dark blue
    doc.text("• Note: MSEDCL Net Metering Liaisoning & Discom Documentation Support charges at actuals.", margin + 5, yPos + 4.7);
    yPos += pillH + 5;

    const costData = [];
    costData.push(["Total System Cost (Inc. GST) (as payable to Datlion Cnergy Pvt. Ltd.)", formatCurrency(option.totalPreSubsidy)]);

    // Conditionally include subsidy
    if (!hideSubsidy) {
      const isMulti = input.meters && Array.isArray(input.meters) && input.meters.length > 1;
      const subLabel = isMulti
        ? `Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account across ${input.meters.length} flats)`
        : "Expected Subsidy (PM Surya Ghar Direct bank transfer to Customers bank account)";
      costData.push([subLabel, `- ${formatCurrency(option.subsidy)}`]);
    }
    costData.push(["Net Payable Cost to customer", formatCurrency(option.netCost)]);

    doc.autoTable({
      startY: yPos,
      body: costData,
      theme: "plain",
      columnStyles: {
        0: { fontStyle: "normal", cellWidth: 135 },
        1: { halign: "right", cellWidth: 45 },
      },
      didParseCell: function (data) {
        if (
          data.row.raw[0].includes("Total System Cost") ||
          data.row.raw[0].includes("Net Payable")
        ) {
          data.cell.styles.fontStyle = "bold";
        }
        if (data.row.raw[0].includes("Expected Subsidy")) {
          data.cell.styles.textColor = COLORS.primary;
          data.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: margin },
    });

    yPos = doc.lastAutoTable.finalY + 4;

    // Additional costs note
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(COLORS.textLight);
    doc.text("* GST: 70% goods @ 5% + 30% services @ 18% = 8.9% effective rate.", margin, yPos);
    yPos += 3.8;
    doc.text("* Quotation validity: 15 days. Full contract value is payable to Datlion Cnergy Pvt. Ltd. regardless of central subsidy disbursement.", margin, yPos);
    yPos += 6;
  } else {
    doc.addPage();
    yPos = 30;
    addHeader("Estimated Savings");
  }

  // ================= POSSIBLE SAVINGS BREAKDOWN (SOLAR OFFSET) =================
  const saveEnergyCharges = hideFlags.saveEnergyCharges !== false;
  const saveElectricityDuty = hideFlags.saveElectricityDuty !== false;
  const saveWheelingFac = hideFlags.saveWheelingFac !== false;
  const saveTodRebate = hideFlags.saveTodRebate !== false;

  doc.setTextColor(COLORS.black);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Possible Savings Breakdown (Solar Offset)", margin, yPos);
  yPos += 5;

  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(COLORS.textLight);
  doc.text("Electricity bill components offset & reduced through rooftop solar generation:", margin, yPos);
  yPos += 6;

  const tipMap = {
    "Energy Charges Offset": "Direct slab-wise energy charge reduction from solar generation",
    "Electricity Duty Offset": "Avoided state electricity duty on self-generated solar units",
    "Wheeling & Fuel Adjustment (FAC) Offset": "Avoided DISCOM wheeling & fuel adjustment charges",
    "ToD Daytime Solar Generation Credit": "Time-of-day solar generation incentive credited by DISCOM",
    "Peak penalty avoided": "Using battery during peak hours (5PM-10PM) avoids expensive peak tariffs.",
    "PF improvement": "Smart inverters maintain a high Power Factor, earning a discount from MSEDCL.",
    "Prompt pay discount": "1% bill discount for prompt payment differential."
  };

  const savingsTableBody = [];
  if (option.savingsBreakdownList && option.savingsBreakdownList.length > 0) {
    option.savingsBreakdownList.forEach(item => {
      if (item.value > 0 && !item.isHidden) {
        if (item.label === "Energy Charges Offset" && !saveEnergyCharges) return;
        if (item.label === "Electricity Duty Offset" && !saveElectricityDuty) return;
        if (item.label === "Wheeling & Fuel Adjustment (FAC) Offset" && !saveWheelingFac) return;
        if (item.label === "ToD Daytime Solar Generation Credit" && !saveTodRebate) return;

        savingsTableBody.push([
          item.label,
          formatCurrency(item.value),
          formatCurrency(item.value * 12),
          tipMap[item.label] || "Solar net metering bill reduction benefit"
        ]);
      }
    });
  } else {
    const sb = option.savingsBreakdown || {};
    if (saveEnergyCharges && sb.energyChargeOffset > 0) {
      savingsTableBody.push(["Energy Charges Offset", formatCurrency(sb.energyChargeOffset), formatCurrency(sb.energyChargeOffset * 12), tipMap["Energy Charges Offset"]]);
    }
    if (saveElectricityDuty && sb.dutyOffset > 0) {
      savingsTableBody.push(["Electricity Duty Offset", formatCurrency(sb.dutyOffset), formatCurrency(sb.dutyOffset * 12), tipMap["Electricity Duty Offset"]]);
    }
    if (saveWheelingFac && sb.wheelingFacOffset > 0) {
      savingsTableBody.push(["Wheeling & Fuel Adjustment (FAC) Offset", formatCurrency(sb.wheelingFacOffset), formatCurrency(sb.wheelingFacOffset * 12), tipMap["Wheeling & Fuel Adjustment (FAC) Offset"]]);
    }
    if (saveTodRebate && sb.todDaytimeRebate > 0) {
      savingsTableBody.push(["ToD Daytime Solar Generation Credit", formatCurrency(sb.todDaytimeRebate), formatCurrency(sb.todDaytimeRebate * 12), tipMap["ToD Daytime Solar Generation Credit"]]);
    }
    if (sb.todPeakAvoided > 0) {
      savingsTableBody.push(["Peak penalty avoided", formatCurrency(sb.todPeakAvoided), formatCurrency(sb.todPeakAvoided * 12), tipMap["Peak penalty avoided"]]);
    }
    if (sb.pfIncentive > 0) {
      savingsTableBody.push(["PF improvement", formatCurrency(sb.pfIncentive), formatCurrency(sb.pfIncentive * 12), tipMap["PF improvement"]]);
    }
    if (sb.promptPayDiscount > 0) {
      savingsTableBody.push(["Prompt pay discount", formatCurrency(sb.promptPayDiscount), formatCurrency(sb.promptPayDiscount * 12), tipMap["Prompt pay discount"]]);
    }
  }

  savingsTableBody.push(["-------------------", "-------------------", "-------------------", ""]);
  savingsTableBody.push([
    "Estimated Savings / Month (Save/mo)",
    formatCurrency(option.monthlySavings),
    formatCurrency(option.annualSavings),
    "Direct monthly electricity bill reduction"
  ]);
  savingsTableBody.push([
    "Total Projected Annual Savings",
    formatCurrency(option.annualSavings),
    formatCurrency(option.annualSavings),
    "First year projected cumulative financial savings"
  ]);

  doc.autoTable({
    startY: yPos,
    head: [["Offsettable Bill Component", "Monthly Savings", "Annual Savings", "Solar Benefit Description"]],
    body: savingsTableBody,
    theme: "plain",
    headStyles: { fillColor: COLORS.primary, fontSize: 8.5, textColor: COLORS.white },
    bodyStyles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: {
      0: { fontStyle: "normal", width: 62 },
      1: { halign: "right", width: 28 },
      2: { halign: "right", width: 28 },
      3: { fontStyle: "italic", fontSize: 7.5, textColor: COLORS.textLight, width: 62 },
    },
    didParseCell: function (data) {
      if (data.row.raw[0].includes("Estimated Savings / Month") || data.row.raw[0].includes("Save/mo")) {
        data.cell.styles.fillColor = COLORS.bgLight;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = COLORS.primary;
      } else if (data.row.raw[0].includes("Total Projected Annual Savings")) {
        data.cell.styles.fontStyle = "bold";
      }
    },
    margin: { left: margin },
  });

  yPos = doc.lastAutoTable.finalY + 7;

  // Conditionally include payback
  if (!hidePayback) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.text);
    doc.setFontSize(10);
    doc.text("Estimated Payback Period: ", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${option.paybackYears.toFixed(1)} Years`, margin + 50, yPos);
    yPos += 5.5;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(COLORS.text);
  doc.text("25-Year Lifetime Savings: ", margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.primary);
  doc.text(`${formatCurrency(option.lifetimeSavings)}`, margin + 50, yPos);
  yPos += 5.5;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.textLight);
  doc.text("* Note: Financial payback and bill savings projections are modeled on prevailing MSEDCL tariffs and MERC net metering regulations; subject to customer consumption patterns and grid availability.", margin, yPos);
  yPos += 8;

  // ================= SECTION 3 (or dynamic): Bank Partner Loan Proposal =================
  if (!hideFinancing && !hideCost && option.financing) {
    const fin = option.financing;
    doc.addPage();
    yPos = 30;
    addHeader("Bank Partner Loan Proposal");

    doc.setTextColor(COLORS.black);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    const loanProposalTitle = `${sectionNumber}. Bank Partner Loan Proposal (For illustrative purposes only actual cost depends on actual loan rates)`;
    const splitLoanTitle = doc.splitTextToSize(loanProposalTitle, pageWidth - margin * 2);
    doc.text(splitLoanTitle, margin, yPos);
    yPos += splitLoanTitle.length * 5.5 + 2.5;
    sectionNumber++;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.text);
    doc.text("Convert your monthly electricity bill into an appreciating rooftop solar asset with zero incremental budget.", margin, yPos);
    yPos += 7;

    // Zero Out-of-Pocket Hero Box
    const bannerHeight = 24;
    doc.setFillColor(242, 248, 238); // Soft green background
    doc.setDrawColor(99, 146, 62);  // Primary border
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, bannerHeight, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(COLORS.primary);
    doc.text("Zero Out-of-Pocket Principle & Strategic Capital Advantage", margin + 5, yPos + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(COLORS.text);
    const zeroPocketDesc = fin.isZeroOutOfPocket
      ? `Instead of paying your current MSEDCL electricity bill of Rs ${formatCurrency(fin.targetBillAmount)}/mo, you redirect that exact amount as a bank EMI (${formatCurrency(fin.monthlyEmi)}/mo). You incur Rs 0 extra monthly burden, and in just ${fin.tenureFormatted}, the entire system is 100% free and fully owned, giving you free electricity for the next ${fin.freeElectricityYears} years!`
      : `Finance your solar plant with an affordable bank EMI of ${formatCurrency(fin.monthlyEmi)}/mo for ${fin.tenureFormatted}, after which you enjoy 100% free solar power for the remaining ${fin.freeElectricityYears} years of system life.`;
    const splitFinDesc = doc.splitTextToSize(zeroPocketDesc, pageWidth - margin * 2 - 10);
    doc.text(splitFinDesc, margin + 5, yPos + 12);
    yPos += bannerHeight + 8;

    // 3 Mini KPI Summary Cards
    const totalW = pageWidth - margin * 2;
    const cardW = (totalW - 8) / 3;
    const cardH = 20;

    // Card 1: Monthly EMI
    doc.setFillColor(COLORS.bgLight);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(margin, yPos, cardW, cardH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.textLight);
    doc.text("Monthly Installment (EMI)", margin + 4, yPos + 5);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.primary);
    doc.text(`${formatCurrency(fin.monthlyEmi)} / mo`, margin + 4, yPos + 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(COLORS.textLight);
    doc.text("(Matches electricity bill)", margin + 4, yPos + 17);

    // Card 2: Payoff Tenure
    const card2X = margin + cardW + 4;
    doc.setFillColor(COLORS.bgLight);
    doc.roundedRect(card2X, yPos, cardW, cardH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textLight);
    doc.text("Loan Payoff Period", card2X + 4, yPos + 5);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.black);
    doc.text(fin.tenureFormatted, card2X + 4, yPos + 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(COLORS.textLight);
    doc.text("(Time to 100% free solar)", card2X + 4, yPos + 17);

    // Card 3: Free Solar Life
    const card3X = card2X + cardW + 4;
    doc.setFillColor(COLORS.bgLight);
    doc.roundedRect(card3X, yPos, cardW, cardH, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(COLORS.textLight);
    doc.text("100% Free Electricity", card3X + 4, yPos + 5);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.primary);
    doc.text(`${fin.freeElectricityYears} Years`, card3X + 4, yPos + 12);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(COLORS.textLight);
    doc.text("(Post-loan generation)", card3X + 4, yPos + 17);

    yPos += cardH + 8;

    // Commercial Comparison Table
    const finTableBody = [
      ["Upfront Customer Payment (Down Payment)", formatCurrency(fin.totalPreSubsidy), formatCurrency(fin.downPayment)],
      ["Loan Principal Amount (Bank Funded)", "-", formatCurrency(fin.principal)],
      ["Bank Partner Interest Rate", "-", `${fin.interestRatePct}% p.a.`],
      ["Monthly Installment (EMI)", "Rs 0 / mo", `${formatCurrency(fin.monthlyEmi)} / mo`],
      ["Loan Repayment Period (Payoff Duration)", "Immediate", fin.tenureFormatted],
      ["Total Interest Paid to Bank", "Rs 0", formatCurrency(fin.totalInterest)],
      ["Total Outflow over Life", formatCurrency(fin.upfrontNetCost), formatCurrency(fin.totalLoanCost)],
      ["100% Free Solar Electricity Period", "25.0 Years", `${fin.freeElectricityYears} Years`],
      ["25-Year Net Financial Gain", formatCurrency(fin.lifetimeNetGainUpfront), formatCurrency(fin.lifetimeNetGainWithLoan)],
    ];

    doc.autoTable({
      startY: yPos,
      head: [["Commercial Feature", "Option A: Upfront Cash", "Option B: Bank Loan (Zero Out-of-Pocket)"]],
      body: finTableBody,
      theme: "grid",
      headStyles: { fillColor: COLORS.primary, fontSize: 8.5, cellPadding: 2.5 },
      bodyStyles: { fontSize: 8, cellPadding: 2.2 },
      columnStyles: {
        0: { fontStyle: "normal", width: 85 },
        1: { halign: "right", width: 45 },
        2: { halign: "right", width: 50, fontStyle: "bold", textColor: COLORS.primary },
      },
      didParseCell: function (data) {
        if (data.row.index === finTableBody.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = COLORS.bgLight;
        }
      },
      margin: { left: margin },
    });

    yPos = doc.lastAutoTable.finalY + 5;

    // Strategic EMI & Opportunity Cost Advantage Card
    const optCostCardW = pageWidth - margin * 2;
    const bulletIndent = 6;
    const emiSubstText = `Paying EMI (${formatCurrency(fin.monthlyEmi)}/mo) to the bank instead of electricity bill payments (current bill) will make the solar system 100% free in just ${fin.tenureFormatted} (Option B vs Upfront Cash comparison). You incur zero extra monthly burden, and after payoff, you enjoy ${fin.freeElectricityYears} years of 100% free electricity!`;
    const oppCostText = `Save upfront cash (${formatCurrency(fin.totalPreSubsidy)}) and invest it in your business or high-yield assets (opportunity cost advantage). Keeping capital liquid for business expansion or working capital while letting your existing utility bill budget pay off the solar plant is the smartest financial leverage.`;

    const textWrapW = optCostCardW - 14;
    const lineSpacing = 3.5;
    const splitEmi = doc.splitTextToSize(emiSubstText, textWrapW);
    const splitOpp = doc.splitTextToSize(oppCostText, textWrapW);
    const optCostBoxH = 8.7 + 5.8 + (splitEmi.length * lineSpacing) + 3.3 + (splitOpp.length * lineSpacing) + 5.5;

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, yPos, optCostCardW, optCostBoxH, 1.5, 1.5, "FD");
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(margin, yPos, 2.5, optCostBoxH, 0.8, 0.8, "F");

    let cardTextY = yPos + 4.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text("Strategic Opportunity Cost & Loan EMI Note (Option B vs Upfront Cash):", margin + bulletIndent, cardTextY);
    cardTextY += 4.2;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text("1. Loan EMI vs Current Bill Substitution:", margin + bulletIndent, cardTextY);
    cardTextY += 3.3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(51, 65, 85);
    doc.text(splitEmi, margin + bulletIndent + 3, cardTextY);
    cardTextY += splitEmi.length * lineSpacing + 2.5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text("2. Save Upfront Cash & Invest in Business (Opportunity Cost):", margin + bulletIndent, cardTextY);
    cardTextY += 3.3;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.3);
    doc.setTextColor(51, 65, 85);
    doc.text(splitOpp, margin + bulletIndent + 3, cardTextY);

    yPos += optCostBoxH + 5;

    // Loan Advantages Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(COLORS.black);
    doc.text("Key Advantages of Bank Partner Solar Financing:", margin, yPos);
    yPos += 4.5;

    const benefits = [
      `Zero Incremental Monthly Budget: Paying EMI to the bank instead of bill payments makes the system free in just ${fin.tenureFormatted}.`,
      `Save Upfront Cash for Business: Preserve ${formatCurrency(fin.totalPreSubsidy)} liquidity for business working capital, inventory, or investment opportunity cost.`,
      "Nationalized Bank Schemes: Easy processing under PM Surya Ghar with subsidized interest rates.",
      "Asset Creation & Long-Term Wealth: Switch from a perpetual utility expense to owning a high-ROI power plant.",
      "No Prepayment Penalty: Option to prepay or foreclose at any time to eliminate interest and accelerate free power."
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    doc.setTextColor(COLORS.text);
    benefits.forEach((benefit) => {
      doc.text(`- ${benefit}`, margin + 2, yPos);
      yPos += 4.2;
    });

    yPos += 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.textLight);
    doc.text("* Note: Loan approval, interest rates, and final terms are governed exclusively by the lending bank. Financing delays or rejections do not alter payment milestone obligations to Datlion Cnergy Pvt. Ltd.", margin + 2, yPos);
    yPos += 6;
  }

  // ================= SECTION: Terms & Conditions, Warranty and Details =================
  doc.addPage();
  yPos = 30;
  addHeader("Warranty and Details");

  doc.setTextColor(COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${sectionNumber}. Terms & Conditions, Warranty and Details`, margin, yPos);
  yPos += 8;
  sectionNumber++;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  doc.text("Comprehensive component warranties, manufacturer guarantees, and contractual terms governing this EPC proposal.", margin, yPos);
  yPos += 8;

  const warrantyData = [
    ["1", "SOLAR PANEL", "Tier-1 Mono PERC / TOPCon (DCR / Non-DCR as per proposal)", "12 Year Warranty /\n30 Year Performance Warranty"],
    ["2", "DCDB", "HAVELLS 1 IN 1 OUT 600 V", "5 Year"],
    ["3", "EARTHING", "16 SQ MM EARTHING ALU. CONDUCTOR ROD;\n14 SQ MM × 1 MTR COPPER ROD", "—"],
    ["4", "DC CABLE", "4 SQ MM COPPER TIN", "20 Year"],
    ["5", "CIVIL CHAMBER", "ISI STANDARD", "10 Year"],
    ["6", "ONGRID INVERTER", "Grid-Tied Solar Inverter (IP65)", "10 Year Warranty"],
  ];

  doc.autoTable({
    startY: yPos,
    head: [["Sr. No.", "Product", "Make & Specification", "Warranty"]],
    body: warrantyData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary, fontStyle: "bold", fontSize: 9.5, halign: "center" },
    bodyStyles: { fontSize: 8.5, cellPadding: 3 },
    columnStyles: {
      0: { width: 15, halign: "center", fontStyle: "bold" },
      1: { width: 38, fontStyle: "bold" },
      2: { width: 77 },
      3: { width: 50, fontStyle: "bold", textColor: COLORS.primary, halign: "center" },
    },
    margin: { left: margin },
  });

  yPos = doc.lastAutoTable.finalY + 4;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(COLORS.textLight);
  doc.text("* Note: Other product warranties not mentioned above will be added later / as per project BOM.", margin, yPos);
  yPos += 9;

  // Terms and Conditions Section Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(COLORS.black);
  doc.text("Terms and Conditions for Warranty, System Design, Installation & Commercials", margin, yPos);
  yPos += 5.2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(COLORS.textLight);
  doc.text("The following terms and conditions govern this EPC proposal and form the collaborative agreement between Datlion Cnergy Pvt. Ltd. and the Client.", margin, yPos);
  yPos += 5.5;

  const renderTermsGroup = (categories) => {
    categories.forEach(cat => {
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 5.5, 1, 1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(COLORS.primary);
      doc.text(cat.categoryTitle, margin + 3.5, yPos + 3.8);
      yPos += 7.2;

      cat.terms.forEach(term => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.6);
        doc.setTextColor(COLORS.text);
        doc.text(term.title, margin, yPos);
        yPos += 3.3;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(COLORS.textLight);
        const splitDesc = doc.splitTextToSize(term.desc, pageWidth - margin * 2);
        doc.text(splitDesc, margin, yPos);
        yPos += splitDesc.length * 3.1 + 2.2;
      });

      yPos += 1.5;
    });
  };

  // --- Page 1 Terms: Categories A, B, C ---
  const termsPage1 = [
    {
      categoryTitle: "A. System Design & Generation Feasibility Terms",
      terms: [
        {
          title: "1. Simulated Solar Generation & Yield Engineering:",
          desc: "Projections and carbon offsets are computer-simulated engineering estimations based on standard test conditions (STC) and historical Pune irradiance data (NASA/Meteonorm). Actual yield reflects real-time sunlight, seasonal weather, grid availability, and routine module washing."
        },
        {
          title: "2. Grid Synchronization & Statutory Anti-Islanding:",
          desc: "As mandated by Central Electricity Authority (CEA) and MSEDCL safety regulations, on-grid inverters automatically disconnect during utility power cuts or voltage/frequency trips (anti-islanding protection). Standby during utility outages is a regulatory safety feature."
        },
        {
          title: "3. Future Shading Obstructions & Property Alterations:",
          desc: "Array design is optimized for site conditions at the time of survey. Subsequent construction, foliage growth, or architectural changes on adjoining properties that cast shade are beyond the installer's scope."
        }
      ]
    },
    {
      categoryTitle: "B. Rooftop Layout, Civil & Structural Responsibilities",
      terms: [
        {
          title: "1. Roof Structural Soundness & Load Capacity:",
          desc: "Mounting structures are engineered for wind speeds up to 150 km/h. The client confirms the roof slab or support structure possesses adequate structural load-bearing capacity for the solar installation."
        },
        {
          title: "2. Fastener Sealing & Roof Water Ingress:",
          desc: "Datlion Cnergy employs standard chemical anchoring and weatherproofing sealant at base fixings. General roof slab waterproofing and structural maintenance remain the client's responsibility."
        },
        {
          title: "3. Rooftop Access & Routine Module Washing:",
          desc: "The client provides safe roof access and a soft-water tap connection. Fortnightly module washing with clean, non-abrasive water preserves peak power output and maintains OEM warranties."
        },
        {
          title: "4. Indicative Blueprint & Site Adaptations:",
          desc: "The CAD layout is an indicative engineering blueprint. Minor string routing or walkway adjustments may be made during physical installation to best accommodate site conduits without reducing contracted DC capacity."
        }
      ]
    },
    {
      categoryTitle: "C. Commercial, Pricing & Milestone Payment Terms",
      terms: [
        {
          title: "1. Quotation Validity & Milestone Progress:",
          desc: "Pricing is valid for 15 days from issue date. Payments follow agreed project milestones (advance booking, material dispatch, installation, and commissioning), ensuring smooth procurement and prompt execution."
        },
        {
          title: "2. Cabling, Wiring & Civil Works at Actuals:",
          desc: "Standard bill of materials (BOM) allowances are included. Cabling and wiring charges will be at actual measured length of DC and AC cabling required on site, ensuring client pays transparently for exact site requirements."
        },
        {
          title: "3. Statutory Taxes & On-Site Material Custody:",
          desc: "Pricing reflects prevailing GST rates (effective composite 8.9%). Delivered materials stored safely at site transition to client custody, with ownership title transferring upon final milestone settlement."
        }
      ]
    }
  ];

  renderTermsGroup(termsPage1);

  // --- Page 2 Terms: Categories D, E, F, G ---
  doc.addPage();
  yPos = 30;
  addHeader("Terms and Conditions (Contd.)");

  const termsPage2 = [
    {
      categoryTitle: "D. MSEDCL Net Metering, Grid Interconnection & PM Surya Ghar Subsidy Terms",
      terms: [
        {
          title: "1. PM Surya Ghar Central Subsidy (Direct Benefit Transfer):",
          desc: "The central capital subsidy under PM Surya Ghar is credited directly into the client's bank account via government DBT. Datlion Cnergy actively assists with National Portal documentation; project contract payments to the EPC remain independent of government DBT processing timelines."
        },
        {
          title: "2. DISCOM Net Metering Feasibility & Approvals:",
          desc: "Net meter connectivity and sanctioned load feasibility are governed by MSEDCL regulations and local distribution transformer (DT) solar limits. Datlion Cnergy provides comprehensive liaisoning support, with official utility statutory fees and infrastructure charges borne by the applicant."
        }
      ]
    },
    {
      categoryTitle: "E. Bank Partner Financing Facilitation Terms",
      terms: [
        {
          title: "1. Illustrative EMI Projections & Underwriting:",
          desc: "All bank EMI figures, interest rates (e.g. 9.5% p.a.), and payback timelines are illustrative estimates. Final loan sanction, interest rates, and loan tenure are determined by the partner lending bank (SBI, Canara Bank, Union Bank, etc.) under PM Surya Ghar nationalized schemes."
        },
        {
          title: "2. EPC Facilitation Role & Independent Milestones:",
          desc: "Datlion Cnergy acts as a technology and documentation facilitator to help clients secure competitive green solar loans. Project milestone payments proceed in coordination with bank disbursement schedules."
        }
      ]
    },
    {
      categoryTitle: "F. Terms and Conditions for Warranty & OEM Pass-Through",
      terms: [
        {
          title: "1. Original Equipment Manufacturer (OEM) Pass-Through:",
          desc: "Solar panels (12-yr product / 30-yr performance), inverters (10-yr), and switchgear carry direct manufacturer warranties. Datlion Cnergy acts as your local single-point facilitator for manufacturer warranty claims and RMA processing."
        },
        {
          title: "2. Operation, Maintenance & Pass-Through Warranty:",
          desc: "All product warranties are original equipment manufacturer (OEM) pass-through warranties. Standard warranty remains valid when the system is operated within rated electrical parameters, cleaned regularly with soft water, and serviced by authorized personnel."
        },
        {
          title: "3. Natural Calamity & Force Majeure Protections:",
          desc: "Warranties cover equipment manufacturing and performance defects. Damages caused by Natural Calamity events (cyclones exceeding design rating, hailstorms, flooding, earthquakes) or Force Majeure disruptions (civil unrest, grid-level anomalies) are covered under comprehensive plant insurance rather than equipment warranties."
        },
        {
          title: "4. Change in Government Policies & Regulatory Framework:",
          desc: "Savings and payback models are based on current MERC net metering regulations and MSEDCL tariffs. Any future Change in Government Policies, tariff revisions, or DISCOM grid-banking rules are external regulatory updates."
        }
      ]
    },
    {
      categoryTitle: "G. Proposal-Wide General EPC Terms & Conditions",
      terms: [
        {
          title: "1. Limitation of EPC Liability (Capped at 5%):",
          desc: "To the extent permitted by law, the total cumulative aggregate liability of Datlion Cnergy Pvt. Ltd. for any claim or dispute arising under this proposal shall be subject to a Limitation of EPC Liability (Capped at 5%) of the total contract value actually received, excluding indirect or consequential downtime losses."
        },
        {
          title: "2. Mutual Good Faith & Exclusive Jurisdiction:",
          desc: "Both parties agree to resolve any operational questions through mutual consultation and good-faith cooperation. Unresolved legal disputes shall be subject to the exclusive jurisdiction of the competent courts in Pune, Maharashtra, India."
        }
      ]
    }
  ];

  renderTermsGroup(termsPage2);

  // ================= SECTION: Solar System Types =================
  doc.addPage();
  yPos = 30;
  addHeader("Solar System Types");

  doc.setTextColor(COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${sectionNumber}. Solar System Types`, margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  doc.text("Understanding the different solar system configurations to choose the right solution for your needs.", margin, yPos);
  yPos += 10;

  // Insert system_differences.png image
  if (sysDiffResult) {
    // Ensure image doesn't overflow the page
    const maxWidth = pageWidth - margin * 2;
    const maxHeight = pageHeight - yPos - 30;
    const imgRatio = (sysDiffResult.width > 0) ? sysDiffResult.height / sysDiffResult.width : 1;
    const imgWidth = maxWidth;
    const imgHeight = imgWidth * imgRatio;

    const finalWidth = imgHeight > maxHeight ? maxHeight / imgRatio : imgWidth;
    const finalHeight = imgHeight > maxHeight ? maxHeight : imgHeight;

    if (!isNaN(finalWidth) && !isNaN(finalHeight)) {
      doc.addImage(sysDiffResult.data, 'JPEG', margin, yPos, finalWidth, finalHeight);
      yPos += finalHeight + 10;
    } else {
      yPos += 10;
    }
  } else {
    // Fallback: text descriptions
    const systemDescriptions = [
      ["On-Grid", "Connected to utility grid. Solar panels generate power during day, excess is exported via net metering. No battery backup - system shuts down during power cuts. Lowest cost, best ROI."],
      ["Semi-Hybrid", "On-grid with a small backup inverter and battery. Provides basic backup during outages while maintaining net metering benefits. Good balance of savings and reliability."],
      ["Hybrid", "Grid-connected with full battery storage. Solar charges batteries during the day, batteries provide backup during outages. Higher cost but complete energy independence."],
      ["Off-Grid", "Fully independent - no grid connection. Requires larger battery banks. Best for locations without reliable grid access. Highest cost, no net metering."],
    ];

    systemDescriptions.forEach(([type, desc]) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(COLORS.primary);
      doc.text(type, margin, yPos);
      yPos += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(COLORS.text);
      const lines = doc.splitTextToSize(desc, pageWidth - margin * 2);
      doc.text(lines, margin, yPos);
      yPos += lines.length * 5 + 6;
    });
  }

  // ================= APPLY DYNAMIC FOOTERS TO ALL PAGES =================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 10;
    doc.setTextColor(COLORS.text);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");

    // Left: URL
    doc.text("www.cnergy.co.in", margin, footerY);

    // Center: Page X of Y | Ref: proposalSerialNo
    doc.text(`Page ${i} of ${totalPages}  |  Ref: ${proposalSerialNo}`, pageWidth / 2, footerY, { align: "center" });

    // Right: Company Name & Location
    doc.setFontSize(7.5);
    doc.text("DATLION CNERGY PRIVATE LIMITED", pageWidth - margin, footerY - 4, { align: "right" });
    doc.text("GSTIN: 27AALCD8550A1ZP | Pune", pageWidth - margin, footerY, { align: "right" });
  }

  const filename = input.customerName
    ? `DC_Energy_Proposal_${input.customerName.replace(/\s+/g, "_")}.pdf`
    : `DC_Energy_Proposal.pdf`;

  doc.save(filename);
  } catch (error) {
    console.error("PDF generation error:", error);
    alert("Error generating PDF: " + error.message);
  }
}

// Make available globally for both module and non-module usage
if (typeof window !== 'undefined') {
  window.generateProposalPDF = generateProposalPDF;
}
