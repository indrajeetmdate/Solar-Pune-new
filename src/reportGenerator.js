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
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({
        data: canvas.toDataURL('image/jpeg', 0.8),
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
    const [logoResult, sysDiffResult] = await Promise.all([
      loadImage("https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energy.png"),
      loadImage("https://solarcalculator.cnergy.co.in/src/system_differences.png", 2400),
    ]);

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

  const { hidePayback, hideAreaFit, hideSubsidy, hideCost, solarInstalled } = hideFlags;

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
      doc.addImage(logoResult.data, 'JPEG', pageWidth - margin - targetWidth, footerY - 8 - targetHeight, targetWidth, targetHeight, 'companyLogo');
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

  // Selected system type label
  doc.setTextColor(COLORS.primary);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(`Selected System: ${formatSysType(option.systemType)} (${option.dcCapacityKw} kWp)`, margin, yPos);
  yPos += 10;

  // Sizing Requirements
  doc.setTextColor(COLORS.black);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Capacity Requirements", margin, yPos);
  yPos += 8;

  const reqData = [
    ["Required by Consumption", `${option.sizing.byConsumptionKw} kW`],
    ["Supported by Roof Area", `${option.sizing.byAreaKw} kW`],
    ["Sanctioned Load Limit", option.sizing.byLoadKw ? `${option.sizing.byLoadKw} kW` : "N/A"],
    [solarInstalled ? "Installed Solar Capacity" : "Recommended Solar Capacity", `${option.dcCapacityKw} kWp`],
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

    const panelData = [
      ["Panel Specification", `${panelLayout.panelDimensions} (${panelLayout.panelWp} Wp each)`],
      ["Number of Panels", `${panelLayout.numPanels} panels`],
      ["Total Area Required", `${panelLayout.totalAreaSqft} sq ft (${panelLayout.totalAreaSqm} m²)`],
      ["Available Installation Area", `${panelLayout.availableAreaSqft} sq ft`],
    ];

    // Conditionally include "Fits in Available Area"
    if (!hideAreaFit) {
      const fitStatus = panelLayout.fitsInArea === null
        ? "Area not specified"
        : panelLayout.fitsInArea
          ? `Yes — fits in ${panelLayout.availableAreaSqft} sq ft`
          : `No — needs ${panelLayout.totalAreaSqft - panelLayout.availableAreaSqft} sq ft more`;
      panelData.push(["Fits in Available Area", fitStatus]);
    }

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
    columnStyles: {
      0: { fontStyle: "bold", width: 80, fillColor: COLORS.bgLight },
    },
    margin: { left: margin },
  });
  yPos = doc.lastAutoTable.finalY + 15;

  addFooter(1);

  // ================= PAGE 2: Financial Quote =================
  if (!hideCost) {
    doc.addPage();
    yPos = 30;
    addHeader("Financial Quote");
  
    doc.setTextColor(COLORS.black);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("2. Financial Quote & Breakup", margin, yPos);
    yPos += 10;
  
    doc.setFontSize(12);
    doc.text(`Selected Option: ${formatSysType(option.systemType)} (${option.dcCapacityKw} kWp)`, margin, yPos);
    yPos += 10;
  
    const cBreakup = option.costBreakup;
    mainInverterPrefix = "On-grid";
    if (option.systemType === "hybrid") mainInverterPrefix = "Hybrid";
    if (option.systemType === "offgrid") mainInverterPrefix = "Off-grid";
  
    // Build system includes text - use custom text if provided, otherwise auto-generate
    let includesText;
    if (option.systemIncludesText) {
      includesText = "System Includes: " + option.systemIncludesText;
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
          "Electrical safety and wiring",
          "Installation & Commissioning",
          "Consultancy"
        );
        if (cBreakup.backupInverter > 0) includedItems.push("Backup Off-grid Inverter");
        if (cBreakup.battery > 0) includedItems.push("Battery Storage");
      }
      includesText = "System Includes: " + includedItems.join(", ") + ", GST, and Contingency.";
    }
  
    doc.setFontSize(10);
    doc.setTextColor(COLORS.text);
    const splitIncludes = doc.splitTextToSize(includesText, 210 - margin * 2);
    doc.text(splitIncludes, margin, yPos);
    yPos += (splitIncludes.length * 5) + 5;
  
    const costData = [];
    costData.push(["Total System Cost (Inc. GST)", formatCurrency(option.totalPreSubsidy)]);
  
    // Conditionally include subsidy
    if (!hideSubsidy) {
      costData.push(["Expected Subsidy", `- ${formatCurrency(option.subsidy)}`]);
    }
    costData.push(["Net Payable Cost", formatCurrency(option.netCost)]);
  
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
  } else {
    doc.addPage();
    yPos = 30;
    addHeader("Estimated Savings");
  }

  // Estimated Savings summary
  doc.setTextColor(COLORS.black);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Estimated Savings", margin, yPos);
  yPos += 5;
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(COLORS.textLight);
  doc.text("* Note: These are system-generated estimates and actual figures may vary.", margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.text);
  
  const savingsData = [];
  
  if (option.savingsBreakdownList) {
    const tipMap = {
      "Slab/tariff offset": "Savings from generating your own electricity & shifting to lower MSEDCL slabs.",
      "ToD daytime rebate": "Time-of-Day credits earned for generating solar during daytime (9AM-5PM).",
      "Peak penalty avoided": "Using battery during peak hours (5PM-10PM) avoids expensive MSEDCL peak tariffs.",
      "PF improvement": "Smart inverters maintain a high Power Factor, earning a discount from MSEDCL.",
      "Prompt pay discount": "1% bill discount for prompt payment, easier with significantly lowered bills.",
      "Banking loss": "MSEDCL grid-support charges on excess solar energy exported to the grid.",
    };
    option.savingsBreakdownList.forEach(item => {
      if (!item.isHidden && item.value !== 0) {
        let label = item.label;
        let valueStr = item.value < 0 ? `-${formatCurrency(Math.abs(item.value * 12))}` : formatCurrency(item.value * 12);
        let tip = tipMap[item.label] || "";
        savingsData.push([label, valueStr, tip]);
      }
    });
    
    savingsData.push(["-------------------", "-------------------", ""]);
    savingsData.push(["Total Annual Savings", formatCurrency(option.annualSavings), "Projected savings in the first year of operation."]);
  } else {
    savingsData.push(["Total Annual Savings", formatCurrency(option.annualSavings), "Projected savings in the first year of operation."]);
  }

  doc.autoTable({
    startY: yPos,
    body: savingsData,
    theme: "plain",
    columnStyles: {
      0: { fontStyle: "bold", width: 45 },
      1: { halign: "right", fontStyle: "bold", textColor: COLORS.primary },
      2: { fontStyle: "italic", fontSize: 9, textColor: COLORS.textLight }
    },
    didParseCell: function (data) {
      if (data.row.raw[0].includes("Total Annual Savings")) {
        data.cell.styles.fillColor = COLORS.bgLight;
      }
      if (data.row.raw[0].includes("Banking Charges")) {
        data.row.cells[1].styles.textColor = [200, 50, 50]; // Red color for loss
      }
    },
    margin: { left: margin },
  });

  yPos = doc.lastAutoTable.finalY + 8;

  // Conditionally include payback
  if (!hidePayback) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(COLORS.text);
    doc.text(`Estimated Payback Period: `, margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${option.paybackYears.toFixed(1)} Years`, margin + 50, yPos);
    yPos += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.text(`25-Year Lifetime Savings: `, margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(COLORS.primary);
  doc.text(`${formatCurrency(option.lifetimeSavings)}`, margin + 50, yPos);

  
  addFooter(2);

  // ================= PAGE 3: System Type Differences =================
  doc.addPage();
  yPos = 30;
  addHeader("Solar System Types");

  doc.setTextColor(COLORS.black);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("3. Solar System Types", margin, yPos);
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
      ["On-Grid", "Connected to utility grid. Solar panels generate power during day, excess is exported via net metering. No battery backup — system shuts down during power cuts. Lowest cost, best ROI."],
      ["Semi-Hybrid", "On-grid with a small backup inverter and battery. Provides basic backup during outages while maintaining net metering benefits. Good balance of savings and reliability."],
      ["Hybrid", "Grid-connected with full battery storage. Solar charges batteries during the day, batteries provide backup during outages. Higher cost but complete energy independence."],
      ["Off-Grid", "Fully independent — no grid connection. Requires larger battery banks. Best for locations without reliable grid access. Highest cost, no net metering."],
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
