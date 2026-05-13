export function drawPanelArray(canvas, config) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const logicalWidth = canvas.parentElement.clientWidth;
  const logicalHeight = 350; // Increased height for tall legs

  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);

  const { rows, cols, panelWidthMm, panelHeightMm } = config;
  
  // Scale the physical dimensions (scaled down to fit terrace area)
  const scale = 0.028; // mm to px scale (reduced from 0.045)
  const pW = panelWidthMm * scale;
  const pH = panelHeightMm * scale;
  const totalW = cols * pW;
  const totalH = rows * pH;
  
  const cx = logicalWidth / 2;
  // Shifted downward significantly to place legs on the terrace floor
  const cy = logicalHeight / 2 + 110; 

  // Isometric projection
  const iso = (x, y, z) => ({
    x: cx + (x - y) * Math.cos(Math.PI / 6),
    y: cy + (x + y) * Math.sin(Math.PI / 6) - z
  });

  const tiltRad = 15 * Math.PI / 180; // visual tilt
  const structureHeight = 80; // tall legs for terrace

  // To draw back-to-front, we iterate x and y from back to front.
  // In our isometric view (x down-right, y down-left), back is small x, small y.
  
  // 1. Draw floor shadows for legs
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (c % Math.max(1, Math.floor(cols/2)) === 0 && r % Math.max(1, Math.floor(rows/2)) === 0) {
        const x = c * pW - totalW/2;
        const y = r * pH - totalH/2;
        const p = iso(x, y, 0);
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 8, 4, 0, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // 2. Draw Legs (Verticals)
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      // Only draw legs at corners and middle
      if (c % Math.max(1, Math.floor(cols/2)) === 0 && r % Math.max(1, Math.floor(rows/2)) === 0) {
        const x = c * pW - totalW/2;
        const y = r * pH - totalH/2;
        const zBottom = 0;
        const zTop = structureHeight + y * Math.tan(tiltRad); // top matches tilted plane
        
        const pb = iso(x, y, zBottom);
        const pt = iso(x, y, zTop);
        
        ctx.beginPath();
        ctx.moveTo(pb.x, pb.y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    }
  }

  // 3. Draw horizontal support rails (under the panels)
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 3;
  for (let r = 0; r <= rows; r++) {
    const y = r * pH - totalH/2;
    const z = structureHeight + y * Math.tan(tiltRad);
    const p1 = iso(-totalW/2, y, z);
    const p2 = iso(totalW/2, y, z);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const x = c * pW - totalW/2;
    const yStart = -totalH/2;
    const yEnd = totalH/2;
    const p1 = iso(x, yStart, structureHeight + yStart * Math.tan(tiltRad));
    const p2 = iso(x, yEnd, structureHeight + yEnd * Math.tan(tiltRad));
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // 4. Draw Panels
  const drawPoly = (pts, fill, stroke) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for(let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  };

  const panelGap = 1.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * pW - totalW/2 + panelGap;
      const y = r * pH - totalH/2 + panelGap;
      const w = pW - panelGap*2;
      const h = pH - panelGap*2;
      
      const z0 = structureHeight + y * Math.tan(tiltRad);
      const z1 = structureHeight + (y+h) * Math.tan(tiltRad);

      const p0 = iso(x, y, z0);
      const p1 = iso(x+w, y, z0);
      const p2 = iso(x+w, y+h, z1);
      const p3 = iso(x, y+h, z1);

      drawPoly([p0, p1, p2, p3], "rgba(30, 41, 59, 0.95)", "#cbd5e1");

      // Draw panel cell lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      for(let i=1; i<4; i++) {
        const lx = x + w*(i/4);
        const pt1 = iso(lx, y, z0);
        const pt2 = iso(lx, y+h, z1);
        ctx.moveTo(pt1.x, pt1.y); ctx.lineTo(pt2.x, pt2.y);
      }
      for(let i=1; i<6; i++) {
        const ly = y + h*(i/6);
        const lz = structureHeight + ly * Math.tan(tiltRad);
        const pt1 = iso(x, ly, lz);
        const pt2 = iso(x+w, ly, lz);
        ctx.moveTo(pt1.x, pt1.y); ctx.lineTo(pt2.x, pt2.y);
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

    // Text
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    const mx = (pStart.x + pEnd.x)/2;
    const my = (pStart.y + pEnd.y)/2;
    ctx.fillText(label, mx, my - 5);
    ctx.shadowBlur = 0; // reset
  };

  // Width dimension (along X axis)
  const yFront = totalH/2 + 20;
  const zFront = structureHeight + yFront * Math.tan(tiltRad);
  const d1 = iso(-totalW/2, yFront, zFront);
  const d2 = iso(totalW/2, yFront, zFront);
  drawArrow(d1, d2, `${(cols * panelWidthMm / 1000).toFixed(2)} m`);

  // Height dimension (along Y axis)
  const xRight = totalW/2 + 20;
  const d3 = iso(xRight, -totalH/2, structureHeight + (-totalH/2) * Math.tan(tiltRad));
  const d4 = iso(xRight, totalH/2, structureHeight + (totalH/2) * Math.tan(tiltRad));
  drawArrow(d3, d4, `${(rows * panelHeightMm / 1000).toFixed(2)} m`);
}
