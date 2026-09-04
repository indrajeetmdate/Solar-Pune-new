// ================================================================
// DC Energy — Interactive Rooftop Solar CAD & Layout Canvas Engine
// Supports:
// 1. Measured Base Roof Rectangle (Length × Breadth in Green)
// 2. Obstacle Subtraction (Red Cutouts with hatching & area deduction)
// 3. Custom Pathways / Maintenance Corridors
// 4. Custom Aerial / Drone Image Import with Pan, Zoom, Rotate & Opacity
// 5. Manual Solar Panel Placement with 4-Sided Magnetic Edge Snapping
// 6. Latent Panels Inventory Pool & Multi-Island Layout
// ================================================================

export class RooftopCAD {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = options;

    // Unit: "ft" (feet) or "m" (meters)
    this.unit = "ft";

    // Roof dimensions (in feet)
    this.roofLengthFt = options.roofLengthFt || 30;
    this.roofBreadthFt = options.roofBreadthFt || 20;

    // Canvas geometry & viewport
    this.scalePxPerFt = 15;
    this.roofX = 50;
    this.roofY = 50;
    this.roofW = 450;
    this.roofH = 300;

    // Subtracted Obstacle Areas (Red)
    // { id, x, y, w, h, lengthFt, breadthFt, label }
    this.cutouts = [];

    // Custom Pathways / Walkways
    // { id, x, y, w, h, lengthFt, breadthFt, label }
    this.pathways = [];
    this.defaultPathwayWidthFt = 2.5;

    // Solar Panels
    // { id, x, y, w, h, orientation: 'portrait'|'landscape', islandId }
    this.panels = [];
    this.panelWidthMm = options.panelWidthMm || 1134; // standard ~550Wp panel width
    this.panelHeightMm = options.panelHeightMm || 2279; // standard ~550Wp panel height
    this.requiredPanels = options.requiredPanels || 12;

    // Imported Image inside Roof
    this.image = {
      element: null,
      src: null,
      x: 0, // pan offset X in px
      y: 0, // pan offset Y in px
      scale: 1.0,
      rotation: 0, // degrees: 0, 90, 180, 270
      opacity: 0.85,
      isLoaded: false,
    };

    // Active Tool: 'select' | 'roof' | 'subtract' | 'pathway' | 'panel' | 'image_pan'
    this.activeTool = "panel";

    // Interaction state
    this.dragMode = null; // 'drag_panel', 'draw_roof', 'draw_cutout', 'draw_pathway', 'pan_image', 'resize_cutout'
    this.dragItem = null;
    this.dragStart = { x: 0, y: 0 };
    this.dragOffset = { x: 0, y: 0 };
    this.drawPreview = null;
    this.activeSnapGuide = null;
    this.selectedItem = null; // { type: 'panel'|'cutout'|'pathway', id }

    // Callbacks
    this.onStatsChange = options.onStatsChange || null;
    this.onPanelsChange = options.onPanelsChange || null;

