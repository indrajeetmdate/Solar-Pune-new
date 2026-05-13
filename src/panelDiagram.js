export function drawPanelArray(canvas, config) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.parentElement.clientWidth;
  const logicalHeight = 350;

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  const { rows, cols, panelWidthMm, panelHeightMm } = config;
  
  // Scale down to fit terrace area
  const scale = 0.035; // slightly increased from 0.028 to use horizontal space well
  const pW = panelWidthMm * scale;
  const pH = panelHeightMm * scale;
  const totalW = cols * pW;
  const totalH = rows * pH;
  
  const cx = logicalWidth / 2;
  const cy = logicalHeight / 2 + 100; // shifted downward

  // Straight orthographic projection with depth foreshortening
  // x: horizontal
  // y: depth (front-to-back)
  // z: vertical height
  const proj = (x, y, z) => ({
    x: cx + x,
    y: cy + y * 0.5 - z
  });

  const tiltRad = 20 * Math.PI / 180; // visual tilt angle
  const structureHeight = 10; // minimal leg height at the front

  // Z calculation: back is elevated, front is low.
  // y ranges from -totalH/2 (back) to totalH/2 (front).
  const getZ = (y) => structureHeight + (totalH/2 - y) * Math.tan(tiltRad);

  // Helper to draw polygons
  const drawPoly = (pts, fill, stroke, lineWidth = 1) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  };

  // 1. Draw floor shadows for legs
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (c % Math.max(1, Math.floor(cols/2)) === 0) {
        const x = c * pW - totalW/2;
        const y = r * pH - totalH/2;
        const p = proj(x, y, 0);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 10, 3, 0, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Draw back to front to ensure proper overlap
  for (let r = 0; r <= rows; r++) {
    const yLine = r * pH - totalH/2;
    const zLine = getZ(yLine);

    // 2. Draw Legs for this row
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    for (let c = 0; c <= cols; c++) {
      if (c % Math.max(1, Math.floor(cols/2)) === 0) {
        const xLine = c * pW - totalW/2;
        const pb = proj(xLine, yLine, 0);
        const pt = proj(xLine, yLine, zLine);
        ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      }
    }

    // 3. Draw horizontal support rail for this row
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    const pr1 = proj(-totalW/2, yLine, zLine);
    const pr2 = proj(totalW/2, yLine, zLine);
    ctx.beginPath(); ctx.moveTo(pr1.x, pr1.y); ctx.lineTo(pr2.x, pr2.y); ctx.stroke();
  }

  // 4. Draw Panels (back to front)
  const panelGap = 1.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // y values: r=0 is back (more negative), r=rows-1 is front
      const yBack = r * pH - totalH/2 + panelGap;
      const yFront = (r + 1) * pH - totalH/2 - panelGap;
      const xLeft = c * pW - totalW/2 + panelGap;
      const xRight = (c + 1) * pW - totalW/2 - panelGap;
      
      const zBack = getZ(yBack);
      const zFront = getZ(yFront);

      const pBackLeft = proj(xLeft, yBack, zBack);
      const pBackRight = proj(xRight, yBack, zBack);
      const pFrontRight = proj(xRight, yFront, zFront);
      const pFrontLeft = proj(xLeft, yFront, zFront);

      // Panel background and border
      drawPoly([pBackLeft, pBackRight, pFrontRight, pFrontLeft], "#1e293b", "#cbd5e1");

      // Inner cell grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      // vertical lines (front to back)
      for(let i=1; i<6; i++) {
        const lx = xLeft + (xRight - xLeft)*(i/6);
        const ptBack = proj(lx, yBack, zBack);
        const ptFront = proj(lx, yFront, zFront);
        ctx.moveTo(ptBack.x, ptBack.y); ctx.lineTo(ptFront.x, ptFront.y);
      }
      // horizontal lines (left to right)
      for(let i=1; i<10; i++) {
        const ly = yBack + (yFront - yBack)*(i/10);
        const lz = getZ(ly);
        const ptLeft = proj(xLeft, ly, lz);
        const ptRight = proj(xRight, ly, lz);
        ctx.moveTo(ptLeft.x, ptLeft.y); ctx.lineTo(ptRight.x, ptRight.y);
      }
      ctx.stroke();
    }
  }

  // 5. Draw Dimension Arrows
  const drawArrow = (pStart, pEnd, label) => {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();

    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    const mx = (pStart.x + pEnd.x)/2;
    const my = (pStart.y + pEnd.y)/2;
    ctx.fillText(label, mx, my - 5);
    ctx.shadowBlur = 0;
  };

  // Width dimension (along front edge)
  const yFrontEdge = totalH/2;
  const zFrontEdge = getZ(yFrontEdge);
  const d1 = proj(-totalW/2, yFrontEdge + 30, zFrontEdge);
  const d2 = proj(totalW/2, yFrontEdge + 30, zFrontEdge);
  drawArrow(d1, d2, `${(cols * panelWidthMm / 1000).toFixed(2)} m`);

  // Height dimension (along right edge)
  const xRightEdge = totalW/2 + 20;
  const d3 = proj(xRightEdge, -totalH/2, getZ(-totalH/2));
  const d4 = proj(xRightEdge, totalH/2, getZ(totalH/2));
  drawArrow(d3, d4, `${(rows * panelHeightMm / 1000).toFixed(2)} m`);
}
