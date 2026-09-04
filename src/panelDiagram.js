import {
  PUNE_COORDINATES,
  SEASONAL_DAYS,
  getDayOfYear,
  calculateSolarPosition,
  generate2DYearlySunPathData,
  calculateObstacleShadow,
  calculateArrayShadingLoss,
  calculateDailyHourlyProfile,
} from "./sunSimulation.js";

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
// 8. North Orientation & Multi-View Astronomical Sun Path & Shadow Engine
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

    // True North Alignment (0° = North straight UP, 90° = East, 180° = South, 270° = West)
    this.northAngleDeg = options.northAngleDeg ?? 0;
    this.compassWidget = { x: 0, y: 0, radius: 28, isHovered: false };

    // Multi-View Elevation System: 'top' | 'front' | 'side'
    this.activeView = options.activeView || "top";
    this.buildingHeightFt = options.buildingHeightFt || 18; // building elevation from ground to roof slab

    // External Obstacles (Trees, Utility Poles, Buildings, Walls placed outside the roof in yard/setback)
    // Item: { id, type: 'tree'|'pole'|'building'|'wall', shape: 'circle'|'rectangle', label, lengthFt, breadthFt, diameterFt, heightFt, distanceFromRoofX, distanceFromRoofY, opacity, baseElevationFt }
    this.externalObstacles = [];

    // Astronomical Sun Path Simulation & Shadow Analysis State
    this.sunSim = {
      enabled: false,
      isPlaying: false,
      dayOfYear: options.dayOfYear || SEASONAL_DAYS.WINTER_SOLSTICE, // default winter solstice
      timeHour: options.timeHour || 10.5, // 10:30 AM
      speed: 1.0,
      latitude: options.latitude || PUNE_COORDINATES.latitude,
      longitude: options.longitude || PUNE_COORDINATES.longitude,
      animId: null,
    };
    this.yearlySunPathData = generate2DYearlySunPathData(this.sunSim.latitude, this.sunSim.longitude);

    // Interaction state
    this.dragMode = null; // 'drag_item', 'resize_item', 'draw_shape', 'pan_image', 'rotate_compass', 'drag_obstacle', 'drag_height_front', 'drag_height_side'
    this.dragItem = null;
    this.activeResizeHandle = null; // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'radius', 'height'
    this.dragStart = { x: 0, y: 0 };
    this.dragOffset = { x: 0, y: 0 };
    this.initialBounds = null; // snapshot of bounds at drag start for accurate resizing
    this.drawPreview = null;
    this.selectedItem = null; // primary { type: 'panel'|'cutout'|'pathway'|'roof'|'obstacle', item }
    this.selectedItems = []; // Array of { type, item } for multi-selection
    this.selectionMarquee = null; // { startX, startY, currentX, currentY } for rubber-band box select
    this.multiDragSnapshots = null; // snapshot during multi-item translation

    // Callbacks
    this.onStatsChange = options.onStatsChange || null;
    this.onPanelsChange = options.onPanelsChange || null;
    this.onSelectionChange = options.onSelectionChange || null;
    this.onLayersChange = options.onLayersChange || null;
    this.onSunChange = options.onSunChange || null;
    this.onViewChange = options.onViewChange || null;
    this.onNorthChange = options.onNorthChange || null;

    // Layer Stack Ordering, Visibility & Opacity (Order from back to front)
    this.layerOrder = ["image", "roof", "pathways", "cutouts", "panels"];
    this.layerOpacity = {
      image: 0.85,
      roof: 1.0,
      pathways: 1.0,
      cutouts: 1.0,
      panels: 1.0,
    };
    this.layerVisible = {
      image: true,
      roof: true,
      pathways: true,
      cutouts: true,
      panels: true,
    };
    this.roofOpacity = 1.0;

    this.initEvents();
    this.autoFitRoof();
    this.notifyChanges();
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

    if (!this.externalObstacles || this.externalObstacles.length === 0) {
      this.scalePxPerFt = Math.min(availW / Math.max(5, this.roofLengthFt), availH / Math.max(5, this.roofBreadthFt));
      this.scalePxPerFt = Math.max(4, Math.min(32, this.scalePxPerFt));

      this.roofW = this.roofLengthFt * this.scalePxPerFt;
      this.roofH = this.roofBreadthFt * this.scalePxPerFt;
      this.roofX = (logicalW - this.roofW) / 2;
      this.roofY = (logicalH - this.roofH) / 2;
    } else {
      let minXFt = 0;
      let maxXFt = this.roofLengthFt;
      let minYFt = 0;
      let maxYFt = this.roofBreadthFt;

      for (const obs of this.externalObstacles) {
        const wFt = obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.lengthFt || 10);
        const hFt = obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.breadthFt || 10);
        minXFt = Math.min(minXFt, obs.distanceFromRoofX);
        maxXFt = Math.max(maxXFt, obs.distanceFromRoofX + wFt);
        minYFt = Math.min(minYFt, obs.distanceFromRoofY);
        maxYFt = Math.max(maxYFt, obs.distanceFromRoofY + hFt);
      }

      const marginFt = 4;
      minXFt -= marginFt;
      maxXFt += marginFt;
      minYFt -= marginFt;
      maxYFt += marginFt;

      const totalWFt = Math.max(12, maxXFt - minXFt);
      const totalHFt = Math.max(12, maxYFt - minYFt);

      this.scalePxPerFt = Math.min(availW / totalWFt, availH / totalHFt);
      this.scalePxPerFt = Math.max(4, Math.min(32, this.scalePxPerFt));

      this.roofW = this.roofLengthFt * this.scalePxPerFt;
      this.roofH = this.roofBreadthFt * this.scalePxPerFt;

      const bboxPxW = totalWFt * this.scalePxPerFt;
      const bboxPxH = totalHFt * this.scalePxPerFt;
      this.roofX = (logicalW - bboxPxW) / 2 - minXFt * this.scalePxPerFt;
      this.roofY = (logicalH - bboxPxH) / 2 - minYFt * this.scalePxPerFt;
    }

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
      opacity: 1.0,
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
          opacity: 1.0,
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
            opacity: 1.0,
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
      opacity: 1.0,
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
      opacity: 1.0,
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

  // ================= EXTERNAL OBSTACLES (Trees, Poles, Buildings, Walls) =================
  addExternalObstacle(type = "tree", props = {}) {
    const id = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let defaultObstacle = {
      id,
      type,
      shape: type === "tree" || type === "pole" ? "circle" : "rectangle",
      label: type === "tree" ? "Tree" : type === "pole" ? "Utility Pole" : type === "building" ? "Neighbor" : "Boundary Wall",
      lengthFt: 10,
      breadthFt: 10,
      diameterFt: 10,
      heightFt: 20,
      distanceFromRoofX: -15,
      distanceFromRoofY: 4,
      opacity: 1.0,
      baseElevationFt: 0,
    };

    if (type === "tree") {
      defaultObstacle.diameterFt = 10;
      defaultObstacle.lengthFt = 10;
      defaultObstacle.breadthFt = 10;
      defaultObstacle.heightFt = 22;
      defaultObstacle.distanceFromRoofX = -16;
      defaultObstacle.distanceFromRoofY = 5;
    } else if (type === "pole") {
      defaultObstacle.diameterFt = 2.5;
      defaultObstacle.lengthFt = 2.5;
      defaultObstacle.breadthFt = 2.5;
      defaultObstacle.heightFt = 26;
      defaultObstacle.distanceFromRoofX = 8;
      defaultObstacle.distanceFromRoofY = -15;
    } else if (type === "building") {
      defaultObstacle.lengthFt = 24;
      defaultObstacle.breadthFt = 20;
      defaultObstacle.heightFt = 28;
      defaultObstacle.distanceFromRoofX = this.roofLengthFt + 10;
      defaultObstacle.distanceFromRoofY = 0;
    } else if (type === "wall") {
      defaultObstacle.lengthFt = this.roofLengthFt + 8;
      defaultObstacle.breadthFt = 2;
      defaultObstacle.heightFt = 7;
      defaultObstacle.distanceFromRoofX = -4;
      defaultObstacle.distanceFromRoofY = -8;
    }

    const obstacle = { ...defaultObstacle, ...props };
    this.externalObstacles.push(obstacle);
    this.autoFitRoof();
    this.selectItem("obstacle", obstacle);
    this.notifyChanges();
    this.render();
    return obstacle;
  }

  updateExternalObstacle(id, props = {}) {
    const obs = this.externalObstacles.find((o) => o.id === id);
    if (!obs) return;
    Object.assign(obs, props);
    if (obs.shape === "circle" && obs.diameterFt) {
      obs.lengthFt = obs.diameterFt;
      obs.breadthFt = obs.diameterFt;
    }
    this.notifyChanges();
    this.render();
  }

  removeExternalObstacle(id) {
    this.externalObstacles = this.externalObstacles.filter((o) => o.id !== id);
    if (this.selectedItem && this.selectedItem.item?.id === id) {
      this.selectItem(null, null);
    }
    this.autoFitRoof();
    this.notifyChanges();
    this.render();
  }

  clearAllObstacles() {
    this.externalObstacles = [];
    if (this.selectedItem && this.selectedItem.type === "obstacle") {
      this.selectItem(null, null);
    }
    this.autoFitRoof();
    this.notifyChanges();
    this.render();
  }

  getObstacleScreenBounds(obs) {
    const x = this.roofX + obs.distanceFromRoofX * this.scalePxPerFt;
    const y = this.roofY + obs.distanceFromRoofY * this.scalePxPerFt;
    const w = (obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.lengthFt || 10)) * this.scalePxPerFt;
    const h = (obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.breadthFt || 10)) * this.scalePxPerFt;
    const radius = obs.shape === "circle" ? w / 2 : undefined;
    return { x, y, w, h, radius };
  }

  // ================= TRUE NORTH ALIGNMENT =================
  setNorthAngle(deg) {
    this.northAngleDeg = ((Math.round(Number(deg)) % 360) + 360) % 360;
    this.notifyChanges();
    this.render();
  }

  rotateNorth(deltaDeg) {
    this.setNorthAngle(this.northAngleDeg + deltaDeg);
  }

  // ================= MULTI-VIEW ELEVATION SYSTEM =================
  setActiveView(view) {
    if (!["top", "front", "side"].includes(view)) return;
    this.activeView = view;
    if (this.onViewChange) {
      this.onViewChange(view);
    }
    this.render();
  }

  setBuildingHeight(heightFt) {
    this.buildingHeightFt = Math.max(5, Number(heightFt) || 18);
    this.notifyChanges();
    this.render();
  }

  // ================= ASTRONOMICAL SUN SIMULATION & SHADOW ENGINE =================
  toggleSunSimulation(enabled = null) {
    if (enabled === null) {
      this.sunSim.enabled = !this.sunSim.enabled;
    } else {
      this.sunSim.enabled = Boolean(enabled);
    }
    if (!this.sunSim.enabled && this.sunSim.isPlaying) {
      this.pauseSunAnimation();
    }
    this.notifySunChange();
    this.render();
    return this.sunSim.enabled;
  }

  setSunTime(hour) {
    this.sunSim.timeHour = Math.max(5.5, Math.min(18.5, Number(hour)));
    this.notifySunChange();
    this.render();
  }

  setSunDate(dayOfYear) {
    this.sunSim.dayOfYear = Math.max(1, Math.min(365, Number(dayOfYear)));
    this.notifySunChange();
    this.render();
  }

  playSunAnimation(speed = 1.0) {
    this.sunSim.enabled = true;
    this.sunSim.isPlaying = true;
    this.sunSim.speed = speed;

    if (this.sunSim.animId) {
      cancelAnimationFrame(this.sunSim.animId);
    }

    let lastTimestamp = performance.now();
    const animate = (timestamp) => {
      if (!this.sunSim.isPlaying) return;
      const dt = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      this.sunSim.timeHour += dt * 0.45 * this.sunSim.speed;
      if (this.sunSim.timeHour > 18.5) {
        this.sunSim.timeHour = 5.5; // Loop back
      }

      this.notifySunChange();
      this.render();
      this.sunSim.animId = requestAnimationFrame(animate);
    };

    this.sunSim.animId = requestAnimationFrame(animate);
  }

  pauseSunAnimation() {
    this.sunSim.isPlaying = false;
    if (this.sunSim.animId) {
      cancelAnimationFrame(this.sunSim.animId);
      this.sunSim.animId = null;
    }
    this.notifySunChange();
    this.render();
  }

  getSolarPosition() {
    return calculateSolarPosition(
      this.sunSim.dayOfYear,
      this.sunSim.timeHour,
      this.sunSim.latitude,
      this.sunSim.longitude
    );
  }

  getShadingLossStats() {
    const solarPos = this.getSolarPosition();
    const lossStats = calculateArrayShadingLoss(
      this.panels,
      this.externalObstacles,
      this.roofX,
      this.roofY,
      this.scalePxPerFt,
      solarPos,
      this.northAngleDeg
    );

    return {
      solarPos,
      ...lossStats,
    };
  }

  notifySunChange() {
    if (this.onSunChange) {
      this.onSunChange({
        enabled: this.sunSim.enabled,
        isPlaying: this.sunSim.isPlaying,
        timeHour: this.sunSim.timeHour,
        dayOfYear: this.sunSim.dayOfYear,
        solarPos: this.getSolarPosition(),
        stats: this.getShadingLossStats(),
      });
    }
  }

  // Selection & Properties Inspector Synchronization
  isSelected(type, item) {
    if (!item) return false;
    const itemId = item.id || (type === "roof" ? "roof_main" : type === "image" ? "roof_image" : null);
    return this.selectedItems.some(
      (s) => s.type === type && (s.item.id === itemId || s.item === item)
    );
  }

  selectItem(type, item, isMulti = false) {
    if (!type || !item) {
      this.selectedItem = null;
      this.selectedItems = [];
    } else if (isMulti) {
      const alreadyIdx = this.selectedItems.findIndex(
        (s) => s.type === type && (s.item.id === item.id || s.item === item)
      );
      if (alreadyIdx >= 0) {
        this.selectedItems.splice(alreadyIdx, 1);
        this.selectedItem = this.selectedItems.length > 0 ? this.selectedItems[this.selectedItems.length - 1] : null;
      } else {
        this.selectedItems.push({ type, item });
        this.selectedItem = { type, item };
      }
    } else {
      this.selectedItem = { type, item };
      this.selectedItems = [{ type, item }];
    }

    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem, this.selectedItems);
    }
    this.notifyLayersChange();
    this.render();
  }

  selectMultiple(items) {
    this.selectedItems = Array.isArray(items) ? [...items] : [];
    this.selectedItem = this.selectedItems.length > 0 ? this.selectedItems[0] : null;
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem, this.selectedItems);
    }
    this.notifyLayersChange();
    this.render();
  }

  selectAllPanels() {
    this.selectedItems = this.panels.map((p) => ({ type: "panel", item: p }));
    this.selectedItem = this.selectedItems[0] || null;
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem, this.selectedItems);
    }
    this.notifyLayersChange();
    this.render();
  }

  clearSelection() {
    this.selectItem(null, null);
  }

  rotateSelectedPanels(deg = 90) {
    const panelsToRotate = this.selectedItems.filter((s) => s.type === "panel").map((s) => s.item);
    if (panelsToRotate.length === 0 && this.selectedItem && this.selectedItem.type === "panel") {
      panelsToRotate.push(this.selectedItem.item);
    }
    if (panelsToRotate.length === 0) return;

    panelsToRotate.forEach((p) => {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const oldW = p.w;
      p.w = p.h;
      p.h = oldW;
      p.x = cx - p.w / 2;
      p.y = cy - p.h / 2;
    });

    this.notifyChanges();
    this.notifyLayersChange();
    this.render();
  }

  scaleSelectedItems(factor = 1.1, fromCenter = true) {
    if (!this.selectedItems || this.selectedItems.length === 0) {
      if (this.selectedItem) this.selectedItems = [this.selectedItem];
      else return;
    }

    if (fromCenter && this.selectedItems.length > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.selectedItems.forEach((s) => {
        let it = s.item;
        let b = it;
        if (s.type === "obstacle") b = this.getObstacleScreenBounds(it);
        if (b) {
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.w);
          maxY = Math.max(maxY, b.y + b.h);
        }
      });
      const collectiveCx = (minX + maxX) / 2;
      const collectiveCy = (minY + maxY) / 2;

      this.selectedItems.forEach((s) => {
        const it = s.item;
        if (!it) return;
        if (s.type === "panel") {
          const curCx = it.x + it.w / 2;
          const curCy = it.y + it.h / 2;
          const newCx = collectiveCx + (curCx - collectiveCx) * factor;
          const newCy = collectiveCy + (curCy - collectiveCy) * factor;
          it.x = newCx - it.w / 2;
          it.y = newCy - it.h / 2;
        } else if (s.type === "cutout" || s.type === "pathway") {
          const curCx = it.x + it.w / 2;
          const curCy = it.y + it.h / 2;
          const newCx = collectiveCx + (curCx - collectiveCx) * factor;
          const newCy = collectiveCy + (curCy - collectiveCy) * factor;
          it.w = Math.max(10, it.w * factor);
          it.h = Math.max(10, it.h * factor);
          if (it.radius) it.radius = Math.max(5, it.radius * factor);
          it.x = newCx - it.w / 2;
          it.y = newCy - it.h / 2;
        } else if (s.type === "obstacle") {
          it.widthFt = Math.max(1, (it.widthFt || 5) * factor);
          it.breadthFt = Math.max(1, (it.breadthFt || 5) * factor);
          it.distanceXFt = (it.distanceXFt || 0) * factor;
          it.distanceYFt = (it.distanceYFt || 0) * factor;
        }
      });
    } else {
      this.selectedItems.forEach((s) => {
        const it = s.item;
        if (!it) return;
        if (s.type === "cutout" || s.type === "pathway") {
          const cx = it.x + it.w / 2;
          const cy = it.y + it.h / 2;
          it.w = Math.max(10, it.w * factor);
          it.h = Math.max(10, it.h * factor);
          if (it.radius) it.radius = Math.max(5, it.radius * factor);
          it.x = cx - it.w / 2;
          it.y = cy - it.h / 2;
        } else if (s.type === "obstacle") {
          it.widthFt = Math.max(1, (it.widthFt || 5) * factor);
          it.breadthFt = Math.max(1, (it.breadthFt || 5) * factor);
        }
      });
    }

    this.notifyChanges();
    this.notifyLayersChange();
    this.render();
  }

  updateSelectedItem(props = {}) {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const { type, item: it } = this.selectedItem;

    if (props.label !== undefined) it.label = props.label;

    if (props.opacity !== undefined) {
      const op = Math.max(0.05, Math.min(1.0, Number(props.opacity)));
      // If multiple items selected, update opacity across all selected items
      if (this.selectedItems.length > 1) {
        this.selectedItems.forEach((s) => {
          if (s.item) s.item.opacity = op;
        });
      } else {
        it.opacity = op;
      }
      if (type === "roof") {
        this.roofOpacity = op;
        this.layerOpacity.roof = op;
      }
    }

    if (type === "roof") {
      const l = props.lengthFt !== undefined ? Math.max(5, Number(props.lengthFt)) : this.roofLengthFt;
      const b = props.breadthFt !== undefined ? Math.max(5, Number(props.breadthFt)) : this.roofBreadthFt;
      this.setRoofDimensions(l, b);
      it.lengthFt = this.roofLengthFt;
      it.breadthFt = this.roofBreadthFt;
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem, this.selectedItems);
      }
      return;
    }

    if (type === "obstacle") {
      if (props.heightFt !== undefined) it.heightFt = Math.max(1, Number(props.heightFt));
      if (props.distanceFromRoofX !== undefined) it.distanceFromRoofX = Number(props.distanceFromRoofX);
      if (props.distanceFromRoofY !== undefined) it.distanceFromRoofY = Number(props.distanceFromRoofY);
      if (it.shape === "circle" && props.diameterFt !== undefined) {
        const diaFt = Math.max(1, Number(props.diameterFt));
        it.diameterFt = diaFt;
        it.lengthFt = diaFt;
        it.breadthFt = diaFt;
      } else {
        if (props.lengthFt !== undefined) it.lengthFt = Math.max(1, Number(props.lengthFt));
        if (props.breadthFt !== undefined) it.breadthFt = Math.max(1, Number(props.breadthFt));
      }
      this.autoFitRoof();
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem, this.selectedItems);
      }
      this.notifyChanges();
      this.render();
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
      this.onSelectionChange(this.selectedItem, this.selectedItems);
    }
    this.notifyChanges();
    this.render();
  }

  removeSelectedItem() {
    if (!this.selectedItem) return;
    this.removeSelectedItems();
  }

  removeSelectedItems() {
    if (this.selectedItems.length === 0 && this.selectedItem) {
      this.selectedItems = [this.selectedItem];
    }
    if (this.selectedItems.length === 0) return;

    const panelIds = new Set(this.selectedItems.filter((s) => s.type === "panel").map((s) => s.item.id));
    const cutoutIds = new Set(this.selectedItems.filter((s) => s.type === "cutout").map((s) => s.item.id));
    const pathwayIds = new Set(this.selectedItems.filter((s) => s.type === "pathway").map((s) => s.item.id));
    const obstacleIds = new Set(this.selectedItems.filter((s) => s.type === "obstacle").map((s) => s.item.id));

    if (panelIds.size > 0) {
      this.panels = this.panels.filter((p) => !panelIds.has(p.id));
    }
    if (cutoutIds.size > 0) {
      this.cutouts = this.cutouts.filter((c) => !cutoutIds.has(c.id));
    }
    if (pathwayIds.size > 0) {
      this.pathways = this.pathways.filter((pw) => !pathwayIds.has(pw.id));
    }
    if (obstacleIds.size > 0) {
      this.externalObstacles = this.externalObstacles.filter((o) => !obstacleIds.has(o.id));
      this.autoFitRoof();
    }

    this.selectItem(null, null);
    this.notifyChanges();
    this.notifyLayersChange();
    this.render();
  }

  // ================= LAYER & COMPONENT Z-ORDER / OPACITY METHODS =================
  moveLayerUp(layerName) {
    const idx = this.layerOrder.indexOf(layerName);
    if (idx === -1 || idx === this.layerOrder.length - 1) return;
    const temp = this.layerOrder[idx];
    this.layerOrder[idx] = this.layerOrder[idx + 1];
    this.layerOrder[idx + 1] = temp;
    this.notifyLayersChange();
    this.render();
  }

  moveLayerDown(layerName) {
    const idx = this.layerOrder.indexOf(layerName);
    if (idx <= 0) return;
    const temp = this.layerOrder[idx];
    this.layerOrder[idx] = this.layerOrder[idx - 1];
    this.layerOrder[idx - 1] = temp;
    this.notifyLayersChange();
    this.render();
  }

  setLayerOpacity(layerName, opacity) {
    const op = Math.max(0.05, Math.min(1.0, Number(opacity)));
    this.layerOpacity[layerName] = op;
    if (layerName === "image") {
      this.image.opacity = op;
    } else if (layerName === "roof") {
      this.roofOpacity = op;
    }
    this.notifyLayersChange();
    this.render();
  }

  setLayerVisibility(layerName, visible) {
    this.layerVisible[layerName] = !!visible;
    this.notifyLayersChange();
    this.render();
  }

  moveSelectedItemUp() {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const { type, item } = this.selectedItem;

    if (type === "panel") {
      const idx = this.panels.findIndex((p) => p.id === item.id);
      if (idx !== -1 && idx < this.panels.length - 1) {
        const temp = this.panels[idx];
        this.panels[idx] = this.panels[idx + 1];
        this.panels[idx + 1] = temp;
      }
    } else if (type === "cutout") {
      const idx = this.cutouts.findIndex((c) => c.id === item.id);
      if (idx !== -1 && idx < this.cutouts.length - 1) {
        const temp = this.cutouts[idx];
        this.cutouts[idx] = this.cutouts[idx + 1];
        this.cutouts[idx + 1] = temp;
      }
    } else if (type === "pathway") {
      const idx = this.pathways.findIndex((pw) => pw.id === item.id);
      if (idx !== -1 && idx < this.pathways.length - 1) {
        const temp = this.pathways[idx];
        this.pathways[idx] = this.pathways[idx + 1];
        this.pathways[idx + 1] = temp;
      }
    }
    this.notifyLayersChange();
    this.render();
  }

  moveSelectedItemDown() {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const { type, item } = this.selectedItem;

    if (type === "panel") {
      const idx = this.panels.findIndex((p) => p.id === item.id);
      if (idx > 0) {
        const temp = this.panels[idx];
        this.panels[idx] = this.panels[idx - 1];
        this.panels[idx - 1] = temp;
      }
    } else if (type === "cutout") {
      const idx = this.cutouts.findIndex((c) => c.id === item.id);
      if (idx > 0) {
        const temp = this.cutouts[idx];
        this.cutouts[idx] = this.cutouts[idx - 1];
        this.cutouts[idx - 1] = temp;
      }
    } else if (type === "pathway") {
      const idx = this.pathways.findIndex((pw) => pw.id === item.id);
      if (idx > 0) {
        const temp = this.pathways[idx];
        this.pathways[idx] = this.pathways[idx - 1];
        this.pathways[idx - 1] = temp;
      }
    }
    this.notifyLayersChange();
    this.render();
  }

  bringSelectedItemToFront() {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const { type, item } = this.selectedItem;
    if (type === "panel") {
      this.panels = this.panels.filter((p) => p.id !== item.id);
      this.panels.push(item);
    } else if (type === "cutout") {
      this.cutouts = this.cutouts.filter((c) => c.id !== item.id);
      this.cutouts.push(item);
    } else if (type === "pathway") {
      this.pathways = this.pathways.filter((pw) => pw.id !== item.id);
      this.pathways.push(item);
    } else if (type === "obstacle") {
      this.externalObstacles = this.externalObstacles.filter((o) => o.id !== item.id);
      this.externalObstacles.push(item);
    }
    this.notifyLayersChange();
    this.render();
  }

  sendSelectedItemToBack() {
    if (!this.selectedItem || !this.selectedItem.item) return;
    const { type, item } = this.selectedItem;
    if (type === "panel") {
      this.panels = this.panels.filter((p) => p.id !== item.id);
      this.panels.unshift(item);
    } else if (type === "cutout") {
      this.cutouts = this.cutouts.filter((c) => c.id !== item.id);
      this.cutouts.unshift(item);
    } else if (type === "pathway") {
      this.pathways = this.pathways.filter((pw) => pw.id !== item.id);
      this.pathways.unshift(item);
    } else if (type === "obstacle") {
      this.externalObstacles = this.externalObstacles.filter((o) => o.id !== item.id);
      this.externalObstacles.unshift(item);
    }
    this.notifyLayersChange();
    this.render();
  }

  notifyLayersChange() {
    if (this.onLayersChange) {
      this.onLayersChange(this.getLayerState());
    }
  }

  getLayerState() {
    return {
      order: [...this.layerOrder],
      opacity: { ...this.layerOpacity },
      visible: { ...this.layerVisible },
      cutouts: this.cutouts.map((c) => ({ ...c })),
      pathways: this.pathways.map((pw) => ({ ...pw })),
      obstacles: this.externalObstacles.map((o) => ({ ...o })),
      panelsCount: this.panels.length,
      panels: this.panels.map((p, idx) => ({ ...p, index: idx + 1 })),
      imageLoaded: this.image.isLoaded,
      roofLengthFt: this.roofLengthFt,
      roofBreadthFt: this.roofBreadthFt,
      northAngleDeg: this.northAngleDeg,
      activeView: this.activeView,
      sunSim: { ...this.sunSim },
      selectedItem: this.selectedItem
        ? {
            type: this.selectedItem.type,
            id: this.selectedItem.item?.id,
          }
        : null,
      selectedItems: this.selectedItems.map((s) => ({
        type: s.type,
        id: s.item?.id,
      })),
    };
  }

  selectComponent(type, id) {
    if (!type) {
      this.selectItem(null, null);
      return;
    }
    if (type === "roof") {
      this.selectItem("roof", {
        id: "roof_main",
        type: "roof",
        shape: "rectangle",
        lengthFt: this.roofLengthFt,
        breadthFt: this.roofBreadthFt,
        label: "Base Roof",
        opacity: this.roofOpacity,
      });
      return;
    }
    if (type === "image") {
      this.selectItem("image", {
        id: "roof_image",
        type: "image",
        label: "Aerial Image",
        opacity: this.image.opacity,
        scale: this.image.scale,
      });
      return;
    }
    if (type === "panel") {
      const p = this.panels.find((item) => item.id === id);
      if (p) this.selectItem("panel", p);
      return;
    }
    if (type === "cutout") {
      const c = this.cutouts.find((item) => item.id === id);
      if (c) this.selectItem("cutout", c);
      return;
    }
    if (type === "pathway") {
      const pw = this.pathways.find((item) => item.id === id);
      if (pw) this.selectItem("pathway", pw);
      return;
    }
    if (type === "obstacle") {
      const obs = this.externalObstacles.find((item) => item.id === id);
      if (obs) this.selectItem("obstacle", obs);
      return;
    }
  }

  setComponentOpacity(type, id, opacity) {
    const op = Math.max(0.05, Math.min(1.0, Number(opacity)));
    if (type === "roof") {
      this.setLayerOpacity("roof", op);
      return;
    }
    if (type === "image") {
      this.setImageOpacity(op);
      return;
    }
    let target = null;
    if (type === "panel") target = this.panels.find((p) => p.id === id);
    else if (type === "cutout") target = this.cutouts.find((c) => c.id === id);
    else if (type === "pathway") target = this.pathways.find((pw) => pw.id === id);
    else if (type === "obstacle") target = this.externalObstacles.find((o) => o.id === id);

    if (target) {
      target.opacity = op;
      if (this.selectedItem && this.selectedItem.item && this.selectedItem.item.id === id) {
        this.selectedItem.item.opacity = op;
        if (this.onSelectionChange) this.onSelectionChange(this.selectedItem, this.selectedItems);
      }
      this.notifyLayersChange();
      this.render();
    }
  }

  moveComponent(type, id, direction) {
    let arr = null;
    if (type === "panel") arr = this.panels;
    else if (type === "cutout") arr = this.cutouts;
    else if (type === "pathway") arr = this.pathways;
    else if (type === "obstacle") arr = this.externalObstacles;
    if (!arr) return;

    const idx = arr.findIndex((item) => item.id === id);
    if (idx === -1) return;

    if (direction === "up" && idx < arr.length - 1) {
      const temp = arr[idx];
      arr[idx] = arr[idx + 1];
      arr[idx + 1] = temp;
    } else if (direction === "down" && idx > 0) {
      const temp = arr[idx];
      arr[idx] = arr[idx - 1];
      arr[idx - 1] = temp;
    }
    this.notifyLayersChange();
    this.render();
  }

  removeComponent(type, id) {
    if (type === "panel") {
      this.panels = this.panels.filter((p) => p.id !== id);
    } else if (type === "cutout") {
      this.cutouts = this.cutouts.filter((c) => c.id !== id);
    } else if (type === "pathway") {
      this.pathways = this.pathways.filter((pw) => pw.id !== id);
    } else if (type === "obstacle") {
      this.removeExternalObstacle(id);
      return;
    }
    this.selectedItems = this.selectedItems.filter((s) => s.item?.id !== id);
    if (this.selectedItem && this.selectedItem.item && this.selectedItem.item.id === id) {
      this.selectedItem = this.selectedItems.length > 0 ? this.selectedItems[0] : null;
    }
    if (this.onSelectionChange) {
      this.onSelectionChange(this.selectedItem, this.selectedItems);
    }
    this.notifyChanges();
    this.notifyLayersChange();
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
    this.notifyLayersChange();
    if (this.onNorthChange) {
      this.onNorthChange(this.northAngleDeg);
    }
  }

  // ================= 8-POINT RESIZE HANDLES & EVENT LOGIC =================
  getResizeHandles(item) {
    if (!item) return [];
    let { x, y, w, h } = item;
    if (this.selectedItem && this.selectedItem.type === "obstacle") {
      const b = this.getObstacleScreenBounds(item);
      x = b.x;
      y = b.y;
      w = b.w;
      h = b.h;
    }

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
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        this.removeSelectedItems();
      } else if (e.key === "r" || e.key === "R") {
        this.rotateSelectedPanels(90);
      } else if (e.key === "a" || e.key === "A") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.selectAllPanels();
        }
      } else if (e.key === "+" || e.key === "=") {
        this.scaleSelectedItems(1.1);
      } else if (e.key === "-" || e.key === "_") {
        this.scaleSelectedItems(0.9);
      } else if (e.key === "Escape") {
        this.clearSelection();
      }
    });

    window.addEventListener("resize", () => {
      this.autoFitRoof();
      this.render();
    });
  }

  handlePointerDown(x, y, e) {
    this.dragStart = { x, y };
    const logicalH = 460;
    const groundY = logicalH - 75;

    // Check Elevation Views (Front / Side)
    if (this.activeView === "front") {
      for (let i = this.externalObstacles.length - 1; i >= 0; i--) {
        const obs = this.externalObstacles[i];
        const obsX = this.roofX + obs.distanceFromRoofX * this.scalePxPerFt;
        const obsW = (obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.lengthFt || 10)) * this.scalePxPerFt;
        const obsHPx = obs.heightFt * this.scalePxPerFt;
        const topY = groundY - obsHPx;

        // Height drag handle on top
        if (Math.hypot(x - (obsX + obsW / 2), y - topY) <= 14) {
          this.selectItem("obstacle", obs);
          this.dragMode = "drag_height_front";
          this.dragItem = obs;
          return;
        }

        // Obstacle body click
        if (x >= obsX && x <= obsX + obsW && y >= topY && y <= groundY) {
          this.selectItem("obstacle", obs);
          return;
        }
      }
      this.selectItem(null, null);
      return;
    }

    if (this.activeView === "side") {
      const logicalW = this.canvas.parentElement ? Math.max(300, this.canvas.parentElement.clientWidth) : 800;
      const bldgW = this.roofBreadthFt * this.scalePxPerFt;
      const bldgX = (logicalW - bldgW) / 2;

      for (let i = this.externalObstacles.length - 1; i >= 0; i--) {
        const obs = this.externalObstacles[i];
        const obsX = bldgX + obs.distanceFromRoofY * this.scalePxPerFt;
        const obsW = (obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.breadthFt || 10)) * this.scalePxPerFt;
        const obsHPx = obs.heightFt * this.scalePxPerFt;
        const topY = groundY - obsHPx;

        // Height drag handle on top
        if (Math.hypot(x - (obsX + obsW / 2), y - topY) <= 14) {
          this.selectItem("obstacle", obs);
          this.dragMode = "drag_height_side";
          this.dragItem = obs;
          return;
        }

        // Obstacle body click
        if (x >= obsX && x <= obsX + obsW && y >= topY && y <= groundY) {
          this.selectItem("obstacle", obs);
          return;
        }
      }
      this.selectItem(null, null);
      return;
    }

    // TOP PLAN VIEW:
    // 1. Check True North Compass Dial click / rotate
    if (this.compassWidget) {
      const distToCompass = Math.hypot(x - this.compassWidget.x, y - this.compassWidget.y);
      if (distToCompass <= this.compassWidget.radius + 8) {
        this.dragMode = "rotate_compass";
        return;
      }
    }

    // 2. Check if clicked an interactive resize handle on the selected item
    const clickedHandle = this.findHandleAt(x, y);
    if (clickedHandle && this.selectedItem) {
      this.dragMode = "resize_item";
      this.activeResizeHandle = clickedHandle.handle;
      const it = this.selectedItem.item;
      if (this.selectedItem.type === "obstacle") {
        const b = this.getObstacleScreenBounds(it);
        this.initialBounds = {
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          radius: b.radius || b.w / 2,
          distanceFromRoofX: it.distanceFromRoofX,
          distanceFromRoofY: it.distanceFromRoofY,
        };
      } else {
        this.initialBounds = { x: it.x, y: it.y, w: it.w, h: it.h, radius: it.radius || it.w / 2 };
      }
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

    // 3. Check External Obstacles in Yard
    for (let i = this.externalObstacles.length - 1; i >= 0; i--) {
      const obs = this.externalObstacles[i];
      const b = this.getObstacleScreenBounds(obs);
      let inside = false;
      if (obs.shape === "circle") {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const r = b.radius || b.w / 2;
        inside = (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2;
      } else {
        inside = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      }

      if (inside) {
        if (e.shiftKey) {
          this.selectItem("obstacle", obs, true);
          return;
        }
        if (!this.isSelected("obstacle", obs)) {
          this.selectItem("obstacle", obs, false);
        }
        this.dragItem = obs;
        this.dragStartSnapshot = { x: obs.distanceFromRoofX, y: obs.distanceFromRoofY };
        this.dragOffset = { x: x - b.x, y: y - b.y };
        if (this.selectedItems.length > 1) {
          this.dragMode = "drag_multi";
          this.multiDragSnapshots = this.selectedItems.map((s) => ({
            type: s.type,
            item: s.item,
            origX: s.item.x,
            origY: s.item.y,
            origDistX: s.item.distanceFromRoofX,
            origDistY: s.item.distanceFromRoofY,
          }));
        } else {
          this.dragMode = "drag_obstacle";
        }
        return;
      }
    }

    // 4. Hit-test internal roof layers according to dynamic layerOrder
    for (let lIdx = this.layerOrder.length - 1; lIdx >= 0; lIdx--) {
      const layer = this.layerOrder[lIdx];
      if (!this.layerVisible[layer]) continue;

      if (layer === "panels") {
        for (let i = this.panels.length - 1; i >= 0; i--) {
          const p = this.panels[i];
          if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
            if (e.shiftKey) {
              this.selectItem("panel", p, true);
              return;
            }
            if (!this.isSelected("panel", p)) {
              this.selectItem("panel", p, false);
            }
            this.dragItem = p;
            this.dragStartSnapshot = { x: p.x, y: p.y };
            this.dragOffset = { x: x - p.x, y: y - p.y };
            if (this.selectedItems.length > 1) {
              this.dragMode = "drag_multi";
              this.multiDragSnapshots = this.selectedItems.map((s) => ({
                type: s.type,
                item: s.item,
                origX: s.item.x,
                origY: s.item.y,
                origDistX: s.item.distanceFromRoofX,
                origDistY: s.item.distanceFromRoofY,
              }));
            } else {
              this.dragMode = "drag_item";
            }
            return;
          }
        }
      } else if (layer === "cutouts") {
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
            if (e.shiftKey) {
              this.selectItem("cutout", c, true);
              return;
            }
            if (!this.isSelected("cutout", c)) {
              this.selectItem("cutout", c, false);
            }
            this.dragItem = c;
            this.dragStartSnapshot = { x: c.x, y: c.y };
            this.dragOffset = { x: x - c.x, y: y - c.y };
            if (this.selectedItems.length > 1) {
              this.dragMode = "drag_multi";
              this.multiDragSnapshots = this.selectedItems.map((s) => ({
                type: s.type,
                item: s.item,
                origX: s.item.x,
                origY: s.item.y,
                origDistX: s.item.distanceFromRoofX,
                origDistY: s.item.distanceFromRoofY,
              }));
            } else {
              this.dragMode = "drag_item";
            }
            return;
          }
        }
      } else if (layer === "pathways") {
        for (let i = this.pathways.length - 1; i >= 0; i--) {
          const pw = this.pathways[i];
          if (x >= pw.x && x <= pw.x + pw.w && y >= pw.y && y <= pw.y + pw.h) {
            if (e.shiftKey) {
              this.selectItem("pathway", pw, true);
              return;
            }
            if (!this.isSelected("pathway", pw)) {
              this.selectItem("pathway", pw, false);
            }
            this.dragItem = pw;
            this.dragStartSnapshot = { x: pw.x, y: pw.y };
            this.dragOffset = { x: x - pw.x, y: y - pw.y };
            if (this.selectedItems.length > 1) {
              this.dragMode = "drag_multi";
              this.multiDragSnapshots = this.selectedItems.map((s) => ({
                type: s.type,
                item: s.item,
                origX: s.item.x,
                origY: s.item.y,
                origDistX: s.item.distanceFromRoofX,
                origDistY: s.item.distanceFromRoofY,
              }));
            } else {
              this.dragMode = "drag_item";
            }
            return;
          }
        }
      } else if (layer === "roof") {
        if (x >= this.roofX && x <= this.roofX + this.roofW && y >= this.roofY && y <= this.roofY + this.roofH) {
          this.selectItem("roof", {
            id: "roof_main",
            type: "roof",
            shape: "rectangle",
            lengthFt: this.roofLengthFt,
            breadthFt: this.roofBreadthFt,
            label: "Base Roof",
            opacity: this.roofOpacity,
          });
          return;
        }
      }
    }

    // Clicked empty canvas: start rubber-band marquee selection in select/panel mode
    if (this.activeTool === "select" || this.activeTool === "panel") {
      if (!e.shiftKey) {
        this.selectItem(null, null);
      }
      this.dragMode = "marquee_select";
      this.selectionMarquee = { startX: x, startY: y, currentX: x, currentY: y };
      this.render();
      return;
    }

    this.selectItem(null, null);
  }

  handlePointerMove(x, y, e) {
    const logicalH = 460;
    const groundY = logicalH - 75;

    // Hover handle cursor detection when idle
    if (!this.dragMode) {
      if (this.activeView === "top" && this.compassWidget) {
        const distToCompass = Math.hypot(x - this.compassWidget.x, y - this.compassWidget.y);
        if (distToCompass <= this.compassWidget.radius + 8) {
          this.canvas.style.cursor = "crosshair";
          return;
        }
      }

      if (this.activeView === "front" || this.activeView === "side") {
        this.canvas.style.cursor = "default";
        return;
      }

      const hoveredHandle = this.findHandleAt(x, y);
      if (hoveredHandle) {
        this.canvas.style.cursor = hoveredHandle.cursor;
      } else if (this.activeTool === "image_pan") {
        this.canvas.style.cursor = "grab";
      } else if (this.activeTool === "select") {
        this.canvas.style.cursor = "default";
      }
    }

    if (this.dragMode === "marquee_select" && this.selectionMarquee) {
      this.selectionMarquee.currentX = x;
      this.selectionMarquee.currentY = y;
      this.render();
      return;
    }

    if (this.dragMode === "drag_multi" && this.multiDragSnapshots) {
      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;
      this.multiDragSnapshots.forEach((snap) => {
        if (snap.type === "panel" || snap.type === "cutout" || snap.type === "pathway") {
          snap.item.x = snap.origX + dx;
          snap.item.y = snap.origY + dy;
        } else if (snap.type === "obstacle") {
          snap.item.distanceFromRoofX = Number((snap.origDistX + dx / this.scalePxPerFt).toFixed(1));
          snap.item.distanceFromRoofY = Number((snap.origDistY + dy / this.scalePxPerFt).toFixed(1));
        }
      });
      this.render();
      return;
    }

    if (this.dragMode === "rotate_compass" && this.compassWidget) {
      const dx = x - this.compassWidget.x;
      const dy = y - this.compassWidget.y;
      const deg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
      this.northAngleDeg = ((deg % 360) + 360) % 360;
      this.notifyChanges();
      this.render();
      return;
    }

    if (this.dragMode === "drag_obstacle" && this.dragItem) {
      const rawX = x - this.dragOffset.x;
      const rawY = y - this.dragOffset.y;
      this.dragItem.distanceFromRoofX = Number(((rawX - this.roofX) / this.scalePxPerFt).toFixed(1));
      this.dragItem.distanceFromRoofY = Number(((rawY - this.roofY) / this.scalePxPerFt).toFixed(1));
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem);
      }
      this.render();
      return;
    }

    if ((this.dragMode === "drag_height_front" || this.dragMode === "drag_height_side") && this.dragItem) {
      const hPx = Math.max(10, groundY - y);
      const hFt = Math.max(1, Math.round(hPx / this.scalePxPerFt));
      this.dragItem.heightFt = hFt;
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem);
      }
      this.render();
      return;
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
    const isObs = this.selectedItem && this.selectedItem.type === "obstacle";
    const it = this.selectedItem.item;
    const b = this.initialBounds;
    const dx = mouseX - this.dragStart.x;
    const dy = mouseY - this.dragStart.y;
    const minDim = 15;

    if (it.shape === "circle") {
      if (this.activeResizeHandle === "radius_e") {
        const newR = Math.max(8, b.radius + dx);
        if (isObs) {
          it.diameterFt = Number(((newR * 2) / this.scalePxPerFt).toFixed(1));
          it.lengthFt = it.diameterFt;
          it.breadthFt = it.diameterFt;
        } else {
          it.radius = newR;
          it.w = newR * 2;
          it.h = newR * 2;
          it.diameterFt = (newR * 2) / this.scalePxPerFt;
          it.lengthFt = it.diameterFt;
          it.breadthFt = it.diameterFt;
        }
      } else if (this.activeResizeHandle === "radius_s") {
        const newR = Math.max(8, b.radius + dy);
        if (isObs) {
          it.diameterFt = Number(((newR * 2) / this.scalePxPerFt).toFixed(1));
          it.lengthFt = it.diameterFt;
          it.breadthFt = it.diameterFt;
        } else {
          it.radius = newR;
          it.w = newR * 2;
          it.h = newR * 2;
          it.diameterFt = (newR * 2) / this.scalePxPerFt;
          it.lengthFt = it.diameterFt;
          it.breadthFt = it.diameterFt;
        }
      }
      if (this.onSelectionChange) {
        this.onSelectionChange(this.selectedItem);
      }
      this.notifyChanges();
      return;
    }

    if (isObs) {
      let wPx = b.w;
      let hPx = b.h;
      if (this.activeResizeHandle.includes("e")) wPx = Math.max(minDim, b.w + dx);
      if (this.activeResizeHandle.includes("s")) hPx = Math.max(minDim, b.h + dy);
      if (this.activeResizeHandle.includes("w")) {
        wPx = Math.max(minDim, b.w - dx);
        it.distanceFromRoofX = Number((b.distanceFromRoofX + dx / this.scalePxPerFt).toFixed(1));
      }
      if (this.activeResizeHandle.includes("n")) {
        hPx = Math.max(minDim, b.h - dy);
        it.distanceFromRoofY = Number((b.distanceFromRoofY + dy / this.scalePxPerFt).toFixed(1));
      }
      it.lengthFt = Number((wPx / this.scalePxPerFt).toFixed(1));
      it.breadthFt = Number((hPx / this.scalePxPerFt).toFixed(1));
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

    if (this.dragMode === "marquee_select" && this.selectionMarquee) {
      const rx = Math.min(this.selectionMarquee.startX, this.selectionMarquee.currentX);
      const ry = Math.min(this.selectionMarquee.startY, this.selectionMarquee.currentY);
      const rw = Math.abs(this.selectionMarquee.currentX - this.selectionMarquee.startX);
      const rh = Math.abs(this.selectionMarquee.currentY - this.selectionMarquee.startY);

      if (rw > 5 || rh > 5) {
        const found = [];
        this.panels.forEach((p) => {
          if (!(p.x + p.w < rx || p.x > rx + rw || p.y + p.h < ry || p.y > ry + rh)) {
            found.push({ type: "panel", item: p });
          }
        });
        this.cutouts.forEach((c) => {
          if (!(c.x + c.w < rx || c.x > rx + rw || c.y + c.h < ry || c.y > ry + rh)) {
            found.push({ type: "cutout", item: c });
          }
        });
        this.externalObstacles.forEach((o) => {
          const b = this.getObstacleScreenBounds(o);
          if (!(b.x + b.w < rx || b.x > rx + rw || b.y + b.h < ry || b.y > ry + rh)) {
            found.push({ type: "obstacle", item: o });
          }
        });

        if (found.length > 0) {
          if (e.shiftKey) {
            const existingIds = new Set(this.selectedItems.map((s) => s.item?.id));
            found.forEach((f) => {
              if (!existingIds.has(f.item?.id)) this.selectedItems.push(f);
            });
            this.selectedItem = this.selectedItems[this.selectedItems.length - 1];
            this.selectMultiple(this.selectedItems);
          } else {
            this.selectMultiple(found);
          }
        }
      }
      this.selectionMarquee = null;
      this.dragMode = null;
      this.render();
      return;
    }

    if (this.dragMode === "drag_multi") {
      this.dragMode = null;
      this.dragItem = null;
      this.multiDragSnapshots = null;
      this.notifyChanges();
      this.render();
      return;
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

    if (this.activeView === "front") {
      this.renderFrontView(logicalW, logicalH);
    } else if (this.activeView === "side") {
      this.renderSideView(logicalW, logicalH);
    } else {
      this.renderTopView(logicalW, logicalH);
    }

    ctx.restore();
  }

  renderTopView(logicalW, logicalH) {
    const ctx = this.ctx;

    // Layer 1: Modern Dark Engineering Grid Background
    this.drawGrid(logicalW, logicalH);

    // If sun simulation is enabled: draw polar celestial dome underlay
    if (this.sunSim.enabled) {
      this.drawTopSunPathArc(logicalW, logicalH);
    }

    // Dynamic Layer Ordering from this.layerOrder
    for (const layer of this.layerOrder) {
      if (!this.layerVisible[layer]) continue;

      ctx.save();
      const baseAlpha = this.layerOpacity[layer] ?? 1.0;

      if (layer === "image") {
        if (this.image.isLoaded && this.image.element) {
          this.drawClippedImage(baseAlpha);
        }
      } else if (layer === "roof") {
        this.drawRoofBoundary(baseAlpha);
      } else if (layer === "pathways") {
        this.drawPathways(baseAlpha);
      } else if (layer === "cutouts") {
        this.drawCutouts(baseAlpha);
      } else if (layer === "panels") {
        this.drawPanels(baseAlpha);
      }
      ctx.restore();
    }

    // Cast Shadows on ground & roof when sun simulation is active
    let shadedPanelIds = new Set();
    if (this.sunSim.enabled) {
      const stats = this.getShadingLossStats();
      shadedPanelIds = stats.shadedPanelIds || new Set();
      this.drawCastShadows(stats.shadowPolygons, shadedPanelIds);
    }

    // External Obstacles in Yard
    this.drawExternalObstaclesTop();

    // Overlays, gizmos and annotations
    this.drawInteractiveOverlays();
    this.drawSelectionGizmo();
    this.drawDimensions();

    // True North Compass Dial
    this.drawCompass(logicalW, logicalH);
  }

  drawCompass(logicalW, logicalH) {
    const ctx = this.ctx;
    const cx = logicalW - 52;
    const cy = 52;
    const r = 26;
    this.compassWidget = { x: cx, y: cy, radius: r };

    ctx.save();
    ctx.translate(cx, cy);

    // Bezel
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Degree tick marks
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const isCard = deg % 90 === 0;
      const rInner = isCard ? r - 6 : r - 3;
      ctx.beginPath();
      ctx.moveTo(rInner * Math.sin(rad), -rInner * Math.cos(rad));
      ctx.lineTo((r - 2) * Math.sin(rad), -(r - 2) * Math.cos(rad));
      ctx.strokeStyle = isCard ? "#38bdf8" : "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = isCard ? 1.5 : 1;
      ctx.stroke();
    }

    // Needle rotated by this.northAngleDeg
    ctx.rotate((this.northAngleDeg * Math.PI) / 180);

    // North arrow (Bright Red)
    ctx.beginPath();
    ctx.moveTo(0, -r + 5);
    ctx.lineTo(5.5, 0);
    ctx.lineTo(0, -2);
    ctx.lineTo(-5.5, 0);
    ctx.closePath();
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // South arrow (Silver / Slate)
    ctx.beginPath();
    ctx.moveTo(0, r - 5);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fillStyle = "#94a3b8";
    ctx.fill();

    // Center pivot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // North 'N' letter
    ctx.font = "bold 9px Inter, sans-serif";
    ctx.fillStyle = "#f87171";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("N", 0, -r + 3);

    ctx.restore();

    // North angle text badge below compass
    ctx.font = "bold 9.5px Inter, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`North: ${this.northAngleDeg}°`, cx, cy + r + 5);
  }

  drawTopSunPathArc(logicalW, logicalH) {
    const ctx = this.ctx;
    const cx = this.roofX + this.roofW / 2;
    const cy = this.roofY + this.roofH / 2;
    const domeR = Math.max(150, Math.min(logicalW, logicalH) * 0.42);

    ctx.save();

    // 1. Concentric Altitude Rings (Horizon 0°, 30°, 60°)
    const rings = [
      { r: domeR, label: "0° Horizon" },
      { r: domeR * (2 / 3), label: "30°" },
      { r: domeR * (1 / 3), label: "60°" },
    ];

    rings.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 2. Cardinal Crosshairs aligned with True North
    const nRad = (this.northAngleDeg * Math.PI) / 180;
    const cardinals = [
      { label: "N", angle: nRad, color: "#f87171" },
      { label: "E", angle: nRad + Math.PI / 2, color: "#94a3b8" },
      { label: "S", angle: nRad + Math.PI, color: "#94a3b8" },
      { label: "W", angle: nRad + (3 * Math.PI) / 2, color: "#94a3b8" },
    ];

    cardinals.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const ex = cx + domeR * Math.sin(c.angle);
      const ey = cy - domeR * Math.cos(c.angle);
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = c.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(c.label, cx + (domeR + 10) * Math.sin(c.angle), cy - (domeR + 10) * Math.cos(c.angle));
    });

    // Helper: Map (alt, az) to Polar (x, y)
    const mapToPolar = (altDeg, azDeg) => {
      const altClamped = Math.max(0, altDeg);
      const r = domeR * (1 - altClamped / 90);
      const angleRad = ((azDeg - this.northAngleDeg) * Math.PI) / 180;
      return {
        x: cx + r * Math.sin(angleRad),
        y: cy - r * Math.cos(angleRad),
      };
    };

    // 3. 2D Seasonal Curves (Summer Solstice, Equinox, Winter Solstice)
    if (this.yearlySunPathData && this.yearlySunPathData.seasonalArcs) {
      this.yearlySunPathData.seasonalArcs.forEach((arc) => {
        if (!arc.points || arc.points.length === 0) return;
        ctx.beginPath();
        let started = false;
        arc.points.forEach((pt) => {
          if (pt.altitude <= 0) return;
          const pos = mapToPolar(pt.altitude, pt.azimuth);
          if (!started) {
            ctx.moveTo(pos.x, pos.y);
            started = true;
          } else {
            ctx.lineTo(pos.x, pos.y);
          }
        });
        ctx.strokeStyle = arc.color || "#38bdf8";
        ctx.lineWidth = arc.strokeWidth || 1.5;
        ctx.stroke();
      });

      // 4. 2D Hourly Analemma / Time Lines (6 AM to 6 PM connecting seasons)
      if (this.yearlySunPathData.hourlyGrid) {
        this.yearlySunPathData.hourlyGrid.forEach((hLine) => {
          if (!hLine.points || hLine.points.length < 2) return;
          ctx.beginPath();
          let started = false;
          hLine.points.forEach((pt) => {
            const pos = mapToPolar(pt.altitude, pt.azimuth);
            if (!started) {
              ctx.moveTo(pos.x, pos.y);
              started = true;
            } else {
              ctx.lineTo(pos.x, pos.y);
            }
          });
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }
    }

    // 5. Current Sun Position Marker
    const solarPos = this.getSolarPosition();
    if (solarPos && solarPos.isDaylight) {
      const sunCoord = mapToPolar(solarPos.altitudeDeg, solarPos.azimuthDeg);

      // Incoming Sun Ray towards roof center
      ctx.beginPath();
      ctx.moveTo(sunCoord.x, sunCoord.y);
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sun Glow & Disk
      const sunGrad = ctx.createRadialGradient(sunCoord.x, sunCoord.y, 2, sunCoord.x, sunCoord.y, 14);
      sunGrad.addColorStop(0, "rgba(253, 224, 71, 1)");
      sunGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.7)");
      sunGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunCoord.x, sunCoord.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sunCoord.x, sunCoord.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fef08a";
      ctx.fill();
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tooltip
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = "#fef08a";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`☀️ ${solarPos.altitudeDeg.toFixed(1)}° Alt | ${solarPos.azimuthDeg.toFixed(1)}° Az`, sunCoord.x, sunCoord.y - 12);
    }

    ctx.restore();
  }

  drawExternalObstaclesTop() {
    const ctx = this.ctx;

    this.externalObstacles.forEach((obs) => {
      const isSelected = this.isSelected("obstacle", obs);
      const b = this.getObstacleScreenBounds(obs);

      ctx.save();
      ctx.globalAlpha = obs.opacity ?? 1.0;

      if (obs.shape === "circle" || obs.type === "tree") {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const r = b.radius || b.w / 2;

        if (obs.type === "tree") {
          // Lush layered foliage
          const treeGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
          treeGrad.addColorStop(0, "#22c55e");
          treeGrad.addColorStop(0.7, "#15803d");
          treeGrad.addColorStop(1, "#14532d");
          ctx.fillStyle = treeGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          // Trunk center ring
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(3, r * 0.22), 0, Math.PI * 2);
          ctx.fillStyle = "#78350f";
          ctx.fill();

          ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(34, 197, 94, 0.7)";
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();
        } else {
          // Utility Pole / Round structure
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();

          // Crossarm lines
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx - r * 1.5, cy);
          ctx.lineTo(cx + r * 1.5, cy);
          ctx.moveTo(cx, cy - r * 1.5);
          ctx.lineTo(cx, cy + r * 1.5);
          ctx.stroke();

          ctx.strokeStyle = isSelected ? "#38bdf8" : "#64748b";
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label
        ctx.font = "bold 9px Inter, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${obs.label} (${obs.heightFt}ft)`, cx, cy);
      } else {
        // Rectangle: Neighbor Building or Wall
        if (obs.type === "building") {
          ctx.fillStyle = "rgba(71, 85, 105, 0.75)";
          ctx.fillRect(b.x, b.y, b.w, b.h);

          // Roof parapet outline
          ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
          ctx.lineWidth = 1;
          ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);

          ctx.strokeStyle = isSelected ? "#38bdf8" : "#94a3b8";
          ctx.lineWidth = isSelected ? 2.5 : 1.8;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        } else {
          // Boundary Wall
          ctx.fillStyle = "rgba(168, 85, 247, 0.35)";
          ctx.fillRect(b.x, b.y, b.w, b.h);
          ctx.strokeStyle = isSelected ? "#38bdf8" : "#c084fc";
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.strokeRect(b.x, b.y, b.w, b.h);
        }

        // Label
        ctx.font = "bold 9.5px Inter, sans-serif";
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${obs.label} (${obs.heightFt}ft H)`, b.x + b.w / 2, b.y + b.h / 2);
      }

      ctx.restore();
    });
  }

  drawCastShadows(shadowPolygons = [], shadedPanelIds = new Set()) {
    const ctx = this.ctx;
    ctx.save();

    // 1. Draw 3D Extruded Shadow Polygons
    shadowPolygons.forEach((sh) => {
      const poly = sh.shadowPolygon;
      if (!poly || poly.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();

      ctx.fillStyle = "rgba(10, 15, 30, 0.48)";
      ctx.fill();

      ctx.strokeStyle = "rgba(15, 23, 42, 0.75)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Shadow Length Tag
      if (sh.tipX && sh.tipY) {
        ctx.font = "bold 8.5px Inter, sans-serif";
        ctx.fillStyle = "rgba(226, 232, 240, 0.75)";
        ctx.textAlign = "center";
        ctx.fillText(`${sh.label} Shadow (${sh.shadowLengthFt.toFixed(1)}ft)`, sh.tipX, sh.tipY + 10);
      }
    });

    // 2. Highlight Panels Covered by Shadows
    this.panels.forEach((p) => {
      if (shadedPanelIds.has(p.id)) {
        ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
        ctx.fillRect(p.x, p.y, p.w, p.h);

        ctx.strokeStyle = "#f87171";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        ctx.setLineDash([]);

        ctx.font = "bold 8px Inter, sans-serif";
        ctx.fillStyle = "#fee2e2";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚠️ Shaded", p.x + p.w / 2, p.y + p.h / 2);
      }
    });

    ctx.restore();
  }

  // ================= FRONT ELEVATION VIEW =================
  renderFrontView(logicalW, logicalH) {
    const ctx = this.ctx;
    const groundY = logicalH - 75;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, "#081026");
    skyGrad.addColorStop(0.75, "#152238");
    skyGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, logicalW, groundY);

    // Ground platform
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, logicalH);
    groundGrad.addColorStop(0, "#1c2e24");
    groundGrad.addColorStop(1, "#0d1712");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, logicalW, logicalH - groundY);

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(logicalW, groundY);
    ctx.stroke();

    // 2D Elevation Sun Path Arc across the sky dome
    this.drawFrontSunPathArc(logicalW, logicalH, groundY);

    // Building Front Facade
    const bldgW = this.roofLengthFt * this.scalePxPerFt;
    const bldgH = this.buildingHeightFt * this.scalePxPerFt;
    const bldgX = (logicalW - bldgW) / 2;
    const roofTopY = groundY - bldgH;

    // Facade Body
    const facadeGrad = ctx.createLinearGradient(bldgX, roofTopY, bldgX + bldgW, groundY);
    facadeGrad.addColorStop(0, "#1e293b");
    facadeGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = facadeGrad;
    ctx.fillRect(bldgX, roofTopY, bldgW, bldgH);

    // Architectural Window Grid & Floor Slab Line
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1;
    const floors = Math.max(1, Math.round(this.buildingHeightFt / 10));
    for (let f = 1; f < floors; f++) {
      const fy = groundY - (bldgH * f) / floors;
      ctx.beginPath();
      ctx.moveTo(bldgX, fy);
      ctx.lineTo(bldgX + bldgW, fy);
      ctx.stroke();
    }

    // Windows
    ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
    const winCols = Math.max(2, Math.round(this.roofLengthFt / 8));
    const winW = (bldgW / winCols) * 0.55;
    const winH = Math.min(22, (bldgH / floors) * 0.45);
    for (let f = 0; f < floors; f++) {
      const floorBaseY = groundY - (bldgH * (f + 0.3)) / floors;
      for (let c = 0; c < winCols; c++) {
        const wx = bldgX + (c + 0.22) * (bldgW / winCols);
        ctx.fillRect(wx, floorBaseY, winW, winH);
        ctx.strokeRect(wx, floorBaseY, winW, winH);
      }
    }

    // Concrete Roof Slab
    ctx.fillStyle = "#334155";
    ctx.fillRect(bldgX - 6, roofTopY - 6, bldgW + 12, 8);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bldgX - 6, roofTopY - 6, bldgW + 12, 8);

    // Parapet Wall
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(bldgX - 6, roofTopY - 14, 8, 8);
    ctx.fillRect(bldgX + bldgW - 2, roofTopY - 14, 8, 8);

    // Solar Panels Mounted on Roof (Front Profile)
    if (this.panels.length > 0) {
      const panelCols = Math.min(this.panels.length, Math.max(2, Math.round(this.roofLengthFt / 3.8)));
      const pUnitW = (bldgW - 20) / panelCols;
      for (let i = 0; i < panelCols; i++) {
        const px = bldgX + 10 + i * pUnitW;
        const py = roofTopY - 18;

        // Racking legs
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 4, roofTopY - 6);
        ctx.lineTo(px + 4, py + 8);
        ctx.moveTo(px + pUnitW - 6, roofTopY - 6);
        ctx.lineTo(px + pUnitW - 6, py + 8);
        ctx.stroke();

        // Panel Module
        ctx.fillStyle = "#0284c7";
        ctx.fillRect(px + 2, py, pUnitW - 4, 8);
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py, pUnitW - 4, 8);
      }
    }

    // External Obstacles in Front View
    this.externalObstacles.forEach((obs) => {
      const isSelected = this.selectedItem && this.selectedItem.item?.id === obs.id;
      const obsX = bldgX + obs.distanceFromRoofX * this.scalePxPerFt;
      const obsW = (obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.lengthFt || 10)) * this.scalePxPerFt;
      const obsH = obs.heightFt * this.scalePxPerFt;
      const topY = groundY - obsH;

      ctx.save();
      if (obs.type === "tree") {
        // Trunk
        const trunkW = Math.max(5, obsW * 0.2);
        ctx.fillStyle = "#78350f";
        ctx.fillRect(obsX + (obsW - trunkW) / 2, groundY - obsH * 0.45, trunkW, obsH * 0.45);

        // Foliage Layers
        const foliageGrad = ctx.createLinearGradient(obsX, topY, obsX + obsW, groundY - obsH * 0.4);
        foliageGrad.addColorStop(0, "#22c55e");
        foliageGrad.addColorStop(1, "#14532d");
        ctx.fillStyle = foliageGrad;

        ctx.beginPath();
        ctx.arc(obsX + obsW / 2, topY + obsH * 0.35, obsW / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isSelected ? "#38bdf8" : "#166534";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      } else if (obs.type === "pole") {
        // Utility Pole
        const poleW = Math.max(3, obsW * 0.15);
        ctx.fillStyle = "#64748b";
        ctx.fillRect(obsX + (obsW - poleW) / 2, topY, poleW, obsH);

        // Crossarms
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obsX, topY + 8);
        ctx.lineTo(obsX + obsW, topY + 8);
        ctx.stroke();

        ctx.strokeStyle = isSelected ? "#38bdf8" : "#475569";
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.strokeRect(obsX + (obsW - poleW) / 2, topY, poleW, obsH);
      } else if (obs.type === "building") {
        // Neighbor Building
        ctx.fillStyle = "#334155";
        ctx.fillRect(obsX, topY, obsW, obsH);
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#64748b";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.strokeRect(obsX, topY, obsW, obsH);
      } else {
        // Boundary Wall
        ctx.fillStyle = "#7c3aed";
        ctx.fillRect(obsX, topY, obsW, obsH);
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#a855f7";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.strokeRect(obsX, topY, obsW, obsH);
      }

      // Height Drag Handle on Top
      ctx.fillStyle = isSelected ? "#38bdf8" : "#ffffff";
      ctx.beginPath();
      ctx.arc(obsX + obsW / 2, topY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Height Tag Pill
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = isSelected ? "#38bdf8" : "#f1f5f9";
      ctx.textAlign = "center";
      ctx.fillText(`${obs.label}: ${obs.heightFt} ft`, obsX + obsW / 2, topY - 10);

      ctx.restore();
    });

    // Front View Header & Telemetry
    const solarPos = this.getSolarPosition();
    const stats = this.getShadingLossStats();
    ctx.font = "bold 11.5px Inter, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText(`🏢 FRONT ELEVATION (Length: ${this.roofLengthFt} ft | Building Height: ${this.buildingHeightFt} ft)`, 16, 24);

    ctx.font = "600 10.5px Inter, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`☀️ Solar Alt: ${solarPos.altitudeDeg.toFixed(1)}° | Az: ${solarPos.azimuthDeg.toFixed(1)}° | Array Shading: ${stats.lossPercentage}%`, 16, 42);
  }

  drawFrontSunPathArc(logicalW, logicalH, groundY) {
    const ctx = this.ctx;
    const arcCx = logicalW / 2;
    const domeR = Math.min(logicalW * 0.45, 250);

    ctx.save();

    // Sky Dome Arc (Horizon to Horizon)
    ctx.beginPath();
    ctx.arc(arcCx, groundY, domeR, Math.PI, 0, false);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Horizon Labels
    ctx.font = "bold 9.5px Inter, sans-serif";
    ctx.fillStyle = "#f59e0b";
    ctx.textAlign = "left";
    ctx.fillText("🌅 EAST (Sunrise)", arcCx - domeR + 10, groundY - 6);

    ctx.fillStyle = "#f97316";
    ctx.textAlign = "right";
    ctx.fillText("🌇 WEST (Sunset)", arcCx + domeR - 10, groundY - 6);

    // 2D Yearly Solstice & Equinox Curves:
    const curves = [
      { label: "Summer Solstice (~85°)", peakAlt: 85, color: "#f59e0b", width: 2 },
      { label: "Equinox (~71.5°)", peakAlt: 71.5, color: "#38bdf8", width: 1.5 },
      { label: "Winter Solstice (~48°)", peakAlt: 48, color: "#60a5fa", width: 1.8 },
    ];

    curves.forEach((c) => {
      ctx.beginPath();
      const peakY = groundY - domeR * Math.sin((c.peakAlt * Math.PI) / 180);
      ctx.moveTo(arcCx - domeR * 0.92, groundY);
      ctx.quadraticCurveTo(arcCx, peakY, arcCx + domeR * 0.92, groundY);
      ctx.strokeStyle = c.color;
      ctx.lineWidth = c.width;
      ctx.stroke();

      ctx.font = "bold 8.5px Inter, sans-serif";
      ctx.fillStyle = c.color;
      ctx.textAlign = "center";
      ctx.fillText(c.label, arcCx, peakY - 6);
    });

    // 2D Hourly Diurnal Grid Lines connecting seasons (6 AM, 9 AM, 12 PM, 3 PM, 6 PM)
    const hours = [
      { h: 7, label: "7 AM" },
      { h: 9, label: "9 AM" },
      { h: 12, label: "12 PM" },
      { h: 15, label: "3 PM" },
      { h: 17, label: "5 PM" },
    ];

    hours.forEach((hr) => {
      const frac = (hr.h - 6) / 12;
      const theta = Math.PI - frac * Math.PI;
      const hx = arcCx + domeR * Math.cos(theta) * 0.88;
      const hy = groundY - domeR * Math.sin(theta) * 0.88;

      ctx.beginPath();
      ctx.moveTo(arcCx, groundY);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = "bold 8px Inter, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.textAlign = "center";
      ctx.fillText(hr.label, hx, hy - 4);
    });

    // Current Sun Position
    const solarPos = this.getSolarPosition();
    if (solarPos && solarPos.isDaylight) {
      const frac = Math.max(0, Math.min(1, (this.sunSim.timeHour - 6) / 12));
      const theta = Math.PI - frac * Math.PI;
      const altFrac = Math.max(0, solarPos.altitudeDeg / 90);
      const sunR = domeR * (0.2 + 0.78 * altFrac);
      const sunX = arcCx + sunR * Math.cos(theta);
      const sunY = groundY - domeR * Math.sin(altFrac * (Math.PI / 2));

      // Beam to building roof
      const bldgH = this.buildingHeightFt * this.scalePxPerFt;
      const roofTopY = groundY - bldgH;
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(arcCx, roofTopY - 8);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing Sun
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 16);
      sunGrad.addColorStop(0, "rgba(253, 224, 71, 1)");
      sunGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.7)");
      sunGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sunX, sunY, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = "#fef08a";
      ctx.fill();
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = "#fef08a";
      ctx.textAlign = "center";
      ctx.fillText(`☀️ ${solarPos.altitudeDeg.toFixed(1)}° Alt | ${solarPos.azimuthDeg.toFixed(1)}° Az`, sunX, sunY - 12);
    }

    ctx.restore();
  }

  // ================= SIDE ELEVATION VIEW =================
  renderSideView(logicalW, logicalH) {
    const ctx = this.ctx;
    const groundY = logicalH - 75;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, "#081026");
    skyGrad.addColorStop(0.75, "#152238");
    skyGrad.addColorStop(1, "#1e293b");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, logicalW, groundY);

    // Ground platform
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, logicalH);
    groundGrad.addColorStop(0, "#1c2e24");
    groundGrad.addColorStop(1, "#0d1712");
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, logicalW, logicalH - groundY);

    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(logicalW, groundY);
    ctx.stroke();

    // 2D Declination Sun Path Arc
    this.drawSideSunPathArc(logicalW, logicalH, groundY);

    // Building Side Facade
    const bldgW = this.roofBreadthFt * this.scalePxPerFt;
    const bldgH = this.buildingHeightFt * this.scalePxPerFt;
    const bldgX = (logicalW - bldgW) / 2;
    const roofTopY = groundY - bldgH;

    // Facade Body
    const facadeGrad = ctx.createLinearGradient(bldgX, roofTopY, bldgX + bldgW, groundY);
    facadeGrad.addColorStop(0, "#1e293b");
    facadeGrad.addColorStop(1, "#0f172a");
    ctx.fillStyle = facadeGrad;
    ctx.fillRect(bldgX, roofTopY, bldgW, bldgH);

    // Architectural Side Division Lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bldgX, roofTopY, bldgW, bldgH);

    // Concrete Roof Slab
    ctx.fillStyle = "#334155";
    ctx.fillRect(bldgX - 6, roofTopY - 6, bldgW + 12, 8);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bldgX - 6, roofTopY - 6, bldgW + 12, 8);

    // Solar Panels on Roof (Side Profile with 18° South-facing Tilt)
    if (this.panels.length > 0) {
      const panelRows = Math.min(4, Math.max(1, Math.round(this.roofBreadthFt / 6)));
      const rowGap = (bldgW - 20) / panelRows;

      for (let r = 0; r < panelRows; r++) {
        const rx = bldgX + 10 + r * rowGap;
        const ry = roofTopY - 6;

        // Angled solar module (tilted South towards right)
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + 6, ry - 14);
        ctx.lineTo(rx + 22, ry - 7);
        ctx.lineTo(rx + 16, ry);
        ctx.stroke();

        ctx.fillStyle = "#0284c7";
        ctx.beginPath();
        ctx.moveTo(rx + 4, ry - 14);
        ctx.lineTo(rx + 24, ry - 7);
        ctx.lineTo(rx + 23, ry - 5);
        ctx.lineTo(rx + 3, ry - 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    // External Obstacles in Side View
    this.externalObstacles.forEach((obs) => {
      const isSelected = this.selectedItem && this.selectedItem.item?.id === obs.id;
      const obsX = bldgX + obs.distanceFromRoofY * this.scalePxPerFt;
      const obsW = (obs.shape === "circle" ? (obs.diameterFt || 8) : (obs.breadthFt || 10)) * this.scalePxPerFt;
      const obsH = obs.heightFt * this.scalePxPerFt;
      const topY = groundY - obsH;

      ctx.save();
      if (obs.type === "tree") {
        const trunkW = Math.max(5, obsW * 0.2);
        ctx.fillStyle = "#78350f";
        ctx.fillRect(obsX + (obsW - trunkW) / 2, groundY - obsH * 0.45, trunkW, obsH * 0.45);

        const foliageGrad = ctx.createLinearGradient(obsX, topY, obsX + obsW, groundY - obsH * 0.4);
        foliageGrad.addColorStop(0, "#22c55e");
        foliageGrad.addColorStop(1, "#14532d");
        ctx.fillStyle = foliageGrad;

        ctx.beginPath();
        ctx.arc(obsX + obsW / 2, topY + obsH * 0.35, obsW / 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isSelected ? "#38bdf8" : "#166534";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
      } else if (obs.type === "pole") {
        const poleW = Math.max(3, obsW * 0.15);
        ctx.fillStyle = "#64748b";
        ctx.fillRect(obsX + (obsW - poleW) / 2, topY, poleW, obsH);
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#475569";
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.strokeRect(obsX + (obsW - poleW) / 2, topY, poleW, obsH);
      } else if (obs.type === "building") {
        ctx.fillStyle = "#334155";
        ctx.fillRect(obsX, topY, obsW, obsH);
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#64748b";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.strokeRect(obsX, topY, obsW, obsH);
      } else {
        ctx.fillStyle = "#7c3aed";
        ctx.fillRect(obsX, topY, obsW, obsH);
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#a855f7";
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.strokeRect(obsX, topY, obsW, obsH);
      }

      // Height Drag Handle on Top
      ctx.fillStyle = isSelected ? "#38bdf8" : "#ffffff";
      ctx.beginPath();
      ctx.arc(obsX + obsW / 2, topY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Height Tag Pill
      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = isSelected ? "#38bdf8" : "#f1f5f9";
      ctx.textAlign = "center";
      ctx.fillText(`${obs.label}: ${obs.heightFt} ft`, obsX + obsW / 2, topY - 10);

      ctx.restore();
    });

    // Side View Header & Telemetry
    const solarPos = this.getSolarPosition();
    ctx.font = "bold 11.5px Inter, sans-serif";
    ctx.fillStyle = "#f8fafc";
    ctx.textAlign = "left";
    ctx.fillText(`🏛️ SIDE ELEVATION (Breadth: ${this.roofBreadthFt} ft | Building Height: ${this.buildingHeightFt} ft)`, 16, 24);

    ctx.font = "600 10.5px Inter, sans-serif";
    ctx.fillStyle = "#38bdf8";
    ctx.fillText(`☀️ Array Tilt: South-Facing ~18° | Solar Alt: ${solarPos.altitudeDeg.toFixed(1)}° | Az: ${solarPos.azimuthDeg.toFixed(1)}°`, 16, 42);
  }

  drawSideSunPathArc(logicalW, logicalH, groundY) {
    const ctx = this.ctx;
    const bldgW = this.roofBreadthFt * this.scalePxPerFt;
    const bldgX = (logicalW - bldgW) / 2;
    const bldgH = this.buildingHeightFt * this.scalePxPerFt;
    const roofTopY = groundY - bldgH;
    const arcCx = bldgX + bldgW / 2;
    const domeR = Math.min(logicalW * 0.42, 230);

    ctx.save();

    // Side sky dome: shows North-South seasonal declination variation
    ctx.beginPath();
    ctx.arc(arcCx, groundY, domeR, Math.PI, 0, false);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // North / South indicators on ground horizon
    ctx.font = "bold 9px Inter, sans-serif";
    ctx.fillStyle = "#f87171";
    ctx.textAlign = "right";
    ctx.fillText("← NORTH", arcCx - domeR + 10, groundY - 6);

    ctx.fillStyle = "#38bdf8";
    ctx.textAlign = "left";
    ctx.fillText("SOUTH (Solar Panel Tilt) →", arcCx + 30, groundY - 6);

    // 2D Declination Arcs:
    const seasonalCurves = [
      { label: "Summer (+23.5°)", peakAlt: 85, color: "#f59e0b", tiltDir: -1 },
      { label: "Equinox (0°)", peakAlt: 71.5, color: "#38bdf8", tiltDir: 1 },
      { label: "Winter (-23.5°)", peakAlt: 48, color: "#60a5fa", tiltDir: 1 },
    ];

    seasonalCurves.forEach((sc) => {
      ctx.beginPath();
      const peakRad = (sc.peakAlt * Math.PI) / 180;
      const peakY = groundY - domeR * Math.sin(peakRad);
      const peakX = arcCx + sc.tiltDir * domeR * Math.cos(peakRad) * 0.5;

      ctx.moveTo(arcCx - domeR * 0.85, groundY);
      ctx.quadraticCurveTo(peakX, peakY, arcCx + domeR * 0.85, groundY);
      ctx.strokeStyle = sc.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Current Sun marker in Side View
    const solarPos = this.getSolarPosition();
    if (solarPos && solarPos.isDaylight) {
      const altRad = (solarPos.altitudeDeg * Math.PI) / 180;
      const azRad = (solarPos.azimuthDeg * Math.PI) / 180;
      const nsComponent = -Math.cos(azRad);
      const sunX = arcCx + nsComponent * (domeR * Math.cos(altRad) * 0.8);
      const sunY = groundY - domeR * Math.sin(altRad);

      // Sun ray pointing to roof
      ctx.beginPath();
      ctx.moveTo(sunX, sunY);
      ctx.lineTo(arcCx, roofTopY - 10);
      ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glowing Sun Disk
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 15);
      sunGrad.addColorStop(0, "rgba(253, 224, 71, 1)");
      sunGrad.addColorStop(0.5, "rgba(245, 158, 11, 0.6)");
      sunGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(sunX, sunY, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#fef08a";
      ctx.fill();
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = "bold 9px Inter, sans-serif";
      ctx.fillStyle = "#fef08a";
      ctx.textAlign = "center";
      ctx.fillText(`☀️ Alt ${solarPos.altitudeDeg.toFixed(1)}°`, sunX, sunY - 12);
    }

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

  drawClippedImage(layerAlpha = 1.0) {
    const ctx = this.ctx;
    ctx.save();

    ctx.beginPath();
    ctx.rect(this.roofX, this.roofY, this.roofW, this.roofH);
    ctx.clip();

    ctx.globalAlpha = layerAlpha * (this.image.opacity ?? 0.85);

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

  drawRoofBoundary(layerAlpha = 1.0) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = layerAlpha * (this.roofOpacity ?? 1.0);

    ctx.fillStyle = this.image.isLoaded ? "rgba(99, 146, 62, 0.25)" : "rgba(34, 197, 94, 0.22)";
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

    ctx.restore();
  }

  drawPathways(layerAlpha = 1.0) {
    const ctx = this.ctx;
    this.pathways.forEach((pw) => {
      const isSelected = this.isSelected("pathway", pw);
      const alpha = layerAlpha * (pw.opacity ?? 1.0);

      ctx.save();
      ctx.globalAlpha = alpha;

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

      ctx.restore();
    });
  }

  drawCutouts(layerAlpha = 1.0) {
    const ctx = this.ctx;

    this.cutouts.forEach((c) => {
      const isSelected = this.isSelected("cutout", c);
      const alpha = layerAlpha * (c.opacity ?? 1.0);

      ctx.save();
      ctx.globalAlpha = alpha;

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

      ctx.restore();
    });
  }

  drawPanels(layerAlpha = 1.0) {
    const ctx = this.ctx;

    this.panels.forEach((p, idx) => {
      const isSelected = this.isSelected("panel", p);
      const alpha = layerAlpha * (p.opacity ?? 1.0);

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.fillStyle = isSelected ? "#1e3a8a" : "#0f172a";
      ctx.fillRect(p.x, p.y, p.w, p.h);

      const grad = ctx.createLinearGradient(p.x, p.y, p.x + p.w, p.y + p.h);
      grad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
      grad.addColorStop(1, "rgba(30, 58, 138, 0.08)");
      ctx.fillStyle = grad;
      ctx.fillRect(p.x, p.y, p.w, p.h);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h * 0.33);
      ctx.lineTo(p.x + p.w, p.y + p.h * 0.33);
      ctx.moveTo(p.x, p.y + p.h * 0.66);
      ctx.lineTo(p.x + p.w, p.y + p.h * 0.66);
      ctx.moveTo(p.x, p.y + p.w * 0.5);
      ctx.lineTo(p.x + p.w * 0.5, p.y + p.h);
      ctx.stroke();

      ctx.strokeStyle = isSelected ? "#38bdf8" : "#94a3b8";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(p.x, p.y, p.w, p.h);

      ctx.font = "bold 8px Inter, sans-serif";
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(idx + 1, p.x + p.w / 2, p.y + p.h / 2);

      ctx.restore();
    });
  }

  // 8-Point Transform Handles on Selected Item / Multi-Select Box
  drawSelectionGizmo() {
    const ctx = this.ctx;

    // Multi-selection collective bounding box
    if (this.selectedItems && this.selectedItems.length > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.selectedItems.forEach((s) => {
        let it = s.item;
        let bounds = it;
        if (s.type === "obstacle") bounds = this.getObstacleScreenBounds(it);
        if (bounds) {
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.w);
          maxY = Math.max(maxY, bounds.y + bounds.h);
        }
      });

      if (minX < maxX && minY < maxY) {
        ctx.save();
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(minX - 4, minY - 4, (maxX - minX) + 8, (maxY - minY) + 8);
        ctx.setLineDash([]);

        const pillText = `${this.selectedItems.length} Items Selected`;
        ctx.font = "bold 10px Inter, sans-serif";
        const textW = ctx.measureText ? ctx.measureText(pillText).width : 90;
        const pillX = (minX + maxX) / 2 - (textW + 16) / 2;
        const pillY = minY - 24;

        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, textW + 16, 18, 4);
        } else {
          ctx.rect(pillX, pillY, textW + 16, 18);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pillText, (minX + maxX) / 2, pillY + 9);
        ctx.restore();
      }
      return;
    }

    // Single item transform gizmo
    if (!this.selectedItem || !this.selectedItem.item) return;
    const it = this.selectedItem.item;

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

    // Rubber-band marquee selection box
    if (this.selectionMarquee) {
      const rx = Math.min(this.selectionMarquee.startX, this.selectionMarquee.currentX);
      const ry = Math.min(this.selectionMarquee.startY, this.selectionMarquee.currentY);
      const rw = Math.abs(this.selectionMarquee.currentX - this.selectionMarquee.startX);
      const rh = Math.abs(this.selectionMarquee.currentY - this.selectionMarquee.startY);

      ctx.save();
      ctx.fillStyle = "rgba(56, 189, 248, 0.15)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.restore();
    }

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

