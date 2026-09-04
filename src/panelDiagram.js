// ================================================================
// DC Energy — Interactive Rooftop Solar CAD & Multi-Shape Engine
// Features:
// 1. All Panels Latent Initially (Clean roof on load)
// 2. Multi-Shape Cutouts (Rectangle, Circle, L-Shape) with editable dimensions
// 3. 8-Point Interactive Transform & Resize Handles
// 4. Contextual Selection & Properties Inspector
// 5. Collision-Free Grid Auto-Placement (Zero panel overlap)
// 6. 4-Sided Magnetic Edge Snapping for Manual Placement & Multi-Islands
// 7. Aerial/Drone Image Import with Pan, Zoom, Rotate & Opacity
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
    // Item: { id, shape: 'rectangle'|'circle'|'l_shape', x, y, w, h, radius, lengthFt, breadthFt, diameterFt, label }
    this.cutouts = [];

    // Custom Pathways / Walkways
    // Item: { id, shape: 'rectangle', x, y, w, h, lengthFt, breadthFt, label }
    this.pathways = [];
    this.defaultPathwayWidthFt = 2.5;

    // Solar Panels (ALL LATENT INITIALLY)
    // Item: { id, x, y, w, h, orientation: 'portrait'|'landscape', islandId }
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

    // Active Tool: 'select' | 'roof' | 'subtract_rect' | 'subtract_circle' | 'pathway' | 'panel' | 'image_pan'
    this.activeTool = "select";
    this.addShapeCategory = "cutout"; // 'cutout' | 'pathway' | 'roof'
    this.addShapeType = "rectangle";  // 'rectangle' | 'circle' | 'l_shape'

    // Interaction state
    this.dragMode = null; // 'drag_item', 'resize_item', 'draw_shape', 'pan_image'
    this.dragItem = null;
    this.activeResizeHandle = null; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'radius'
    this.dragStart = { x: 0, y: 0 };
    this.dragOffset = { x: 0, y: 0 };
    this.initialBounds = null; // snapshot of bounds at drag start for accurate resizing
    this.drawPreview = null;
    this.activeSnapGuide = null;
    this.selectedItem = null; // { type: 'panel'|'cutout'|'pathway'|'roof', item }

    // Callbacks
    this.onStatsChange = options.onStatsChange || null;
    this.onPanelsChange = options.onPanelsChange || null;
    this.onSelectionChange = options.onSelectionChange || null;

    this.initEvents();
    this.autoFitRoof();
    this.render();
  }

  // Auto-fit roof in canvas viewport
  autoFitRoof() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: 800, height: 460 };
    const logicalW = rect.width > 100 ? rect.width : 800;
    const logicalH = 460;

    const padX = 65;
    const padY = 55;
    const availW = Math.max(100, logicalW - padX * 2);
    const availH = Math.max(100, logicalH - padY * 2);

    this.scalePxPerFt = Math.min(availW / Math.max(5, this.roofLengthFt), availH / Math.max(5, this.roofBreadthFt));
    this.scalePxPerFt = Math.max(4, Math.min(32, this.scalePxPerFt));

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

    // Scale items proportionally
    if (oldW > 0 && oldH > 0) {
      const rx = this.roofW / oldW;
      const ry = this.roofH / oldH;
      this.cutouts.forEach((c) => {
        c.x = this.roofX + (c.x - oldX) * rx;
        c.y = this.roofY + (c.y - oldY) * ry;
        c.w *= rx;
        c.h *= ry;
        if (c.radius) c.radius *= (rx + ry) / 2;
        c.lengthFt = c.w / this.scalePxPerFt;
        c.breadthFt = c.h / this.scalePxPerFt;
        if (c.diameterFt) c.diameterFt = (c.radius * 2) / this.scalePxPerFt;
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
      else if (tool === "select") this.canvas.style.cursor = "default";
      else if (tool.startsWith("draw_") || tool === "subtract" || tool === "pathway" || tool === "roof") {
        this.canvas.style.cursor = "crosshair";
      } else if (tool === "panel") {
        this.canvas.style.cursor = "copy";
      } else {
        this.canvas.style.cursor = "default";
      }
    }
    this.render();
  }

  setShapeType(shape) {
    this.addShapeType = shape || "rectangle";
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

    // Find next sensible non-overlapping spot
    if (targetX === null || targetY === null) {
      const slot = this.findNextAvailableSlot(w, h);
      if (slot) {
        targetX = slot.x;
        targetY = slot.y;
      } else {
        targetX = this.roofX + 15;
        targetY = this.roofY + 15;
      }
    }

    const panel = {
      id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
      type: "panel",
      x: targetX,
      y: targetY,
      w,
      h,
      orientation,
    };

    this.panels.push(panel);
    this.selectItem("panel", panel);
    this.notifyChanges();
    this.render();
    return panel;
  }

  // Place a 2x2 or MxN block of panels
  placePanelBlock(cols = 2, rows = 2, orientation = "portrait") {
    const { w, h } = this.getPanelSizePx(orientation);
    const gap = 3;

    // Find a clear region for the whole block
    const blockW = cols * w + (cols - 1) * gap;
    const blockH = rows * h + (rows - 1) * gap;
    const startSlot = this.findNextAvailableSlot(blockW, blockH) || { x: this.roofX + 15, y: this.roofY + 15 };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.panels.length >= this.requiredPanels) break;
        this.panels.push({
          id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          type: "panel",
          x: startSlot.x + c * (w + gap),
          y: startSlot.y + r * (h + gap),
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

  // Collision-free auto placement algorithm (NEVER STACKS PANELS)
  autoPlaceRemainingPanels(orientation = "portrait") {
    const remaining = this.requiredPanels - this.panels.length;
    if (remaining <= 0) return;

    const { w, h } = this.getPanelSizePx(orientation);
    const gap = 3;
    const margin = 10;

    let placedCount = 0;
    const maxCols = Math.floor((this.roofW - margin * 2 + gap) / (w + gap));
    const maxRows = Math.floor((this.roofH - margin * 2 + gap) / (h + gap));

    for (let r = 0; r < maxRows && placedCount < remaining; r++) {
      for (let c = 0; c < maxCols && placedCount < remaining; c++) {
        const candidateX = this.roofX + margin + c * (w + gap);
        const candidateY = this.roofY + margin + r * (h + gap);

        // Strict boundary check inside roof
        if (
          candidateX < this.roofX + margin ||
          candidateY < this.roofY + margin ||
          candidateX + w > this.roofX + this.roofW - margin ||
          candidateY + h > this.roofY + this.roofH - margin
        ) {
          continue;
        }

        // Strict non-overlapping check against:
        // 1. All existing panels
        // 2. All cutouts (rectangles, circles & l-shapes)
        // 3. All pathways
        const collidesWithPanel = this.panels.some((p) =>
          this.doRectanglesOverlap(candidateX, candidateY, w, h, p.x, p.y, p.w, p.h)
        );
        const collidesWithObstacle = this.isAreaBlocked(candidateX, candidateY, w, h);

        if (!collidesWithPanel && !collidesWithObstacle) {
          this.panels.push({
            id: "p_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
            type: "panel",
            x: candidateX,
            y: candidateY,
            w,
            h,
            orientation,
          });
          placedCount++;
        }
      }
    }

    this.notifyChanges();
    this.render();
  }

  // Find next available open grid slot for width w and height h
  findNextAvailableSlot(w, h) {
    const gap = 3;
    const margin = 10;
    const step = 20;

    for (let y = this.roofY + margin; y + h <= this.roofY + this.roofH - margin; y += step) {
      for (let x = this.roofX + margin; x + w <= this.roofX + this.roofW - margin; x += step) {
        const collidesWithPanel = this.panels.some((p) =>
          this.doRectanglesOverlap(x, y, w, h, p.x, p.y, p.w, p.h)
        );
        const collidesWithObstacle = this.isAreaBlocked(x, y, w, h);

        if (!collidesWithPanel && !collidesWithObstacle) {
          return { x, y };
        }
      }
    }
    return null;
  }

  doRectanglesOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  clearAllPanels() {
    this.panels = [];
    this.selectItem(null, null);
    this.notifyChanges();
    this.render();
  }

  // Add Cutout with shape support (Rectangle, Circle, L-Shape)
  addCutout(x, y, w, h, shape = "rectangle", label = null) {
    if (w <= 0 || h <= 0) return null;
    let lengthFt = w / this.scalePxPerFt;
    let breadthFt = h / this.scalePxPerFt;
    let radius = Math.min(w, h) / 2;
    let diameterFt = (radius * 2) / this.scalePxPerFt;

    if (shape === "circle") {
      const dia = Math.min(w, h);
      w = dia;
      h = dia;
      radius = dia / 2;
      diameterFt = dia / this.scalePxPerFt;
      lengthFt = diameterFt;
      breadthFt = diameterFt;
    }

    const defaultLabel =
      label || (shape === "circle" ? "Round Tank" : shape === "l_shape" ? "L-Obstacle" : "Obstacle");

    const cutout = {
      id: "cut_" + Date.now(),
      type: "cutout",
      shape,
      x,
      y,
      w,
      h,
      radius,
      lengthFt: Number(lengthFt.toFixed(1)),
      breadthFt: Number(breadthFt.toFixed(1)),
      diameterFt: Number(diameterFt.toFixed(1)),
      label: defaultLabel,
    };

    this.cutouts.push(cutout);
    this.selectItem("cutout", cutout);
    this.notifyChanges();
    this.render();
    return cutout;
  }

  clearAllCutouts() {
    this.cutouts = [];
    if (this.selectedItem && this.selectedItem.type === "cutout") {
      this.selectItem(null, null);
    }
    this.notifyChanges();
    this.render();
  }

  // Add Pathway Corridor
  addPathway(x, y, w, h, label = "Walkway") {
    if (w <= 0 || h <= 0) return null;
    const pathway = {
      id: "pw_" + Date.now(),
      type: "pathway",
      shape: "rectangle",
      x,
      y,
      w,
      h,
      lengthFt: Number((w / this.scalePxPerFt).toFixed(1)),
      breadthFt: Number((h / this.scalePxPerFt).toFixed(1)),
      label,
    };
    this.pathways.push(pathway);
    this.selectItem("pathway", pathway);
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
    if (this.selectedItem && this.selectedItem.type === "pathway") {
      this.selectItem(null, null);
    }
    this.notifyChanges();
    this.render();
  }

  // Selection & Properties Inspector Synchronization
  selectItem(type, item) {
    if (!type || !item) {
      this.selectedItem = null;
    } else {
      this.selectedItem = { type, item };
    }
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem);
    }
    this.render();
  }

  updateSelectedItem(props = {}) {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const { type, item: it } = this.selectedItem;

    if (props.label !== undefined) it.label = props.label;

    if (type === "roof") {
      const l = props.lengthFt !== undefined ? Math.max(5, Number(props.lengthFt)) : this.roofLengthFt;
      const b = props.breadthFt !== undefined ? Math.max(5, Number(props.breadthFt)) : this.roofBreadthFt;
      this.setRoofDimensions(l, b);
      it.lengthFt = this.roofLengthFt;
      it.breadthFt = this.roofBreadthFt;
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem);
      }
      return;
    }

    if (it.shape === "circle" && props.diameterFt !== undefined) {
      const diaFt = Math.max(1, Number(props.diameterFt));
      it.diameterFt = diaFt;
      it.radius = (diaFt * this.scalePxPerFt) / 2;
      it.w = it.radius * 2;
      it.h = it.radius * 2;
      it.lengthFt = diaFt;
      it.breadthFt = diaFt;
    } else {
      if (props.lengthFt !== undefined) {
        const lFt = Math.max(1, Number(props.lengthFt));
        it.lengthFt = lFt;
        it.w = lFt * this.scalePxPerFt;
      }
      if (props.breadthFt !== undefined) {
        const bFt = Math.max(1, Number(props.breadthFt));
        it.breadthFt = bFt;
        it.h = bFt * this.scalePxPerFt;
      }
    }

    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem);
    }
    this.notifyChanges();
    this.render();
  }

  removeSelectedItem() {
    if (!this.selectedItem) return;
    const { type, item } = this.selectedItem;

    if (type === "panel") {
      this.panels = this.panels.filter((p) => p.id !== item.id);
    } else if (type === "cutout") {
      this.cutouts = this.cutouts.filter((c) => c.id !== item.id);
    } else if (type === "pathway") {
      this.pathways = this.pathways.filter((p) => p.id !== item.id);
    }

    this.selectItem(null, null);
    this.notifyChanges();
    this.render();
  }

  // Check if an area overlaps obstacles or pathways
  isAreaBlocked(x, y, w, h) {
    // Check cutouts (handles rectangle, circle, and l_shape)
    const inCutout = this.cutouts.some((c) => {
      if (c.shape === "circle") {
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const r = c.radius || c.w / 2;
        const closestX = Math.max(x, Math.min(cx, x + w));
        const closestY = Math.max(y, Math.min(cy, y + h));
        const distSq = (cx - closestX) ** 2 + (cy - closestY) ** 2;
        return distSq < r ** 2;
      }
      if (c.shape === "l_shape") {
        const overlapV = this.doRectanglesOverlap(x, y, w, h, c.x, c.y, c.w * 0.5, c.h);
        const overlapH = this.doRectanglesOverlap(x, y, w, h, c.x, c.y + c.h * 0.5, c.w, c.h * 0.5);
        return overlapV || overlapH;
      }
      return this.doRectanglesOverlap(x, y, w, h, c.x, c.y, c.w, c.h);
    });
    if (inCutout) return true;

    // Check pathways
    return this.pathways.some((p) => this.doRectanglesOverlap(x, y, w, h, p.x, p.y, p.w, p.h));
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
    const snapDist = 12;
    const gap = 2.5;
    let finalX = newX;
    let finalY = newY;
    let snapGuide = null;

    for (const target of this.panels) {
      if (target.id === panel.id) continue;

      const vOverlap = finalY < target.y + target.h + snapDist && finalY + panel.h > target.y - snapDist;
      const hOverlap = finalX < target.x + target.w + snapDist && finalX + panel.w > target.x - snapDist;

      // 1. Snap to Target's RIGHT edge
      if (vOverlap && Math.abs(finalX - (target.x + target.w + gap)) < snapDist) {
        finalX = target.x + target.w + gap;
        snapGuide = { type: "vertical", x: finalX };
        if (Math.abs(finalY - target.y) < snapDist) finalY = target.y;
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
        if (Math.abs(finalX - target.x) < snapDist) finalX = target.x;
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

  // Keep items bounded inside roof
  clampItemsToRoof() {
    this.panels.forEach((p) => {
      p.x = Math.max(this.roofX, Math.min(this.roofX + this.roofW - p.w, p.x));
      p.y = Math.max(this.roofY, Math.min(this.roofY + this.roofH - p.h, p.y));
    });
  }

  // Calculate area statistics
  getAreaStats() {
    const grossSqft = this.roofLengthFt * this.roofBreadthFt;
    let cutoutSqft = 0;
    this.cutouts.forEach((c) => {
      if (c.shape === "circle") {
        const radiusFt = (c.radius || c.w / 2) / this.scalePxPerFt;
        cutoutSqft += Math.PI * radiusFt * radiusFt;
      } else if (c.shape === "l_shape") {
        cutoutSqft += c.lengthFt * c.breadthFt * 0.75;
      } else {
        cutoutSqft += c.lengthFt * c.breadthFt;
      }
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

  // Island groupings for solar panels
  getIslands() {
    const islands = [];
    const visited = new Set();
    const gapThreshold = 8;

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

  // ================= 8-POINT RESIZE HANDLES & EVENT LOGIC =================
  getResizeHandles(item) {
    if (!item) return [];
    const { x, y, w, h } = item;
    const handleSize = 8;

    if (item.shape === "circle") {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = item.radius || w / 2;
      return [
        { handle: "radius_e", x: cx + r, y: cy, cursor: "ew-resize" },
        { handle: "radius_s", x: cx, y: cy + r, cursor: "ns-resize" },
      ];
    }

    return [
      { handle: "nw", x: x, y: y, cursor: "nwse-resize" },
      { handle: "n", x: x + w / 2, y: y, cursor: "ns-resize" },
      { handle: "ne", x: x + w, y: y, cursor: "nesw-resize" },
      { handle: "e", x: x + w, y: y + h / 2, cursor: "ew-resize" },
      { handle: "se", x: x + w, y: y + h, cursor: "nwse-resize" },
      { handle: "s", x: x + w / 2, y: y + h, cursor: "ns-resize" },
      { handle: "sw", x: x, y: y + h, cursor: "nesw-resize" },
      { handle: "w", x: x, y: y + h / 2, cursor: "ew-resize" },
    ];
  }

  findHandleAt(x, y) {
    if (!this.selectedItem || !this.selectedItem.item) return null;
    const handles = this.getResizeHandles(this.selectedItem.item);
    const hitRadius = 7;
    for (const h of handles) {
      if (Math.abs(x - h.x) <= hitRadius && Math.abs(y - h.y) <= hitRadius) {
        return h;
      }
    }
    return null;
  }

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
      const pos = getPos(e);
      this.handlePointerMove(pos.x, pos.y, e);
    });

    window.addEventListener("mouseup", (e) => {
      const pos = getPos(e);
      this.handlePointerUp(pos.x, pos.y, e);
    });

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

    window.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (this.selectedItem && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
          this.removeSelectedItem();
        }
      }
    });

    window.addEventListener("resize", () => {
      this.autoFitRoof();
      this.render();
    });
  }

  handlePointerDown(x, y, e) {
    this.dragStart = { x, y };

    // Check if clicked an interactive resize handle on the selected item
    const clickedHandle = this.findHandleAt(x, y);
    if (clickedHandle && this.selectedItem) {
      this.dragMode = "resize_item";
      this.activeResizeHandle = clickedHandle.handle;
      const it = this.selectedItem.item;
      this.initialBounds = { x: it.x, y: it.y, w: it.w, h: it.h, radius: it.radius || it.w / 2 };
      return;
    }

    if (this.activeTool === "image_pan") {
      this.dragMode = "pan_image";
      this.dragOffset = { x: this.image.x, y: this.image.y };
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (this.activeTool === "roof") {
      this.dragMode = "draw_shape";
      this.drawPreview = { category: "roof", shape: "rectangle", startX: x, startY: y, currentX: x, currentY: y };
      return;
    }

    if (this.activeTool === "subtract") {
      this.dragMode = "draw_shape";
      this.drawPreview = {
        category: "cutout",
        shape: this.addShapeType || "rectangle",
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      };
      return;
    }

    if (this.activeTool === "pathway") {
      this.dragMode = "draw_shape";
      this.drawPreview = { category: "pathway", shape: "rectangle", startX: x, startY: y, currentX: x, currentY: y };
      return;
    }

    // Check if clicked on a panel
    for (let i = this.panels.length - 1; i >= 0; i--) {
      const p = this.panels[i];
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
        this.selectItem("panel", p);
        this.dragItem = p;
        this.dragStartSnapshot = { x: p.x, y: p.y };
        this.dragMode = "drag_item";
        this.dragOffset = { x: x - p.x, y: y - p.y };
        return;
      }
    }

    // Check if clicked on a cutout
    for (let i = this.cutouts.length - 1; i >= 0; i--) {
      const c = this.cutouts[i];
      let inside = false;
      if (c.shape === "circle") {
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const r = c.radius || c.w / 2;
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
      } else if (c.shape === "l_shape") {
        const inV = x >= c.x && x <= c.x + c.w * 0.5 && y >= c.y && y <= c.y + c.h;
        const inH = x >= c.x && x <= c.x + c.w && y >= c.y + c.h * 0.5 && y <= c.y + c.h;
        inside = inV || inH;
      } else {
        inside = x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h;
      }

      if (inside) {
        this.selectItem("cutout", c);
        this.dragItem = c;
        this.dragStartSnapshot = { x: c.x, y: c.y };
        this.dragMode = "drag_item";
        this.dragOffset = { x: x - c.x, y: y - c.y };
        return;
      }
    }

    // Check if clicked on a pathway
    for (let i = this.pathways.length - 1; i >= 0; i--) {
      const pw = this.pathways[i];
      if (x >= pw.x && x <= pw.x + pw.w && y >= pw.y && y <= pw.y + pw.h) {
        this.selectItem("pathway", pw);
        this.dragItem = pw;
        this.dragStartSnapshot = { x: pw.x, y: pw.y };
        this.dragMode = "drag_item";
        this.dragOffset = { x: x - pw.x, y: y - pw.y };
        return;
      }
    }

    // Check if clicked inside base roof
    if (x >= this.roofX && x <= this.roofX + this.roofW && y >= this.roofY && y <= this.roofY + this.roofH) {
      this.selectItem("roof", {
        id: "roof_main",
        type: "roof",
        shape: "rectangle",
        lengthFt: this.roofLengthFt,
        breadthFt: this.roofBreadthFt,
        label: "Base Roof",
      });
      return;
    }

    // Clicked empty canvas outside roof
    this.selectItem(null, null);
  }

  handlePointerMove(x, y, e) {
    // Hover handle cursor detection when idle
    if (!this.dragMode) {
      const hoveredHandle = this.findHandleAt(x, y);
      if (hoveredHandle) {
        this.canvas.style.cursor = hoveredHandle.cursor;
      } else if (this.activeTool === "image_pan") {
        this.canvas.style.cursor = "grab";
      } else if (this.activeTool === "select") {
        this.canvas.style.cursor = "default";
      }
    }

    if (this.dragMode === "pan_image") {
      this.image.x = this.dragOffset.x + (x - this.dragStart.x);
      this.image.y = this.dragOffset.y + (y - this.dragStart.y);
      this.render();
      return;
    }

    if (this.dragMode === "draw_shape") {
      this.drawPreview.currentX = x;
      this.drawPreview.currentY = y;
      this.render();
      return;
    }

    if (this.dragMode === "resize_item" && this.selectedItem && this.initialBounds) {
      this.applyResize(x, y);
      this.render();
      return;
    }

    if (this.dragMode === "drag_item" && this.dragItem) {
      const rawX = x - this.dragOffset.x;
      const rawY = y - this.dragOffset.y;

      if (this.selectedItem.type === "panel") {
        const snapped = this.applyMagneticSnapping(this.dragItem, rawX, rawY);
        this.dragItem.x = snapped.x;
        this.dragItem.y = snapped.y;
        this.clampItemsToRoof();
      } else {
        this.dragItem.x = rawX;
        this.dragItem.y = rawY;
      }
      this.render();
      return;
    }
  }

  applyResize(mouseX, mouseY) {
    const it = this.selectedItem.item;
    const b = this.initialBounds;
    const dx = mouseX - this.dragStart.x;
    const dy = mouseY - this.dragStart.y;
    const minDim = 15;

    if (it.shape === "circle") {
      if (this.activeResizeHandle === "radius_e") {
        const newR = Math.max(8, b.radius + dx);
        it.radius = newR;
        it.w = newR * 2;
        it.h = newR * 2;
        it.diameterFt = (newR * 2) / this.scalePxPerFt;
        it.lengthFt = it.diameterFt;
        it.breadthFt = it.diameterFt;
      } else if (this.activeResizeHandle === "radius_s") {
        const newR = Math.max(8, b.radius + dy);
        it.radius = newR;
        it.w = newR * 2;
        it.h = newR * 2;
        it.diameterFt = (newR * 2) / this.scalePxPerFt;
        it.lengthFt = it.diameterFt;
        it.breadthFt = it.diameterFt;
      }
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem);
      }
      this.notifyChanges();
      return;
    }

    let newX = b.x;
    let newY = b.y;
    let newW = b.w;
    let newH = b.h;

    switch (this.activeResizeHandle) {
      case "se":
        newW = Math.max(minDim, b.w + dx);
        newH = Math.max(minDim, b.h + dy);
        break;
      case "e":
        newW = Math.max(minDim, b.w + dx);
        break;
      case "s":
        newH = Math.max(minDim, b.h + dy);
        break;
      case "ne":
        newW = Math.max(minDim, b.w + dx);
        newY = Math.min(b.y + b.h - minDim, b.y + dy);
        newH = b.h + (b.y - newY);
        break;
      case "n":
        newY = Math.min(b.y + b.h - minDim, b.y + dy);
        newH = b.h + (b.y - newY);
        break;
      case "nw":
        newX = Math.min(b.x + b.w - minDim, b.x + dx);
        newW = b.w + (b.x - newX);
        newY = Math.min(b.y + b.h - minDim, b.y + dy);
        newH = b.h + (b.y - newY);
        break;
      case "w":
        newX = Math.min(b.x + b.w - minDim, b.x + dx);
        newW = b.w + (b.x - newX);
        break;
      case "sw":
        newX = Math.min(b.x + b.w - minDim, b.x + dx);
        newW = b.w + (b.x - newX);
        newH = Math.max(minDim, b.h + dy);
        break;
    }

    it.x = newX;
    it.y = newY;
    it.w = newW;
    it.h = newH;
    it.lengthFt = Number((newW / this.scalePxPerFt).toFixed(1));
    it.breadthFt = Number((newH / this.scalePxPerFt).toFixed(1));

    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem);
    }
    this.notifyChanges();
  }

  handlePointerUp(x, y, e) {
    if (this.dragMode === "pan_image") {
      this.canvas.style.cursor = "grab";
    }

    // Revert panel drop if it causes an illegal overlap with another panel or obstacle
    if (this.dragMode === "drag_item" && this.selectedItem && this.selectedItem.type === "panel" && this.dragItem) {
      const p = this.dragItem;
      const overlapsOther = this.panels.some(
        (other) => other.id !== p.id && this.doRectanglesOverlap(p.x, p.y, p.w, p.h, other.x, other.y, other.w, other.h)
      );
      const overlapsObstacle = this.isAreaBlocked(p.x, p.y, p.w, p.h);

      if ((overlapsOther || overlapsObstacle) && this.dragStartSnapshot) {
        p.x = this.dragStartSnapshot.x;
        p.y = this.dragStartSnapshot.y;
      }
    }

    if (this.dragMode === "draw_shape" && this.drawPreview) {
      const p = this.drawPreview;
      const rx = Math.min(p.startX, p.currentX);
      const ry = Math.min(p.startY, p.currentY);
      const rw = Math.abs(p.currentX - p.startX);
      const rh = Math.abs(p.currentY - p.startY);

      if (rw > 12 && rh > 12) {
        if (p.category === "roof") {
          const lFt = Math.round(rw / this.scalePxPerFt);
          const bFt = Math.round(rh / this.scalePxPerFt);
          this.setRoofDimensions(Math.max(10, lFt), Math.max(10, bFt));
        } else if (p.category === "cutout") {
          const defaultLabel =
            p.shape === "circle" ? "Round Tank" : p.shape === "l_shape" ? "L-Obstacle" : "Obstacle";
          this.addCutout(rx, ry, rw, rh, p.shape, defaultLabel);
        } else if (p.category === "pathway") {
          this.addPathway(rx, ry, rw, rh, "Walkway");
        }
      }
    }

    this.dragMode = null;
    this.dragItem = null;
    this.activeResizeHandle = null;
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

    // Layer 8: 8-Point Transform Handles on Selected Item
    this.drawSelectionGizmo();

    // Layer 9: Dimension Lines & Annotations
    this.drawDimensions();

    ctx.restore();
  }

  drawGrid(width, height) {
    const ctx = this.ctx;
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;

    const gridSize = Math.max(15, this.scalePxPerFt * 2);
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

  drawClippedImage() {
    const ctx = this.ctx;
    ctx.save();

    ctx.beginPath();
    ctx.rect(this.roofX, this.roofY, this.roofW, this.roofH);
    ctx.clip();

    ctx.globalAlpha = this.image.opacity;

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

  drawRoofBoundary() {
    const ctx = this.ctx;
    ctx.fillStyle = this.image.isLoaded ? "rgba(99, 146, 62, 0.2)" : "rgba(34, 197, 94, 0.18)";
    ctx.fillRect(this.roofX, this.roofY, this.roofW, this.roofH);

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(this.roofX, this.roofY, this.roofW, this.roofH);

    const tick = 8;
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.roofX - tick, this.roofY);
    ctx.lineTo(this.roofX + tick, this.roofY);
    ctx.moveTo(this.roofX, this.roofY - tick);
    ctx.lineTo(this.roofX, this.roofY + tick);
    ctx.moveTo(this.roofX + this.roofW - tick, this.roofY + this.roofH);
    ctx.lineTo(this.roofX + this.roofW + tick, this.roofY + this.roofH);
    ctx.moveTo(this.roofX + this.roofW, this.roofY + this.roofH - tick);
    ctx.lineTo(this.roofX + this.roofW, this.roofY + this.roofH + tick);
    ctx.stroke();
  }

  drawPathways() {
    const ctx = this.ctx;
    this.pathways.forEach((pw) => {
      const isSelected = this.selectedItem && this.selectedItem.item && this.selectedItem.item.id === pw.id;

      ctx.fillStyle = "rgba(234, 179, 8, 0.25)";
      ctx.fillRect(pw.x, pw.y, pw.w, pw.h);

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

      ctx.strokeStyle = isSelected ? "#38bdf8" : "#eab308";
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(pw.x, pw.y, pw.w, pw.h);
      ctx.setLineDash([]);

      ctx.font = "600 10px Inter, sans-serif";
      ctx.fillStyle = "#fef08a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pw.label || "Walkway", pw.x + pw.w / 2, pw.y + pw.h / 2);
    });
  }

  drawCutouts() {
    const ctx = this.ctx;

    this.cutouts.forEach((c) => {
      const isSelected = this.selectedItem && this.selectedItem.item && this.selectedItem.item.id === c.id;

      if (c.shape === "circle") {
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const r = c.radius || c.w / 2;

        ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
        ctx.lineWidth = 1.5;
        const hatchGap = 10;
        for (let x = cx - r * 2; x < cx + r * 2; x += hatchGap) {
          ctx.beginPath();
          ctx.moveTo(x, cy - r);
          ctx.lineTo(x + r * 2, cy + r);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = isSelected ? "#38bdf8" : "#ef4444";
        ctx.lineWidth = isSelected ? 2.5 : 1.8;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillStyle = "#fee2e2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const areaFt = Math.round(Math.PI * (c.lengthFt / 2) ** 2);
        ctx.fillText(`${c.label || "Tank"} (⌀${c.diameterFt || c.lengthFt}ft)`, cx, cy);
      } else if (c.shape === "l_shape") {
        // L-Shape obstacle
        ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + c.w * 0.5, c.y);
        ctx.lineTo(c.x + c.w * 0.5, c.y + c.h * 0.5);
        ctx.lineTo(c.x + c.w, c.y + c.h * 0.5);
        ctx.lineTo(c.x + c.w, c.y + c.h);
        ctx.lineTo(c.x, c.y + c.h);
        ctx.closePath();
        ctx.fill();

        ctx.save();
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

        ctx.strokeStyle = isSelected ? "#38bdf8" : "#ef4444";
        ctx.lineWidth = isSelected ? 2.5 : 1.8;
        ctx.stroke();

        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillStyle = "#fee2e2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const area = Math.round(c.lengthFt * c.breadthFt * 0.75);
        ctx.fillText(`${c.label} (-${area} sq ft)`, c.x + c.w * 0.35, c.y + c.h * 0.65);
      } else {
        // Rectangle
        ctx.fillStyle = "rgba(239, 68, 68, 0.4)";
        ctx.fillRect(c.x, c.y, c.w, c.h);

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

        ctx.strokeStyle = isSelected ? "#38bdf8" : "#ef4444";
        ctx.lineWidth = isSelected ? 2.5 : 1.8;
        ctx.strokeRect(c.x, c.y, c.w, c.h);

        ctx.font = "bold 10px Inter, sans-serif";
        ctx.fillStyle = "#fee2e2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const area = Math.round(c.lengthFt * c.breadthFt);
        ctx.fillText(`${c.label} (-${area} sq ft)`, c.x + c.w / 2, c.y + c.h / 2);
      }
    });
  }

  drawPanels() {
    const ctx = this.ctx;

    this.panels.forEach((p, idx) => {
      const isSelected = this.selectedItem && this.selectedItem.item && this.selectedItem.item.id === p.id;

      ctx.fillStyle = isSelected ? "#1e3a8a" : "#0f172a";
      ctx.fillRect(p.x, p.y, p.w, p.h);

      const grad = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
      grad.addColorStop(1, "rgba(30, 58, 138, 0.05)");
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h * 0.33);
      ctx.lineTo(p.x + p.w, p.y + p.h * 0.33);
      ctx.moveTo(p.x, p.y + p.h * 0.66);
      ctx.lineTo(p.x + p.w, p.y + p.h * 0.66);
      ctx.moveTo(p.x + p.w * 0.5, p.y);
      ctx.lineTo(p.x + p.w * 0.5, p.y + p.h);
      ctx.stroke();

      ctx.strokeStyle = isSelected ? "#38bdf8" : "#94a3b8";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      ctx.font = "bold 8px Inter, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(idx + 1, p.x + p.w / 2, p.y + p.h / 2);
    });
  }

  // 8-Point Transform Handles on Selected Item
  drawSelectionGizmo() {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const it = this.selectedItem.item;
    const ctx = this.ctx;

    // Outer selection bounding box
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(it.x - 2, it.y - 2, it.w + 4, it.h + 4);
    ctx.setLineDash([]);

    // Draw handles
    const handles = this.getResizeHandles(it);
    const size = 7;

    handles.forEach((h) => {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.rect(h.x - size / 2, h.y - size / 2, size, size);
      ctx.fill();
      ctx.stroke();
    });

    // Dimension tooltip during resize
    if (this.dragMode === "resize_item") {
      ctx.font = "bold 10px Inter, sans-serif";
      ctx.fillStyle = "#38bdf8";
      ctx.textAlign = "center";
      const dimText =
        it.shape === "circle"
          ? `⌀ ${it.diameterFt || it.lengthFt} ft`
          : `${it.lengthFt} ft × ${it.breadthFt} ft`;
      ctx.fillText(dimText, it.x + it.w / 2, it.y - 8);
    }
  }

  drawInteractiveOverlays() {
    const ctx = this.ctx;

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

    if (this.drawPreview) {
      const p = this.drawPreview;
      const rx = Math.min(p.startX, p.currentX);
      const ry = Math.min(p.startY, p.currentY);
      const rw = Math.abs(p.currentX - p.startX);
      const rh = Math.abs(p.currentY - p.startY);

      if (p.shape === "circle") {
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        const r = Math.min(rw, rh) / 2;
        ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
      } else if (p.shape === "l_shape") {
        ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw * 0.5, ry);
        ctx.lineTo(rx + rw * 0.5, ry + rh * 0.5);
        ctx.lineTo(rx + rw, ry + rh * 0.5);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
      } else {
        if (p.category === "roof") {
          ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
          ctx.strokeStyle = "#22c55e";
        } else if (p.category === "cutout") {
          ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
          ctx.strokeStyle = "#ef4444";
        } else {
          ctx.fillStyle = "rgba(234, 179, 8, 0.3)";
          ctx.strokeStyle = "#eab308";
        }
        ctx.fillRect(rx, ry, rw, rh);
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rx, ry, rw, rh);
      }
      ctx.setLineDash([]);
    }
  }

  drawDimensions() {
    const ctx = this.ctx;
    ctx.font = "bold 11px Inter, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

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
// NOTE: All panels remain LATENT initially (panels = [])
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

  activeCADInstance.render();
}

