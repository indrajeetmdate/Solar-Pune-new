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
  
  // Scale down physical dimensions to internal model units
  const modelScale = 0.045; 
  const pW = panelWidthMm * modelScale;
  const pH = panelHeightMm * modelScale;
  const totalW = cols * pW;
  const totalH = rows * pH;
  
  const cx = logicalWidth / 2;
  const cyHorizon = logicalHeight / 2 - 20; // Horizon line on screen

  // 3D Perspective Camera Setup
  // Origin (0,0,0) is the center of the panel array on the floor.
  // x: horizontal (left/right)
  // y: depth (back is negative, front is positive)
  // z: vertical (up is positive)
  
  const camY = totalH / 2 + 180; // Distance of camera from the front edge
  const camZ = 120; // Height of camera above the floor
  const focalLength = 350; // Controls perspective distortion (lower = more extreme)

  const proj = (x, y, z) => {
    const dy = camY - y; 
    const scale = dy > 0 ? focalLength / dy : 0.01;
    
    const screenX = cx + x * scale;
    // Difference between camera height and object height
    const dz = camZ - z;
    const screenY = cyHorizon + dz * scale;
    
    return { x: screenX, y: screenY };
  };

  const tiltRad = 15 * Math.PI / 180; // Panel tilt angle
  const structureHeight = 15; // Leg height at the front

  // Calculate Z (height) based on Y (depth)
  // Back (negative y) is elevated. Front (positive y) is low.
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
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      if (c % Math.max(1, Math.floor(cols/2)) === 0) {
        const x = c * pW - totalW/2;
        const y = r * pH - totalH/2;
        const p = proj(x, y, 0);
        
        // Shadow size scales with perspective
        const dy = camY - y;
        const s = focalLength / dy;
        
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 10 * s, 3 * s, 0, 0, Math.PI*2);
        ctx.fill();
      }
    }
  }

  // Draw back to front for proper depth sorting
  for (let r = 0; r <= rows; r++) {
    const yLine = r * pH - totalH/2;
    const zLine = getZ(yLine);

    // 2. Draw Legs for this row
    ctx.strokeStyle = "#475569";
    for (let c = 0; c <= cols; c++) {
      if (c % Math.max(1, Math.floor(cols/2)) === 0) {
        const xLine = c * pW - totalW/2;
        const pb = proj(xLine, yLine, 0);
        const pt = proj(xLine, yLine, zLine);
        
        const dy = camY - yLine;
        ctx.lineWidth = Math.max(1, 6 * (focalLength / dy)); // Scale line width by depth
        ctx.lineCap = "round";
        
        ctx.beginPath(); ctx.moveTo(pb.x, pb.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      }
    }

    // 3. Draw horizontal support rail for this row
    ctx.strokeStyle = "#94a3b8";
    const dyRail = camY - yLine;
    ctx.lineWidth = Math.max(1, 4 * (focalLength / dyRail));
    
    const pr1 = proj(-totalW/2, yLine, zLine - 2); // Slightly below panel surface
    const pr2 = proj(totalW/2, yLine, zLine - 2);
    ctx.beginPath(); ctx.moveTo(pr1.x, pr1.y); ctx.lineTo(pr2.x, pr2.y); ctx.stroke();
  }

  // 4. Draw Panels (back to front)
  const panelGap = 1.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
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
      drawPoly([pBackLeft, pBackRight, pFrontRight, pFrontLeft], "rgba(30, 41, 59, 0.98)", "#cbd5e1");

      // Inner cell grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
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
  const drawArrow = (pStart, pEnd, label, offsetTextY = -5) => {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();

    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 4;
    const mx = (pStart.x + pEnd.x)/2;
    const my = (pStart.y + pEnd.y)/2;
    ctx.fillText(label, mx, my + offsetTextY);
    ctx.shadowBlur = 0;
  };

  // Width dimension (along front edge, projected into perspective)
  const yFrontEdge = totalH/2;
  const zFrontEdge = getZ(yFrontEdge);
  // We offset it slightly forward in Y and down in Z so it hovers in front
  const d1 = proj(-totalW/2, yFrontEdge + 30, zFrontEdge - 15);
  const d2 = proj(totalW/2, yFrontEdge + 30, zFrontEdge - 15);
  drawArrow(d1, d2, `${(cols * panelWidthMm / 1000).toFixed(2)} m`, 12);

  // Height dimension (along right edge, projected into perspective)
  const xRightEdge = totalW/2;
  // Offset to the right
  const d3 = proj(xRightEdge + 30, -totalH/2, getZ(-totalH/2));
  const d4 = proj(xRightEdge + 30, totalH/2, getZ(totalH/2));
  drawArrow(d3, d4, `${(rows * panelHeightMm / 1000).toFixed(2)} m`, 0);
}
