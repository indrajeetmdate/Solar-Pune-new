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

  // Draw panels
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * pWidth;
      const y = startY + r * pHeight;

      // Panel background
      ctx.fillStyle = "#1e293b"; // Dark slate
      ctx.fillRect(x, y, pWidth, pHeight);

      // Panel border (silver frame)
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, pWidth, pHeight);

      // Inner cell grid lines (simulating solar cells, 6x10 grid per panel roughly)
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      // vertical lines
      for (let i = 1; i < 6; i++) {
        const lineX = x + (pWidth / 6) * i;
        ctx.moveTo(lineX, y);
        ctx.lineTo(lineX, y + pHeight);
      }
      // horizontal lines
      for (let i = 1; i < 10; i++) {
        const lineY = y + (pHeight / 10) * i;
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + pWidth, lineY);
      }
      ctx.stroke();
    }
  }

  // Draw dimensions outside the array
  ctx.restore(); // back to logical coords
}
