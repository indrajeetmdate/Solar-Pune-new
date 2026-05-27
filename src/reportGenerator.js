// Helper to load image and get base64 data
const loadImage = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve({
        data: canvas.toDataURL('image/png'),
        width: img.width,
        height: img.height
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

export async function generateProposalPDF(estimates) {
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
    // Load logo before generating document
    const logoResult = await loadImage("https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energy.png");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const COLORS = {
    primary: "#63923E",
    secondary: "#92B56B",
    text: "#4C4C4C",
    black: "#000000",
    white: "#FFFFFF",
    bgLight: "#eef3ec",
  };

  const { input, options, recommended, sanctionedStatus } = estimates;

  // --- Helpers ---
  const formatCurrency = (val) =>
    "Rs " + Number(val).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const addHeader = (title) => {
    doc.setFillColor(COLORS.primary);
    doc.rect(0, 0, pageWidth, 20, "F");

    doc.setTextColor(COLORS.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("DC ENERGY", margin, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(title, pageWidth - margin, 14, { align: "right" });
  };

  const addFooter = (pageNum) => {
    const footerY = pageHeight - 10;
    doc.setTextColor(COLORS.text);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    // Left: URL
    doc.text("www.cnergy.co.in", margin, footerY);
    
    // Center: Page number
    doc.text(`Page ${pageNum}`, pageWidth / 2, footerY, { align: "center" });
    
    // Right: Logo, Company Name, Location
    doc.setFontSize(8);
    doc.text("Datlion Cnergy Pvt. Ltd.", pageWidth - margin, footerY - 4, { align: "right" });
    doc.text("Pune, Maharashtra", pageWidth - margin, footerY, { align: "right" });
    
    if (logoResult) {
      const targetWidth = 16;
      const targetHeight = (logoResult.height / logoResult.width) * targetWidth;
      doc.addImage(logoResult.data, 'PNG', pageWidth - margin - targetWidth, footerY - 8 - targetHeight, targetWidth, targetHeight);
    }
  };

  // ================= PAGE 1: System Design Considerations =================
  let yPos = 30;
  addHeader("Solar System Proposal");

  doc.setTextColor(COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("1. System Design Considerations", margin, yPos);
  yPos += 10;

  // Customer details
  doc.setFontSize(11);
  doc.setTextColor(COLORS.text);
  doc.text(`Customer Name: ${input.customerName || "Valued Customer"}`, margin, yPos);
  yPos += 6;
  if (input.mobileNumber) {
    doc.text(`Mobile: ${input.mobileNumber}`, margin, yPos);
    yPos += 6;
  }
  if (input.emailAddress) {
    doc.text(`Email: ${input.emailAddress}`, margin, yPos);
    yPos += 6;
  }
  doc.text(`Monthly Consumption: ${input.monthlyUnits} units`, margin, yPos);
  yPos += 6;
  doc.text(`Current Average Bill: ${formatCurrency(input.monthlyBill || 0)}`, margin, yPos);
  yPos += 6;
  doc.text(`Sanctioned Load: ${input.sanctionedLoad} kW`, margin, yPos);
  yPos += 6;
  doc.text(`Usable Roof Area: ${input.roofArea} sq ft`, margin, yPos);
  yPos += 6;
  if (input.coordinates || input.tiltAngle !== null || input.orientationDir) {
    const geoInfo = [];
    if (input.coordinates) geoInfo.push(`Coordinates: ${input.coordinates}`);
    if (input.tiltAngle !== null) geoInfo.push(`Tilt: ${input.tiltAngle}°`);
    if (input.orientationDir) geoInfo.push(`Orientation: ${input.orientationDir}`);
    if (geoInfo.length > 0) {
      doc.text(geoInfo.join(" | "), margin, yPos);
      yPos += 6;
    }
  }
  yPos += 6;

  // Sizing Requirements
  doc.setTextColor(COLORS.black);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Capacity Requirements", margin, yPos);
  yPos += 8;

  const reqData = [
    ["Required by Consumption", `${recommended.sizing.byConsumptionKw} kW`],
    ["Supported by Roof Area", `${recommended.sizing.byAreaKw} kW`],
    ["Sanctioned Load Limit", recommended.sizing.byLoadKw ? `${recommended.sizing.byLoadKw} kW` : "N/A"],
    ["Recommended Solar Capacity", `${recommended.dcCapacityKw} kWp`],
    ["Sanction Status", sanctionedStatus.label]
  ];

  doc.autoTable({
    startY: yPos,
    body: reqData,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary },
    columnStyles: {
      0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
    },
    margin: { left: margin },
  });
  yPos = doc.lastAutoTable.finalY + 15;

  // Panel Layout Configuration
  const panelLayout = estimates.panelLayout;
  if (panelLayout) {
    doc.setTextColor(COLORS.black);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Panel Configuration", margin, yPos);
    yPos += 8;

    const fitStatus = panelLayout.fitsInArea === null
      ? "Area not specified"
      : panelLayout.fitsInArea
        ? `Yes — fits in ${panelLayout.availableAreaSqft} sq ft`
        : `No — needs ${panelLayout.totalAreaSqft - panelLayout.availableAreaSqft} sq ft more`;

    const panelData = [
      ["Panel Specification", `${panelLayout.panelDimensions} (${panelLayout.panelWp} Wp each)`],
      ["Number of Panels", `${panelLayout.numPanels} panels`],
      ["Total Area Required", `${panelLayout.totalAreaSqft} sq ft (${panelLayout.totalAreaSqm} m²)`],
      ["Available Installation Area", `${panelLayout.availableAreaSqft} sq ft`],
      ["Fits in Available Area", fitStatus],
    ];

    doc.autoTable({
      startY: yPos,
      body: panelData,
      theme: "grid",
      headStyles: { fillColor: COLORS.primary },
      columnStyles: {
        0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
      },
      margin: { left: margin },
    });
    yPos = doc.lastAutoTable.finalY + 15;
  }

  // Battery and Inverter Specifications
  doc.setTextColor(COLORS.black);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Battery and Inverter Specifications", margin, yPos);
  yPos += 8;

  let mainInverterPrefix = "On-grid";
  if (recommended.systemType === "hybrid") mainInverterPrefix = "Hybrid";
  if (recommended.systemType === "offgrid") mainInverterPrefix = "Off-grid";

  const inverterSpecs = [
    [`${mainInverterPrefix} Inverter Capacity`, `${recommended.inverterCapacityKw} kW`],
  ];
  
  if (recommended.systemType === "ongrid_basic_backup") {
    inverterSpecs.push(["Backup Off-grid Inverter", "1.1 kVA"]);
    inverterSpecs.push(["Backup Battery Capacity", `${recommended.batteryCapacityKwh} kWh`]);
  } else if (recommended.systemType === "ongrid_standard_backup") {
    inverterSpecs.push(["Backup Off-grid Inverter", "2.1 kVA"]);
    inverterSpecs.push(["Backup Battery Capacity", `${recommended.batteryCapacityKwh} kWh`]);
  } else if (recommended.batteryCapacityKwh > 0) {
    inverterSpecs.push(["Battery Capacity", `${recommended.batteryCapacityKwh} kWh`]);
  } else {
    inverterSpecs.push(["Battery Capacity", "No battery (Grid-tied system)"]);
  }

  doc.autoTable({
    startY: yPos,
    body: inverterSpecs,
    theme: "grid",
    headStyles: { fillColor: COLORS.primary },
    columnStyles: {
      0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
    },
    margin: { left: margin },
  });
  yPos = doc.lastAutoTable.finalY + 15;

  addFooter(1);

  // ================= PAGE 2: Feasible Solutions =================
  doc.addPage();
  yPos = 30;
  addHeader("Feasible Solutions Comparison");

  doc.setTextColor(COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("2. Feasible Solutions", margin, yPos);
  yPos += 10;

  const formatSysType = (t) =>
    t === "ongrid" ? "On-Grid" : t === "offgrid" ? "Off-Grid" : "Hybrid";

  const comparisonHead = [["System Type", "Net Cost", "Subsidy", "Savings / month", "Payback (Yrs)"]];
  const comparisonBody = options.map((opt) => [
    `${formatSysType(opt.systemType)} (${opt.dcCapacityKw} kW)`,
    formatCurrency(opt.netCost),
    formatCurrency(opt.subsidy),
    formatCurrency(opt.monthlySavings),
    opt.paybackYears === Infinity ? "N/A" : `${opt.paybackYears.toFixed(1)} yrs`,
  ]);

  doc.autoTable({
    startY: yPos,
    head: comparisonHead,
    body: comparisonBody,
    theme: "striped",
    headStyles: { fillColor: COLORS.primary },
    margin: { left: margin },
  });

  yPos = doc.lastAutoTable.finalY + 15;
  doc.setFontSize(11);
  doc.setTextColor(COLORS.text);
  doc.text(
    `Based on your goal (${input.goal}), the recommended option is the ${formatSysType(
      recommended.systemType
    )} system.`,
    margin,
    yPos
  );

  addFooter(2);

  // ================= PAGE 3: Financial Quote =================
  doc.addPage();
  yPos = 30;
  addHeader("Financial Quote");

  doc.setTextColor(COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("3. Financial Quote & Breakup", margin, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.text(`Selected Option: ${formatSysType(recommended.systemType)} (${recommended.dcCapacityKw} kWp)`, margin, yPos);
  yPos += 10;

  const cBreakup = recommended.costBreakup;
  let mainInverterPrefix = "On-grid";
  if (recommended.systemType === "hybrid") mainInverterPrefix = "Hybrid";
  if (recommended.systemType === "offgrid") mainInverterPrefix = "Off-grid";

  const costData = [
    ["Solar Panels", formatCurrency(cBreakup.panels)],
    [`${mainInverterPrefix} Inverter`, formatCurrency(cBreakup.inverter)],
    ["Mounting Structure", formatCurrency(cBreakup.structure)],
    ["Electrical safety and wiring", formatCurrency(cBreakup.electricalSafetyAndWiring)],
    ["Installation & Commissioning", formatCurrency(cBreakup.installation)],
    ["Consultancy", formatCurrency(cBreakup.consultancy)],
    ["Contingency", formatCurrency(cBreakup.contingency)],
  ];

  if (cBreakup.backupInverter > 0) {
    costData.splice(2, 0, ["Backup Off-grid Inverter", formatCurrency(cBreakup.backupInverter)]);
  }

  if (cBreakup.battery > 0) {
    const batteryLabel = cBreakup.backupInverter > 0 ? "Backup Battery Storage" : "Battery Storage";
    costData.push([batteryLabel, formatCurrency(cBreakup.battery)]);
  }

  // Pre-tax subtotal (exclude gst and effectiveGstRate from sum)
  const preTaxSubtotal = cBreakup.panels + cBreakup.structure + cBreakup.inverter +
    (cBreakup.backupInverter || 0) + cBreakup.battery + cBreakup.electricalSafetyAndWiring + cBreakup.installation +
    cBreakup.consultancy + cBreakup.contingency;
  
  costData.push(["-------------------", "-------------------"]);
  costData.push(["Subtotal (Pre-Tax)", formatCurrency(preTaxSubtotal)]);
  costData.push([`GST (${cBreakup.effectiveGstRate}% effective)`, formatCurrency(cBreakup.gst)]);
  costData.push(["-------------------", "-------------------"]);
  costData.push(["Total Cost (Inc. GST)", formatCurrency(recommended.totalPreSubsidy)]);
  costData.push(["Expected Subsidy", `- ${formatCurrency(recommended.subsidy)}`]);
  costData.push(["Net Payable Cost", formatCurrency(recommended.netCost)]);

  doc.autoTable({
    startY: yPos,
    body: costData,
    theme: "plain",
    columnStyles: {
      0: { fontStyle: "normal", width: 120 },
      1: { halign: "right" },
    },
    didParseCell: function (data) {
      // Bold the total rows
      if (
        data.row.raw[0].includes("Subtotal") ||
        data.row.raw[0].includes("Total Cost") ||
        data.row.raw[0].includes("Net Payable")
      ) {
        data.cell.styles.fontStyle = "bold";
      }
      if (data.row.raw[0].includes("Expected Subsidy")) {
        data.cell.styles.textColor = COLORS.primary;
      }
    },
    margin: { left: margin },
  });

  yPos = doc.lastAutoTable.finalY + 5;

  // Additional costs note
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(COLORS.text);
  doc.text("* Net metering and liaisoning costs are additional and will be quoted separately.", margin, yPos);
  doc.text("* GST: 70% goods @ 5% + 30% services @ 18% = 8.9% effective rate.", margin, yPos + 4);
  yPos += 13;

  // ROI summary
  doc.setTextColor(COLORS.black);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Return on Investment (ROI)", margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  doc.text(`Annual Savings: ${formatCurrency(recommended.annualSavings)}`, margin, yPos);
  yPos += 6;
  doc.text(`Payback Period: ${recommended.paybackYears.toFixed(1)} Years`, margin, yPos);
  yPos += 6;
  doc.text(`25-Year Lifetime Savings: ${formatCurrency(recommended.lifetimeSavings)}`, margin, yPos);
  
  addFooter(3);

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