    this.initEvents();
    this.autoFitRoof();
    this.render();
  }

  // Auto-fit roof in canvas viewport
  autoFitRoof() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: 800, height: 450 };
    const logicalW = rect.width > 100 ? rect.width : 800;
    const logicalH = 450;

    const padX = 60;
    const padY = 50;
    const availW = Math.max(100, logicalW - padX * 2);
    const availH = Math.max(100, logicalH - padY * 2);

    this.scalePxPerFt = Math.min(availW / Math.max(5, this.roofLengthFt), availH / Math.max(5, this.roofBreadthFt));
    // Clamp scale to readable range
    this.scalePxPerFt = Math.max(4, Math.min(30, this.scalePxPerFt));

    this.roofW = this.roofLengthFt * this.scalePxPerFt;
    this.roofH = this.roofBreadthFt * this.scalePxPerFt;
    this.roofX = (logicalW - this.roofW) / 2;
    this.roofY = (logicalH - this.roofH) / 2;

    this.clampItemsToRoof();
  }

  setRoofDimensions(lengthFt, breadthFt) {
    if (lengthFt <= 0 || breadthFt <= 0) return;
    const oldW = this.roofW;
    const oldH = this.roofH;
    const oldX = this.roofX;
    const oldY = this.roofY;

    this.roofLengthFt = Number(lengthFt);
    this.roofBreadthFt = Number(breadthFt);
    this.autoFitRoof();

    // Scale cutouts and pathways proportionally to maintain relative positions
    if (oldW > 0 && oldH > 0) {
      const rx = this.roofW / oldW;
      const ry = this.roofH / oldH;
      this.cutouts.forEach((c) => {
        c.x = this.roofX + (c.x - oldX) * rx;
        c.y = this.roofY + (c.y - oldY) * ry;
        c.w *= rx;
        c.h *= ry;
        c.lengthFt = c.w / this.scalePxPerFt;
        c.breadthFt = c.h / this.scalePxPerFt;
      });
      this.pathways.forEach((p) => {
        p.x = this.roofX + (p.x - oldX) * rx;
        p.y = this.roofY + (p.y - oldY) * ry;
        p.w *= rx;
        p.h *= ry;
        p.lengthFt = p.w / this.scalePxPerFt;
        p.breadthFt = p.h / this.scalePxPerFt;
      });
      this.panels.forEach((p) => {
        p.x = this.roofX + (p.x - oldX) * rx;
        p.y = this.roofY + (p.y - oldY) * ry;
      });
    }

    this.clampItemsToRoof();
    this.notifyChanges();
    this.render();
  }

  setRequiredPanels(count, widthMm = null, heightMm = null) {
    this.requiredPanels = Math.max(0, parseInt(count) || 0);
    if (widthMm) this.panelWidthMm = widthMm;
    if (heightMm) this.panelHeightMm = heightMm;
    this.notifyChanges();
    this.render();
  }

  setTool(tool) {
    this.activeTool = tool;
    if (this.canvas) {
      if (tool === "image_pan") this.canvas.style.cursor = "grab";
      else if (tool === "subtract" || tool === "pathway" || tool === "roof") this.canvas.style.cursor = "crosshair";
      else if (tool === "panel") this.canvas.style.cursor = "copy";
      else this.canvas.style.cursor = "default";
    }
    this.render();
  }

  // Calculate panel dimensions in canvas pixels
  getPanelSizePx(orientation = "portrait") {
    // 1 m = 3.28084 ft
    const wFt = (this.panelWidthMm / 1000) * 3.28084;
    const hFt = (this.panelHeightMm / 1000) * 3.28084;
    if (orientation === "landscape") {
      return { w: hFt * this.scalePxPerFt, h: wFt * this.scalePxPerFt };
    }
    return { w: wFt * this.scalePxPerFt, h: hFt * this.scalePxPerFt };
  }

  // Place a single panel from latent pool
  placePanel(orientation = "portrait", x = null, y = null) {
    if (this.panels.length >= this.requiredPanels) return null;
    const { w, h } = this.getPanelSizePx(orientation);

    let targetX = x;
    let targetY = y;

    // If no coordinates provided, find next sensible open spot on roof
    if (targetX === null || targetY === null) {
      const margin = 10;
      const gap = 3;
      if (this.panels.length > 0) {
        const last = this.panels[this.panels.length - 1];
        if (last.x + last.w + gap + w <= this.roofX + this.roofW - margin) {
          targetX = last.x + last.w + gap;
          targetY = last.y;
        } else if (last.y + last.h + gap + h <= this.roofY + this.roofH - margin) {
          targetX = this.roofX + margin;
          targetY = last.y + last.h + gap;
        }
      }
      if (targetX === null) {
        targetX = this.roofX + margin;
        targetY = this.roofY + margin;
      }
    }

    const panel = {
      id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      x: targetX,
      y: targetY,
      w,
      h,
      orientation,
    };

    this.panels.push(panel);
    this.selectedItem = { type: "panel", id: panel.id };
    this.notifyChanges();
    this.render();
    return panel;
  }

  // Place a block (e.g. 2x2 or 2x3)
  placePanelBlock(cols = 2, rows = 2, orientation = "portrait") {
    const { w, h } = this.getPanelSizePx(orientation);
    const gap = 3;
    const startX = this.roofX + 15;
    const startY = this.roofY + 15;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.panels.length >= this.requiredPanels) break;
        this.panels.push({
          id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          x: startX + c * (w + gap),
          y: startY + r * (h + gap),
          w,
          h,
          orientation,
        });
      }
    }
    this.clampItemsToRoof();
    this.notifyChanges();
    this.render();
  }

  // Auto-place all remaining latent panels on the green roof
  autoPlaceRemainingPanels(orientation = "portrait") {
    const remaining = this.requiredPanels - this.panels.length;
    if (remaining <= 0) return;

    const { w, h } = this.getPanelSizePx(orientation);
    const gap = 3;
    const margin = 10;

    let curX = this.roofX + margin;
    let curY = this.roofY + margin;

    let placedCount = 0;
    while (placedCount < remaining && curY + h <= this.roofY + this.roofH - margin) {
      // Check if spot overlaps any red obstacle or pathway
      const overlaps = this.isAreaBlocked(curX, curY, w, h);
      const overlapsExistingPanel = this.panels.some(
        (p) => curX < p.x + p.w && curX + w > p.x && curY < p.y + p.h && curY + h > p.y
      );

      if (!overlaps && !overlapsExistingPanel) {
        this.panels.push({
          id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          x: curX,
          y: curY,
          w,
          h,
          orientation,
        });
        placedCount++;
      }

      curX += w + gap;
      if (curX + w > this.roofX + this.roofW - margin) {
        curX = this.roofX + margin;
        curY += h + gap;
      }
    }

    this.notifyChanges();
    this.render();
  }

  clearAllPanels() {
    this.panels = [];
    this.selectedItem = null;
    this.notifyChanges();
    this.render();
  }

  removeSelectedItem() {
    if (!this.selectedItem) return;
    if (this.selectedItem.type === "panel") {
      this.panels = this.panels.filter((p) => p.id !== this.selectedItem.id);
    } else if (this.selectedItem.type === "cutout") {
      this.cutouts = this.cutouts.filter((c) => c.id !== this.selectedItem.id);
    } else if (this.selectedItem.type === "pathway") {
      this.pathways = this.pathways.filter((p) => p.id !== this.selectedItem.id);
    }
    this.selectedItem = null;
    this.notifyChanges();
    this.render();
  }

  // Add a subtracted obstacle area
  addCutout(x, y, w, h, label = "Obstacle") {
    if (w <= 0 || h <= 0) return;
    const cutout = {
      id: "cut_" + Date.now(),
      x,
      y,
      w,
      h,
      lengthFt: w / this.scalePxPerFt,
      breadthFt: h / this.scalePxPerFt,
      label,
    };
    this.cutouts.push(cutout);
    this.selectedItem = { type: "cutout", id: cutout.id };
    this.notifyChanges();
    this.render();
    return cutout;
  }

  clearAllCutouts() {
    this.cutouts = [];
    this.notifyChanges();
    this.render();
  }

  // Add a pathway corridor
  addPathway(x, y, w, h, label = "Pathway") {
    if (w <= 0 || h <= 0) return;
    const pathway = {
      id: "pw_" + Date.now(),
      x,
      y,
      w,
      h,
      lengthFt: w / this.scalePxPerFt,
      breadthFt: h / this.scalePxPerFt,
      label,
    };
    this.pathways.push(pathway);
    this.selectedItem = { type: "pathway", id: pathway.id };
    this.notifyChanges();
    this.render();
    return pathway;
  }

  addDefaultHorizontalPathway() {
    const hPx = this.defaultPathwayWidthFt * this.scalePxPerFt;
    const y = this.roofY + this.roofH / 2 - hPx / 2;
    this.addPathway(this.roofX, y, this.roofW, hPx, `Walkway ${this.defaultPathwayWidthFt} ft`);
  }

  addDefaultVerticalPathway() {
    const wPx = this.defaultPathwayWidthFt * this.scalePxPerFt;
    const x = this.roofX + this.roofW / 2 - wPx / 2;
    this.addPathway(x, this.roofY, wPx, this.roofH, `Walkway ${this.defaultPathwayWidthFt} ft`);
  }

  clearAllPathways() {
    this.pathways = [];
    this.notifyChanges();
    this.render();
  }

  // Check if an area overlaps obstacles or pathways
  isAreaBlocked(x, y, w, h) {
    // Check cutouts
    const inCutout = this.cutouts.some((c) => x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y);
    if (inCutout) return true;
    // Check pathways
    const inPathway = this.pathways.some((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);
    return inPathway;
  }

  // Load custom image
  loadCustomImage(fileOrUrl) {
    if (!fileOrUrl) return;
    const img = new Image();
    img.crossOrigin = "Anonymous";

    const onLoaded = () => {
      this.image.element = img;
      this.image.src = img.src;
      this.image.origWidth = img.naturalWidth || img.width;
      this.image.origHeight = img.naturalHeight || img.height;
      this.image.x = 0;
      this.image.y = 0;
      // Auto-scale to fill roof width or height nicely
      const scaleX = this.roofW / this.image.origWidth;
      const scaleY = this.roofH / this.image.origHeight;
      this.image.scale = Math.max(scaleX, scaleY);
      this.image.isLoaded = true;
      this.render();
      this.notifyChanges();
    };

    if (typeof fileOrUrl === "string") {
      img.src = fileOrUrl;
      img.onload = onLoaded;
    } else if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        img.onload = onLoaded;
      };
      reader.readAsDataURL(fileOrUrl);
    }
  }

  removeCustomImage() {
    this.image.element = null;
    this.image.src = null;
    this.image.isLoaded = false;
    this.render();
    this.notifyChanges();
  }

  setImageZoom(scale) {
    this.image.scale = Math.max(0.1, Math.min(5.0, Number(scale)));
    this.render();
  }

  setImageRotation(deg) {
    this.image.rotation = (Number(deg) + 360) % 360;
    this.render();
  }

  rotateImage90() {
    this.image.rotation = (this.image.rotation + 90) % 360;
    this.render();
  }

  setImageOpacity(op) {
    this.image.opacity = Math.max(0.05, Math.min(1.0, Number(op)));
    this.render();
  }

  resetImageTransform() {
    if (!this.image.element) return;
    this.image.x = 0;
    this.image.y = 0;
    const scaleX = this.roofW / this.image.origWidth;
    const scaleY = this.roofH / this.image.origHeight;
    this.image.scale = Math.max(scaleX, scaleY);
    this.image.rotation = 0;
    this.render();
  }

  // 4-Side Magnetic Snapping Engine
  applyMagneticSnapping(panel, newX, newY) {
    const snapDist = 12; // Snap proximity threshold in pixels
    const gap = 2.5; // Thermal/clamp physical gap in pixels
    let finalX = newX;
    let finalY = newY;
    let snapGuide = null;

    for (const target of this.panels) {
      if (target.id === panel.id) continue;

      // Vertical overlap check
      const vOverlap = finalY < target.y + target.h + snapDist && finalY + panel.h > target.y - snapDist;
      // Horizontal overlap check
      const hOverlap = finalX < target.x + target.w + snapDist && finalX + panel.w > target.x - snapDist;

      // 1. Snap to Target's RIGHT edge
      if (vOverlap && Math.abs(finalX - (target.x + target.w + gap)) < snapDist) {
        finalX = target.x + target.w + gap;
        snapGuide = { type: "vertical", x: finalX };
        // Axial snap top edge
        if (Math.abs(finalY - target.y) < snapDist) finalY = target.y;
        // Axial snap bottom edge
        else if (Math.abs(finalY + panel.h - (target.y + target.h)) < snapDist) {
          finalY = target.y + target.h - panel.h;
        }
        break;
      }

      // 2. Snap to Target's LEFT edge
      if (vOverlap && Math.abs(finalX + panel.w + gap - target.x) < snapDist) {
        finalX = target.x - panel.w - gap;
        snapGuide = { type: "vertical", x: target.x };
        if (Math.abs(finalY - target.y) < snapDist) finalY = target.y;
        else if (Math.abs(finalY + panel.h - (target.y + target.h)) < snapDist) {
          finalY = target.y + target.h - panel.h;
        }
        break;
      }

      // 3. Snap to Target's BOTTOM edge
      if (hOverlap && Math.abs(finalY - (target.y + target.h + gap)) < snapDist) {
        finalY = target.y + target.h + gap;
        snapGuide = { type: "horizontal", y: finalY };
        // Axial snap left edge
        if (Math.abs(finalX - target.x) < snapDist) finalX = target.x;
        // Axial snap right edge
        else if (Math.abs(finalX + panel.w - (target.x + target.w)) < snapDist) {
          finalX = target.x + target.w - panel.w;
        }
        break;
      }

      // 4. Snap to Target's TOP edge
      if (hOverlap && Math.abs(finalY + panel.h + gap - target.y) < snapDist) {
        finalY = target.y - panel.h - gap;
        snapGuide = { type: "horizontal", y: target.y };
        if (Math.abs(finalX - target.x) < snapDist) finalX = target.x;
        else if (Math.abs(finalX + panel.w - (target.x + target.w)) < snapDist) {
          finalX = target.x + target.w - panel.w;
        }
        break;
      }
    }

    this.activeSnapGuide = snapGuide;
    return { x: finalX, y: finalY };
  }

  // Keep items bounded inside or near roof
  clampItemsToRoof() {
    this.panels.forEach((p) => {
      p.x = Math.max(this.roofX, Math.min(this.roofX + this.roofW - p.w, p.x));
      p.y = Math.max(this.roofY, Math.min(this.roofY + this.roofH - p.h, p.y));
    });
  }

  // Get Island groupings (connected components of panels)
  getIslands() {
    const islands = [];
    const visited = new Set();
    const gapThreshold = 8; // Connected if within 8px of each other

    for (const p of this.panels) {
      if (visited.has(p.id)) continue;
      const island = [];
      const queue = [p];
      visited.add(p.id);

      while (queue.length > 0) {
        const curr = queue.shift();
        island.push(curr);

        for (const other of this.panels) {
          if (visited.has(other.id)) continue;
          const isAdjacent =
            curr.x - gapThreshold <= other.x + other.w &&
            curr.x + curr.w + gapThreshold >= other.x &&
            curr.y - gapThreshold <= other.y + other.h &&
            curr.y + curr.h + gapThreshold >= other.y;
          if (isAdjacent) {
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
      islands.push(island);
    }
    return islands;
  }

  // Calculate area statistics
  getAreaStats() {
    const grossSqft = this.roofLengthFt * this.roofBreadthFt;
    let cutoutSqft = 0;
    this.cutouts.forEach((c) => {
      cutoutSqft += c.lengthFt * c.breadthFt;
    });
    let pathwaySqft = 0;
    this.pathways.forEach((p) => {
      pathwaySqft += p.lengthFt * p.breadthFt;
    });

    const netUsableSqft = Math.max(0, grossSqft - cutoutSqft - pathwaySqft);
    return {
      grossSqft: Math.round(grossSqft),
      cutoutSqft: Math.round(cutoutSqft),
      pathwaySqft: Math.round(pathwaySqft),
      netUsableSqft: Math.round(netUsableSqft),
      grossSqm: (grossSqft * 0.092903).toFixed(1),
      netUsableSqm: (netUsableSqft * 0.092903).toFixed(1),
    };
  }

  // Notify callbacks
  notifyChanges() {
    if (this.onStatsChange) {
      this.onStatsChange(this.getAreaStats());
    }
    if (this.onPanelsChange) {
      this.onPanelsChange({
        required: this.requiredPanels,
        placed: this.panels.length,
        remaining: Math.max(0, this.requiredPanels - this.panels.length),
        islandsCount: this.getIslands().length,
      });
    }
  }

  // Setup DOM event listeners
  initEvents() {
    if (!this.canvas) return;

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    this.canvas.addEventListener("mousedown", (e) => {
      const pos = getPos(e);
      this.handlePointerDown(pos.x, pos.y, e);
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.dragMode) return;
      const pos = getPos(e);
      this.handlePointerMove(pos.x, pos.y, e);
    });

    window.addEventListener("mouseup", (e) => {
      if (!this.dragMode) return;
      const pos = getPos(e);
      this.handlePointerUp(pos.x, pos.y, e);
    });

    // Mouse wheel for image zooming or canvas scaling
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (this.image.isLoaded) {
          const delta = e.deltaY < 0 ? 1.08 : 0.92;
          this.setImageZoom(this.image.scale * delta);
        }
      },
      { passive: false }
    );

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.selectedItem && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
          this.removeSelectedItem();
        }
      }
    });

    // Resize listener for responsive layout
    window.addEventListener("resize", () => {
      this.autoFitRoof();
      this.render();
    });
  }

  handlePointerDown(x, y, e) {
    this.dragStart = { x, y };

    if (this.activeTool === "image_pan") {
      this.dragMode = "pan_image";
      this.dragOffset = { x: this.image.x, y: this.image.y };
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (this.activeTool === "roof") {
      this.dragMode = "draw_roof";
      this.drawPreview = { startX: x, startY: y, currentX: x, currentY: y };
      return;
    }

    if (this.activeTool === "subtract") {
      this.dragMode = "draw_cutout";
      this.drawPreview = { startX: x, startY: y, currentX: x, currentY: y };
      return;
    }

    if (this.activeTool === "pathway") {
      this.dragMode = "draw_pathway";
      this.drawPreview = { startX: x, startY: y, currentX: x, currentY: y };
      return;
    }

    // Check if clicked on a panel (top-most panel first)
    for (let i = this.panels.length - 1; i >= 0; i--) {
      const p = this.panels[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        this.selectedItem = { type: "panel", id: p.id };
        this.dragItem = p;
        this.dragMode = "drag_panel";
        this.dragOffset = { x: x - p.x, y: y - p.y };
        this.render();
        return;
      }
    }

    // Check if clicked on a cutout
    for (let i = this.cutouts.length - 1; i >= 0; i--) {
      const c = this.cutouts[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
        this.selectedItem = { type: "cutout", id: c.id };
        this.dragItem = c;
        this.dragMode = "drag_cutout";
        this.dragOffset = { x: x - c.x, y: y - c.y };
        this.render();
        return;
      }
    }

    // Check if clicked on a pathway
    for (let i = this.pathways.length - 1; i >= 0; i--) {
      const pw = this.pathways[i];
      if (x >= pw.x && x <= pw.x + pw.w && y >= pw.y && y <= pw.y + pw.h) {
        this.selectedItem = { type: "pathway", id: pw.id };
        this.dragItem = pw;
        this.dragMode = "drag_pathway";
        this.dragOffset = { x: x - pw.x, y: y - pw.y };
        this.render();
        return;
      }
    }

    // Clicked empty area
    this.selectedItem = null;
    this.render();
  }

  handlePointerMove(x, y, e) {
    if (this.dragMode === "pan_image") {
      this.image.x = this.dragOffset.x + (x - this.dragStart.x);
      this.image.y = this.dragOffset.y + (y - this.dragStart.y);
      this.render();
      return;
    }

    if (this.dragMode === "draw_roof" || this.dragMode === "draw_cutout" || this.dragMode === "draw_pathway") {
      this.drawPreview.currentX = x;
      this.drawPreview.currentY = y;
      this.render();
      return;
    }

    if (this.dragMode === "drag_panel" && this.dragItem) {
      const rawX = x - this.dragOffset.x;
      const rawY = y - this.dragOffset.y;
      // Apply magnetic snapping
      const snapped = this.applyMagneticSnapping(this.dragItem, rawX, rawY);
      this.dragItem.x = snapped.x;
      this.dragItem.y = snapped.y;
      this.clampItemsToRoof();
      this.render();
      return;
    }

    if ((this.dragMode === "drag_cutout" || this.dragMode === "drag_pathway") && this.dragItem) {
      this.dragItem.x = x - this.dragOffset.x;
      this.dragItem.y = y - this.dragOffset.y;
      this.render();
      return;
    }
  }

  handlePointerUp(x, y, e) {
    if (this.dragMode === "pan_image") {
      this.canvas.style.cursor = "grab";
    }

    if (this.dragMode === "draw_roof" && this.drawPreview) {
      const rx = Math.min(this.drawPreview.startX, this.drawPreview.currentX);
      const ry = Math.min(this.drawPreview.startY, this.drawPreview.currentY);
      const rw = Math.abs(this.drawPreview.currentX - this.drawPreview.startX);
      const rh = Math.abs(this.drawPreview.currentY - this.drawPreview.startY);

      if (rw > 30 && rh > 30) {
        const lFt = Math.round(rw / this.scalePxPerFt);
        const bFt = Math.round(rh / this.scalePxPerFt);
        this.setRoofDimensions(Math.max(10, lFt), Math.max(10, bFt));
      }
    }

    if (this.dragMode === "draw_cutout" && this.drawPreview) {
      const rx = Math.min(this.drawPreview.startX, this.drawPreview.currentX);
      const ry = Math.min(this.drawPreview.startY, this.drawPreview.currentY);
      const rw = Math.abs(this.drawPreview.currentX - this.drawPreview.startX);
      const rh = Math.abs(this.drawPreview.currentY - this.drawPreview.startY);

      if (rw > 10 && rh > 10) {
        this.addCutout(rx, ry, rw, rh, "Cutout");
      }
    }

    if (this.dragMode === "draw_pathway" && this.drawPreview) {
      const rx = Math.min(this.drawPreview.startX, this.drawPreview.currentX);
      const ry = Math.min(this.drawPreview.startY, this.drawPreview.currentY);
      const rw = Math.abs(this.drawPreview.currentX - this.drawPreview.startX);
      const rh = Math.abs(this.drawPreview.currentY - this.drawPreview.startY);

      if (rw > 10 && rh > 10) {
        this.addPathway(rx, ry, rw, rh, "Pathway");
      }
    }

    this.dragMode = null;
    this.dragItem = null;
    this.drawPreview = null;
    this.activeSnapGuide = null;
    this.notifyChanges();
    this.render();
  }

  // ================= RENDER PIPELINE =================
  render() {
    if (!this.canvas) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    const parentW = this.canvas.parentElement ? this.canvas.parentElement.clientWidth : 800;
    const logicalW = Math.max(300, parentW);
    const logicalH = 460;

    if (this.canvas.width !== logicalW * dpr || this.canvas.height !== logicalH * dpr) {
      this.canvas.width = logicalW * dpr;
      this.canvas.height = logicalH * dpr;
      this.canvas.style.width = `${logicalW}px`;
      this.canvas.style.height = `${logicalH}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalW, logicalH);

    // Layer 1: Modern Dark Engineering Grid Background
    this.drawGrid(logicalW, logicalH);

    // Layer 2: Clipped Imported Roof / Aerial Image
    if (this.image.isLoaded && this.image.element) {
      this.drawClippedImage();
    }

    // Layer 3: Green Usable Roof Area Boundary & Fill
    this.drawRoofBoundary();

    // Layer 4: Custom Pathways / Walkways
    this.drawPathways();

    // Layer 5: Subtracted Obstacle Areas (Red Cutouts)
    this.drawCutouts();

    // Layer 6: Solar Panels
    this.drawPanels();

    // Layer 7: Drawing Preview & Snap Guides
    this.drawInteractiveOverlays();

    // Layer 8: Dimension Lines & Annotations
    this.drawDimensions();

    ctx.restore();
  }

  // Draw engineering drafting grid
  drawGrid(width, height) {
    const ctx = this.ctx;
    ctx.fillStyle = "#111827"; // Clean deep slate background
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    const gridSize = Math.max(15, this.scalePxPerFt * 2); // 2 ft grid lines
    ctx.beginPath();
    for (let x = 0; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  // Draw imported image clipped strictly to the green roof rectangle
  drawClippedImage() {
    const ctx = this.ctx;
    ctx.save();

    // Clip to roof rectangle
    ctx.beginPath();
    ctx.rect(this.roofX, this.roofY, this.roofW, this.roofH);
    ctx.clip();

    ctx.globalAlpha = this.image.opacity;

    // Transform from center of roof
    const cx = this.roofX + this.roofW / 2 + this.image.x;
    const cy = this.roofY + this.roofH / 2 + this.image.y;

    ctx.translate(cx, cy);
    ctx.rotate((this.image.rotation * Math.PI) / 180);
    ctx.scale(this.image.scale, this.image.scale);

    const iw = this.image.origWidth;
    const ih = this.image.origHeight;
    ctx.drawImage(this.image.element, -iw / 2, -ih / 2, iw, ih);

    ctx.restore();
  }

  // Draw Base Roof (Green Usable Space)
  drawRoofBoundary() {
    const ctx = this.ctx;

    // Semi-transparent brand green fill
    ctx.fillStyle = this.image.isLoaded ? "rgba(99, 146, 62, 0.2)" : "rgba(34, 197, 94, 0.18)";
    ctx.fillRect(this.roofX, this.roofY, this.roofW, this.roofH);

    // Green boundary stroke
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(this.roofX, this.roofY, this.roofW, this.roofH);

    // Corner alignment ticks
    const tick = 8;
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(this.roofX - tick, this.roofY);
    ctx.lineTo(this.roofX + tick, this.roofY);
    ctx.moveTo(this.roofX, this.roofY - tick);
    ctx.lineTo(this.roofX, this.roofY + tick);
    // Bottom-right
    ctx.moveTo(this.roofX + this.roofW - tick, this.roofY + this.roofH);
    ctx.lineTo(this.roofX + this.roofW + tick, this.roofY + this.roofH);
    ctx.moveTo(this.roofX + this.roofW, this.roofY + this.roofH - tick);
    ctx.lineTo(this.roofX + this.roofW, this.roofY + this.roofH + tick);
    ctx.stroke();
  }

  // Draw Pathways / Walkways
  drawPathways() {
    const ctx = this.ctx;
    this.pathways.forEach((pw) => {
      const isSelected = this.selectedItem && this.selectedItem.id === pw.id;

      // Pathway background
      ctx.fillStyle = "rgba(234, 179, 8, 0.25)";
      ctx.fillRect(pw.x, pw.y, pw.w, pw.h);

      // Diagonal safety stripes pattern
      ctx.save();
      ctx.beginPath();
      ctx.rect(pw.x, pw.y, pw.w, pw.h);
      ctx.clip();

      ctx.strokeStyle = "rgba(234, 179, 8, 0.35)";
      ctx.lineWidth = 1.5;
      const stripeGap = 12;
      for (let x = pw.x - pw.h; x < pw.x + pw.w + pw.h; x += stripeGap) {
        ctx.beginPath();
        ctx.moveTo(x, pw.y);
        ctx.lineTo(x + pw.h, pw.y + pw.h);
        ctx.stroke();
      }
      ctx.restore();

      // Border
      ctx.strokeStyle = isSelected ? "#ffffff" : "#eab308";
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(pw.x, pw.y, pw.w, pw.h);
      ctx.setLineDash([]);

      // Label
      ctx.font = "600 10px Inter, sans-serif";
      ctx.fillStyle = "#fef08a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pw.label || "Walkway", pw.x + pw.w / 2, pw.y + pw.h / 2);
    });
  }

  // Draw Subtracted Obstacle Areas (Red Cutouts)
  drawCutouts() {
    const ctx = this.ctx;

    this.cutouts.forEach((c) => {
      const isSelected = this.selectedItem && this.selectedItem.id === c.id;

      // Red fill
      ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
      ctx.fillRect(c.x, c.y, c.w, c.h);

      // Red diagonal hatch lines
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x, c.y, c.w, c.h);
      ctx.clip();

      ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
      ctx.lineWidth = 1.5;
      const hatchGap = 10;
      for (let x = c.x - c.h; x < c.x + c.w + c.h; x += hatchGap) {
        ctx.beginPath();
        ctx.moveTo(x, c.y);
        ctx.lineTo(x + c.h, c.y + c.h);
        ctx.stroke();
      }
      ctx.restore();

      // Red border
      ctx.strokeStyle = isSelected ? "#ffffff" : "#ef4444";
      ctx.lineWidth = isSelected ? 2.5 : 1.8;
      ctx.strokeRect(c.x, c.y, c.w, c.h);

      // Label & Area deduction text
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.fillStyle = "#fee2e2";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const area = Math.round(c.lengthFt * c.breadthFt);
      ctx.fillText(`${c.label} (-${area} sq ft)`, c.x + c.w / 2, c.y + c.h / 2);
    });
  }

  // Draw Solar Panels (Photovoltaic cells & aluminium frame)
  drawPanels() {
    const ctx = this.ctx;

    this.panels.forEach((p, idx) => {
      const isSelected = this.selectedItem && this.selectedItem.id === p.id;

      // Dark monocrystalline blue cell fill
      ctx.fillStyle = isSelected ? "#1e3a8a" : "#0f172a";
      ctx.fillRect(p.x, p.y, p.w, p.h);

      // Anti-reflective sheen gradient
      const grad = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
      grad.addColorStop(1, "rgba(30, 58, 138, 0.05)");
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      // Silicon cell grid lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      // 2 horizontal division lines
      ctx.moveTo(p.x, p.y + p.h * 0.33);
      ctx.lineTo(p.x + p.w, p.y + p.h * 0.33);
      ctx.moveTo(p.x, p.y + p.h * 0.66);
      ctx.lineTo(p.x + p.w, p.y + p.h * 0.66);
      // 1 vertical division line
      ctx.moveTo(p.x + p.w * 0.5, p.y);
      ctx.lineTo(p.x + p.w * 0.5, p.y + p.h);
      ctx.stroke();

      // Aluminium silver frame
      ctx.strokeStyle = isSelected ? "#38bdf8" : "#94a3b8";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      // Panel Index Badge
      ctx.font = "bold 8px Inter, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(idx + 1, p.x + p.w / 2, p.y + p.h / 2);
    });
  }

  // Draw Snap Guides, Previews and Selection handles
  drawInteractiveOverlays() {
    const ctx = this.ctx;

    // Active magnetic snap line guide
    if (this.activeSnapGuide) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      if (this.activeSnapGuide.type === "vertical") {
        ctx.moveTo(this.activeSnapGuide.x, this.roofY - 20);
        ctx.lineTo(this.activeSnapGuide.x, this.roofY + this.roofH + 20);
      } else {
        ctx.moveTo(this.roofX - 20, this.activeSnapGuide.y);
        ctx.lineTo(this.roofX + this.roofW + 20, this.activeSnapGuide.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Drawing preview rectangle
    if (this.drawPreview) {
      const rx = Math.min(this.drawPreview.startX, this.drawPreview.currentX);
      const ry = Math.min(this.drawPreview.startY, this.drawPreview.currentY);
      const rw = Math.abs(this.drawPreview.currentX - this.drawPreview.startX);
      const rh = Math.abs(this.drawPreview.currentY - this.drawPreview.startY);

      if (this.dragMode === "draw_roof") {
        ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (this.dragMode === "draw_cutout") {
        ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
      } else if (this.dragMode === "draw_pathway") {
        ctx.fillStyle = "rgba(234, 179, 8, 0.3)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.setLineDash([]);
    }
  }

  // Draw dimension lines on roof edges
  drawDimensions() {
    const ctx = this.ctx;
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Top Width (Length) Dimension Line
    const dY = this.roofY - 14;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.roofX, dY);
    ctx.lineTo(this.roofX + this.roofW, dY);
    ctx.moveTo(this.roofX, dY - 4);
    ctx.lineTo(this.roofX, dY + 4);
    ctx.moveTo(this.roofX + this.roofW, dY - 4);
    ctx.lineTo(this.roofX + this.roofW, dY + 4);
    ctx.stroke();

    const lenM = (this.roofLengthFt * 0.3048).toFixed(1);
    ctx.fillText(`${this.roofLengthFt} ft (${lenM} m)`, this.roofX + this.roofW / 2, dY - 8);

    // Left Height (Breadth) Dimension Line
    const dX = this.roofX - 14;
    ctx.beginPath();
    ctx.moveTo(dX, this.roofY);
    ctx.lineTo(dX, this.roofY + this.roofH);
    ctx.moveTo(dX - 4, this.roofY);
    ctx.lineTo(dX + 4, this.roofY);
    ctx.moveTo(dX - 4, this.roofY + this.roofH);
    ctx.lineTo(dX + 4, this.roofY + this.roofH);
    ctx.stroke();

    ctx.save();
    ctx.translate(dX - 8, this.roofY + this.roofH / 2);
    ctx.rotate(-Math.PI / 2);
    const brM = (this.roofBreadthFt * 0.3048).toFixed(1);
    ctx.fillText(`${this.roofBreadthFt} ft (${brM} m)`, 0, 0);
    ctx.restore();
  }
}

// Global reference for active instance
let activeCADInstance = null;

export function getActiveRooftopCAD() {
  return activeCADInstance;
}

export function initRooftopCAD(canvas, options = {}) {
  activeCADInstance = new RooftopCAD(canvas, options);
  return activeCADInstance;
}

// Backwards-compatible adapter for existing app.js calls
export function drawPanelArray(canvas, config) {
  if (!canvas) return;

  if (!activeCADInstance || activeCADInstance.canvas !== canvas) {
    activeCADInstance = new RooftopCAD(canvas, {
      roofLengthFt: 30,
      roofBreadthFt: 20,
      requiredPanels: (config.rows || 3) * (config.cols || 4),
      panelWidthMm: config.panelWidthMm || 1134,
      panelHeightMm: config.panelHeightMm || 2279,
    });
  } else {
    const totalRequired = (config.rows || 3) * (config.cols || 4);
    activeCADInstance.setRequiredPanels(totalRequired, config.panelWidthMm, config.panelHeightMm);
  }

  // If no panels have been placed yet, place the default block
  if (activeCADInstance.panels.length === 0 && config.rows && config.cols) {
    activeCADInstance.placePanelBlock(config.cols, config.rows);
  }

  activeCADInstance.render();
}
