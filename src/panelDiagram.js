export function drawPanelArray(canvas, config) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  
  // Logical canvas dimensions
  const logicalWidth = canvas.parentElement.clientWidth;
  const logicalHeight = 300; // Fixed max height for the diagram area

  // Setup hi-dpi canvas
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  // Configuration
  const {
    rows,
    cols,
    panelWidthMm,
    panelHeightMm,
    tiltAngle,
    orientationDir
  } = config;

  const totalWidthMm = cols * panelWidthMm;
  const totalHeightMm = rows * panelHeightMm;

  // We need to scale the physical dimensions (mm) to fit in the logical canvas.
  // We'll leave padding for dimensions and compass.
  const padding = 40;
  const availableWidth = logicalWidth - padding * 2;
  const availableHeight = logicalHeight - padding * 2;

  // Calculate scale factor to fit
  const scaleX = availableWidth / totalWidthMm;
  const scaleY = availableHeight / totalHeightMm;
  const scale = Math.min(scaleX, scaleY) * 0.9; // 90% of max fit

  const drawWidth = totalWidthMm * scale;
  const drawHeight = totalHeightMm * scale;
  const pWidth = panelWidthMm * scale;
  const pHeight = panelHeightMm * scale;

  // Center the drawing
  const cx = logicalWidth / 2;
  const cy = logicalHeight / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // 1. Compass / Orientation (Simple text indicator top-right)
  ctx.restore();
  ctx.save();
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "var(--ink, #333)";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(`Facing: ${orientationDir}`, logicalWidth - 10, 10);
  ctx.fillText(`Tilt: ${tiltAngle}°`, logicalWidth - 10, 26);
  ctx.restore();

  // Re-translate to center for array drawing
  ctx.save();
  ctx.translate(cx, cy);

  // The CSS 3D transform handles the perspective/tilt visually in the browser,
  // but if we want to draw it purely on 2D canvas we apply some isometric transforms.
  // The user plan mentioned CSS transforms in index.html, but drawing the grid 
  // on canvas is easiest. Wait, the plan says:
  // "transform: rotateX(var(--tilt)) rotateZ(var(--orient));"
  // If we rely on CSS for the 3D effect, we should just draw the array flat!
  // BUT the compass and dimensions will also be rotated and tilted if we rotate the canvas.
  // It's better to draw everything flat on the canvas and let CSS transform just the array, 
  // OR draw the array, and draw dimensions outside it on the canvas *without* CSS transform.
  // Given the CSS approach, we would only apply CSS transform to the array. 
  // Let's actually draw it flat on the canvas, and use a wrapper div for CSS transform!
  // Wait, the plan was:
  // <canvas id="panelDiagramCanvas"></canvas>
  // <div id="panelDiagramDimensions" class="diagram-dimensions"></div>
  // Let's draw it flat. The CSS will tilt the canvas.

  const startX = -drawWidth / 2;
  const startY = -drawHeight / 2;

  // --- Draw Mechanical Structure ---
  ctx.save();
  // Drop shadow for the entire structure/panels to give depth over the "roof"
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 15;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;

  // Draw mounting rails (2 horizontal rails per row of panels)
  const railBleed = 10; // Rails stick out slightly beyond panels
  ctx.fillStyle = "#94a3b8"; // Metallic silver/gray
  
  for (let r = 0; r < rows; r++) {
    const yTopRail = startY + r * pHeight + pHeight * 0.2;
    const yBotRail = startY + r * pHeight + pHeight * 0.8;
    
    // Top rail for row r
    ctx.fillRect(startX - railBleed, yTopRail, drawWidth + railBleed * 2, 4);
    // Bottom rail for row r
    ctx.fillRect(startX - railBleed, yBotRail, drawWidth + railBleed * 2, 4);
  }

  // Draw vertical mounting brackets/legs periodically
  ctx.fillStyle = "#64748b"; // Darker metal for legs
  for (let c = 0; c <= cols; c++) {
    const xLeg = startX + c * pWidth - (c === cols ? 6 : 0);
    // Draw legs extending "down" slightly to simulate height
    for (let r = 0; r < rows; r++) {
      const yTopRail = startY + r * pHeight + pHeight * 0.2;
      const yBotRail = startY + r * pHeight + pHeight * 0.8;
      
      // Top rail mount
      ctx.fillRect(xLeg + 2, yTopRail - 2, 6, 12);
      // Bottom rail mount
      ctx.fillRect(xLeg + 2, yBotRail - 2, 6, 12);
    }
  }
  ctx.restore();

  // --- Draw Panels ---
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * pWidth;
      const y = startY + r * pHeight;

      // Panel background
      ctx.fillStyle = "#1e293b"; // Dark slate
      ctx.fillRect(x + 1, y + 1, pWidth - 2, pHeight - 2); // 1px gap between panels

      // Panel border (silver frame)
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, pWidth - 2, pHeight - 2);

      // Inner cell grid lines (simulating solar cells)
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      // vertical lines
      for (let i = 1; i < 6; i++) {
        const lineX = x + 1 + ((pWidth - 2) / 6) * i;
        ctx.moveTo(lineX, y + 1);
        ctx.lineTo(lineX, y + pHeight - 1);
      }
      // horizontal lines
      for (let i = 1; i < 10; i++) {
        const lineY = y + 1 + ((pHeight - 2) / 10) * i;
        ctx.moveTo(x + 1, lineY);
        ctx.lineTo(x + pWidth - 1, lineY);
      }
      ctx.stroke();
    }
  }

  // Draw dimensions outside the array
  ctx.restore(); // back to logical coords
}
